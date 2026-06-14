import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NextbotBirthdayOrchestratorService } from './nextbot-birthday-orchestrator.service';

@Injectable()
export class NextbotBirthdayScheduler {
  private readonly logger = new Logger(NextbotBirthdayScheduler.name);

  constructor(private readonly orchestrator: NextbotBirthdayOrchestratorService) {}

  /** 09:00 по серверу — планирование поздравлений на «сегодня». */
  @Cron('0 9 * * *')
  async scheduleDaily(): Promise<void> {
    try {
      const n = await this.orchestrator.scheduleDueBirthdays();
      if (n > 0) {
        this.logger.log(`Scheduled ${n} birthday messages`);
      }
    } catch (e) {
      this.logger.error(`scheduleDueBirthdays failed: ${e}`);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async dispatchDue(): Promise<void> {
    try {
      const sent = await this.orchestrator.dispatchDueMessages(40);
      if (sent > 0) {
        this.logger.log(`Dispatched ${sent} birthday messages`);
      }
    } catch (e) {
      this.logger.error(`birthday dispatchDue failed: ${e}`);
    }
  }
}
