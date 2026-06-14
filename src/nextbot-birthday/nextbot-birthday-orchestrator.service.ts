import { Injectable, Logger } from '@nestjs/common';
import {
  ClientLevel,
  NextbotAutoMessageLogStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { generateId, IdPrefix } from '../common/id-generator';
import { LEVEL_ORDER } from '../clients/constants/levels.constants';
import { NextbotOutboundService } from '../nextbot-auto-messages/nextbot-outbound.service';
import { renderNextbotAutoMessageTemplate } from '../nextbot-auto-messages/nextbot-auto-message-variables';
import {
  addDaysToYmd,
  nextBirthdayYmd,
  toWallDateYmd,
} from './birthday-date.util';

function meetsMinLevel(clientLevel: ClientLevel, minLevel: ClientLevel): boolean {
  const ci = LEVEL_ORDER.indexOf(clientLevel as (typeof LEVEL_ORDER)[number]);
  const mi = LEVEL_ORDER.indexOf(minLevel as (typeof LEVEL_ORDER)[number]);
  if (ci < 0 || mi < 0) return false;
  return ci >= mi;
}

@Injectable()
export class NextbotBirthdayOrchestratorService {
  private readonly logger = new Logger(NextbotBirthdayOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbound: NextbotOutboundService,
  ) {}

  /** Ежедневно: поставить в очередь поздравления на сегодня. */
  async scheduleDueBirthdays(): Promise<number> {
    const studios = await this.prisma.studioBirthdayMessageSettings.findMany({
      where: { isActive: true },
      include: { studio: { select: { id: true, organizationId: true, name: true, timezone: true } } },
    });

    let scheduled = 0;
    const now = new Date();

    for (const settings of studios) {
      const tz = settings.studio.timezone || 'Asia/Almaty';
      const todayYmd = toWallDateYmd(now, tz);

      const clients = await this.prisma.client.findMany({
        where: {
          organizationId: settings.studio.organizationId,
          birthDate: { not: null },
          isBlacklisted: false,
          loyaltyEnabled: true,
        },
        select: {
          id: true,
          birthDate: true,
          level: true,
          firstName: true,
          nextbotDialogId: true,
        },
      });

      for (const client of clients) {
        if (!client.birthDate) continue;
        if (!meetsMinLevel(client.level, settings.minClientLevel)) continue;

        const birthdayYmd = nextBirthdayYmd(client.birthDate, todayYmd);
        const sendOnYmd = addDaysToYmd(birthdayYmd, -settings.daysBeforeBirthday);
        if (sendOnYmd !== todayYmd) continue;

        const congratulationYear = Number(birthdayYmd.slice(0, 4));

        const existing = await this.prisma.nextbotBirthdayMessageLog.findUnique({
          where: {
            organizationId_clientId_congratulationYear: {
              organizationId: settings.studio.organizationId,
              clientId: client.id,
              congratulationYear,
            },
          },
        });
        if (existing) continue;

        await this.prisma.nextbotBirthdayMessageLog.create({
          data: {
            id: generateId(IdPrefix.NextbotBirthdayMessageLog),
            organizationId: settings.studio.organizationId,
            studioId: settings.studioId,
            clientId: client.id,
            congratulationYear,
            scheduledAt: now,
            status: NextbotAutoMessageLogStatus.PENDING,
          },
        });
        scheduled += 1;
      }
    }

    return scheduled;
  }

  async dispatchDueMessages(limit = 50): Promise<number> {
    const now = new Date();
    const due = await this.prisma.nextbotBirthdayMessageLog.findMany({
      where: {
        status: NextbotAutoMessageLogStatus.PENDING,
        scheduledAt: { lte: now },
      },
      take: limit,
      orderBy: { scheduledAt: 'asc' },
      include: {
        client: true,
      },
    });

    let sent = 0;
    for (const row of due) {
      const ok = await this.dispatchLog(row.id);
      if (ok) sent += 1;
    }
    return sent;
  }

  async dispatchLog(logId: string): Promise<boolean> {
    const row = await this.prisma.nextbotBirthdayMessageLog.findUnique({
      where: { id: logId },
      include: { client: true },
    });
    if (!row || row.status !== NextbotAutoMessageLogStatus.PENDING) return false;

    const settings = await this.prisma.studioBirthdayMessageSettings.findUnique({
      where: { studioId: row.studioId },
      include: { studio: true },
    });
    if (!settings?.isActive) {
      await this.markLog(row.id, NextbotAutoMessageLogStatus.SKIPPED, null, 'birthday_inactive');
      return false;
    }

    if (row.client.isBlacklisted) {
      await this.markLog(row.id, NextbotAutoMessageLogStatus.SKIPPED, null, 'client_blacklisted');
      return false;
    }

    if (!row.client.loyaltyEnabled) {
      await this.markLog(row.id, NextbotAutoMessageLogStatus.SKIPPED, null, 'loyalty_disabled');
      return false;
    }

    if (!meetsMinLevel(row.client.level, settings.minClientLevel)) {
      await this.markLog(row.id, NextbotAutoMessageLogStatus.SKIPPED, null, 'level_below_min');
      return false;
    }

    const dialogId = row.client.nextbotDialogId;
    if (!dialogId) {
      await this.markLog(row.id, NextbotAutoMessageLogStatus.SKIPPED, null, 'no_nextbot_dialog_id');
      return false;
    }

    const bonusDescription = this.formatBonusDescription(settings);
    const variables: Record<string, string> = {
      name: row.client.firstName ?? '',
      patronymic: row.client.patronymic ?? '',
      lastName: row.client.lastName ?? '',
      phone: row.client.phone ?? '',
      studio: settings.studio.name,
      bonusDescription,
      bonusValue: String(settings.bonusValue),
    };

    const text = renderNextbotAutoMessageTemplate(settings.messageText, variables);

    try {
      await this.prisma.$transaction(async (tx) => {
        if (!row.bonusApplied) {
          await this.applyBonus(tx, row.clientId, settings);
        }
        await this.outbound.send(settings.studio.organizationId, {
          dialogId,
          text,
          clientId: row.clientId,
        });
      });

      await this.prisma.nextbotBirthdayMessageLog.update({
        where: { id: row.id },
        data: {
          status: NextbotAutoMessageLogStatus.SENT,
          sentAt: new Date(),
          renderedText: text,
          bonusApplied: true,
        },
      });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.markLog(row.id, NextbotAutoMessageLogStatus.FAILED, text, msg);
      return false;
    }
  }

  private formatBonusDescription(settings: { bonusValue: number }): string {
    return `${settings.bonusValue} бонусных баллов`;
  }

  private async applyBonus(
    tx: Prisma.TransactionClient,
    clientId: string,
    settings: { bonusValue: number },
  ) {
    const client = await tx.client.findUnique({
      where: { id: clientId },
      select: { id: true, organizationId: true, bonuses: true },
    });
    if (!client) return;

    await tx.client.update({
      where: { id: clientId },
      data: { bonuses: client.bonuses + settings.bonusValue },
    });
    await tx.bonusHistoryEntry.create({
      data: {
        id: generateId(IdPrefix.BonusHistoryEntry),
        clientId,
        organizationId: client.organizationId,
        amount: settings.bonusValue,
        type: 'BIRTHDAY',
        comment: 'Автоначисление: день рождения',
      },
    });
  }

  private async markLog(
    id: string,
    status: NextbotAutoMessageLogStatus,
    renderedText: string | null,
    skipOrError: string | null,
  ) {
    await this.prisma.nextbotBirthdayMessageLog.update({
      where: { id },
      data: {
        status,
        sentAt: status === NextbotAutoMessageLogStatus.SENT ? new Date() : undefined,
        renderedText: renderedText ?? undefined,
        skipReason:
          status === NextbotAutoMessageLogStatus.SKIPPED ? skipOrError ?? undefined : undefined,
        error:
          status === NextbotAutoMessageLogStatus.FAILED ? skipOrError ?? undefined : undefined,
      },
    });
  }
}
