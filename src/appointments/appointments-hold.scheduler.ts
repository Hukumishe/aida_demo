import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppointmentStatus } from '@prisma/client';

/**
 * Крон авто-освобождения слота при истечении 30-минутного таймера удержания
 * предварительной брони (TENTATIVE). Таймер ставится в Nextbot-потоке ночной оплаты
 * (`request_manager_invoice`). При переходе записи в PENDING_CONFIRMATION / BOOKED / DONE /
 * ARRIVED / CANCELLED — `holdExpiresAt` очищается, и крон такие записи больше не трогает.
 */
@Injectable()
export class AppointmentsHoldScheduler {
  private readonly logger = new Logger(AppointmentsHoldScheduler.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async releaseExpiredTentativeHolds(): Promise<void> {
    const now = new Date();
    try {
      const expired = await this.prisma.appointment.findMany({
        where: {
          status: AppointmentStatus.TENTATIVE,
          holdExpiresAt: { not: null, lte: now },
        },
        select: { id: true, studioId: true, staffUserId: true },
      });

      if (expired.length === 0) {
        return;
      }

      for (const appt of expired) {
        try {
          await this.prisma.appointment.update({
            where: { id: appt.id },
            data: {
              status: AppointmentStatus.CANCELLED,
              holdExpiresAt: null,
            },
          });
          this.logger.log(
            `Released expired TENTATIVE hold: appointment=${appt.id} studio=${appt.studioId}`,
          );
        } catch (e) {
          this.logger.warn(`Failed to release hold for appointment ${appt.id}: ${e}`);
        }
      }
    } catch (e) {
      this.logger.error(`releaseExpiredTentativeHolds failed: ${e}`);
    }
  }
}
