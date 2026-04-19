import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { UpsellsService } from './upsells.service';
import { UpsellsController } from './upsells.controller';
import { AppointmentsHoldScheduler } from './appointments-hold.scheduler';
import { AvailabilityModule } from '../availability/availability.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AvailabilityModule, NotificationsModule],
  controllers: [AppointmentsController, UpsellsController],
  providers: [AppointmentsService, UpsellsService, AppointmentsHoldScheduler],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}




