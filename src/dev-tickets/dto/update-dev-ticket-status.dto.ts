import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { DevTicketStatus } from '@prisma/client';

export class UpdateDevTicketStatusDto {
  @ApiProperty({ enum: ['IN_PROGRESS', 'COMPLETED'] })
  @IsIn([DevTicketStatus.IN_PROGRESS, DevTicketStatus.COMPLETED])
  /** Только эти два значения; OPEN задаётся при создании. */
  status!: Extract<DevTicketStatus, 'IN_PROGRESS' | 'COMPLETED'>;
}
