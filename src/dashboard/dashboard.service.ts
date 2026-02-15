import {
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UserRole } from '../common/decorators/roles.decorator';
import { DashboardQueryDto, DashboardPeriod } from './dto/dashboard-query.dto';
import { AppointmentStatus } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  private getDateRange(period?: DashboardPeriod, startDate?: string, endDate?: string) {
    const now = new Date();
    let start: Date;
    let end: Date = new Date(now);

    if (startDate && endDate) {
      // Use provided dates
      start = new Date(startDate + 'T00:00:00+06:00');
      end = new Date(endDate + 'T23:59:59.999+06:00');
    } else if (period) {
      // Calculate based on period
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
    } else {
      // Default: current month
      start = new Date(now);
      start.setMonth(now.getMonth() - 1);
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
    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== studioId) {
      throw new ForbiddenException('Access denied to this studio');
    }

    const { start, end } = this.getDateRange(query.period, query.startDate, query.endDate);

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
    // Revenue = sum of prepaymentAmount for non-cancelled appointments
    // + sum of service prices for completed appointments (if we had final price field)
    const revenue = appointments
      .filter(a => a.status !== AppointmentStatus.CANCELLED)
      .reduce((sum, a) => {
        // Use prepaymentAmount if available, otherwise use service defaultPrice
        const amount = a.prepaymentAmount || a.service.defaultPrice || 0;
        return sum + amount;
      }, 0);

    // Popular services (top 10)
    const serviceCounts = new Map<string, { name: string; count: number; revenue: number }>();
    appointments.forEach(a => {
      if (a.status !== AppointmentStatus.CANCELLED) {
        const serviceId = a.serviceId;
        const current = serviceCounts.get(serviceId) || { name: a.service.name, count: 0, revenue: 0 };
        current.count++;
        current.revenue += a.prepaymentAmount || a.service.defaultPrice || 0;
        serviceCounts.set(serviceId, current);
      }
    });
    const popularServices = Array.from(serviceCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Staff statistics (top 10)
    const staffCounts = new Map<string, { 
      id: string; 
      name: string; 
      count: number; 
      revenue: number;
    }>();
    appointments.forEach(a => {
      if (a.status !== AppointmentStatus.CANCELLED) {
        const staffId = a.staffUserId;
        const current = staffCounts.get(staffId) || { 
          id: staffId,
          name: `${a.staff.staffProfile?.firstName || ''} ${a.staff.staffProfile?.lastName || ''}`.trim() || 'Unknown',
          count: 0, 
          revenue: 0 
        };
        current.count++;
        current.revenue += a.prepaymentAmount || a.service.defaultPrice || 0;
        staffCounts.set(staffId, current);
      }
    });
    const topStaff = Array.from(staffCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Daily statistics for charts
    const dailyStats = new Map<string, { date: string; count: number; revenue: number }>();
    appointments.forEach(a => {
      if (a.status !== AppointmentStatus.CANCELLED) {
        const dateKey = a.startAt.toISOString().split('T')[0];
        const current = dailyStats.get(dateKey) || { date: dateKey, count: 0, revenue: 0 };
        current.count++;
        current.revenue += a.prepaymentAmount || a.service.defaultPrice || 0;
        dailyStats.set(dateKey, current);
      }
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
  ) {
    // Only OWNER can access this
    if (userRole !== UserRole.OWNER) {
      throw new ForbiddenException('Only owners can view all studios dashboard');
    }

    const { start, end } = this.getDateRange(query.period, query.startDate, query.endDate);

    // Get all studios
    const studios = await this.prisma.studio.findMany({
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
          },
        },
      },
    });

    // Calculate per-studio statistics
    const studioStats = studios.map(studio => {
      const appointments = studio.appointments;
      const totalAppointments = appointments.length;
      
      const statusCounts = {
        [AppointmentStatus.BOOKED]: appointments.filter(a => a.status === AppointmentStatus.BOOKED).length,
        [AppointmentStatus.CANCELLED]: appointments.filter(a => a.status === AppointmentStatus.CANCELLED).length,
        [AppointmentStatus.ARRIVED]: appointments.filter(a => a.status === AppointmentStatus.ARRIVED).length,
        [AppointmentStatus.DONE]: appointments.filter(a => a.status === AppointmentStatus.DONE).length,
      };

      const revenue = appointments
        .filter(a => a.status !== AppointmentStatus.CANCELLED)
        .reduce((sum, a) => {
          const amount = a.prepaymentAmount || a.service.defaultPrice || 0;
          return sum + amount;
        }, 0);

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

