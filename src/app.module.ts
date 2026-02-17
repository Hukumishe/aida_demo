import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { NotificationsModule } from './notifications/notifications.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
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
    NotificationsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}




