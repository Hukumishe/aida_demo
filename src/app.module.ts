import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { StudiosModule } from './studios/studios.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { ServicesModule } from './services/services.module';
import { ScheduleModule } from './schedule/schedule.module';
import { BusySlotsModule } from './busy-slots/busy-slots.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { UploadModule } from './upload/upload.module';
import { LoggingModule } from './logging/logging.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { BlacklistModule } from './blacklist/blacklist.module';
import { WarehouseModule } from './warehouse/warehouse.module';
import { PromptsModule } from './prompts/prompts.module';
import { LandingModule } from './landing/landing.module';
import { FaqModule } from './faq/faq.module';
import { NextbotModule } from './nextbot/nextbot.module';
import { TasksModule } from './tasks/tasks.module';
import { ReferralLinksModule } from './referral-links/referral-links.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { DevTicketsModule } from './dev-tickets/dev-tickets.module';
import { NextbotAutoMessagesModule } from './nextbot-auto-messages/nextbot-auto-messages.module';
import { NextbotBirthdayModule } from './nextbot-birthday/nextbot-birthday.module';
import { TargetPromoModule } from './target-promo/target-promo.module';
import { PayrollModule } from './payroll/payroll.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    NestScheduleModule.forRoot(),
    CommonModule,
    LoggingModule,
    AuthModule,
    StudiosModule,
    UsersModule,
    ClientsModule,
    ServicesModule,
    ScheduleModule,
    BusySlotsModule,
    AppointmentsModule,
    UploadModule,
    DashboardModule,
    AnalyticsModule,
    NotificationsModule,
    BlacklistModule,
    WarehouseModule,
    PromptsModule,
    LandingModule,
    FaqModule,
    NextbotModule,
    TasksModule,
    ReferralLinksModule,
    OrganizationsModule,
    DevTicketsModule,
    NextbotAutoMessagesModule,
    NextbotBirthdayModule,
    TargetPromoModule,
    PayrollModule,
  ],
  controllers: [AppController],
})
export class AppModule {}




