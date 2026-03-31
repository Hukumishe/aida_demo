import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TasksService } from './tasks.service';

@Injectable()
export class TasksReminderScheduler {
  private readonly logger = new Logger(TasksReminderScheduler.name);

  constructor(private readonly tasks: TasksService) {}

  /** Раз в час: задачи с дедлайном в ближайшие 24 ч — уведомление исполнителю и контролёрам (один раз) */
  @Cron(CronExpression.EVERY_HOUR)
  async remindDeadlines() {
    try {
      await this.tasks.sendDeadlineReminders();
    } catch (e) {
      this.logger.error(e);
    }
  }
}
