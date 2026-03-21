import { Module } from '@nestjs/common';
import { NextbotController } from './nextbot.controller';
import { NextbotService } from './nextbot.service';
import { StudiosModule } from '../studios/studios.module';
import { ClientsModule } from '../clients/clients.module';
import { ServicesModule } from '../services/services.module';
import { LandingModule } from '../landing/landing.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { BusySlotsModule } from '../busy-slots/busy-slots.module';
import { AppointmentsModule } from '../appointments/appointments.module';

@Module({
  imports: [
    StudiosModule,
    ClientsModule,
    ServicesModule,
    LandingModule,
    ScheduleModule,
    BusySlotsModule,
    AppointmentsModule,
  ],
  controllers: [NextbotController],
  providers: [NextbotService],
})
export class NextbotModule {}
