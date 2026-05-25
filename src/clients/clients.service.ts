import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { assertUserOrganizationMatchesStudioOrganizationId } from '../common/organization-scope';
import { generateId, IdPrefix } from '../common/id-generator';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { UserRole, isDeveloperRole, isOwnerLevelRole } from '../common/decorators/roles.decorator';
import { assertAdminCannotBrowseClientList } from '../common/admin-access';
import { maskClientPhoneForRole } from '../common/client-phone-privacy.util';
import {
  getCashbackPercent,
  getLevelProgress,
  getLevelFromTotalPaid,
} from './constants/levels.constants';
import {
  nextMilestoneProgress,
  resolveAutoTierForTotalPaid,
} from '../common/loyalty/studio-loyalty.util';
import { ClientLevel, Prisma, StudioLoyaltyMode } from '@prisma/client';
import * as crypto from 'crypto';
import {
  ClientListQueryParams,
  ClientListSegment,
  ClientsPaginatedResponse,
} from './client-list-paginate.types';
import { escapeIlikeUserInput, onlyDigits } from './client-list-paginate.util';
import {
  assertReferralCodeIsNotLandingPromo,
  findReferrerByClientReferralCode,
  normalizeReferralCodeInput,
} from '../common/referral-code.util';

const REFERRAL_CODE_LENGTH = 6;
const REFERRAL_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  /** Доступ к программе лояльности только при заполненных ФИО+дате рождения. */
  private hasLoyaltyAccess(firstName?: string | null, lastName?: string | null, birthDate?: Date | null): boolean {
    const hasFirstName = !!(firstName ?? '').trim();
    const hasLastName = !!(lastName ?? '').trim();
    const hasBirthDate = !!birthDate;
    return hasFirstName && hasLastName && hasBirthDate;
  }

  private resolveNextbotDialogId(dto: {
    nextbotDialogId?: number;
    dialogId?: number;
  }): number | undefined {
    const raw = dto.nextbotDialogId ?? dto.dialogId;
    if (raw == null) return undefined;
    return raw;
  }

  /** Генерирует уникальный реферальный код в пределах организации. */
  private async generateReferralCode(organizationId: string): Promise<string> {
    for (let attempt = 0; attempt < 50; attempt++) {
      let code = '';
      const bytes = crypto.randomBytes(REFERRAL_CODE_LENGTH);
      for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
        code += REFERRAL_CODE_CHARS[bytes[i]! % REFERRAL_CODE_CHARS.length];
      }
      const existing = await this.prisma.client.findUnique({
        where: {
          organizationId_referralCode: { organizationId, referralCode: code },
        },
      });
      if (!existing) return code;
    }
    throw new BadRequestException('Could not generate unique referral code');
  }

  /**
   * Организация для списков клиентов: JWT / X-Organization-Id, либо query organizationId (только DEVELOPER).
   */
  private async resolveListOrganizationId(
    userRole: string | undefined,
    userOrganizationId: string | undefined,
    organizationIdQuery: string | undefined,
  ): Promise<string> {
    if (isDeveloperRole(userRole) && organizationIdQuery?.trim()) {
      const organizationId = organizationIdQuery.trim();
      const org = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true },
      });
      if (!org) {
        throw new NotFoundException(`Organization with ID ${organizationId} not found`);
      }
      return organizationId;
    }
    if (!userOrganizationId?.trim()) {
      throw new BadRequestException('Organization context required');
    }
    const organizationId = userOrganizationId.trim();
    assertUserOrganizationMatchesStudioOrganizationId(
      organizationId,
      userOrganizationId,
      userRole,
    );
    return organizationId;
  }

  /** Клиент должен принадлежать той же организации, что и выбранный контекст (для DEVELOPER — query organizationId или JWT). */
  private async assertClientInOrganizationContext(
    clientOrganizationId: string,
    userRole?: string,
    userOrganizationId?: string,
    organizationIdQuery?: string,
  ): Promise<void> {
    const effectiveOrgId = await this.resolveListOrganizationId(
      userRole,
      userOrganizationId,
      organizationIdQuery,
    );
    if (clientOrganizationId !== effectiveOrgId) {
      throw new ForbiddenException('Access denied to this client');
    }
  }

  /**
   * Список клиентов организации. Путь без studioId — контекст организации из JWT / X-Organization-Id.
   * Query organizationId — только для роли DEVELOPER (другая организация).
   *
   * `list` задан: серверная пагинация, ответ `{ items, total, limit, offset }` (тот же `ApiClient` в items).
   * `list` не задан: прежний контракт — **массив** (все клиенты, несмотря на размер; для `q` — фильтр).
   */
  async findAll(
    query?: string,
    userRole?: string,
    userOrganizationId?: string,
    organizationIdQuery?: string,
    list?: never,
  ): Promise<any[]>;
  async findAll(
    query: string | undefined,
    userRole: string | undefined,
    userOrganizationId: string | undefined,
    organizationIdQuery: string | undefined,
    list: ClientListQueryParams,
  ): Promise<ClientsPaginatedResponse>;
  async findAll(
    query?: string,
    userRole?: string,
    userOrganizationId?: string,
    organizationIdQuery?: string,
    list?: ClientListQueryParams,
  ) {
    assertAdminCannotBrowseClientList(userRole);
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      if (userRole === UserRole.MASTER) {
        throw new ForbiddenException('Masters cannot access client list');
      }
    }

    const organizationId = await this.resolveListOrganizationId(
      userRole,
      userOrganizationId,
      organizationIdQuery,
    );

    if (list) {
      return this.findAllPaginated(organizationId, list);
    }

    const where: Record<string, unknown> = {
      isBlacklisted: false,
      organizationId,
    };

    if (query) {
      where.OR = [
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { patronymic: { contains: query, mode: 'insensitive' } },
        { phone: { contains: query, mode: 'insensitive' } },
      ];
    }

    const clients = await this.prisma.client.findMany({
      where,
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' },
      ],
      include: {
        referredByClient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            referralCode: true,
          },
        },
      },
    });

    return this.attachVisitStatsToClients(clients);
  }

  private async findAllPaginated(
    organizationId: string,
    list: ClientListQueryParams,
  ): Promise<ClientsPaginatedResponse> {
    const now = new Date();
    const v7d = new Date(now);
    v7d.setDate(v7d.getDate() - 7);
    const v6m = new Date(now);
    v6m.setMonth(v6m.getMonth() - 6);

    const whereSearch = this.clientListBuildSearchFilter(list.q);
    const whereSegment = this.clientListBuildSegmentFilter(list.segment, v7d, v6m);
    const orderBy = this.clientListBuildOrderBy(list.sort);
    const limit = list.limit;
    const offset = list.offset;

    const countRows = await this.prisma.$queryRaw<[{ c: bigint }]>(Prisma.sql`
      WITH last_done AS (
        SELECT a."clientId" AS client_id, MAX(a."startAt") AS lastv
        FROM appointments a
        WHERE a."status" = 'DONE'::"AppointmentStatus"
        GROUP BY a."clientId"
      )
      SELECT COUNT(*)::bigint AS c
      FROM "clients" c
      LEFT JOIN last_done l ON l.client_id = c.id
      WHERE
        c."organizationId" = ${organizationId}
        AND c."isBlacklisted" = false
        AND (${whereSearch})
        ${whereSegment}
    `);
    const total = Number(countRows[0]?.c ?? 0n);

    const pageRows = await this.prisma.$queryRaw<Array<{ id: string; lastv: Date | null }>>(
      Prisma.sql`
      WITH last_done AS (
        SELECT a."clientId" AS client_id, MAX(a."startAt") AS lastv
        FROM appointments a
        WHERE a."status" = 'DONE'::"AppointmentStatus"
        GROUP BY a."clientId"
      )
      SELECT c.id, l.lastv
      FROM "clients" c
      LEFT JOIN last_done l ON l.client_id = c.id
      WHERE
        c."organizationId" = ${organizationId}
        AND c."isBlacklisted" = false
        AND (${whereSearch})
        ${whereSegment}
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${offset}
    `,
    );

    const idOrder: string[] = pageRows.map((r) => r.id);

    if (idOrder.length === 0) {
      return { items: [], total, limit, offset };
    }

    const clients = await this.prisma.client.findMany({
      where: { id: { in: idOrder } },
      include: {
        referredByClient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            referralCode: true,
          },
        },
      },
    });
    const pos = new Map(idOrder.map((id, i) => [id, i]));
    clients.sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0));

    const items = await this.attachVisitStatsToClients(clients);
    return { items, total, limit, offset };
  }

  private clientListBuildSearchFilter(q: string): Prisma.Sql {
    const t = (q ?? '').trim();
    if (!t) {
      return Prisma.sql`TRUE`;
    }
    const like = '%' + escapeIlikeUserInput(t) + '%';
    const digits = onlyDigits(t);
    if (digits.length > 0) {
      const dLike = '%' + digits + '%';
      return Prisma.sql`(
        c."firstName" ILIKE ${like} OR
        c."lastName" ILIKE ${like} OR
        c."patronymic" ILIKE ${like} OR
        c."phone" ILIKE ${like} OR
        regexp_replace(c."phone", '[^0-9]', '', 'g') ILIKE ${dLike}
      )`;
    }
    return Prisma.sql`(
      c."firstName" ILIKE ${like} OR
      c."lastName" ILIKE ${like} OR
      c."patronymic" ILIKE ${like} OR
      c."phone" ILIKE ${like}
    )`;
  }

  private clientListBuildSegmentFilter(
    segment: string | null,
    v7d: Date,
    v6m: Date,
  ): Prisma.Sql {
    if (segment == null) {
      return Prisma.empty;
    }
    if (segment === ClientListSegment.VIP) {
      return Prisma.sql`AND c."level"::text = 'DIAMOND'`;
    }
    if (segment === ClientListSegment.LOST) {
      return Prisma.sql`AND (l.lastv IS NULL OR l.lastv < ${v6m})`;
    }
    if (segment === ClientListSegment.NEW) {
      return Prisma.sql`AND c."createdAt" >= ${v7d}`;
    }
    if (segment === ClientListSegment.REGULAR) {
      return Prisma.sql`AND c."level"::text IN ('BRONZE', 'SILVER', 'GOLD') AND l.lastv IS NOT NULL AND l.lastv < ${v7d} AND l.lastv >= ${v6m}`;
    }
    return Prisma.empty;
  }

  private clientListBuildOrderBy(sort: string): Prisma.Sql {
    if (sort === 'createdAt:desc') {
      return Prisma.sql`c."createdAt" DESC`;
    }
    if (sort === 'firstName:asc') {
      return Prisma.sql`c."firstName" ASC NULLS LAST, c."lastName" ASC NULLS LAST`;
    }
    return Prisma.sql`l.lastv DESC NULLS LAST, c."createdAt" DESC`;
  }

  private async attachVisitStatsToClients(clients: any[]) {
    if (clients.length === 0) {
      return [];
    }
    const clientIds = clients.map((c) => c.id);
    const visitStats = await this.prisma.appointment.groupBy({
      by: ['clientId'],
      where: {
        clientId: { in: clientIds },
        status: 'DONE',
      },
      _count: true,
      _max: { startAt: true },
    });
    const statsByClient = new Map(
      visitStats.map((s) => [
        s.clientId,
        { totalVisits: s._count, lastVisitAt: s._max.startAt ?? null },
      ]),
    );
    return clients.map((client) => {
      const stats = statsByClient.get(client.id) ?? { totalVisits: 0, lastVisitAt: null };
      return {
        ...client,
        totalVisits: stats.totalVisits,
        lastVisitAt: stats.lastVisitAt,
      };
    });
  }

  /**
   * Список приведённых клиентов по студии (кто кем привлечён).
   * @deprecated Для таблицы на дэшборде используйте getReferrers — там показываются владельцы кодов со счётчиком.
   */
  async getReferredClients(
    userRole?: string,
    userOrganizationId?: string,
    organizationIdQuery?: string,
  ) {
    assertAdminCannotBrowseClientList(userRole);
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      if (userRole === UserRole.MASTER) {
        throw new ForbiddenException('Masters cannot access referred clients list');
      }
    }

    const organizationId = await this.resolveListOrganizationId(
      userRole,
      userOrganizationId,
      organizationIdQuery,
    );

    const clients = await this.prisma.client.findMany({
      where: {
        organizationId,
        referredByClientId: { not: null },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        referredByClientId: true,
        referredByClient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            referralCode: true,
          },
        },
      },
    });

    return clients.map((c) => ({
      clientId: c.id,
      clientFirstName: c.firstName,
      clientLastName: c.lastName,
      clientPhone: c.phone,
      referrerId: c.referredByClientId,
      referrerFirstName: c.referredByClient?.firstName ?? '',
      referrerLastName: c.referredByClient?.lastName ?? '',
      referrerCode: c.referredByClient?.referralCode ?? '',
    }));
  }

  /**
   * Список клиентов, чьими реферальными кодами воспользовались (для таблицы на дэшборде).
   * Каждая строка — владелец кода + счётчик приведённых. По клику открывается профиль этого клиента.
   */
  async getReferrers(
    userRole?: string,
    userOrganizationId?: string,
    organizationIdQuery?: string,
  ) {
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      if (userRole === UserRole.MASTER) {
        throw new ForbiddenException('Masters cannot access referrers list');
      }
    }

    const organizationId = await this.resolveListOrganizationId(
      userRole,
      userOrganizationId,
      organizationIdQuery,
    );

    const clients = await this.prisma.client.findMany({
      where: {
        organizationId,
        referredClients: { some: {} },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        referralCode: true,
        _count: { select: { referredClients: true } },
      },
    });

    return clients.map((c) => ({
      clientId: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone,
      referralCode: c.referralCode ?? '',
      referredCount: c._count.referredClients,
    }));
  }

  async create(
    createClientDto: CreateClientDto,
    userRole?: string,
    userStudioId?: string,
    userOrganizationId?: string,
    organizationIdQuery?: string,
  ) {
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      if (userRole === UserRole.MASTER) {
        throw new ForbiddenException('Masters cannot create clients');
      }
    }

    const organizationId = await this.resolveListOrganizationId(
      userRole,
      userOrganizationId,
      organizationIdQuery,
    );

    const existingClient = await this.prisma.client.findUnique({
      where: {
        organizationId_phone: { organizationId, phone: createClientDto.phone },
      },
    });

    if (existingClient) {
      throw new BadRequestException('Клиент с таким номером телефона уже существует');
    }

    const normalizedReferrer = normalizeReferralCodeInput(
      createClientDto.referrerCode ?? createClientDto.referralCode,
    );
    let referredByClientId: string | undefined;
    if (normalizedReferrer) {
      await assertReferralCodeIsNotLandingPromo(this.prisma, normalizedReferrer);
      const referrer = await findReferrerByClientReferralCode(
        this.prisma,
        normalizedReferrer,
        organizationId,
      );
      if (!referrer) {
        throw new BadRequestException('Реферальный код не найден');
      }
      referredByClientId = referrer.id;
    }

    const referralCode = await this.generateReferralCode(organizationId);

    const createBirthDate = createClientDto.birthDate ? new Date(createClientDto.birthDate) : undefined;
    const loyaltyEligibleOnCreate = this.hasLoyaltyAccess(
      createClientDto.firstName,
      createClientDto.lastName,
      createBirthDate ?? null,
    );
    const loyaltyEnabledOnCreate =
      loyaltyEligibleOnCreate && (createClientDto.loyaltyEnabled ?? true);
    const nextbotDialogId = this.resolveNextbotDialogId(createClientDto);

    let registrationSource: string | undefined;
    let studioReferralLinkId: string | undefined;
    const rawMarketingLinkId = createClientDto.referralLinkId?.trim();
    if (rawMarketingLinkId) {
      const mLink = await this.prisma.studioReferralLink.findFirst({
        where: { id: rawMarketingLinkId, organizationId },
      });
      if (!mLink) {
        throw new BadRequestException('Маркетинговая реферальная ссылка не найдена');
      }
      if (!mLink.isActive) {
        throw new BadRequestException('Реферальная ссылка отключена');
      }
      registrationSource = mLink.sourceName;
      studioReferralLinkId = mLink.id;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.client.create({
          data: {
            id: generateId(IdPrefix.Client),
            organizationId,
            firstName: createClientDto.firstName,
            lastName: createClientDto.lastName,
            patronymic: createClientDto.patronymic?.trim() || undefined,
            instagram: createClientDto.instagram?.trim() || undefined,
            phone: createClientDto.phone,
            gender: createClientDto.gender,
            birthDate: createBirthDate,
            notes: createClientDto.notes,
            bonuses: createClientDto.bonuses ?? 0,
            loyaltyEnabled: loyaltyEnabledOnCreate,
            discount: createClientDto.discount ?? 0,
            balance: createClientDto.balance ?? 0,
            referralCode,
            referredByClientId,
            registrationSource,
            studioReferralLinkId,
            nextbotDialogId,
          },
          include: {
            referredByClient: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                referralCode: true,
              },
            },
          },
        });

        if (studioReferralLinkId) {
          await tx.studioReferralLink.update({
            where: { id: studioReferralLinkId },
            data: {
              registrationsCount: { increment: 1 },
              lastActivityAt: new Date(),
            },
          });
        }

        return created;
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BadRequestException('Клиент с таким номером телефона уже существует');
      }
      throw error;
    }
  }

  async findOne(
    id: string,
    userRole?: string,
    userStudioId?: string,
    userOrganizationId?: string,
    organizationIdQuery?: string,
  ) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        _count: {
          select: { referredClients: true },
        },
        referredByClient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            referralCode: true,
            phone: true,
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    await this.assertClientInOrganizationContext(
      client.organizationId,
      userRole,
      userOrganizationId,
      organizationIdQuery,
    );

    // Check access (клиенты общие для всех салонов; ADMIN/MASTER как раньше)
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      if (userRole === UserRole.ADMIN && !userStudioId) {
        throw new ForbiddenException('Access denied to this client');
      }
      if (userRole === UserRole.MASTER) {
        throw new ForbiddenException('Masters cannot access client details');
      }
    }

    // Для старых клиентов без реферального кода — сгенерировать при первом чтении
    if (!client.referralCode) {
      client.referralCode = await this.generateReferralCode(client.organizationId);
      await this.prisma.client.update({
        where: { id: client.id },
        data: { referralCode: client.referralCode },
      });
    }

    const referredCount = (client as any)._count?.referredClients ?? 0;
    if (userRole === UserRole.MASTER) {
      const { _count, ...rest } = client as any;
      return {
        ...maskClientPhoneForRole(rest, userRole),
        referredCount,
      };
    }

    const level = (client as any).level ?? 'BRONZE';
    const totalPaidForLevel = (client as any).totalPaidForLevel ?? 0;
    const { _count, ...clientData } = client as any;

    const visitStats = await this.prisma.appointment.aggregate({
      where: { clientId: id, status: 'DONE' },
      _count: { _all: true },
      _max: { startAt: true },
    });
    const completedVisits = visitStats._count._all;
    const lastVisitAt = visitStats._max.startAt ?? null;
    const hasReferrer = !!(client as any).referredByClientId;
    const firstVisitReferralPending =
      hasReferrer &&
      completedVisits === 0 &&
      !(client as any).referralFirstVisitBonusCredited;
    // Блокируем ввод только до первого успешно завершённого визита по рефералке.
    // После первого DONE поле снова доступно для обычных промокодов акций.
    const referralCodeInputDisabled = firstVisitReferralPending;

    const clientOrg = await this.prisma.organization.findUnique({
      where: { id: client.organizationId },
      select: {
        referFriendEnabled: true,
        referFriendInviteeRewardType: true,
        loyaltyMode: true,
      },
    });

    let referralFirstVisitDiscountApplies = false;
    let referralFirstVisitBonusApplies = false;
    if (clientOrg?.referFriendEnabled && firstVisitReferralPending) {
      referralFirstVisitDiscountApplies =
        clientOrg.referFriendInviteeRewardType === 'DISCOUNT_PERCENT';
      referralFirstVisitBonusApplies =
        clientOrg.referFriendInviteeRewardType === 'BONUS_PERCENT';
    }

    let referredList: { clientId: string; firstName: string; lastName: string; usedAt: string }[] = [];
    if (referredCount > 0) {
      const referred = await this.prisma.client.findMany({
        where: { referredByClientId: id },
        select: { id: true, firstName: true, lastName: true },
      });
      const referredIds = referred.map((c) => c.id);
      const firstDoneRows = await this.prisma.appointment.findMany({
        where: { clientId: { in: referredIds }, status: 'DONE' },
        select: { clientId: true, startAt: true },
        orderBy: { startAt: 'asc' },
      });
      const firstDoneAtByClient = new Map<string, Date>();
      for (const row of firstDoneRows) {
        if (!firstDoneAtByClient.has(row.clientId)) {
          firstDoneAtByClient.set(row.clientId, row.startAt);
        }
      }
      const legacyBonusDates = await this.prisma.bonusHistoryEntry.findMany({
        where: {
          clientId: { in: referredIds },
          type: 'REFERRAL_NEW_CLIENT',
        },
        select: { clientId: true, createdAt: true },
      });
      const legacyAtByClient = new Map<string, Date>();
      for (const d of legacyBonusDates) {
        const existing = legacyAtByClient.get(d.clientId);
        if (!existing || d.createdAt < existing) legacyAtByClient.set(d.clientId, d.createdAt);
      }
      referredList = referred.map((c) => {
        const fromDone = firstDoneAtByClient.get(c.id);
        const fromLegacy = legacyAtByClient.get(c.id);
        const usedAt = fromDone ?? fromLegacy;
        return {
          clientId: c.id,
          firstName: c.firstName,
          lastName: c.lastName ?? '',
          usedAt: usedAt ? usedAt.toISOString() : '',
        };
      });
      referredList.sort((a, b) => (b.usedAt || '').localeCompare(a.usedAt || ''));
    }

    let cashbackPercent = getCashbackPercent(level);
    let levelProgress = getLevelProgress(totalPaidForLevel, level);
    let organizationLoyalty: Record<string, unknown> | null = null;

    const orgId = client.organizationId;
    if (clientOrg?.loyaltyMode === StudioLoyaltyMode.CUSTOM) {
      const [loyaltyTiers, loyaltyMilestones, csl] = await Promise.all([
        this.prisma.studioLoyaltyTier.findMany({
          where: { organizationId: orgId },
          orderBy: { sortOrder: 'asc' },
        }),
        this.prisma.studioLoyaltyMilestone.findMany({
          where: { organizationId: orgId },
          orderBy: { minTotalPaid: 'asc' },
        }),
        this.prisma.clientStudioLoyalty.findUnique({
          where: {
            clientId_organizationId: { clientId: client.id, organizationId: orgId },
          },
          include: { currentTier: true },
        }),
      ]);
      if (loyaltyTiers.length > 0 && loyaltyMilestones.length > 0) {
        const tierLikes = loyaltyTiers.map((ct) => ({
          id: ct.id,
          sortOrder: ct.sortOrder,
          name: ct.name,
          cashbackPercent: ct.cashbackPercent,
          manualOnly: ct.manualOnly,
        }));
        const milestoneLikes = loyaltyMilestones.map((m) => ({
          minTotalPaid: m.minTotalPaid,
          targetSortOrder: m.targetSortOrder,
        }));
        const paid = csl?.totalPaid ?? 0;
        const currentTierResolved =
          csl?.levelSetManually && csl.currentTier
            ? {
                id: csl.currentTier.id,
                sortOrder: csl.currentTier.sortOrder,
                name: csl.currentTier.name,
                cashbackPercent: csl.currentTier.cashbackPercent,
                manualOnly: csl.currentTier.manualOnly,
              }
            : resolveAutoTierForTotalPaid(tierLikes, milestoneLikes, paid) ??
              resolveAutoTierForTotalPaid(tierLikes, milestoneLikes, 0);
        const prog = nextMilestoneProgress(milestoneLikes, tierLikes, paid);
        cashbackPercent = currentTierResolved?.cashbackPercent ?? 0;
        levelProgress = {
          currentTotalPaid: paid,
          nextLevel:
            prog.nextTargetSortOrder != null ? `tier_${prog.nextTargetSortOrder}` : null,
          nextLevelThreshold: prog.nextMilestoneMinPaid,
          remainingToNext: prog.remainingToNext,
        };
        organizationLoyalty = {
          organizationId: orgId,
          loyaltyMode: StudioLoyaltyMode.CUSTOM,
          totalPaid: paid,
          currentTier: currentTierResolved,
          levelSetManually: csl?.levelSetManually ?? false,
          milestones: loyaltyMilestones,
          nextStep: {
            minTotalPaid: prog.nextMilestoneMinPaid,
            targetSortOrder: prog.nextTargetSortOrder,
            targetTierName: prog.nextTierName,
            remaining: prog.remainingToNext,
          },
        };
      }
    }

    return {
      ...clientData,
      referredCount,
      referredList,
      cashbackPercent,
      levelProgress,
      organizationLoyalty,
      /** @deprecated Используйте organizationLoyalty */
      studioLoyalty: organizationLoyalty,
      referralCodeInputDisabled,
      referralFirstVisitDiscountApplies,
      referralFirstVisitBonusApplies,
      /** Последний завершённый визит в CRM (max startAt по записям со статусом DONE). */
      lastVisitAt,
      /** Число завершённых визитов в CRM (как в списке клиентов). */
      totalVisits: completedVisits,
    };
  }

  private async applyCustomLoyaltyPatch(
    clientId: string,
    clientOrganizationId: string,
    organizationId: string,
    tierId?: string,
    clearManual?: boolean,
  ) {
    if (organizationId !== clientOrganizationId) {
      throw new BadRequestException(
        'Кастомная лояльность задаётся только для организации клиента (customLoyaltyOrganizationId должен совпадать с organizationId клиента)',
      );
    }
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { loyaltyMode: true },
    });
    if (!org || org.loyaltyMode !== StudioLoyaltyMode.CUSTOM) {
      throw new BadRequestException('Организация не в режиме кастомной лояльности (CUSTOM)');
    }
    const [tiers, milestones] = await Promise.all([
      this.prisma.studioLoyaltyTier.findMany({ where: { organizationId } }),
      this.prisma.studioLoyaltyMilestone.findMany({ where: { organizationId } }),
    ]);
    if (tiers.length === 0 || milestones.length === 0) {
      throw new BadRequestException('В организации не настроены уровни лояльности');
    }
    const tierLikes = tiers.map((ct) => ({
      id: ct.id,
      sortOrder: ct.sortOrder,
      name: ct.name,
      cashbackPercent: ct.cashbackPercent,
      manualOnly: ct.manualOnly,
    }));
    const milestoneLikes = milestones.map((m) => ({
      minTotalPaid: m.minTotalPaid,
      targetSortOrder: m.targetSortOrder,
    }));

    if (clearManual) {
      const csl = await this.prisma.clientStudioLoyalty.findUnique({
        where: { clientId_organizationId: { clientId, organizationId } },
      });
      if (!csl) {
        throw new BadRequestException('Нет учёта лояльности клиента в этой организации');
      }
      const resolved = resolveAutoTierForTotalPaid(tierLikes, milestoneLikes, csl.totalPaid);
      await this.prisma.clientStudioLoyalty.update({
        where: { id: csl.id },
        data: {
          levelSetManually: false,
          currentTierId: resolved?.id ?? null,
        },
      });
    }

    if (tierId) {
      const tier = tiers.find((t) => t.id === tierId);
      if (!tier) {
        throw new BadRequestException('Уровень не найден в этой организации');
      }
      await this.prisma.clientStudioLoyalty.upsert({
        where: { clientId_organizationId: { clientId, organizationId } },
        create: {
          id: generateId(IdPrefix.ClientStudioLoyalty),
          clientId,
          organizationId,
          totalPaid: 0,
          levelSetManually: true,
          currentTierId: tier.id,
        },
        update: {
          levelSetManually: true,
          currentTierId: tier.id,
        },
      });
    }
  }

  async update(
    id: string,
    updateClientDto: UpdateClientDto,
    userRole?: string,
    userStudioId?: string,
    userOrganizationId?: string,
    organizationIdQuery?: string,
  ) {
    const {
      customLoyaltyOrganizationId,
      customLoyaltyStudioId,
      customLoyaltyTierId,
      customLoyaltyClearManual,
      dialogId,
      nextbotDialogId,
      ...patchDto
    } = updateClientDto;

    if (nextbotDialogId !== undefined || dialogId !== undefined) {
      (patchDto as { nextbotDialogId?: number | null }).nextbotDialogId =
        nextbotDialogId !== undefined ? nextbotDialogId : dialogId;
    }

    const client = await this.prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    await this.assertClientInOrganizationContext(
      client.organizationId,
      userRole,
      userOrganizationId,
      organizationIdQuery,
    );

    // Check access (клиенты общие для всех салонов)
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      if (userRole === UserRole.ADMIN && !userStudioId) {
        throw new ForbiddenException('Access denied to this client');
      }
      if (userRole === UserRole.MASTER) {
        throw new ForbiddenException('Masters cannot update clients');
      }
    }

    if (
      customLoyaltyOrganizationId != null ||
      customLoyaltyStudioId != null ||
      customLoyaltyTierId != null ||
      customLoyaltyClearManual === true
    ) {
      let loyaltyOrgId = customLoyaltyOrganizationId ?? null;
      if (customLoyaltyStudioId) {
        const st = await this.prisma.studio.findUnique({
          where: { id: customLoyaltyStudioId },
          select: { organizationId: true },
        });
        const fromStudio = st?.organizationId ?? null;
        if (loyaltyOrgId && fromStudio && loyaltyOrgId !== fromStudio) {
          throw new BadRequestException(
            'customLoyaltyOrganizationId не совпадает с организацией customLoyaltyStudioId',
          );
        }
        if (!loyaltyOrgId) loyaltyOrgId = fromStudio;
      }
      if (!loyaltyOrgId) {
        throw new BadRequestException(
          'Для кастомной лояльности укажите customLoyaltyOrganizationId (или устаревший customLoyaltyStudioId)',
        );
      }
      if (!isOwnerLevelRole(userRole)) {
        throw new ForbiddenException('Only owner level role can change custom loyalty tier');
      }
      if (customLoyaltyTierId == null && customLoyaltyClearManual !== true) {
        throw new BadRequestException(
          'Передайте customLoyaltyTierId (назначить уровень) и/или customLoyaltyClearManual: true',
        );
      }
      await this.applyCustomLoyaltyPatch(
        client.id,
        client.organizationId,
        loyaltyOrgId,
        customLoyaltyTierId ?? undefined,
        customLoyaltyClearManual === true,
      );
    }

    // Check phone uniqueness within organization if phone is being updated
    if (patchDto.phone && patchDto.phone !== client.phone) {
      const existingClient = await this.prisma.client.findUnique({
        where: {
          organizationId_phone: {
            organizationId: client.organizationId,
            phone: patchDto.phone,
          },
        },
      });
      if (existingClient) {
        throw new BadRequestException('Клиент с таким номером телефона уже существует');
      }
    }

    // Только Owner и Deputy могут назначать или снимать DIAMOND
    const assigningDiamond =
      patchDto.level === ClientLevel.DIAMOND || patchDto.levelSetManually === true;
    const removingDiamond =
      (client as any).level === ClientLevel.DIAMOND &&
      (patchDto.levelSetManually === false ||
        (patchDto.level !== undefined && patchDto.level !== ClientLevel.DIAMOND));
    if (assigningDiamond || removingDiamond) {
      if (!isOwnerLevelRole(userRole)) {
        throw new ForbiddenException('Only owner or deputy owner can assign or remove DIAMOND level');
      }
    }

    if (patchDto.level !== undefined && patchDto.level !== ClientLevel.DIAMOND) {
      (patchDto as any).levelSetManually = false;
    }

    // Снять DIAMOND: передали levelSetManually: false — пересчитать уровень по totalPaidForLevel
    const data: any = { ...patchDto };
    if (
      patchDto.levelSetManually === false &&
      (client as any).level === ClientLevel.DIAMOND &&
      patchDto.level === undefined
    ) {
      const totalPaid = (client as any).totalPaidForLevel ?? 0;
      data.level = getLevelFromTotalPaid(totalPaid);
    }
    if (data.birthDate !== undefined) {
      data.birthDate = data.birthDate ? new Date(data.birthDate) : null;
    }
    if (data.importedLastVisitAt !== undefined) {
      data.importedLastVisitAt = data.importedLastVisitAt
        ? new Date(data.importedLastVisitAt)
        : null;
    }

    const nextFirstName =
      data.firstName !== undefined ? String(data.firstName) : (client.firstName ?? '');
    const nextLastName =
      data.lastName !== undefined ? String(data.lastName ?? '') : (client.lastName ?? '');
    const nextBirthDate =
      data.birthDate !== undefined ? (data.birthDate as Date | null) : (client.birthDate ?? null);
    const loyaltyEligibleAfterPatch = this.hasLoyaltyAccess(
      nextFirstName,
      nextLastName,
      nextBirthDate,
    );

    if (data.loyaltyEnabled === true && !loyaltyEligibleAfterPatch) {
      throw new BadRequestException(
        'Cannot enable loyalty: firstName, lastName and birthDate are required',
      );
    }
    if (!loyaltyEligibleAfterPatch) {
      // Если обязательные поля неполные — лояльность принудительно отключается.
      data.loyaltyEnabled = false;
    }

    const hasUpdates = Object.keys(data).length > 0;
    if (hasUpdates) {
      return this.prisma.client.update({
        where: { id },
        data,
      });
    }
    return this.prisma.client.findUnique({ where: { id } });
  }

  /**
   * Client segments for dashboard: New, Never visited, Sleeping (3–6 months no booking), Missing (6+ months no booking).
   * Counts are mutually exclusive; blacklisted clients are excluded.
   */
  async getClientSegments(
    studioId: string,
    userRole?: string,
    userStudioId?: string,
    userOrganizationId?: string,
    organizationIdQuery?: string,
  ) {
    assertAdminCannotBrowseClientList(userRole);
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      if (userRole === UserRole.ADMIN && userStudioId !== studioId) {
        throw new ForbiddenException('Access denied to this studio');
      }
      if (userRole === UserRole.MASTER) {
        throw new ForbiddenException('Masters cannot access client segments');
      }
    }

    const resolvedOrgId = await this.resolveListOrganizationId(
      userRole,
      userOrganizationId,
      organizationIdQuery,
    );

    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
      select: { organizationId: true },
    });
    if (!studio) {
      throw new NotFoundException(`Studio with ID ${studioId} not found`);
    }
    if (studio.organizationId !== resolvedOrgId) {
      throw new ForbiddenException('Access denied to this studio');
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const clients = await this.prisma.client.findMany({
      where: { isBlacklisted: false, organizationId: studio.organizationId },
      select: { id: true, createdAt: true },
    });
    const clientIds = clients.map((c) => c.id);
    if (clientIds.length === 0) {
      return {
        new: 0,
        neverVisited: 0,
        sleeping: 0,
        missing: 0,
      };
    }

    // Последний визит в эту студию (клиенты общие, сегменты считаем по студии)
    const lastAppointmentByClientAtStudio = await this.prisma.appointment.groupBy({
      by: ['clientId'],
      where: { clientId: { in: clientIds }, studioId },
      _max: { startAt: true },
    });
    const lastByClient = new Map(
      lastAppointmentByClientAtStudio.map((r) => [r.clientId, r._max.startAt]),
    );

    let newCount = 0;
    let neverVisited = 0;
    let sleeping = 0;
    let missing = 0;

    for (const c of clients) {
      const lastAtThisStudio = lastByClient.get(c.id);
      const createdInLastWeek = c.createdAt >= sevenDaysAgo;

      if (!lastAtThisStudio) {
        neverVisited++;
        continue;
      }
      if (lastAtThisStudio < sixMonthsAgo) missing++;
      else if (lastAtThisStudio < threeMonthsAgo) sleeping++;
      else if (lastAtThisStudio >= sevenDaysAgo) newCount++;
    }

    return {
      new: newCount,
      neverVisited,
      sleeping,
      missing,
    };
  }

  async getClientStatistics(
    id: string,
    userRole?: string,
    userStudioId?: string,
    userOrganizationId?: string,
    organizationIdQuery?: string,
  ) {
    const client = await this.prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    await this.assertClientInOrganizationContext(
      client.organizationId,
      userRole,
      userOrganizationId,
      organizationIdQuery,
    );

    // Check access (клиенты общие для всех салонов)
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      if (userRole === UserRole.ADMIN && !userStudioId) {
        throw new ForbiddenException('Access denied to this client');
      }
      if (userRole === UserRole.MASTER) {
        throw new ForbiddenException('Masters cannot access client details');
      }
    }

    // Only completed (DONE) visits for card stats: visits count and average check
    const appointments = await this.prisma.appointment.findMany({
      where: {
        clientId: id,
        status: 'DONE',
      },
      include: {
        service: true,
        upsells: true,
      },
    });

    // Resolve main-service price per appointment (staff override or service default)
    const staffServiceKeys = [
      ...new Set(
        appointments.map((a) => ({ studioId: a.studioId, staffUserId: a.staffUserId, serviceId: a.serviceId })),
      ),
    ];
    const overrides = staffServiceKeys.length
      ? await this.prisma.staffServiceOverride.findMany({
          where: {
            isActive: true,
            OR: staffServiceKeys.map((k) => ({
              studioId: k.studioId,
              staffUserId: k.staffUserId,
              serviceId: k.serviceId,
            })),
          },
        })
      : [];
    const overridePriceByKey = new Map(
      overrides.map((o) => [`${o.studioId}:${o.staffUserId}:${o.serviceId}`, o.price]),
    );

    // Calculate statistics: only service price + additional services (upsells); prepayment is excluded
    const totalVisits = appointments.length;
    const totalRevenue = appointments.reduce((sum, a) => {
      const key = `${a.studioId}:${a.staffUserId}:${a.serviceId}`;
      const servicePrice = overridePriceByKey.get(key) ?? a.service.defaultPrice ?? 0;
      const upsellsTotal = a.upsells.reduce((acc, u) => acc + u.totalAmount, 0);
      return sum + servicePrice + upsellsTotal;
    }, 0);

    const averageCheck = totalVisits > 0 ? Math.round(totalRevenue / totalVisits) : 0;

    return {
      totalVisits,
      averageCheck,
      totalSpent: totalRevenue,
    };
  }

  async getClientAppointments(
    id: string,
    upcomingOnly: boolean = false,
    userRole?: string,
    userStudioId?: string,
    userOrganizationId?: string,
    organizationIdQuery?: string,
  ) {
    const client = await this.prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    await this.assertClientInOrganizationContext(
      client.organizationId,
      userRole,
      userOrganizationId,
      organizationIdQuery,
    );

    // Check access (клиенты общие для всех салонов)
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      if (userRole === UserRole.ADMIN && !userStudioId) {
        throw new ForbiddenException('Access denied to this client');
      }
      if (userRole === UserRole.MASTER) {
        throw new ForbiddenException('Masters cannot update clients');
      }
    }

    const where: any = {
      clientId: id,
    };

    // If upcomingOnly, filter by future dates and specific statuses
    if (upcomingOnly) {
      where.startAt = {
        gte: new Date(),
      };
      where.status = {
        in: ['BOOKED', 'ARRIVED'],
      };
    }

    return this.prisma.appointment.findMany({
      where,
      include: {
        staff: {
          include: {
            staffProfile: true,
          },
        },
        service: true,
        arrivedByUser: {
          select: {
            id: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: {
        startAt: upcomingOnly ? 'asc' : 'desc',
      },
    });
  }

  async getBonusHistory(
    clientId: string,
    userRole?: string,
    userStudioId?: string,
    userOrganizationId?: string,
    organizationIdQuery?: string,
  ) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, organizationId: true },
    });
    if (!client) throw new NotFoundException(`Client with ID ${clientId} not found`);

    await this.assertClientInOrganizationContext(
      client.organizationId,
      userRole,
      userOrganizationId,
      organizationIdQuery,
    );

    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      if (userRole === UserRole.ADMIN && !userStudioId) {
        throw new ForbiddenException('Access denied to this client');
      }
      if (userRole === UserRole.MASTER) throw new ForbiddenException('Access denied');
    }
    return this.prisma.bonusHistoryEntry.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async bonusAdjustment(
    clientId: string,
    dto: { amount: number; comment?: string },
    userId: string,
    userRole?: string,
    userStudioId?: string,
    userOrganizationId?: string,
    organizationIdQuery?: string,
  ) {
    if (!isOwnerLevelRole(userRole)) {
      throw new ForbiddenException('Only owner level role can manually adjust bonus balance');
    }
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, bonuses: true, organizationId: true },
    });
    if (!client) throw new NotFoundException(`Client with ID ${clientId} not found`);

    await this.assertClientInOrganizationContext(
      client.organizationId,
      userRole,
      userOrganizationId,
      organizationIdQuery,
    );
    const newBalance = client.bonuses + dto.amount;
    if (newBalance < 0) {
      throw new BadRequestException('Adjustment would result in negative bonus balance');
    }
    await this.prisma.$transaction([
      this.prisma.client.update({
        where: { id: clientId },
        data: { bonuses: newBalance },
      }),
      this.prisma.bonusHistoryEntry.create({
        data: {
          id: generateId(IdPrefix.BonusHistoryEntry),
          clientId,
          organizationId: client.organizationId,
          amount: dto.amount,
          type: 'MANUAL_ADJUSTMENT',
          performedByUserId: userId,
          comment: dto.comment ?? null,
        },
      }),
    ]);
    return this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, bonuses: true },
    });
  }

  /**
   * Полное удаление клиента из БД. Доступно только DEVELOPER.
   * В отличие от обычных действий с клиентом, запись удаляется физически.
   */
  async hardDelete(clientId: string, actorRole?: string) {
    if (!isDeveloperRole(actorRole)) {
      throw new ForbiddenException('Only DEVELOPER can hard delete clients');
    }
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }
    await this.prisma.client.delete({ where: { id: clientId } });
    return { success: true };
  }
}




