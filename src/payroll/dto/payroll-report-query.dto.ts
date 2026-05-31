import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class PayrollReportQueryDto {
  @ApiProperty({ description: 'Начало периода (ISO date или datetime)' })
  @IsDateString()
  from: string;

  @ApiProperty({ description: 'Конец периода (ISO date или datetime)' })
  @IsDateString()
  to: string;

  @ApiPropertyOptional({ description: 'Фильтр по сотруднику' })
  @IsOptional()
  @IsString()
  staffUserId?: string;

  @ApiPropertyOptional({ description: 'Фильтр по филиалу' })
  @IsOptional()
  @IsString()
  studioId?: string;
}
