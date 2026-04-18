import { Module } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientsImportService } from './clients.import.service';
import { ClientsController } from './clients.controller';

@Module({
  controllers: [ClientsController],
  providers: [ClientsService, ClientsImportService],
  exports: [ClientsService],
})
export class ClientsModule {}




