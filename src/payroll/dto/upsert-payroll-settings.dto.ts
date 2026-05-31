import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StaffPayrollBaseMode, StaffPayrollRateMode } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class PayrollCategoryRateDto {
  @ApiProperty()
  @IsString()
  categoryId: string;

  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsInt()
  @Min(0)
  @Max(100)
  percent: number;
}

export class PayrollServiceRateDto {
  @ApiProperty()
  @IsString()
  serviceId: string;

  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsInt()
  @Min(0)
  @Max(100)
  percent: number;
}

export class UpsertPayrollSettingsDto {
  @ApiProperty({ enum: StaffPayrollRateMode })
  @IsEnum(StaffPayrollRateMode)
  rateMode: StaffPayrollRateMode;

  @ApiProperty({ enum: StaffPayrollBaseMode })
  @IsEnum(StaffPayrollBaseMode)
  baseMode: StaffPayrollBaseMode;

  @ApiPropertyOptional({
    description: '0–100, обязателен для режима UNIFIED',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  unifiedPercent?: number;

  @ApiPropertyOptional({ type: [PayrollCategoryRateDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayrollCategoryRateDto)
  categoryRates?: PayrollCategoryRateDto[];

  @ApiPropertyOptional({ type: [PayrollServiceRateDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayrollServiceRateDto)
  serviceRates?: PayrollServiceRateDto[];
}
