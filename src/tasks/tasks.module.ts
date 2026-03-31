import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TasksReminderScheduler } from './tasks-reminder.scheduler';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [TasksController],
  providers: [TasksService, TasksReminderScheduler],
  exports: [TasksService],
})
export class TasksModule {}
