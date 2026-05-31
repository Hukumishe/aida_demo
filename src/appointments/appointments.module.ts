import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentHistoryService } from './appointment-history.service';
import { AppointmentsController } from './appointments.controller';
import { UpsellsService } from './upsells.service';
import { UpsellsController } from './upsells.controller';
import { AppointmentsHoldScheduler } from './appointments-hold.scheduler';
import { AvailabilityModule } from '../availability/availability.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { NextbotAutoMessagesModule } from '../nextbot-auto-messages/nextbot-auto-messages.module';
import { BusySlotsModule } from '../busy-slots/busy-slots.module';

@Module({
  imports: [
    AvailabilityModule,
    NotificationsModule,
    NextbotAutoMessagesModule,
    BusySlotsModule,
  ],
  controllers: [AppointmentsController, UpsellsController],
  providers: [
    AppointmentsService,
    AppointmentHistoryService,
    UpsellsService,
    AppointmentsHoldScheduler,
  ],
  exports: [AppointmentsService, AppointmentHistoryService],
})
export class AppointmentsModule {}




