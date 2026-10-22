import {
  IsString,
  IsDateString,
  IsInt,
  IsOptional,
  IsEnum,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentStatus } from '@prisma/client';

export class UpdateAppointmentDto {
  @ApiProperty({
    example: '2026-10-22T14:30:00+06:00',
    description:
      'ISO 8601 с офсетом (для Алматы +06:00). При переносе — новое начало записи.',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  startAt?: string;

  @ApiPropertyOptional({
    example: '2026-10-22T15:30:00+06:00',
    description:
      'ISO 8601 с офсетом. При переносе должна соответствовать текущей длительности записи (startAt + duration). Если не передана — вычисляется на бэкенде.',
  })
  @IsDateString()
  @IsOptional()
  endAt?: string;

  @ApiPropertyOptional({
    example: 'usr_abc12defgh',
    description: 'Новый мастер при переносе. Проверки слота выполняются относительно этого мастера.',
  })
  @IsString()
  @IsOptional()
  staffUserId?: string;

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
