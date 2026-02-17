import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { UpsellsService } from './upsells.service';
import { UpsellsController } from './upsells.controller';
import { AvailabilityModule } from '../availability/availability.module';

@Module({
  imports: [AvailabilityModule],
  controllers: [AppointmentsController, UpsellsController],
  providers: [AppointmentsService, UpsellsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}




