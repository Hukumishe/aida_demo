import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ServiceSalesQueryDto {
  @ApiProperty({
    example: '2025-02-01',
    required: false,
    description: 'Start date (YYYY-MM-DD). Default: 12 months before endDate.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be YYYY-MM-DD' })
  startDate?: string;

  @ApiProperty({
    example: '2026-02-24',
    required: false,
    description: 'End date (YYYY-MM-DD). Default: today.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must be YYYY-MM-DD' })
  endDate?: string;

  @ApiProperty({
    required: false,
    description: 'Filter by one service ID. Omit for all services.',
  })
  @IsOptional()
  @IsUUID()
  serviceId?: string;
}
