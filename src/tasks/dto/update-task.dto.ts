import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ArrayUnique,
  ValidateIf,
} from 'class-validator';

export class UpdateStudioTaskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigneeUserId?: string;

  @ApiPropertyOptional({ type: [String], description: 'Полная замена списка контролёров' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  controllerUserIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  deadlineAt?: string;

  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({
    description: 'Комментарий к смене статуса (обязателен для мастера при отказе/CANCELLED)',
  })
  @IsOptional()
  @IsString()
  rejectionComment?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Привязка к клиенту; передайте null чтобы снять',
  })
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsString()
  @IsNotEmpty()
  clientId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Привязка к записи; передайте null чтобы снять',
  })
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsString()
  @IsNotEmpty()
  appointmentId?: string | null;
}
