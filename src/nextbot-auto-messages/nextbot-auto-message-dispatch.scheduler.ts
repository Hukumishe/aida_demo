import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NextbotAutoMessageOrchestratorService } from './nextbot-auto-message-orchestrator.service';

@Injectable()
export class NextbotAutoMessageDispatchScheduler {
  private readonly logger = new Logger(NextbotAutoMessageDispatchScheduler.name);

  constructor(private readonly orchestrator: NextbotAutoMessageOrchestratorService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async dispatchDue(): Promise<void> {
    try {
      const sent = await this.orchestrator.dispatchDueMessages(80);
      if (sent > 0) {
        this.logger.log(`Dispatched ${sent} Nextbot auto-messages`);
      }
    } catch (e) {
      this.logger.error(`dispatchDue failed: ${e}`);
    }
  }
}
