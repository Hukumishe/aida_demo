import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export enum AnalyticsPeriod {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
  ALL = 'all',
}

/** Нормализует ISO-дату к YYYY-MM-DD для валидации (фронт часто шлёт toISOString()). */
function toDateOnly(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const datePart = trimmed.includes('T') ? trimmed.split('T')[0]! : trimmed;
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : undefined;
}

export class ServiceSalesQueryDto {
  @ApiProperty({
    example: '2025-02-01',
    required: false,
    description: 'Start date (YYYY-MM-DD or ISO). Default: based on period or last 12 months.',
  })
  @IsOptional()
  @Transform(({ value }) => toDateOnly(value) ?? value)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be YYYY-MM-DD' })
  startDate?: string;

  @ApiProperty({
    example: '2026-02-24',
    required: false,
    description: 'End date (YYYY-MM-DD or ISO). Default: today.',
  })
  @IsOptional()
  @Transform(({ value }) => toDateOnly(value) ?? value)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must be YYYY-MM-DD' })
  endDate?: string;

  @ApiProperty({
    enum: AnalyticsPeriod,
    example: AnalyticsPeriod.MONTH,
    required: false,
    description:
      'Period type. Used only if startDate and endDate are not provided. Calculates period from today backwards.',
  })
  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  @ValidateIf((o) => !o.startDate && !o.endDate)
  period?: AnalyticsPeriod;

  @ApiProperty({
    required: false,
    description: 'Filter by one service ID. Omit for all services.',
  })
  @IsOptional()
  @IsUUID()
  serviceId?: string;
}
