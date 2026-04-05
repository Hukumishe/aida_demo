import { Module } from '@nestjs/common';
import { DevTicketsController } from './dev-tickets.controller';
import { DevTicketsService } from './dev-tickets.service';

@Module({
  controllers: [DevTicketsController],
  providers: [DevTicketsService],
  exports: [DevTicketsService],
})
export class DevTicketsModule {}
