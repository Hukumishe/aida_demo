import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  StaffPayrollBaseMode,
  StaffPayrollLineType,
  StaffPayrollRateMode,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { generateId, IdPrefix } from '../common/id-generator';
import { assertUserOrganizationMatchesOrganizationId } from '../common/organization-scope';
import {
  isDeveloperRole,
  UserRole as RoleEnum,
} from '../common/decorators/roles.decorator';
import { UpsertPayrollSettingsDto } from './dto/upsert-payroll-settings.dto';
import {
  buildPayrollAccrualRows,
  clampPercent,
  PayrollLineInput,
  PayrollSettingsSnapshot,
} from './payroll-calculation.util';
import {
  PAYROLL_BASE_MODE_LABELS,
  PAYROLL_LINE_TYPE_LABELS,
  PAYROLL_RATE_MODE_LABELS,
} from './payroll.constants';

type Tx = Prisma.TransactionClient;

export type AccruePayrollVisitInput = {
  organizationId: string;
  staffUserId: string;
  appointmentId: string;
  studioId: string;
  appointmentStartAt: Date;
  grossTotal: number;
  discountedTotal: number;
  primaryLines: Array<{
    lineRef: string;
    serviceId: string;
    serviceName: string;
    categoryId: string;
    categoryName: string;
    grossAmount: number;
  }>;
  upsellLines: Array<{
    upsellId: string;
    serviceId: string;
    serviceName: string;
    categoryId: string;
    categoryName: string;
    grossAmount: number;
  }>;
};

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  private assertCanManageSettings(userRole?: string) {
    if (userRole === RoleEnum.OWNER || isDeveloperRole(userRole)) {
      return;
    }
    throw new ForbiddenException(
      'Настройки зарплаты может изменять только владелец или разработчик',
    );
  }

  private assertCanViewOrgSettings(userRole?: string) {
    if (
      userRole === RoleEnum.OWNER ||
      isDeveloperRole(userRole) ||
      userRole === RoleEnum.MASTER
    ) {
      return;
    }
    throw new ForbiddenException('Нет доступа к настройкам зарплаты организации');
  }

  private resolveReportStaffUserId(
    userRole?: string,
    userId?: string,
    requestedStaffUserId?: string,
  ): string | undefined {
    if (userRole === RoleEnum.MASTER) {
      if (!userId) {
        throw new ForbiddenException('Нет доступа к отчёту по зарплате');
      }
      if (requestedStaffUserId && requestedStaffUserId !== userId) {
        throw new ForbiddenException('Мастер может просматривать только свою зарплату');
      }
      return userId;
    }
    if (userRole === RoleEnum.OWNER || isDeveloperRole(userRole)) {
      return requestedStaffUserId;
    }
    throw new ForbiddenException('Нет доступа к отчёту по зарплате');
  }

  private async fetchSettingsPayload(organizationId: string) {
    const settings = await this.prisma.organizationPayrollSettings.findUnique({
      where: { organizationId },
    });
    const categoryRates = await this.prisma.organizationPayrollCategoryRate.findMany({
      where: { organizationId },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { category: { name: 'asc' } },
    });
    const serviceRates = await this.prisma.organizationPayrollServiceRate.findMany({
      where: { organizationId },
      include: { service: { select: { id: true, name: true } } },
      orderBy: { service: { name: 'asc' } },
    });

    return {
      organizationId,
      configured: !!settings,
      settings: settings
        ? {
            rateMode: settings.rateMode,
            rateModeLabel: PAYROLL_RATE_MODE_LABELS[settings.rateMode],
            baseMode: settings.baseMode,
            baseModeLabel: PAYROLL_BASE_MODE_LABELS[settings.baseMode],
            unifiedPercent: settings.unifiedPercent,
          }
        : null,
      categoryRates: categoryRates.map((r) => ({
        categoryId: r.categoryId,
        categoryName: r.category.name,
        percent: r.percent,
      })),
      serviceRates: serviceRates.map((r) => ({
        serviceId: r.serviceId,
        serviceName: r.service.name,
        percent: r.percent,
      })),
    };
  }

  async getSettings(
    organizationId: string,
    userRole?: string,
    userOrganizationId?: string,
  ) {
    this.assertCanViewOrgSettings(userRole);
    assertUserOrganizationMatchesOrganizationId(
      organizationId,
      userOrganizationId,
      userRole,
    );
    return this.fetchSettingsPayload(organizationId);
  }

  /**
   * Карточка мастера: общие ставки организации + отчёт по этому мастеру за период.
   */
  async getStaffPayrollView(
    organizationId: string,
    staffUserId: string,
    query: { from: string; to: string; studioId?: string },
    userRole?: string,
    userOrganizationId?: string,
    userId?: string,
  ) {
    assertUserOrganizationMatchesOrganizationId(
      organizationId,
      userOrganizationId,
      userRole,
    );
    await this.assertStaffInOrganization(organizationId, staffUserId);

    if (userRole === RoleEnum.MASTER && userId !== staffUserId) {
      throw new ForbiddenException('Нет доступа к зарплате другого сотрудника');
    }

    const [organizationPayroll, report] = await Promise.all([
      this.getSettings(organizationId, userRole, userOrganizationId),
      this.getReport(
        organizationId,
        { ...query, staffUserId },
        userRole,
        userOrganizationId,
        userId,
      ),
    ]);

    return {
      staffUserId,
      organizationPayroll,
      report,
    };
  }

  async upsertSettings(
    organizationId: string,
    dto: UpsertPayrollSettingsDto,
    userRole?: string,
    userOrganizationId?: string,
  ) {
    this.assertCanManageSettings(userRole);
    assertUserOrganizationMatchesOrganizationId(
      organizationId,
      userOrganizationId,
      userRole,
    );

    if (dto.rateMode === StaffPayrollRateMode.UNIFIED) {
      if (dto.unifiedPercent == null) {
        throw new BadRequestException('unifiedPercent обязателен для режима UNIFIED');
      }
    }

    const categoryRates = dto.categoryRates ?? [];
    const serviceRates = dto.serviceRates ?? [];

    if (dto.rateMode === StaffPayrollRateMode.BY_CATEGORY) {
      await this.validateCategoryRates(organizationId, categoryRates);
    }
    if (dto.rateMode === StaffPayrollRateMode.BY_SERVICE) {
      await this.validateServiceRates(organizationId, serviceRates);
    }

    const unifiedPercent =
      dto.rateMode === StaffPayrollRateMode.UNIFIED
        ? clampPercent(dto.unifiedPercent ?? 0)
        : 0;

    await this.prisma.$transaction(async (tx) => {
      await tx.organizationPayrollSettings.upsert({
        where: { organizationId },
        create: {
          organizationId,
          rateMode: dto.rateMode,
          baseMode: dto.baseMode,
          unifiedPercent,
        },
        update: {
          rateMode: dto.rateMode,
          baseMode: dto.baseMode,
          unifiedPercent,
        },
      });

      await tx.organizationPayrollCategoryRate.deleteMany({
        where: { organizationId },
      });
      await tx.organizationPayrollServiceRate.deleteMany({
        where: { organizationId },
      });

      if (dto.rateMode === StaffPayrollRateMode.BY_CATEGORY && categoryRates.length > 0) {
        await tx.organizationPayrollCategoryRate.createMany({
          data: categoryRates.map((r) => ({
            id: generateId(IdPrefix.StaffPayrollCategoryRate),
            organizationId,
            categoryId: r.categoryId,
            percent: clampPercent(r.percent),
          })),
        });
      }

      if (dto.rateMode === StaffPayrollRateMode.BY_SERVICE && serviceRates.length > 0) {
        await tx.organizationPayrollServiceRate.createMany({
          data: serviceRates.map((r) => ({
            id: generateId(IdPrefix.StaffPayrollServiceRate),
            organizationId,
            serviceId: r.serviceId,
            percent: clampPercent(r.percent),
          })),
        });
      }
    });

    return this.getSettings(organizationId, userRole, userOrganizationId);
  }

  async getReport(
    organizationId: string,
    query: { from: string; to: string; staffUserId?: string; studioId?: string },
    userRole?: string,
    userOrganizationId?: string,
    userId?: string,
  ) {
    assertUserOrganizationMatchesOrganizationId(
      organizationId,
      userOrganizationId,
      userRole,
    );

    const staffUserId = this.resolveReportStaffUserId(
      userRole,
      userId,
      query.staffUserId,
    );

    const from = new Date(query.from);
    const to = new Date(query.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Некорректный период');
    }
    if (to < from) {
      throw new BadRequestException('Дата «по» должна быть не раньше «с»');
    }

    if (staffUserId) {
      await this.assertStaffInOrganization(organizationId, staffUserId);
    }

    const where: Prisma.StaffPayrollAccrualWhereInput = {
      organizationId,
      createdAt: { gte: from, lte: to },
      ...(staffUserId ? { staffUserId } : {}),
      ...(query.studioId ? { studioId: query.studioId } : {}),
    };

    const rows = await this.prisma.staffPayrollAccrual.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { appointmentStartAt: 'asc' }],
      include: {
        staff: {
          select: {
            id: true,
            staffProfile: { select: { firstName: true, lastName: true } },
          },
        },
        appointment: {
          select: {
            id: true,
            startAt: true,
            client: { select: { firstName: true, lastName: true } },
          },
        },
        studio: { select: { id: true, name: true } },
      },
    });

    const byStaff = new Map<
      string,
      {
        staffUserId: string;
        staffName: string;
        totalCommission: number;
        lines: typeof rows;
      }
    >();

    let totalCommission = 0;
    for (const row of rows) {
      totalCommission += row.commissionAmount;
      const name =
        `${row.staff.staffProfile?.firstName ?? ''} ${row.staff.staffProfile?.lastName ?? ''}`.trim() ||
        row.staffUserId;
      const bucket = byStaff.get(row.staffUserId) ?? {
        staffUserId: row.staffUserId,
        staffName: name,
        totalCommission: 0,
        lines: [] as typeof rows,
      };
      bucket.totalCommission += row.commissionAmount;
      bucket.lines.push(row);
      byStaff.set(row.staffUserId, bucket);
    }

    const viewScope =
      userRole === RoleEnum.MASTER ? ('self' as const) : ('organization' as const);

    return {
      organizationId,
      from: from.toISOString(),
      to: to.toISOString(),
      viewScope,
      staffUserId: staffUserId ?? null,
      totalCommission,
      staff: Array.from(byStaff.values()).map((s) => ({
        staffUserId: s.staffUserId,
        staffName: s.staffName,
        totalCommission: s.totalCommission,
        items: s.lines.map((r) => this.mapAccrualRow(r)),
      })),
      items: rows.map((r) => this.mapAccrualRow(r)),
    };
  }

  private mapAccrualRow(r: {
    id: string;
    staffUserId: string;
    appointmentId: string;
    appointmentStartAt: Date;
    studioId: string;
    lineType: StaffPayrollLineType;
    serviceId: string;
    serviceName: string;
    categoryId: string | null;
    categoryName: string | null;
    grossLineAmount: number;
    baseAmount: number;
    percent: number;
    commissionAmount: number;
    baseMode: StaffPayrollBaseMode;
    rateMode: StaffPayrollRateMode;
    createdAt: Date;
    staff: {
      staffProfile: { firstName: string; lastName: string | null } | null;
    };
    appointment: {
      client: { firstName: string; lastName: string | null };
    } | null;
    studio: { name: string };
  }) {
    const clientName = r.appointment?.client
      ? `${r.appointment.client.firstName} ${r.appointment.client.lastName ?? ''}`.trim()
      : '';
    const staffName =
      `${r.staff.staffProfile?.firstName ?? ''} ${r.staff.staffProfile?.lastName ?? ''}`.trim() ||
      r.staffUserId;

    return {
      id: r.id,
      staffUserId: r.staffUserId,
      staffName,
      appointmentId: r.appointmentId,
      appointmentStartAt: r.appointmentStartAt,
      studioId: r.studioId,
      studioName: r.studio.name,
      clientName,
      lineType: r.lineType,
      lineTypeLabel: PAYROLL_LINE_TYPE_LABELS[r.lineType],
      serviceId: r.serviceId,
      serviceName: r.serviceName,
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      grossLineAmount: r.grossLineAmount,
      baseAmount: r.baseAmount,
      percent: r.percent,
      commissionAmount: r.commissionAmount,
      baseMode: r.baseMode,
      baseModeLabel: PAYROLL_BASE_MODE_LABELS[r.baseMode],
      rateMode: r.rateMode,
      rateModeLabel: PAYROLL_RATE_MODE_LABELS[r.rateMode],
      createdAt: r.createdAt,
    };
  }

  async loadSettingsSnapshot(
    organizationId: string,
    tx?: Tx,
  ): Promise<PayrollSettingsSnapshot | null> {
    const db = tx ?? this.prisma;
    const settings = await db.organizationPayrollSettings.findUnique({
      where: { organizationId },
    });
    if (!settings) {
      return null;
    }

    const [categoryRates, serviceRates] = await Promise.all([
      db.organizationPayrollCategoryRate.findMany({ where: { organizationId } }),
      db.organizationPayrollServiceRate.findMany({ where: { organizationId } }),
    ]);

    return {
      rateMode: settings.rateMode,
      baseMode: settings.baseMode,
      unifiedPercent: settings.unifiedPercent,
      categoryPercents: new Map(categoryRates.map((r) => [r.categoryId, r.percent])),
      servicePercents: new Map(serviceRates.map((r) => [r.serviceId, r.percent])),
    };
  }

  async accrueForCompletedVisit(input: AccruePayrollVisitInput, tx: Tx): Promise<void> {
    const settings = await this.loadSettingsSnapshot(input.organizationId, tx);
    if (!settings) {
      return;
    }

    const lines: PayrollLineInput[] = [
      ...input.primaryLines.map((p) => ({
        lineRef: p.lineRef,
        lineType: StaffPayrollLineType.PRIMARY_SERVICE,
        serviceId: p.serviceId,
        serviceName: p.serviceName,
        categoryId: p.categoryId,
        categoryName: p.categoryName,
        grossAmount: p.grossAmount,
      })),
      ...input.upsellLines.map((u) => ({
        lineRef: `ups_${u.upsellId}`,
        lineType: StaffPayrollLineType.UPSELL,
        serviceId: u.serviceId,
        serviceName: u.serviceName,
        categoryId: u.categoryId,
        categoryName: u.categoryName,
        grossAmount: u.grossAmount,
      })),
    ];

    if (lines.length === 0) {
      return;
    }

    const accrualRows = buildPayrollAccrualRows(
      settings,
      lines,
      input.grossTotal,
      input.discountedTotal,
    ).filter((r) => r.percent > 0 && r.commissionAmount > 0);

    if (accrualRows.length === 0) {
      return;
    }

    for (const row of accrualRows) {
      await tx.staffPayrollAccrual.create({
        data: {
          id: generateId(IdPrefix.StaffPayrollAccrual),
          organizationId: input.organizationId,
          staffUserId: input.staffUserId,
          appointmentId: input.appointmentId,
          studioId: input.studioId,
          lineRef: row.line.lineRef,
          lineType: row.line.lineType,
          serviceId: row.line.serviceId,
          serviceName: row.line.serviceName,
          categoryId: row.line.categoryId,
          categoryName: row.line.categoryName,
          grossLineAmount: row.grossLineAmount,
          baseAmount: row.baseAmount,
          percent: row.percent,
          commissionAmount: row.commissionAmount,
          baseMode: settings.baseMode,
          rateMode: settings.rateMode,
          appointmentStartAt: input.appointmentStartAt,
        },
      });
    }
  }

  private async assertStaffInOrganization(organizationId: string, staffUserId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: staffUserId, organizationId },
    });
    if (!user) {
      throw new NotFoundException('Сотрудник не найден в организации');
    }
  }

  private async validateCategoryRates(
    organizationId: string,
    rates: { categoryId: string; percent: number }[],
  ) {
    const ids = [...new Set(rates.map((r) => r.categoryId))];
    const count = await this.prisma.serviceCategory.count({
      where: { organizationId, id: { in: ids } },
    });
    if (count !== ids.length) {
      throw new BadRequestException('Одна или несколько категорий не принадлежат организации');
    }
  }

  private async validateServiceRates(
    organizationId: string,
    rates: { serviceId: string; percent: number }[],
  ) {
    const ids = [...new Set(rates.map((r) => r.serviceId))];
    const count = await this.prisma.service.count({
      where: { organizationId, id: { in: ids } },
    });
    if (count !== ids.length) {
      throw new BadRequestException('Одна или несколько услуг не принадлежат организации');
    }
  }
}
