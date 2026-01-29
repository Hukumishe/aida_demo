import {
  IsString,
  IsDateString,
  IsInt,
  IsOptional,
  IsEnum,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AppointmentStatus } from '@prisma/client';

export class UpdateAppointmentDto {
  @ApiProperty({ example: '2024-01-15T10:00:00Z', required: false })
  @IsDateString()
  @IsOptional()
  startAt?: string;

  @ApiProperty({ example: 1000, required: false })
  @IsInt()
  @IsOptional()
  @Min(0)
  prepaymentAmount?: number;

  @ApiProperty({ enum: AppointmentStatus, required: false })
  @IsEnum(AppointmentStatus)
  @IsOptional()
  status?: AppointmentStatus;
}

