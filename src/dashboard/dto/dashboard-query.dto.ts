import { IsOptional, IsString, IsEnum, Matches, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum DashboardPeriod {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
  ALL = 'all',
}

export class DashboardQueryDto {
  @ApiProperty({
    example: '2024-01-15',
    required: false,
    description: 'Start date (YYYY-MM-DD). Filter "from" date. If only startDate is provided, endDate defaults to today. If both startDate and endDate are provided, period is ignored.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate must be in YYYY-MM-DD format',
  })
  startDate?: string;

  @ApiProperty({
    example: '2024-01-31',
    required: false,
    description: 'End date (YYYY-MM-DD). Filter "to" date. If only endDate is provided, startDate defaults to 30 days before endDate. If both startDate and endDate are provided, period is ignored.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate must be in YYYY-MM-DD format',
  })
  endDate?: string;

  @ApiProperty({
    enum: DashboardPeriod,
    example: DashboardPeriod.MONTH,
    required: false,
    description: 'Period type. Used only if startDate and endDate are not provided. Calculates period from today backwards.',
  })
  @IsOptional()
  @IsEnum(DashboardPeriod)
  @ValidateIf((o) => !o.startDate && !o.endDate)
  period?: DashboardPeriod;
}








