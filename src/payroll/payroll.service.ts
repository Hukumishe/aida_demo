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
  UserRole,
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
    serviceItemId?: string;
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

  private assertCanViewSettings(
    staffUserId: string,
    userRole?: string,
    userId?: string,
  ) {
    if (userRole === RoleEnum.OWNER || isDeveloperRole(userRole)) {
      return;
    }
    if (userRole === RoleEnum.MASTER && userId === staffUserId) {
      return;
    }
    throw new ForbiddenException('Нет доступа к настройкам зарплаты этого сотрудника');
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
    if (
      userRole === RoleEnum.OWNER ||
      isDeveloperRole(userRole)
    ) {
      return requestedStaffUserId;
    }
    throw new ForbiddenException('Нет доступа к отчёту по зарплате');
  }

  async getSettings(
    organizationId: string,
    staffUserId: string,
    userRole?: string,
    userOrganizationId?: string,
    userId?: string,
  ) {
    this.assertCanViewSettings(staffUserId, userRole, userId);
    assertUserOrganizationMatchesOrganizationId(
      organizationId,
      userOrganizationId,
      userRole,
    );
    await this.assertStaffInOrganization(organizationId, staffUserId);

    const settings = await this.prisma.staffPayrollSettings.findUnique({
      where: { staffUserId },
    });
    const categoryRates = await this.prisma.staffPayrollCategoryRate.findMany({
      where: { organizationId, staffUserId },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { category: { name: 'asc' } },
    });
    const serviceRates = await this.prisma.staffPayrollServiceRate.findMany({
      where: { organizationId, staffUserId },
      include: { service: { select: { id: true, name: true } } },
      orderBy: { service: { name: 'asc' } },
    });

    return {
      organizationId,
      staffUserId,
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

  async upsertSettings(
    organizationId: string,
    staffUserId: string,
    dto: UpsertPayrollSettingsDto,
    userRole?: string,
    userOrganizationId?: string,
    userId?: string,
  ) {
    this.assertCanManageSettings(userRole);
    assertUserOrganizationMatchesOrganizationId(
      organizationId,
      userOrganizationId,
      userRole,
    );
    await this.assertStaffInOrganization(organizationId, staffUserId);

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
      await this.validateServiceRates(organizationId, staffUserId, serviceRates);
    }

    const unifiedPercent =
      dto.rateMode === StaffPayrollRateMode.UNIFIED
        ? clampPercent(dto.unifiedPercent ?? 0)
        : 0;

    await this.prisma.$transaction(async (tx) => {
      await tx.staffPayrollSettings.upsert({
        where: { staffUserId },
        create: {
          staffUserId,
          organizationId,
          rateMode: dto.rateMode,
          baseMode: dto.baseMode,
          unifiedPercent,
        },
        update: {
          organizationId,
          rateMode: dto.rateMode,
          baseMode: dto.baseMode,
          unifiedPercent,
        },
      });

      await tx.staffPayrollCategoryRate.deleteMany({
        where: { staffUserId },
      });
      await tx.staffPayrollServiceRate.deleteMany({
        where: { staffUserId },
      });

      if (dto.rateMode === StaffPayrollRateMode.BY_CATEGORY && categoryRates.length > 0) {
        await tx.staffPayrollCategoryRate.createMany({
          data: categoryRates.map((r) => ({
            id: generateId(IdPrefix.StaffPayrollCategoryRate),
            organizationId,
            staffUserId,
            categoryId: r.categoryId,
            percent: clampPercent(r.percent),
          })),
        });
      }

      if (dto.rateMode === StaffPayrollRateMode.BY_SERVICE && serviceRates.length > 0) {
        await tx.staffPayrollServiceRate.createMany({
          data: serviceRates.map((r) => ({
            id: generateId(IdPrefix.StaffPayrollServiceRate),
            organizationId,
            staffUserId,
            serviceId: r.serviceId,
            percent: clampPercent(r.percent),
          })),
        });
      }
    });

    return this.getSettings(
      organizationId,
      staffUserId,
      userRole,
      userOrganizationId,
      userId,
    );
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
    staffUserId: string,
    tx?: Tx,
  ): Promise<PayrollSettingsSnapshot | null> {
    const db = tx ?? this.prisma;
    const settings = await db.staffPayrollSettings.findUnique({
      where: { staffUserId },
    });
    if (!settings) {
      return null;
    }

    const [categoryRates, serviceRates] = await Promise.all([
      db.staffPayrollCategoryRate.findMany({ where: { staffUserId } }),
      db.staffPayrollServiceRate.findMany({ where: { staffUserId } }),
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
    const settings = await this.loadSettingsSnapshot(input.staffUserId, tx);
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
      include: { staffProfile: true },
    });
    if (!user) {
      throw new NotFoundException('Сотрудник не найден в организации');
    }
    const payrollRoles: UserRole[] = [
      UserRole.MASTER,
      UserRole.ADMIN,
      UserRole.MANAGER,
    ];
    if (!payrollRoles.includes(user.role) && user.role !== UserRole.OWNER) {
      throw new BadRequestException(
        'Настройки зарплаты доступны для мастеров и сотрудников филиала',
      );
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
    staffUserId: string,
    rates: { serviceId: string; percent: number }[],
  ) {
    const ids = [...new Set(rates.map((r) => r.serviceId))];
    const services = await this.prisma.service.findMany({
      where: { organizationId, id: { in: ids } },
      select: { id: true },
    });
    if (services.length !== ids.length) {
      throw new BadRequestException('Одна или несколько услуг не принадлежат организации');
    }

    const staffServiceCount = await this.prisma.staffService.count({
      where: { staffUserId, serviceId: { in: ids } },
    });
    if (staffServiceCount !== ids.length) {
      throw new BadRequestException(
        'Процент по услуге можно задать только для услуг, которые оказывает сотрудник',
      );
    }
  }
}
