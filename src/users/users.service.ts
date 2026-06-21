import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  assignStaffServiceAcrossStudios,
  getStaffServiceIdsUnion,
  removeStaffServiceAcrossStudios,
} from '../common/staff-service-offering';
import { assertAdminCannotEditMaster } from '../common/admin-access';
import { assertCanChangeStaffPhone } from '../common/staff-login-access';
import { normalizeStaffPhone } from '../common/staff-phone.util';
import {
  assertMasterCanOnlyViewSelf,
  assertMasterCannotEditStaff,
  buildStaffProfilePermissions,
} from '../common/master-access';
import { mapStaffServiceRow } from '../common/staff-service-timing.util';
import { assertUserStudioAccessForResource } from '../common/studio-access.util';
import { generateId, IdPrefix } from '../common/id-generator';
import { CreateStaffDto } from './dto/create-staff.dto';
import { CreateOrganizationOwnerDto } from './dto/create-organization-owner.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { UpdateStaffPhoneDto } from './dto/update-staff-phone.dto';
import { UpdateStaffProfileDto } from './dto/update-staff-profile.dto';
import { CreateServiceOverrideDto } from './dto/create-service-override.dto';
import { UpdateServiceOverrideDto } from './dto/update-service-override.dto';
import {
  UserRole,
  isDeveloperRole,
  isOwnerLevelRole,
  canManageOwners,
  canManageDeputies,
  NETWORK_STAFF_ROLES,
} from '../common/decorators/roles.decorator';
import { assertStaffWorksAtStudio } from '../common/staff-studio-membership';
import { StaffProfileQueryDto } from './dto/staff-profile-query.dto';
import {
  StaffProfileAppointmentStats,
  buildAppointmentStatsFromRows,
  collectStaffWorkStudioIds,
  resolveStaffProfileStatsPeriod,
  timezoneFromStudio,
} from './staff-profile-appointment-stats.util';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /** Доступ к карточке филиального сотрудника: основной филиал или запись в user_studio_memberships. */
  private async assertActorCanAccessStaff(
    staff: { id: string; studioId: string | null },
    actorRole: string,
    actorStudioId: string | undefined,
    actorUserId?: string,
  ): Promise<void> {
    assertMasterCanOnlyViewSelf(actorRole, staff.id, actorUserId);
    if (isOwnerLevelRole(actorRole)) return;
    const sid = (actorStudioId ?? '').trim();
    if (sid && staff.studioId === sid) return;
    if (sid) {
      const m = await this.prisma.userStudioMembership.findUnique({
        where: {
          userId_studioId: { userId: staff.id, studioId: sid },
        },
      });
      if (m) return;
    }
    throw new ForbiddenException('Access denied to this staff member');
  }

  private async validateStudioIdsBelongToOrganization(
    studioIds: string[],
    organizationId: string,
  ): Promise<string[]> {
    const unique = [...new Set(studioIds.map((s) => s.trim()).filter(Boolean))];
    if (unique.length === 0) {
      throw new BadRequestException('At least one studio id is required');
    }
    const studios = await this.prisma.studio.findMany({
      where: { id: { in: unique }, organizationId },
      select: { id: true },
    });
    if (studios.length !== unique.length) {
      throw new BadRequestException(
        'One or more studios not found or not in this organization',
      );
    }
    return unique;
  }

  private async resolveStaffPhoneForUpdate(
    targetUserId: string,
    current: { phone: string | null; email: string | null },
    rawPhone: string,
    actorRole: string,
  ): Promise<string | null> {
    assertCanChangeStaffPhone(actorRole);
    const normalized = normalizeStaffPhone(rawPhone);
    if (!normalized) {
      throw new BadRequestException('Укажите корректный номер телефона');
    }
    if (!current.email && normalized === current.phone) {
      return normalized;
    }
    if (normalized === current.phone) {
      return normalized;
    }
    if (!current.email && !normalized) {
      throw new BadRequestException(
        'Нельзя убрать телефон: у сотрудника не указан email для входа',
      );
    }
    const existingPhone = await this.prisma.user.findUnique({
      where: { phone: normalized },
    });
    if (existingPhone && existingPhone.id !== targetUserId) {
      throw new BadRequestException('Этот номер уже используется другим пользователем');
    }
    return normalized;
  }

  /**
   * Пользователи организации без привязки к филиалу (административный персонал сети).
   * Не включает DEVELOPER (платформа) и роли филиала (ADMIN/MASTER с studioId).
   */
  async findNetworkStaff(
    studioId: string,
    userRole: string,
    userStudioId?: string,
    userOrganizationId?: string,
    includeDismissed = false,
    userId?: string,
  ) {
    if (!isOwnerLevelRole(userRole)) {
      await assertUserStudioAccessForResource(this.prisma, {
        userRole,
        userId,
        userStudioId,
        userOrganizationId,
        studioId,
      });
    }

    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
      select: { organizationId: true },
    });
    if (!studio) {
      throw new NotFoundException(`Studio with ID ${studioId} not found`);
    }

    const users = await this.prisma.user.findMany({
      where: {
        organizationId: studio.organizationId,
        studioId: null,
        ...(includeDismissed ? {} : { isActive: true }),
        role: { in: NETWORK_STAFF_ROLES },
      },
      include: {
        staffProfile: true,
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    if (!isOwnerLevelRole(userRole)) {
      return users.map(({ password, ...user }) => user);
    }

    return users;
  }

  async findAll(
    studioId: string,
    userRole: string,
    userStudioId?: string,
    userOrganizationId?: string,
    includeNetwork = false,
    includeDismissed = false,
    userStaffId?: string,
  ) {
    // Check access:
    // - owner-level: any studio
    // - manager: any studio in own organization
    // - others: only own studio
    if (!isOwnerLevelRole(userRole)) {
      await assertUserStudioAccessForResource(this.prisma, {
        userRole,
        userId: userStaffId,
        userStudioId,
        userOrganizationId,
        studioId,
      });
    }

    const branchStaffWhere = {
      ...(includeDismissed ? {} : { isActive: true }),
      role: {
        in: [UserRole.ADMIN, UserRole.MANAGER, UserRole.MASTER],
      },
      OR: [
        { studioId },
        { studioMemberships: { some: { studioId } } },
      ],
    };

    const users = await this.prisma.user.findMany({
      where: branchStaffWhere,
      include: {
        staffProfile: true,
        studioMemberships: {
          include: {
            studio: { select: { id: true, name: true } },
          },
        },
        staffServices: {
          include: {
            service: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }).catch((error) => {
      // Если таблица staff_services еще не создана, возвращаем без staffServices
      if (error.message?.includes('staff_services') || error.message?.includes('does not exist')) {
        return this.prisma.user.findMany({
          where: branchStaffWhere,
          include: {
            staffProfile: true,
            studioMemberships: {
              include: {
                studio: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });
      }
      throw error;
    });

    let mergedUsers = users;
    if (includeNetwork) {
      const studio = await this.prisma.studio.findUnique({
        where: { id: studioId },
        select: { organizationId: true },
      });
      if (!studio) {
        throw new NotFoundException(`Studio with ID ${studioId} not found`);
      }

      const networkUsers = await this.prisma.user.findMany({
        where: {
          organizationId: studio.organizationId,
          studioId: null,
          ...(includeDismissed ? {} : { isActive: true }),
          role: { in: NETWORK_STAFF_ROLES },
        },
        include: {
          staffProfile: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      const dedup = new Map<string, (typeof users)[number]>();
      for (const u of users) dedup.set(u.id, u);
      for (const u of networkUsers) dedup.set(u.id, u as (typeof users)[number]);
      mergedUsers = Array.from(dedup.values());
    }

    if (userRole === UserRole.MASTER && userStaffId) {
      mergedUsers = mergedUsers.filter((u) => u.id === userStaffId);
    }

    // Remove password from response if user is not OWNER or DEPUTY_OWNER
    if (!isOwnerLevelRole(userRole)) {
      return mergedUsers.map(({ password, ...user }) => user);
    }

    return mergedUsers;
  }

  async create(
    studioId: string,
    createStaffDto: CreateStaffDto,
    userRole: string,
    userStudioId?: string,
  ) {
    // Check access
    if (!isOwnerLevelRole(userRole) && userStudioId !== studioId) {
      throw new ForbiddenException('Access denied to this studio');
    }

    // Verify studio exists
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
    });
    if (!studio) {
      throw new NotFoundException(`Studio with ID ${studioId} not found`);
    }

    // Validate role - only OWNER can create OWNER or DEPUTY_OWNER
    if (createStaffDto.role === UserRole.OWNER && !canManageOwners(userRole)) {
      throw new BadRequestException('Cannot create OWNER role via this endpoint');
    }
    if (createStaffDto.role === UserRole.DEPUTY_OWNER && !canManageDeputies(userRole)) {
      throw new BadRequestException('Cannot create DEPUTY_OWNER role via this endpoint');
    }
    if (createStaffDto.role === UserRole.DEVELOPER && userRole !== UserRole.DEVELOPER) {
      throw new BadRequestException('Only DEVELOPER can assign DEVELOPER role');
    }

    // Check email/phone uniqueness
    if (createStaffDto.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: createStaffDto.email },
      });
      if (existingEmail) {
        throw new BadRequestException('Email already exists');
      }
    }

    if (createStaffDto.phone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone: createStaffDto.phone },
      });
      if (existingPhone) {
        throw new BadRequestException('Phone already exists');
      }
    }

    const passwordHash = await bcrypt.hash(createStaffDto.password, 10);

    const studioRow = await this.prisma.studio.findUnique({
      where: { id: studioId },
      select: { organizationId: true },
    });
    if (!studioRow) {
      throw new NotFoundException('Studio not found');
    }

    /** Роли уровня сети: без привязки к филиалу (см. GET .../staff/network). */
    const assignStudioId = NETWORK_STAFF_ROLES.includes(createStaffDto.role)
      ? null
      : studioId;

    let primaryStudioId: string | null = assignStudioId;
    let membershipStudioIds: string[] = [];
    if (assignStudioId !== null) {
      if (createStaffDto.studioIds?.length) {
        const ids = await this.validateStudioIdsBelongToOrganization(
          createStaffDto.studioIds,
          studioRow.organizationId,
        );
        if (!ids.includes(studioId)) {
          throw new BadRequestException(
            'studioIds must include the studio id from the request path',
          );
        }
        membershipStudioIds = ids;
        primaryStudioId = ids[0]!;
      } else {
        membershipStudioIds = [studioId];
        primaryStudioId = studioId;
      }
    }

    const createdUser = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          id: generateId(IdPrefix.User),
          email: createStaffDto.email,
          phone: createStaffDto.phone,
          passwordHash,
          password: createStaffDto.password, // Store plain password for OWNER/DEPUTY_OWNER visibility
          role: createStaffDto.role,
          organizationId: studioRow.organizationId,
          studioId: primaryStudioId,
          staffProfile: {
            create: {
              firstName: createStaffDto.firstName,
              lastName: createStaffDto.lastName,
              title: createStaffDto.title,
              category: createStaffDto.category,
              providesServices: createStaffDto.providesServices ?? true,
              avatar: createStaffDto.avatar,
              bio: createStaffDto.bio,
              portfolioPhotos: createStaffDto.portfolioPhotos || [],
              rank: createStaffDto.rank,
            },
          },
        },
        include: {
          staffProfile: true,
        },
      });

      if (membershipStudioIds.length > 0) {
        await tx.userStudioMembership.createMany({
          data: membershipStudioIds.map((sid) => ({
            id: generateId(IdPrefix.UserStudioMembership),
            userId: u.id,
            studioId: sid,
          })),
        });
      }

      return tx.user.findUnique({
        where: { id: u.id },
        include: {
          staffProfile: true,
          studioMemberships: {
            include: {
              studio: { select: { id: true, name: true } },
            },
          },
        },
      });
    });

    if (!createdUser) {
      throw new NotFoundException('Failed to create staff member');
    }

    // Remove password from response if user is not OWNER or DEPUTY_OWNER
    if (!isOwnerLevelRole(userRole)) {
      const { password, ...userWithoutPassword } = createdUser;
      return userWithoutPassword;
    }

    return createdUser;
  }

  /**
   * Создать OWNER организации без филиала (studioId = null).
   * Используется при онбординге новой организации (DEVELOPER).
   */
  async createOrganizationOwner(
    organizationId: string,
    dto: CreateOrganizationOwnerDto,
    actorRole: string,
  ) {
    if (!canManageOwners(actorRole)) {
      throw new ForbiddenException('Cannot create organization owner with this role');
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) {
      throw new NotFoundException(`Organization with ID ${organizationId} not found`);
    }

    if (dto.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existingEmail) {
        throw new BadRequestException('Email already exists');
      }
    }

    const existingPhone = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });
    if (existingPhone) {
      throw new BadRequestException('Phone already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const createdUser = await this.prisma.user.create({
      data: {
        id: generateId(IdPrefix.User),
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        password: dto.password,
        role: UserRole.OWNER,
        organizationId,
        studioId: null,
        staffProfile: {
          create: {
            firstName: dto.firstName,
            lastName: dto.lastName,
            providesServices: false,
            portfolioPhotos: [],
          },
        },
      },
      include: {
        staffProfile: true,
      },
    });

    if (!isOwnerLevelRole(actorRole)) {
      const { password, ...userWithoutPassword } = createdUser;
      return userWithoutPassword;
    }

    return createdUser;
  }

  async updateStaffPhone(
    userId: string,
    dto: UpdateStaffPhoneDto,
    userRole: string,
    userStudioId?: string,
    actorUserId?: string,
  ) {
    assertCanChangeStaffPhone(userRole);
    assertMasterCannotEditStaff(userRole);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { staffProfile: true },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    await this.assertActorCanAccessStaff(user, userRole, userStudioId, actorUserId);
    assertAdminCannotEditMaster(userRole, user.role);

    const phone = await this.resolveStaffPhoneForUpdate(userId, user, dto.phone, userRole);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { phone },
      include: { staffProfile: true },
    });

    if (!isOwnerLevelRole(userRole)) {
      const { password, ...rest } = updated;
      return rest;
    }
    return updated;
  }

  async update(
    userId: string,
    updateStaffDto: UpdateStaffDto,
    userRole: string,
    userStudioId?: string,
    actorUserId?: string,
  ) {
    assertMasterCannotEditStaff(userRole);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    await this.assertActorCanAccessStaff(user, userRole, userStudioId, actorUserId);
    assertAdminCannotEditMaster(userRole, user.role);

    // Cannot change to OWNER role (only OWNER can do this, and only via special endpoint)
    if (updateStaffDto.role === UserRole.OWNER && !canManageOwners(userRole)) {
      throw new BadRequestException('Cannot change role to OWNER');
    }
    // Cannot change to DEPUTY_OWNER role (only OWNER can do this)
    if (updateStaffDto.role === UserRole.DEPUTY_OWNER && !canManageDeputies(userRole)) {
      throw new BadRequestException('Cannot change role to DEPUTY_OWNER');
    }
    if (updateStaffDto.role === UserRole.DEVELOPER && userRole !== UserRole.DEVELOPER) {
      throw new BadRequestException('Only DEVELOPER can assign DEVELOPER role');
    }

    if (updateStaffDto.phone !== undefined) {
      assertCanChangeStaffPhone(userRole);
    }

    // Check email uniqueness
    if (updateStaffDto.email && updateStaffDto.email !== user.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: updateStaffDto.email },
      });
      if (existingEmail) {
        throw new BadRequestException('Email already exists');
      }
    }

    let resolvedPhone: string | null | undefined;
    if (updateStaffDto.phone !== undefined) {
      resolvedPhone = await this.resolveStaffPhoneForUpdate(
        userId,
        user,
        updateStaffDto.phone,
        userRole,
      );
    }

    const updateData: any = {
      email: updateStaffDto.email,
      role: updateStaffDto.role,
      isActive: updateStaffDto.isActive,
    };
    if (resolvedPhone !== undefined) {
      updateData.phone = resolvedPhone;
    }

    if (updateStaffDto.password) {
      updateData.passwordHash = await bcrypt.hash(updateStaffDto.password, 10);
      updateData.password = updateStaffDto.password; // Store plain password for OWNER/DEPUTY_OWNER visibility
    }

    const hasProfileUpdate =
      updateStaffDto.firstName !== undefined ||
      updateStaffDto.lastName !== undefined ||
      updateStaffDto.title !== undefined ||
      updateStaffDto.category !== undefined ||
      updateStaffDto.providesServices !== undefined ||
      updateStaffDto.avatar !== undefined ||
      updateStaffDto.bio !== undefined ||
      updateStaffDto.portfolioPhotos !== undefined ||
      updateStaffDto.rank !== undefined;

    let membershipStudioIds: string[] | undefined;
    if (updateStaffDto.studioIds !== undefined) {
      const roleAfterUpdate = (updateStaffDto.role ?? user.role) as UserRole;
      if (!NETWORK_STAFF_ROLES.includes(roleAfterUpdate)) {
        if (user.studioId === null) {
          throw new BadRequestException(
            'studioIds can only be set for staff assigned to a branch',
          );
        }
        membershipStudioIds = await this.validateStudioIdsBelongToOrganization(
          updateStaffDto.studioIds,
          user.organizationId,
        );
        updateData.studioId = membershipStudioIds[0]!;
      }
      // Для MARKETER / MANAGER / OWNER и др. studioIds из формы игнорируем
    }

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      if (membershipStudioIds) {
        await tx.userStudioMembership.deleteMany({ where: { userId } });
        await tx.userStudioMembership.createMany({
          data: membershipStudioIds.map((sid) => ({
            id: generateId(IdPrefix.UserStudioMembership),
            userId,
            studioId: sid,
          })),
        });
      }
      return tx.user.update({
        where: { id: userId },
        data: {
          ...updateData,
          staffProfile: hasProfileUpdate
            ? {
                update: {
                  firstName: updateStaffDto.firstName,
                  lastName: updateStaffDto.lastName,
                  title: updateStaffDto.title,
                  category: updateStaffDto.category,
                  providesServices: updateStaffDto.providesServices,
                  avatar: updateStaffDto.avatar,
                  bio: updateStaffDto.bio,
                  portfolioPhotos: updateStaffDto.portfolioPhotos,
                  rank: updateStaffDto.rank,
                },
              }
            : undefined,
        },
        include: {
          staffProfile: true,
          studioMemberships: {
            include: {
              studio: { select: { id: true, name: true } },
            },
          },
        },
      });
    });

    // Remove password from response if user is not OWNER or DEPUTY_OWNER
    if (!isOwnerLevelRole(userRole)) {
      const { password, ...userWithoutPassword } = updatedUser;
      return userWithoutPassword;
    }

    return updatedUser;
  }

  async addService(
    staffUserId: string,
    serviceId: string,
    userRole: string,
    userStudioId?: string,
    actorUserId?: string,
  ) {
    assertMasterCannotEditStaff(userRole);
    // Get staff user
    const staff = await this.prisma.user.findUnique({
      where: { id: staffUserId },
      include: { studio: true },
    });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${staffUserId} not found`);
    }

    await this.assertActorCanAccessStaff(staff, userRole, userStudioId, actorUserId);
    assertAdminCannotEditMaster(userRole, staff.role);

    if (!staff.studioId) {
      throw new BadRequestException('Staff has no branch');
    }

    const staffBranch = await this.prisma.studio.findUnique({
      where: { id: staff.studioId },
      select: { organizationId: true },
    });
    if (!staffBranch) {
      throw new BadRequestException('Staff has no branch');
    }

    const unionIds = await getStaffServiceIdsUnion(this.prisma, staffUserId);
    if (unionIds.includes(serviceId)) {
      throw new BadRequestException('Service is already assigned to this staff member');
    }

    const createdCount = await assignStaffServiceAcrossStudios(
      this.prisma,
      staffUserId,
      serviceId,
      staffBranch.organizationId,
    );
    if (createdCount === 0) {
      throw new BadRequestException(
        'Услуга недоступна ни в одном филиале, где работает этот сотрудник',
      );
    }

    const row = await this.prisma.staffService.findFirst({
      where: { staffUserId, serviceId },
      include: { service: true },
    });
    return row!;
  }

  async removeService(
    staffUserId: string,
    serviceId: string,
    userRole: string,
    userStudioId?: string,
    actorUserId?: string,
  ) {
    assertMasterCannotEditStaff(userRole);
    // Get staff user
    const staff = await this.prisma.user.findUnique({
      where: { id: staffUserId },
    });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${staffUserId} not found`);
    }

    await this.assertActorCanAccessStaff(staff, userRole, userStudioId, actorUserId);
    assertAdminCannotEditMaster(userRole, staff.role);

    const removed = await removeStaffServiceAcrossStudios(
      this.prisma,
      staffUserId,
      serviceId,
    );
    if (removed === 0) {
      throw new NotFoundException('Service is not assigned to this staff member');
    }

    return { removedCount: removed };
  }

  async getStaffServices(
    staffUserId: string,
    userRole: string,
    userStudioId?: string,
    actorUserId?: string,
  ) {
    // Get staff user
    const staff = await this.prisma.user.findUnique({
      where: { id: staffUserId },
    });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${staffUserId} not found`);
    }

    await this.assertActorCanAccessStaff(staff, userRole, userStudioId, actorUserId);

    const staffServices = await this.prisma.staffService.findMany({
      where: {
        staffUserId,
      },
      include: {
        service: true,
      },
      orderBy: {
        service: {
          name: 'asc',
        },
      },
    });

    // Get all overrides for this staff member
    const overrides = await this.prisma.staffServiceOverride.findMany({
      where: {
        staffUserId,
      },
    });

    // Map overrides by serviceId for quick lookup
    const overrideMap = new Map(
      overrides.map((o) => [o.serviceId, o]),
    );

    const seen = new Set<string>();
    return staffServices
      .filter((ss) => {
        if (seen.has(ss.serviceId)) {
          return false;
        }
        seen.add(ss.serviceId);
        return true;
      })
      .map((ss) =>
        mapStaffServiceRow({
          ...ss,
          override: overrideMap.get(ss.serviceId) || null,
        }),
      );
  }

  async getStaffProfile(
    userId: string,
    userRole: string,
    userStudioId?: string,
    actorUserId?: string,
    query?: StaffProfileQueryDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        staffProfile: true,
        studio: { select: { id: true, name: true } },
        studioMemberships: {
          include: {
            studio: { select: { id: true, name: true } },
          },
        },
        staffServices: {
          include: {
            service: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    await this.assertActorCanAccessStaff(user, userRole, userStudioId, actorUserId);

    // Get all overrides for this staff member
    const overrides = await this.prisma.staffServiceOverride.findMany({
      where: {
        staffUserId: userId,
      },
    });

    // Map overrides by serviceId for quick lookup
    const overrideMap = new Map(
      overrides.map((o) => [o.serviceId, o]),
    );

    // Одна запись на услугу (привязка синхронизирована по филиалам)
    const servicesWithOverrides: Array<Record<string, unknown>> = [];
    const seenServiceIds = new Set<string>();
    for (const ss of user.staffServices) {
      if (seenServiceIds.has(ss.serviceId)) {
        continue;
      }
      seenServiceIds.add(ss.serviceId);
      const override = overrideMap.get(ss.serviceId) || null;
      const timing = mapStaffServiceRow({
        serviceId: ss.serviceId,
        service: ss.service,
        override,
      });
      servicesWithOverrides.push({
        ...ss.service,
        override,
        durationMin: timing.durationMin,
        price: timing.price,
      });
    }

    const workStudios: { id: string; name: string }[] = [];
    const seenStudio = new Set<string>();
    for (const m of user.studioMemberships) {
      if (!seenStudio.has(m.studioId)) {
        seenStudio.add(m.studioId);
        workStudios.push({ id: m.studio.id, name: m.studio.name });
      }
    }
    if (user.studioId && user.studio && !seenStudio.has(user.studioId)) {
      workStudios.push({ id: user.studio.id, name: user.studio.name });
    }

    // Return user with profile, services, and basic info
    const result: any = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      studioId: user.studioId,
      staffProfile: user.staffProfile,
      studioMemberships: user.studioMemberships,
      workStudios,
      services: servicesWithOverrides,
      permissions: buildStaffProfilePermissions(userRole, user.role),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    if (user.role === UserRole.MASTER) {
      result.appointmentStats = await this.loadStaffAppointmentStats(
        user,
        userRole,
        userStudioId,
        actorUserId,
        query,
      );
    }

    // Include password only for OWNER and DEPUTY_OWNER
    if (isOwnerLevelRole(userRole)) {
      result.password = user.password;
    }

    return result;
  }

  private async loadStaffAppointmentStats(
    staff: {
      id: string;
      studioId: string | null;
      studioMemberships: { studioId: string }[];
    },
    actorRole: string,
    actorStudioId: string | undefined,
    actorUserId: string | undefined,
    query?: StaffProfileQueryDto,
  ): Promise<StaffProfileAppointmentStats> {
    const workStudioIds = collectStaffWorkStudioIds(staff);
    const requestedStudioId = query?.studioId?.trim() || undefined;
    let scopedStudioId: string | null = null;
    let studioScope: 'single' | 'all_work_studios' = 'all_work_studios';
    let studioFilter: string | { in: string[] } | undefined;

    if (requestedStudioId) {
      if (!workStudioIds.includes(requestedStudioId)) {
        throw new BadRequestException(
          'Указанный филиал не входит в список филиалов мастера',
        );
      }
      await assertStaffWorksAtStudio(this.prisma, staff.id, requestedStudioId);
      if (!isOwnerLevelRole(actorRole) && actorRole !== UserRole.MANAGER) {
        await assertUserStudioAccessForResource(this.prisma, {
          userRole: actorRole,
          userId: actorUserId,
          userStudioId: actorStudioId,
          studioId: requestedStudioId,
        });
      }
      scopedStudioId = requestedStudioId;
      studioScope = 'single';
      studioFilter = requestedStudioId;
    } else if (actorStudioId?.trim()) {
      const sid = actorStudioId.trim();
      if (workStudioIds.includes(sid)) {
        scopedStudioId = sid;
        studioScope = 'single';
        studioFilter = sid;
      } else if (workStudioIds.length > 0) {
        studioFilter = { in: workStudioIds };
      }
    } else if (workStudioIds.length > 0) {
      studioFilter = { in: workStudioIds };
    }

    const statsStudio = scopedStudioId
      ? await this.prisma.studio.findUnique({
          where: { id: scopedStudioId },
          include: { organization: true },
        })
      : staff.studioId
        ? await this.prisma.studio.findUnique({
            where: { id: staff.studioId },
            include: { organization: true },
          })
        : workStudioIds[0]
          ? await this.prisma.studio.findUnique({
              where: { id: workStudioIds[0] },
              include: { organization: true },
            })
          : null;

    const tz = timezoneFromStudio(statsStudio);
    const period = resolveStaffProfileStatsPeriod(query?.from, query?.to, tz);

    const rows = await this.prisma.appointment.findMany({
      where: {
        staffUserId: staff.id,
        ...(studioFilter ? { studioId: studioFilter } : {}),
        startAt: {
          gte: period.startAtGte,
          lt: period.startAtLt,
        },
      },
      select: { status: true },
    });

    return buildAppointmentStatsFromRows(
      rows,
      { from: period.fromLabel, to: period.toLabel },
      scopedStudioId,
      studioScope,
    );
  }

  async updateStaffProfile(
    userId: string,
    updateProfileDto: UpdateStaffProfileDto,
    userRole: string,
    userStudioId?: string,
    actorUserId?: string,
  ) {
    assertMasterCannotEditStaff(userRole);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { staffProfile: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    await this.assertActorCanAccessStaff(user, userRole, userStudioId, actorUserId);
    assertAdminCannotEditMaster(userRole, user.role);

    // Ensure staff profile exists
    if (!user.staffProfile) {
      throw new NotFoundException('Staff profile not found');
    }

    // Prepare update data
    const profileUpdateData: any = {};

    if (updateProfileDto.avatar !== undefined) {
      profileUpdateData.avatar = updateProfileDto.avatar || null;
    }
    if (updateProfileDto.bio !== undefined) {
      profileUpdateData.bio = updateProfileDto.bio || null;
    }
    if (updateProfileDto.portfolioPhotos !== undefined) {
      profileUpdateData.portfolioPhotos = updateProfileDto.portfolioPhotos || [];
    }
    if (updateProfileDto.rank !== undefined) {
      profileUpdateData.rank = updateProfileDto.rank || null;
    }
    if (updateProfileDto.firstName !== undefined) {
      profileUpdateData.firstName = updateProfileDto.firstName;
    }
    if (updateProfileDto.lastName !== undefined) {
      profileUpdateData.lastName = updateProfileDto.lastName || null;
    }
    if (updateProfileDto.title !== undefined) {
      profileUpdateData.title = updateProfileDto.title || null;
    }
    if (updateProfileDto.category !== undefined) {
      profileUpdateData.category = updateProfileDto.category || null;
    }

    // Update staff profile
    return this.prisma.staffProfile.update({
      where: { userId },
      data: profileUpdateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            role: true,
            isActive: true,
          },
        },
      },
    });
  }

  /**
   * Dismiss (уволить) staff: set isActive = false. User data is preserved, access is revoked.
   */
  async remove(
    userId: string,
    userRole: string,
    userStudioId?: string,
    actorUserId?: string,
  ) {
    assertMasterCannotEditStaff(userRole);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { staffProfile: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (!user.isActive) {
      throw new BadRequestException('User is already dismissed');
    }

    await this.assertActorCanAccessStaff(user, userRole, userStudioId, actorUserId);
    assertAdminCannotEditMaster(userRole, user.role);

    // Cannot dismiss OWNER (only OWNER can do this, and only via special endpoint)
    if (user.role === UserRole.OWNER && !canManageOwners(userRole)) {
      throw new BadRequestException('Cannot dismiss OWNER role');
    }
    // Cannot dismiss DEPUTY_OWNER (only OWNER can do this)
    if (user.role === UserRole.DEPUTY_OWNER && !canManageDeputies(userRole)) {
      throw new BadRequestException('Cannot dismiss DEPUTY_OWNER role');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
      include: { staffProfile: true },
    });

    if (!isOwnerLevelRole(userRole)) {
      const { password, ...rest } = updated;
      return rest;
    }
    return updated;
  }

  /**
   * Restore dismissed staff: set isActive = true. Role, studio, staff_services and other
   * data were never removed at dismissal — JWT again accepts the user as active.
   */
  async restore(
    userId: string,
    userRole: string,
    userStudioId?: string,
    actorUserId?: string,
  ) {
    assertMasterCannotEditStaff(userRole);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { staffProfile: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (user.isActive) {
      throw new BadRequestException('User is already active');
    }

    await this.assertActorCanAccessStaff(user, userRole, userStudioId, actorUserId);
    assertAdminCannotEditMaster(userRole, user.role);

    if (user.role === UserRole.OWNER && !canManageOwners(userRole)) {
      throw new BadRequestException('Cannot restore OWNER role');
    }
    if (user.role === UserRole.DEPUTY_OWNER && !canManageDeputies(userRole)) {
      throw new BadRequestException('Cannot restore DEPUTY_OWNER role');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
      include: { staffProfile: true },
    });

    if (!isOwnerLevelRole(userRole)) {
      const { password, ...rest } = updated;
      return rest;
    }
    return updated;
  }

  /**
   * Полное удаление сотрудника из БД. Доступно только DEVELOPER.
   * В отличие от remove(), это не soft-delete: запись users удаляется физически.
   */
  async hardDelete(userId: string, actorRole: string) {
    if (!isDeveloperRole(actorRole)) {
      throw new ForbiddenException('Only DEVELOPER can hard delete staff');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    await this.prisma.$transaction(async (tx) => {
      // DevTicket.createdBy has onDelete: Restrict — удаляем связанные тикеты,
      // чтобы физическое удаление пользователя прошло без FK-ошибки.
      const createdTicketIds = await tx.devTicket.findMany({
        where: { createdByUserId: userId },
        select: { id: true },
      });
      if (createdTicketIds.length > 0) {
        const ticketIds = createdTicketIds.map((t) => t.id);
        await tx.devTicketMessage.deleteMany({
          where: { ticketId: { in: ticketIds } },
        });
        await tx.devTicket.deleteMany({
          where: { id: { in: ticketIds } },
        });
      }

      await tx.user.delete({ where: { id: userId } });
    });

    return { success: true };
  }

  async createServiceOverride(
    staffUserId: string,
    serviceId: string,
    createOverrideDto: CreateServiceOverrideDto,
    userRole: string,
    userStudioId?: string,
  ) {
    assertMasterCannotEditStaff(userRole);
    // Get staff user
    const staff = await this.prisma.user.findUnique({
      where: { id: staffUserId },
      include: { studio: true },
    });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${staffUserId} not found`);
    }

    await this.assertActorCanAccessStaff(staff, userRole, userStudioId);
    assertAdminCannotEditMaster(userRole, staff.role);

    // Verify service exists and belongs to same studio
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new NotFoundException(`Service with ID ${serviceId} not found`);
    }

    const staffBranchOverride = staff.studioId
      ? await this.prisma.studio.findUnique({
          where: { id: staff.studioId },
          select: { organizationId: true },
        })
      : null;
    if (!staffBranchOverride || service.organizationId !== staffBranchOverride.organizationId) {
      throw new BadRequestException('Service does not belong to the same organization as the staff branch');
    }

    // Verify that staff service exists (staff must be assigned to this service first)
    const staffService = await this.prisma.staffService.findUnique({
      where: {
        studioId_staffUserId_serviceId: {
          studioId: staff.studioId!,
          staffUserId,
          serviceId,
        },
      },
    });

    if (!staffService) {
      throw new BadRequestException('Service is not assigned to this staff member. Please assign the service first.');
    }

    // Check if override already exists
    const existing = await this.prisma.staffServiceOverride.findUnique({
      where: {
        studioId_staffUserId_serviceId: {
          studioId: staff.studioId!,
          staffUserId,
          serviceId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('Override already exists for this staff member and service. Use update instead.');
    }

    // Create override
    return this.prisma.staffServiceOverride.create({
      data: {
        id: generateId(IdPrefix.StaffServiceOverride),
        studioId: staff.studioId!,
        staffUserId,
        serviceId,
        durationMin: createOverrideDto.durationMin,
        price: createOverrideDto.price,
        isActive: createOverrideDto.isActive ?? true,
      },
      include: {
        service: true,
        staff: {
          select: {
            id: true,
            email: true,
            phone: true,
            role: true,
          },
        },
      },
    });
  }

  async updateServiceOverride(
    staffUserId: string,
    serviceId: string,
    updateOverrideDto: UpdateServiceOverrideDto,
    userRole: string,
    userStudioId?: string,
  ) {
    assertMasterCannotEditStaff(userRole);
    // Get staff user
    const staff = await this.prisma.user.findUnique({
      where: { id: staffUserId },
    });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${staffUserId} not found`);
    }

    await this.assertActorCanAccessStaff(staff, userRole, userStudioId);
    assertAdminCannotEditMaster(userRole, staff.role);

    // Find existing override
    const existing = await this.prisma.staffServiceOverride.findUnique({
      where: {
        studioId_staffUserId_serviceId: {
          studioId: staff.studioId!,
          staffUserId,
          serviceId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Override not found for this staff member and service');
    }

    // Prepare update data
    const updateData: any = {};
    if (updateOverrideDto.durationMin !== undefined) {
      updateData.durationMin = updateOverrideDto.durationMin;
    }
    if (updateOverrideDto.price !== undefined) {
      updateData.price = updateOverrideDto.price;
    }
    if (updateOverrideDto.isActive !== undefined) {
      updateData.isActive = updateOverrideDto.isActive;
    }

    // Update override
    return this.prisma.staffServiceOverride.update({
      where: { id: existing.id },
      data: updateData,
      include: {
        service: true,
        staff: {
          select: {
            id: true,
            email: true,
            phone: true,
            role: true,
          },
        },
      },
    });
  }

  async getServiceOverride(
    staffUserId: string,
    serviceId: string,
    userRole: string,
    userStudioId?: string,
  ) {
    // Get staff user
    const staff = await this.prisma.user.findUnique({
      where: { id: staffUserId },
    });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${staffUserId} not found`);
    }

    await this.assertActorCanAccessStaff(staff, userRole, userStudioId);

    // Find override
    const override = await this.prisma.staffServiceOverride.findUnique({
      where: {
        studioId_staffUserId_serviceId: {
          studioId: staff.studioId!,
          staffUserId,
          serviceId,
        },
      },
      include: {
        service: true,
        staff: {
          select: {
            id: true,
            email: true,
            phone: true,
            role: true,
          },
        },
      },
    });

    if (!override) {
      throw new NotFoundException('Override not found for this staff member and service');
    }

    return override;
  }

  async getStaffServiceOverrides(
    staffUserId: string,
    userRole: string,
    userStudioId?: string,
  ) {
    // Get staff user
    const staff = await this.prisma.user.findUnique({
      where: { id: staffUserId },
    });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${staffUserId} not found`);
    }

    await this.assertActorCanAccessStaff(staff, userRole, userStudioId);

    return this.prisma.staffServiceOverride.findMany({
      where: {
        staffUserId,
      },
      include: {
        service: true,
        staff: {
          select: {
            id: true,
            email: true,
            phone: true,
            role: true,
          },
        },
      },
      orderBy: {
        service: {
          name: 'asc',
        },
      },
    });
  }

  async deleteServiceOverride(
    staffUserId: string,
    serviceId: string,
    userRole: string,
    userStudioId?: string,
  ) {
    assertMasterCannotEditStaff(userRole);
    // Get staff user
    const staff = await this.prisma.user.findUnique({
      where: { id: staffUserId },
    });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${staffUserId} not found`);
    }

    await this.assertActorCanAccessStaff(staff, userRole, userStudioId);
    assertAdminCannotEditMaster(userRole, staff.role);

    // Find override
    const override = await this.prisma.staffServiceOverride.findUnique({
      where: {
        studioId_staffUserId_serviceId: {
          studioId: staff.studioId!,
          staffUserId,
          serviceId,
        },
      },
    });

    if (!override) {
      throw new NotFoundException('Override not found for this staff member and service');
    }

    // Delete override
    return this.prisma.staffServiceOverride.delete({
      where: { id: override.id },
    });
  }
}




