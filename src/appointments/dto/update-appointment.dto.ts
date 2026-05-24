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
  @ApiProperty({ 
    example: '2024-01-15T10:00:00+06:00',
    description: 'ISO 8601 date-time string with timezone offset. For Almaty use +06:00',
    required: false 
  })
  @IsDateString()
  @IsOptional()
  startAt?: string;

  @ApiProperty({ example: 1000, required: false })
  @IsInt()
  @IsOptional()
  @Min(0)
  prepaymentAmount?: number;

  @ApiProperty({
    required: false,
    description: 'Комментарий к записи; пустая строка очищает поле',
  })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({ enum: AppointmentStatus, required: false })
  @IsEnum(AppointmentStatus)
  @IsOptional()
  status?: AppointmentStatus;
}


