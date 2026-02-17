import { IsOptional, IsString, IsEnum } from 'class-validator';
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
    description: 'Start date (YYYY-MM-DD). If not provided, uses period from today',
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiProperty({
    example: '2024-01-31',
    required: false,
    description: 'End date (YYYY-MM-DD). If not provided, uses period to today',
  })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiProperty({
    enum: DashboardPeriod,
    example: DashboardPeriod.MONTH,
    required: false,
    description: 'Period type. If provided, calculates period from today backwards',
  })
  @IsOptional()
  @IsEnum(DashboardPeriod)
  period?: DashboardPeriod;
}



