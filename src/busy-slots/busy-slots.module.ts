import { Module } from '@nestjs/common';
import { BusySlotsService } from './busy-slots.service';
import { BusySlotsController } from './busy-slots.controller';
import { AvailabilityModule } from '../availability/availability.module';

@Module({
  imports: [AvailabilityModule],
  controllers: [BusySlotsController],
  providers: [BusySlotsService],
  exports: [BusySlotsService],
})
export class BusySlotsModule {}


