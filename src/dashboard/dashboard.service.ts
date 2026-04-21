import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  UserRole,
  isDeveloperRole,
  isOwnerLevelRole,
} from '../common/decorators/roles.decorator';
import { DashboardQueryDto, DashboardPeriod } from './dto/dashboard-query.dto';
import { AppointmentStatus } from '@prisma/client';
import {
  DEFAULT_IANA_TIMEZONE,
  organizationTimezone,
  studioWallClockTimezone,
} from '../common/effective-timezone';
import { zonedDayRangeUtc } from '../common/iana-wall-time';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  private async resolveOrganizationId(
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

  private getDateRange(
    period?: DashboardPeriod,
    startDate?: string,
    endDate?: string,
    tz: string = DEFAULT_IANA_TIMEZONE,
  ) {
    const now = new Date();
    let start: Date;
    let end: Date = new Date(now);

    const ymd = (d: string) => (d.includes('T') ? d.split('T')[0] : d);

    // If both startDate and endDate are provided, use them (ignore period)
    if (startDate && endDate) {
      const sd = ymd(startDate);
      const ed = ymd(endDate);
      start = zonedDayRangeUtc(sd, tz).dayStart;
      const endNext = zonedDayRangeUtc(ed, tz).nextDayStart;
      end = new Date(endNext.getTime() - 1);

      // Validate that startDate is before endDate
      if (start > end) {
        throw new BadRequestException('startDate must be before or equal to endDate');
      }
    }
    // If only startDate is provided, use it as start and today as end
    else if (startDate) {
      start = zonedDayRangeUtc(ymd(startDate), tz).dayStart;
      end = new Date(now);
      end.setHours(23, 59, 59, 999);

      // Validate that startDate is not in the future
      if (start > end) {
        throw new BadRequestException('startDate cannot be in the future');
      }
    }
    // If only endDate is provided, use 30 days before endDate as start
    else if (endDate) {
      const ed = ymd(endDate);
      const endNext = zonedDayRangeUtc(ed, tz).nextDayStart;
      end = new Date(endNext.getTime() - 1);
      start = new Date(end);
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);

      // Validate that endDate is not in the future
      if (end > now) {
        throw new BadRequestException('endDate cannot be in the future');
      }
    }
    // If period is provided (and no dates), calculate based on period
    else if (period) {
      start = new Date(now);
      switch (period) {
        case DashboardPeriod.DAY:
          start.setHours(0, 0, 0, 0);
          break;
        case DashboardPeriod.WEEK:
          start.setDate(now.getDate() - 7);
          start.setHours(0, 0, 0, 0);
          break;
        case DashboardPeriod.MONTH:
          start.setMonth(now.getMonth() - 1);
          start.setHours(0, 0, 0, 0);
          break;
        case DashboardPeriod.YEAR:
          start.setFullYear(now.getFullYear() - 1);
          start.setHours(0, 0, 0, 0);
          break;
        case DashboardPeriod.ALL:
          start = new Date(0); // Beginning of time
          break;
      }
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
    } 
    // Default: current month (last 30 days)
    else {
      start = new Date(now);
      start.setDate(now.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  }

  async getStudioDashboard(
    studioId: string,
    query: DashboardQueryDto,
    userRole?: string,
    userStudioId?: string,
  ) {
    // Check access - only OWNER and DEPUTY_OWNER can access dashboard
    if (!isOwnerLevelRole(userRole)) {
      throw new ForbiddenException('Only owners and deputy owners can access dashboard');
    }

    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
      include: { organization: true },
    });
    if (!studio) {
      throw new NotFoundException(`Studio with ID ${studioId} not found`);
    }
    const tz = studioWallClockTimezone(studio, studio.organization);
    const { start, end } = this.getDateRange(
      query.period,
      query.startDate,
      query.endDate,
      tz,
    );

    // Get all appointments in date range
    const appointments = await this.prisma.appointment.findMany({
      where: {
        studioId,
        startAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        service: true,
        staff: {
          include: {
            staffProfile: true,
          },
        },
        client: true,
        upsells: {
          include: {
            service: true,
          },
        },
      },
    });

    // Get all no-show income records in date range (based on originalStartAt)
    const noShowIncomes = await this.prisma.noShowIncome.findMany({
      where: {
        studioId,
        originalStartAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        service: true,
        staff: {
          include: {
            staffProfile: true,
          },
        },
      },
    });

    // Calculate statistics
    const totalAppointments = appointments.length;
    
    // Count by status
    const statusCounts = {
      [AppointmentStatus.BOOKED]: appointments.filter(a => a.status === AppointmentStatus.BOOKED).length,
      [AppointmentStatus.CANCELLED]: appointments.filter(a => a.status === AppointmentStatus.CANCELLED).length,
      [AppointmentStatus.ARRIVED]: appointments.filter(a => a.status === AppointmentStatus.ARRIVED).length,
      [AppointmentStatus.DONE]: appointments.filter(a => a.status === AppointmentStatus.DONE).length,
    };

    // Calculate revenue
    // Revenue = sum of prepaymentAmount for DONE appointments + forfeitedPrepaymentAmount for CANCELLED appointments + no-show income + upsell income
    // Доход считается от завершенных записей (DONE), от сгоревших предоплат при поздней отмене (CANCELLED), от неявок (NoShowIncome) и от допродаж (Upsells)
    const revenueFromAppointments = appointments.reduce((sum: number, a: any) => {
      if (a.status === AppointmentStatus.DONE) {
        // Use prepaymentAmount if available, otherwise use service defaultPrice
        const amount = a.prepaymentAmount || a.service.defaultPrice || 0;
        return sum + amount;
      } else if (a.status === AppointmentStatus.CANCELLED && a.forfeitedPrepaymentAmount) {
        // Add forfeited prepayment from late cancellations
        return sum + a.forfeitedPrepaymentAmount;
      }
      return sum;
    }, 0);
    
    const revenueFromUpsells = appointments.reduce((sum: number, a: any) => {
      if (a.status === AppointmentStatus.DONE && a.upsells) {
        const upsellTotal = a.upsells.reduce((upsellSum: number, upsell: any) => upsellSum + upsell.totalAmount, 0);
        return sum + upsellTotal;
      }
      return sum;
    }, 0);
    
    const revenueFromNoShows = noShowIncomes.reduce((sum: number, nsi: any) => sum + nsi.amount, 0);
    const revenue = revenueFromAppointments + revenueFromNoShows + revenueFromUpsells;
    
    // Отдельные метрики для отображения в дэшборде
    const noShowRevenue = revenueFromNoShows;
    const upsellRevenue = revenueFromUpsells;

    // Popular services (top 10)
    // Считаем завершенные записи (DONE), сгоревшие предоплаты (CANCELLED), неявки (NoShowIncome) и допродажи (Upsells) для дохода
    const serviceCounts = new Map<string, { name: string; count: number; revenue: number }>();
    appointments.forEach((a: any) => {
      if (a.status === AppointmentStatus.DONE) {
        const serviceId = a.serviceId;
        const current = serviceCounts.get(serviceId) || { name: a.service.name, count: 0, revenue: 0 };
        current.count++;
        current.revenue += a.prepaymentAmount || a.service.defaultPrice || 0;
        // Add upsell revenue for this appointment
        if (a.upsells && a.upsells.length > 0) {
          const upsellTotal = a.upsells.reduce((sum: number, upsell: any) => sum + upsell.totalAmount, 0);
          current.revenue += upsellTotal;
        }
        serviceCounts.set(serviceId, current);
      } else if (a.status === AppointmentStatus.CANCELLED && a.forfeitedPrepaymentAmount) {
        const serviceId = a.serviceId;
        const current = serviceCounts.get(serviceId) || { name: a.service.name, count: 0, revenue: 0 };
        current.revenue += a.forfeitedPrepaymentAmount;
        serviceCounts.set(serviceId, current);
      }
    });
    // Add no-show income to service statistics
    noShowIncomes.forEach((nsi: any) => {
      const serviceId = nsi.serviceId;
      const current = serviceCounts.get(serviceId) || { name: nsi.service.name, count: 0, revenue: 0 };
      current.revenue += nsi.amount;
      serviceCounts.set(serviceId, current);
    });
    const popularServices = Array.from(serviceCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Staff statistics (top 10)
    // Считаем завершенные записи (DONE), сгоревшие предоплаты (CANCELLED), неявки (NoShowIncome) и допродажи (Upsells) для дохода
    const staffCounts = new Map<string, { 
      id: string; 
      name: string; 
      count: number; 
      revenue: number;
    }>();
    appointments.forEach((a: any) => {
      if (a.status === AppointmentStatus.DONE) {
        const staffId = a.staffUserId;
        const current = staffCounts.get(staffId) || { 
          id: staffId,
          name: `${a.staff.staffProfile?.firstName || ''} ${a.staff.staffProfile?.lastName || ''}`.trim() || 'Unknown',
          count: 0, 
          revenue: 0 
        };
        current.count++;
        current.revenue += a.prepaymentAmount || a.service.defaultPrice || 0;
        // Add upsell revenue for this appointment
        if (a.upsells && a.upsells.length > 0) {
          const upsellTotal = a.upsells.reduce((sum: number, upsell: any) => sum + upsell.totalAmount, 0);
          current.revenue += upsellTotal;
        }
        staffCounts.set(staffId, current);
      } else if (a.status === AppointmentStatus.CANCELLED && a.forfeitedPrepaymentAmount) {
        const staffId = a.staffUserId;
        const current = staffCounts.get(staffId) || { 
          id: staffId,
          name: `${a.staff.staffProfile?.firstName || ''} ${a.staff.staffProfile?.lastName || ''}`.trim() || 'Unknown',
          count: 0, 
          revenue: 0 
        };
        current.revenue += a.forfeitedPrepaymentAmount;
        staffCounts.set(staffId, current);
      }
    });
    // Add no-show income to staff statistics
    noShowIncomes.forEach((nsi: any) => {
      const staffId = nsi.staffUserId;
      const current = staffCounts.get(staffId) || { 
        id: staffId,
        name: `${nsi.staff.staffProfile?.firstName || ''} ${nsi.staff.staffProfile?.lastName || ''}`.trim() || 'Unknown',
        count: 0, 
        revenue: 0 
      };
      current.revenue += nsi.amount;
      staffCounts.set(staffId, current);
    });
    const topStaff = Array.from(staffCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Daily statistics for charts
    // Считаем завершенные записи (DONE), сгоревшие предоплаты (CANCELLED), неявки (NoShowIncome) и допродажи (Upsells) для дохода
    const dailyStats = new Map<string, { date: string; count: number; revenue: number }>();
    appointments.forEach((a: any) => {
      if (a.status === AppointmentStatus.DONE) {
        const dateKey = a.startAt.toISOString().split('T')[0];
        const current = dailyStats.get(dateKey) || { date: dateKey, count: 0, revenue: 0 };
        current.count++;
        current.revenue += a.prepaymentAmount || a.service.defaultPrice || 0;
        // Add upsell revenue for this appointment
        if (a.upsells && a.upsells.length > 0) {
          const upsellTotal = a.upsells.reduce((sum: number, upsell: any) => sum + upsell.totalAmount, 0);
          current.revenue += upsellTotal;
        }
        dailyStats.set(dateKey, current);
      } else if (a.status === AppointmentStatus.CANCELLED && a.forfeitedPrepaymentAmount) {
        const dateKey = a.startAt.toISOString().split('T')[0];
        const current = dailyStats.get(dateKey) || { date: dateKey, count: 0, revenue: 0 };
        current.revenue += a.forfeitedPrepaymentAmount;
        dailyStats.set(dateKey, current);
      }
    });
    // Add no-show income to daily statistics
    noShowIncomes.forEach((nsi: any) => {
      const dateKey = nsi.originalStartAt.toISOString().split('T')[0];
      const current = dailyStats.get(dateKey) || { date: dateKey, count: 0, revenue: 0 };
      current.revenue += nsi.amount;
      dailyStats.set(dateKey, current);
    });
    const dailyChart = Array.from(dailyStats.values())
      .sort((a, b) => a.date.localeCompare(b.date));

    // Cancellation rate
    const cancellationRate = totalAppointments > 0
      ? (statusCounts[AppointmentStatus.CANCELLED] / totalAppointments) * 100
      : 0;

    // Completion rate (DONE / (BOOKED + ARRIVED + DONE))
    const completedAppointments = statusCounts[AppointmentStatus.DONE];
    const totalNonCancelled = totalAppointments - statusCounts[AppointmentStatus.CANCELLED];
    const completionRate = totalNonCancelled > 0
      ? (completedAppointments / totalNonCancelled) * 100
      : 0;

    return {
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      overview: {
        totalAppointments,
        revenue,
        noShowRevenue,
        upsellRevenue,
        cancellationRate: Math.round(cancellationRate * 100) / 100,
        completionRate: Math.round(completionRate * 100) / 100,
      },
      statusCounts,
      popularServices,
      topStaff,
      dailyChart,
    };
  }

  async getAllStudiosDashboard(
    query: DashboardQueryDto,
    userRole?: string,
    userOrganizationId?: string,
    organizationIdQuery?: string,
  ) {
    // Only OWNER and DEPUTY_OWNER can access this
    if (!isOwnerLevelRole(userRole)) {
      throw new ForbiddenException('Only owners and deputy owners can view all studios dashboard');
    }

    const organizationId = await this.resolveOrganizationId(
      userRole,
      userOrganizationId,
      organizationIdQuery,
    );

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { ianaTimezone: true },
    });
    const tz = organizationTimezone(org ?? { ianaTimezone: null });

    const { start, end } = this.getDateRange(
      query.period,
      query.startDate,
      query.endDate,
      tz,
    );

    // Get all studios only for one organization (tenant-safe)
    const studios = await this.prisma.studio.findMany({
      where: { organizationId },
      include: {
        appointments: {
          where: {
            startAt: {
              gte: start,
              lte: end,
            },
          },
          include: {
            service: true,
            staff: {
              include: {
                staffProfile: true,
              },
            },
            upsells: {
              include: {
                service: true,
              },
            },
          },
        },
        noShowIncomes: {
          where: {
            originalStartAt: {
              gte: start,
              lte: end,
            },
          },
        },
      },
    });

    // Calculate per-studio statistics
    const studioStats = studios.map((studio: any) => {
      const appointments = studio.appointments;
      const totalAppointments = appointments.length;
      
      const statusCounts = {
        [AppointmentStatus.BOOKED]: appointments.filter((a: any) => a.status === AppointmentStatus.BOOKED).length,
        [AppointmentStatus.CANCELLED]: appointments.filter((a: any) => a.status === AppointmentStatus.CANCELLED).length,
        [AppointmentStatus.ARRIVED]: appointments.filter((a: any) => a.status === AppointmentStatus.ARRIVED).length,
        [AppointmentStatus.DONE]: appointments.filter((a: any) => a.status === AppointmentStatus.DONE).length,
      };

      // Доход считается от завершенных записей (DONE), от сгоревших предоплат при поздней отмене (CANCELLED), от неявок (NoShowIncome) и от допродаж (Upsells)
      const revenueFromAppointments = appointments.reduce((sum: number, a: any) => {
        if (a.status === AppointmentStatus.DONE) {
          const amount = a.prepaymentAmount || a.service.defaultPrice || 0;
          return sum + amount;
        } else if (a.status === AppointmentStatus.CANCELLED && a.forfeitedPrepaymentAmount) {
          return sum + a.forfeitedPrepaymentAmount;
        }
        return sum;
      }, 0);
      const revenueFromUpsells = appointments.reduce((sum: number, a: any) => {
        if (a.status === AppointmentStatus.DONE && a.upsells) {
          const upsellTotal = a.upsells.reduce((upsellSum: number, upsell: any) => upsellSum + upsell.totalAmount, 0);
          return sum + upsellTotal;
        }
        return sum;
      }, 0);
      const revenueFromNoShows = studio.noShowIncomes.reduce((sum: number, nsi: any) => sum + nsi.amount, 0);
      const revenue = revenueFromAppointments + revenueFromNoShows + revenueFromUpsells;

      return {
        studioId: studio.id,
        studioName: studio.name,
        totalAppointments,
        revenue,
        statusCounts,
      };
    });

    // Aggregate totals
    const totalAppointments = studioStats.reduce((sum, s) => sum + s.totalAppointments, 0);
    const totalRevenue = studioStats.reduce((sum, s) => sum + s.revenue, 0);
    
    const aggregatedStatusCounts = {
      [AppointmentStatus.BOOKED]: studioStats.reduce((sum, s) => sum + s.statusCounts[AppointmentStatus.BOOKED], 0),
      [AppointmentStatus.CANCELLED]: studioStats.reduce((sum, s) => sum + s.statusCounts[AppointmentStatus.CANCELLED], 0),
      [AppointmentStatus.ARRIVED]: studioStats.reduce((sum, s) => sum + s.statusCounts[AppointmentStatus.ARRIVED], 0),
      [AppointmentStatus.DONE]: studioStats.reduce((sum, s) => sum + s.statusCounts[AppointmentStatus.DONE], 0),
    };

    // Overall cancellation rate
    const cancellationRate = totalAppointments > 0
      ? (aggregatedStatusCounts[AppointmentStatus.CANCELLED] / totalAppointments) * 100
      : 0;

    // Overall completion rate
    const completedAppointments = aggregatedStatusCounts[AppointmentStatus.DONE];
    const totalNonCancelled = totalAppointments - aggregatedStatusCounts[AppointmentStatus.CANCELLED];
    const completionRate = totalNonCancelled > 0
      ? (completedAppointments / totalNonCancelled) * 100
      : 0;

    return {
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      overview: {
        totalStudios: studios.length,
        totalAppointments,
        totalRevenue,
        cancellationRate: Math.round(cancellationRate * 100) / 100,
        completionRate: Math.round(completionRate * 100) / 100,
      },
      aggregatedStatusCounts,
      studios: studioStats,
    };
  }
}

