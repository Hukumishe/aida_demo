import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TargetPromoMechanicsType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { generateId, IdPrefix } from '../common/id-generator';
import {
  isDeveloperRole,
  canManageMarketingContent,
} from '../common/decorators/roles.decorator';
import { CreateTargetPromoDto } from './dto/create-target-promo.dto';
import { UpdateTargetPromoDto } from './dto/update-target-promo.dto';
import { normalizeTargetPromoText } from './target-promo-text.util';

import {
  buildTargetPromoMechanicsPayload,
  TargetPromoActivationStatus,
} from './target-promo-nextbot.constants';

@Injectable()
export class TargetPromoService {
  constructor(private readonly prisma: PrismaService) {}

  private assertCanManage(role?: string) {
    if (!canManageMarketingContent(role)) {
      throw new ForbiddenException(
        'Промокоды Target может настраивать владелец сети, маркетолог или разработчик',
      );
    }
  }

  async resolveOrganizationId(
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
    return userOrganizationId.trim();
  }

  private validateMechanics(dto: {
    mechanicsType?: TargetPromoMechanicsType;
    discountPercent?: number | null;
    bonusPoints?: number | null;
  }) {
    const type = dto.mechanicsType ?? TargetPromoMechanicsType.INSTRUCTIONS_ONLY;
    if (type === TargetPromoMechanicsType.DISCOUNT_PERCENT) {
      if (dto.discountPercent == null || dto.discountPercent < 1 || dto.discountPercent > 100) {
        throw new BadRequestException('Для скидки укажите discountPercent от 1 до 100');
      }
    }
    if (type === TargetPromoMechanicsType.BONUS_POINTS) {
      if (dto.bonusPoints == null || dto.bonusPoints < 1) {
        throw new BadRequestException('Для бонусов укажите bonusPoints ≥ 1');
      }
    }
  }

  private mapPromoRow(row: {
    id: string;
    title: string;
    promoText: string;
    isActive: boolean;
    validFrom: Date | null;
    validUntil: Date | null;
    mechanicsType: TargetPromoMechanicsType;
    discountPercent: number | null;
    bonusPoints: number | null;
    mechanicsNote: string | null;
    agentPrompt: string;
    maxActivations: number | null;
    activationCount: number;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      title: row.title,
      promoText: row.promoText,
      isActive: row.isActive,
      validFrom: row.validFrom,
      validUntil: row.validUntil,
      mechanicsType: row.mechanicsType,
      discountPercent: row.discountPercent,
      bonusPoints: row.bonusPoints,
      mechanicsNote: row.mechanicsNote,
      agentPrompt: row.agentPrompt,
      maxActivations: row.maxActivations,
      activationCount: row.activationCount,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private isPromoCurrentlyValid(row: {
    isActive: boolean;
    validFrom: Date | null;
    validUntil: Date | null;
  }): boolean {
    if (!row.isActive) return false;
    const now = new Date();
    if (row.validFrom && row.validFrom > now) return false;
    if (row.validUntil && row.validUntil <= now) return false;
    return true;
  }

  async listForOrganization(
    organizationId: string,
    userRole?: string,
    includeInactive = true,
  ) {
    this.assertCanManage(userRole);
    const rows = await this.prisma.targetPromo.findMany({
      where: {
        organizationId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map((r) => this.mapPromoRow(r));
  }

  /** Список для get_company_context (только активные и в сроке). */
  async listActiveForNextbotContext(organizationId: string) {
    const now = new Date();
    const rows = await this.prisma.targetPromo.findMany({
      where: {
        organizationId,
        isActive: true,
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
          { OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
        ],
      },
      select: {
        id: true,
        promoText: true,
        title: true,
        mechanicsType: true,
        discountPercent: true,
        bonusPoints: true,
        mechanicsNote: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { promoText: 'asc' }],
    });
    const items = rows.map((r) => ({
      id: r.id,
      promoText: r.promoText,
      title: r.title,
      mechanics: buildTargetPromoMechanicsPayload(r),
    }));
    return {
      targetPromos: items,
      /** Список строк для сопоставления с сообщением клиента (как в ТЗ «promo_text»). */
      promoText: items.map((i) => i.promoText),
    };
  }

  async create(
    organizationId: string,
    dto: CreateTargetPromoDto,
    userRole?: string,
  ) {
    this.assertCanManage(userRole);
    const promoText = dto.promoText.trim();
    const promoTextNormalized = normalizeTargetPromoText(promoText);
    if (!promoTextNormalized) {
      throw new BadRequestException('promoText не может быть пустым');
    }
    this.validateMechanics(dto);

    const mechanicsType = dto.mechanicsType ?? TargetPromoMechanicsType.INSTRUCTIONS_ONLY;

    try {
      const created = await this.prisma.targetPromo.create({
        data: {
          id: generateId(IdPrefix.TargetPromo),
          organizationId,
          title: dto.title.trim(),
          promoText,
          promoTextNormalized,
          isActive: dto.isActive ?? true,
          validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
          validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
          mechanicsType,
          discountPercent:
            mechanicsType === TargetPromoMechanicsType.DISCOUNT_PERCENT
              ? dto.discountPercent ?? null
              : null,
          bonusPoints:
            mechanicsType === TargetPromoMechanicsType.BONUS_POINTS
              ? dto.bonusPoints ?? null
              : null,
          mechanicsNote: dto.mechanicsNote?.trim() || null,
          agentPrompt: dto.agentPrompt.trim(),
          maxActivations: dto.maxActivations ?? null,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
      return this.mapPromoRow(created);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException(
          'Промотекст с таким текстом уже существует в этой организации',
        );
      }
      throw e;
    }
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateTargetPromoDto,
    userRole?: string,
  ) {
    this.assertCanManage(userRole);
    const existing = await this.prisma.targetPromo.findFirst({
      where: { id, organizationId },
    });
    if (!existing) {
      throw new NotFoundException('Промокод Target не найден');
    }

    const nextMechanicsType = dto.mechanicsType ?? existing.mechanicsType;
    this.validateMechanics({
      mechanicsType: nextMechanicsType,
      discountPercent:
        dto.discountPercent !== undefined ? dto.discountPercent : existing.discountPercent,
      bonusPoints: dto.bonusPoints !== undefined ? dto.bonusPoints : existing.bonusPoints,
    });

    let promoText = existing.promoText;
    let promoTextNormalized = existing.promoTextNormalized;
    if (dto.promoText !== undefined) {
      promoText = dto.promoText.trim();
      promoTextNormalized = normalizeTargetPromoText(promoText);
      if (!promoTextNormalized) {
        throw new BadRequestException('promoText не может быть пустым');
      }
    }

    try {
      const updated = await this.prisma.targetPromo.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title.trim() }),
          ...(dto.promoText !== undefined && { promoText, promoTextNormalized }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.validFrom !== undefined && {
            validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
          }),
          ...(dto.validUntil !== undefined && {
            validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
          }),
          ...(dto.mechanicsType !== undefined && { mechanicsType: dto.mechanicsType }),
          ...(dto.discountPercent !== undefined && {
            discountPercent: dto.discountPercent,
          }),
          ...(dto.bonusPoints !== undefined && { bonusPoints: dto.bonusPoints }),
          ...(dto.mechanicsNote !== undefined && {
            mechanicsNote: dto.mechanicsNote?.trim() || null,
          }),
          ...(dto.agentPrompt !== undefined && { agentPrompt: dto.agentPrompt.trim() }),
          ...(dto.maxActivations !== undefined && { maxActivations: dto.maxActivations }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        },
      });
      return this.mapPromoRow(updated);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException(
          'Промотекст с таким текстом уже существует в этой организации',
        );
      }
      throw e;
    }
  }

  async remove(organizationId: string, id: string, userRole?: string) {
    this.assertCanManage(userRole);
    const existing = await this.prisma.targetPromo.findFirst({
      where: { id, organizationId },
    });
    if (!existing) {
      throw new NotFoundException('Промокод Target не найден');
    }
    await this.prisma.targetPromo.delete({ where: { id } });
    return { success: true };
  }

  async listActivations(
    organizationId: string,
    targetPromoId: string | undefined,
    userRole: string | undefined,
    limit = 50,
  ) {
    this.assertCanManage(userRole);
    const take = Math.min(200, Math.max(1, limit));
    return this.prisma.targetPromoActivation.findMany({
      where: {
        organizationId,
        ...(targetPromoId ? { targetPromoId } : {}),
      },
      include: {
        targetPromo: { select: { id: true, title: true, promoText: true } },
        client: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  private phoneDigits(raw: string | undefined): string {
    return String(raw ?? '').replace(/\D/g, '');
  }

  private async findClientByPhone(organizationId: string, phone?: string) {
    const digits = this.phoneDigits(phone);
    if (!digits) return null;
    const candidates = [digits];
    if (digits.length === 11 && digits.startsWith('8')) {
      candidates.push('7' + digits.slice(1));
    }
    if (digits.length === 11 && digits.startsWith('7')) {
      candidates.push('8' + digits.slice(1));
    }
    for (const candidate of candidates) {
      const client = await this.prisma.client.findFirst({
        where: { organizationId, phone: candidate, isBlacklisted: false },
        select: { id: true, bonuses: true, loyaltyEnabled: true },
      });
      if (client) return client;
    }
    return null;
  }

  private async resolvePromo(
    organizationId: string,
    promoId?: string,
    promoText?: string,
  ) {
    if (promoId?.trim()) {
      const row = await this.prisma.targetPromo.findFirst({
        where: { id: promoId.trim(), organizationId },
      });
      if (!row) return null;
      return row;
    }
    const normalized = normalizeTargetPromoText(promoText ?? '');
    if (!normalized) return null;
    return this.prisma.targetPromo.findUnique({
      where: {
        organizationId_promoTextNormalized: {
          organizationId,
          promoTextNormalized: normalized,
        },
      },
    });
  }

  /**
   * Срабатывание промо из Nextbot (target_promo).
   * Возвращает payload без поля target_promo — его добавляет NextbotService через withNextbotPrompt.
   */
  async activateForNextbot(
    organizationId: string,
    params: {
      promoId?: string;
      promoText?: string;
      phone?: string;
      dialogId?: number;
    },
  ) {
    if (!params.promoId?.trim() && !params.promoText?.trim()) {
      throw new BadRequestException('Укажите promoText или promoId');
    }

    const promo = await this.resolvePromo(
      organizationId,
      params.promoId,
      params.promoText,
    );

    if (!promo || !this.isPromoCurrentlyValid(promo)) {
      return {
        status: TargetPromoActivationStatus.NOT_MATCHED,
        matched: false,
        promoId: null,
        promoText: params.promoText?.trim() || null,
        title: null,
        mechanics: null,
        clientId: null,
        clientFound: false,
        bonusGranted: null,
        promptFallback: null,
      };
    }

    if (
      promo.maxActivations != null &&
      promo.activationCount >= promo.maxActivations
    ) {
      return {
        status: TargetPromoActivationStatus.EXHAUSTED,
        matched: false,
        promoId: promo.id,
        promoText: promo.promoText,
        title: promo.title,
        mechanics: null,
        clientId: null,
        clientFound: false,
        bonusGranted: null,
        promptFallback: null,
      };
    }

    const client = await this.findClientByPhone(organizationId, params.phone);
    const dialogId = params.dialogId;

    const mechanics: Record<string, unknown> = {
      type: promo.mechanicsType,
      note: promo.mechanicsNote,
    };
    if (promo.discountPercent != null) {
      mechanics.discountPercent = promo.discountPercent;
    }
    if (promo.bonusPoints != null) {
      mechanics.bonusPoints = promo.bonusPoints;
    }

    let bonusGranted: number | null = null;

    await this.prisma.$transaction(async (tx) => {
      if (
        client &&
        promo.mechanicsType === TargetPromoMechanicsType.BONUS_POINTS &&
        promo.bonusPoints != null &&
        promo.bonusPoints > 0 &&
        client.loyaltyEnabled !== false
      ) {
        await tx.client.update({
          where: { id: client.id },
          data: { bonuses: { increment: promo.bonusPoints } },
        });
        bonusGranted = promo.bonusPoints;
      }

      if (client && dialogId != null) {
        await tx.client.updateMany({
          where: { id: client.id, organizationId },
          data: { nextbotDialogId: dialogId },
        });
      }

      await tx.targetPromoActivation.create({
        data: {
          id: generateId(IdPrefix.TargetPromoActivation),
          targetPromoId: promo.id,
          organizationId,
          clientId: client?.id ?? null,
          phone: params.phone?.trim() || null,
          dialogId: dialogId ?? null,
        },
      });

      await tx.targetPromo.update({
        where: { id: promo.id },
        data: { activationCount: { increment: 1 } },
      });
    });

    return {
      status: TargetPromoActivationStatus.MATCHED,
      matched: true,
      promoId: promo.id,
      promoText: promo.promoText,
      title: promo.title,
      mechanics,
      clientId: client?.id ?? null,
      clientFound: !!client,
      bonusGranted,
      promptFallback: promo.agentPrompt,
    };
  }
}
