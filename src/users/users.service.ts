import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { UpdateStaffProfileDto } from './dto/update-staff-profile.dto';
import { CreateServiceOverrideDto } from './dto/create-service-override.dto';
import { UpdateServiceOverrideDto } from './dto/update-service-override.dto';
import { UserRole } from '../common/decorators/roles.decorator';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(studioId: string, userRole: string, userStudioId?: string) {
    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== studioId) {
      throw new ForbiddenException('Access denied to this studio');
    }

    return this.prisma.user.findMany({
      where: {
        studioId,
        role: {
          in: [UserRole.MANAGER, UserRole.MASTER],
        },
      },
      include: {
        staffProfile: true,
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
          where: {
            studioId,
            role: {
              in: [UserRole.MANAGER, UserRole.MASTER],
            },
          },
          include: {
            staffProfile: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });
      }
      throw error;
    });
  }

  async create(
    studioId: string,
    createStaffDto: CreateStaffDto,
    userRole: string,
    userStudioId?: string,
  ) {
    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== studioId) {
      throw new ForbiddenException('Access denied to this studio');
    }

    // Verify studio exists
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
    });
    if (!studio) {
      throw new NotFoundException(`Studio with ID ${studioId} not found`);
    }

    // Validate role
    if (createStaffDto.role === UserRole.OWNER) {
      throw new BadRequestException('Cannot create OWNER role via this endpoint');
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

    return this.prisma.user.create({
      data: {
        email: createStaffDto.email,
        phone: createStaffDto.phone,
        passwordHash,
        role: createStaffDto.role,
        studioId,
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
  }

  async update(
    userId: string,
    updateStaffDto: UpdateStaffDto,
    userRole: string,
    userStudioId?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== user.studioId) {
      throw new ForbiddenException('Access denied to this user');
    }

    // Cannot change OWNER role
    if (updateStaffDto.role === UserRole.OWNER && user.role !== UserRole.OWNER) {
      throw new BadRequestException('Cannot change role to OWNER');
    }

    // Check email/phone uniqueness
    if (updateStaffDto.email && updateStaffDto.email !== user.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: updateStaffDto.email },
      });
      if (existingEmail) {
        throw new BadRequestException('Email already exists');
      }
    }

    if (updateStaffDto.phone && updateStaffDto.phone !== user.phone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone: updateStaffDto.phone },
      });
      if (existingPhone) {
        throw new BadRequestException('Phone already exists');
      }
    }

    const updateData: any = {
      email: updateStaffDto.email,
      phone: updateStaffDto.phone,
      role: updateStaffDto.role,
      isActive: updateStaffDto.isActive,
    };

    if (updateStaffDto.password) {
      updateData.passwordHash = await bcrypt.hash(updateStaffDto.password, 10);
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

    return this.prisma.user.update({
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
      },
    });
  }

  async addService(
    staffUserId: string,
    serviceId: string,
    userRole: string,
    userStudioId?: string,
  ) {
    // Get staff user
    const staff = await this.prisma.user.findUnique({
      where: { id: staffUserId },
      include: { studio: true },
    });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${staffUserId} not found`);
    }

    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== staff.studioId) {
      throw new ForbiddenException('Access denied to this staff member');
    }

    // Verify service exists and belongs to same studio
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new NotFoundException(`Service with ID ${serviceId} not found`);
    }

    if (service.studioId !== staff.studioId) {
      throw new BadRequestException('Service does not belong to the same studio');
    }

    // Check if already exists
    const existing = await this.prisma.staffService.findUnique({
      where: {
        studioId_staffUserId_serviceId: {
          studioId: staff.studioId!,
          staffUserId,
          serviceId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('Service is already assigned to this staff member');
    }

    // Create staff service
    return this.prisma.staffService.create({
      data: {
        studioId: staff.studioId!,
        staffUserId,
        serviceId,
      },
      include: {
        service: true,
      },
    });
  }

  async removeService(
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

    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== staff.studioId) {
      throw new ForbiddenException('Access denied to this staff member');
    }

    // Find and delete staff service
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
      throw new NotFoundException('Service is not assigned to this staff member');
    }

    return this.prisma.staffService.delete({
      where: { id: staffService.id },
    });
  }

  async getStaffServices(
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

    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== staff.studioId) {
      throw new ForbiddenException('Access denied to this staff member');
    }

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

    // Combine services with their overrides
    return staffServices.map((ss) => ({
      ...ss,
      override: overrideMap.get(ss.serviceId) || null,
    }));
  }

  async getStaffProfile(
    userId: string,
    userRole: string,
    userStudioId?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        staffProfile: true,
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

    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== user.studioId) {
      throw new ForbiddenException('Access denied to this user');
    }

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

    // Combine services with their overrides
    const servicesWithOverrides = user.staffServices.map((ss) => ({
      ...ss.service,
      override: overrideMap.get(ss.serviceId) || null,
    }));

    // Return user with profile, services, and basic info
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      staffProfile: user.staffProfile,
      services: servicesWithOverrides,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async updateStaffProfile(
    userId: string,
    updateProfileDto: UpdateStaffProfileDto,
    userRole: string,
    userStudioId?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { staffProfile: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== user.studioId) {
      throw new ForbiddenException('Access denied to this user');
    }

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

  async remove(
    userId: string,
    userRole: string,
    userStudioId?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== user.studioId) {
      throw new ForbiddenException('Access denied to this user');
    }

    // Cannot delete OWNER
    if (user.role === UserRole.OWNER) {
      throw new BadRequestException('Cannot delete OWNER role');
    }

    // Delete user (cascade will delete related records: staffProfile, workSchedules, busySlots, appointments, staffServices, etc.)
    return this.prisma.user.delete({
      where: { id: userId },
    });
  }

  async createServiceOverride(
    staffUserId: string,
    serviceId: string,
    createOverrideDto: CreateServiceOverrideDto,
    userRole: string,
    userStudioId?: string,
  ) {
    // Get staff user
    const staff = await this.prisma.user.findUnique({
      where: { id: staffUserId },
      include: { studio: true },
    });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${staffUserId} not found`);
    }

    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== staff.studioId) {
      throw new ForbiddenException('Access denied to this staff member');
    }

    // Verify service exists and belongs to same studio
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new NotFoundException(`Service with ID ${serviceId} not found`);
    }

    if (service.studioId !== staff.studioId) {
      throw new BadRequestException('Service does not belong to the same studio');
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
    // Get staff user
    const staff = await this.prisma.user.findUnique({
      where: { id: staffUserId },
    });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${staffUserId} not found`);
    }

    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== staff.studioId) {
      throw new ForbiddenException('Access denied to this staff member');
    }

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

    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== staff.studioId) {
      throw new ForbiddenException('Access denied to this staff member');
    }

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

    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== staff.studioId) {
      throw new ForbiddenException('Access denied to this staff member');
    }

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
    // Get staff user
    const staff = await this.prisma.user.findUnique({
      where: { id: staffUserId },
    });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${staffUserId} not found`);
    }

    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== staff.studioId) {
      throw new ForbiddenException('Access denied to this staff member');
    }

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




