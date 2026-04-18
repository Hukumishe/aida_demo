import { Module } from '@nestjs/common';
import { NextbotController } from './nextbot.controller';
import { NextbotService } from './nextbot.service';
import { StudiosModule } from '../studios/studios.module';
import { ClientsModule } from '../clients/clients.module';
import { ServicesModule } from '../services/services.module';
import { LandingModule } from '../landing/landing.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { AvailabilityModule } from '../availability/availability.module';
import { PromptsModule } from '../prompts/prompts.module';

@Module({
  imports: [
    StudiosModule,
    ClientsModule,
    ServicesModule,
    LandingModule,
    AppointmentsModule,
    AvailabilityModule,
    PromptsModule,
  ],
  controllers: [NextbotController],
  providers: [NextbotService],
})
export class NextbotModule {}
