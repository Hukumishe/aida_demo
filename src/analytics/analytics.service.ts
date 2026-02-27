import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UserRole, isOwnerLevelRole } from '../common/decorators/roles.decorator';
import { AppointmentStatus } from '@prisma/client';
import { AnalyticsPeriod, ServiceSalesQueryDto } from './dto/service-sales-query.dto';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  private getDateRange(
    startDate?: string,
    endDate?: string,
    period?: AnalyticsPeriod,
  ): { start: Date; end: Date } {
    const now = new Date();
    let start: Date;
    let end: Date;

    if (startDate && endDate) {
      start = new Date(startDate + 'T00:00:00.000Z');
      end = new Date(endDate + 'T23:59:59.999Z');
      if (start > end) throw new BadRequestException('startDate must be before or equal to endDate');
    } else if (endDate) {
      end = new Date(endDate + 'T23:59:59.999Z');
      start = new Date(end);
      start.setUTCMonth(start.getUTCMonth() - 12);
      start.setUTCDate(1);
      start.setUTCHours(0, 0, 0, 0);
    } else if (startDate) {
      start = new Date(startDate + 'T00:00:00.000Z');
      end = new Date(now);
      end.setUTCHours(23, 59, 59, 999);
    } else if (period) {
      // Если период задан без дат — рассчитываем диапазон как в dashboard
      start = new Date(now);
      switch (period) {
        case AnalyticsPeriod.DAY:
          start.setUTCHours(0, 0, 0, 0);
          break;
        case AnalyticsPeriod.WEEK:
          start.setUTCDate(now.getUTCDate() - 7);
          start.setUTCHours(0, 0, 0, 0);
          break;
        case AnalyticsPeriod.MONTH:
          start.setUTCMonth(now.getUTCMonth() - 1);
          start.setUTCHours(0, 0, 0, 0);
          break;
        case AnalyticsPeriod.YEAR:
          start.setUTCFullYear(now.getUTCFullYear() - 1);
          start.setUTCHours(0, 0, 0, 0);
          break;
        case AnalyticsPeriod.ALL:
          start = new Date(0); // начало времён
          break;
      }
      end = new Date(now);
      end.setUTCHours(23, 59, 59, 999);
    } else {
      // Default: last 12 months
      end = new Date(now);
      end.setUTCHours(23, 59, 59, 999);
      start = new Date(end);
      start.setUTCMonth(start.getUTCMonth() - 12);
      start.setUTCDate(1);
      start.setUTCHours(0, 0, 0, 0);
    }
    return { start, end };
  }

  private getMonthKey(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  private getMonthsBetween(start: Date, end: Date): string[] {
    const months: string[] = [];
    const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    const endMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    while (cur <= endMonth) {
      months.push(this.getMonthKey(cur));
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
    return months;
  }

  async getServiceSales(
    studioId: string,
    query: ServiceSalesQueryDto,
    userRole?: string,
    userStudioId?: string,
  ) {
    if (!isOwnerLevelRole(userRole) && userRole !== UserRole.MANAGER) {
      if (userStudioId !== studioId) {
        throw new ForbiddenException('Access denied to this studio');
      }
    }

    const { start, end } = this.getDateRange(
      query.startDate,
      query.endDate,
      query.period,
    );

    const where: any = {
      studioId,
      status: AppointmentStatus.DONE,
      startAt: { gte: start, lte: end },
    };
    if (query.serviceId) where.serviceId = query.serviceId;

    const appointments = await this.prisma.appointment.findMany({
      where,
      include: {
        service: true,
        upsells: { include: { service: true } },
      },
    });

    const monthToServices = new Map<
      string,
      Map<string, { serviceId: string; serviceName: string; revenue: number; appointmentsCount: number }>
    >();

    for (const a of appointments) {
      const monthKey = this.getMonthKey(a.startAt);
      const revenue =
        (a.prepaymentAmount ?? a.service.defaultPrice ?? 0) +
        (a.upsells?.reduce((s, u) => s + (u.totalAmount ?? 0), 0) ?? 0);

      if (!monthToServices.has(monthKey)) {
        monthToServices.set(
          monthKey,
          new Map(),
        );
      }
      const serviceMap = monthToServices.get(monthKey)!;
      const existing = serviceMap.get(a.serviceId);
      if (existing) {
        existing.revenue += revenue;
        existing.appointmentsCount += 1;
      } else {
        serviceMap.set(a.serviceId, {
          serviceId: a.serviceId,
          serviceName: a.service.name,
          revenue,
          appointmentsCount: 1,
        });
      }
    }

    const allMonths = this.getMonthsBetween(start, end);
    const data = allMonths.map((month) => {
      const serviceMap = monthToServices.get(month);
      const services = serviceMap
        ? Array.from(serviceMap.values()).sort((a, b) => b.revenue - a.revenue)
        : [];
      return { month, services };
    });

    return {
      period: {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      },
      groupBy: 'month' as const,
      data,
    };
  }
}
