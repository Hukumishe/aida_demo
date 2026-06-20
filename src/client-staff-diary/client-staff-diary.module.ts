import { Module } from '@nestjs/common';
import { ClientStaffDiaryService } from './client-staff-diary.service';
import { ClientStaffDiaryController } from './client-staff-diary.controller';

@Module({
  controllers: [ClientStaffDiaryController],
  providers: [ClientStaffDiaryService],
  exports: [ClientStaffDiaryService],
})
export class ClientStaffDiaryModule {}
