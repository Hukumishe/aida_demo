import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { LandingPromotionType } from '@prisma/client';

export class CreateLandingPromotionDto {
  @ApiProperty({
    enum: LandingPromotionType,
    description: 'Тип акции: скидка, 1+1 (две услуги) или набор из N услуг (SERVICE_BUNDLE)',
  })
  @IsEnum(LandingPromotionType)
  type: LandingPromotionType;

  @ApiProperty({ description: 'Заголовок акции для лендинга' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Описание акции' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Включена ли акция (on/off). По умолчанию true' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description:
      'Дата и время окончания действия акции (ISO 8601). После этого промокод и акция не должны применяться на лендинге.',
    example: '2026-12-31T23:59:59+06:00',
  })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  // --- DISCOUNT ---

  @ApiPropertyOptional({
    description: 'Для типа DISCOUNT: список услуг, на которые действует акция',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ValidateIf(
    (o) => o.type === LandingPromotionType.DISCOUNT || o.type === LandingPromotionType.SERVICE_BUNDLE,
  )
  serviceIds?: string[];

  @ApiPropertyOptional({
    description: 'Для типа DISCOUNT: размер скидки в процентах (0–100)',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @ValidateIf((o) => o.type === LandingPromotionType.DISCOUNT)
  @IsInt()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  // --- ONE_PLUS_ONE ---

  @ApiPropertyOptional({
    description: 'Для типа ONE_PLUS_ONE: первая услуга в наборе',
  })
  @IsOptional()
  @ValidateIf((o) => o.type === LandingPromotionType.ONE_PLUS_ONE)
  @IsString()
  serviceIdA?: string;

  @ApiPropertyOptional({
    description: 'Для типа ONE_PLUS_ONE: вторая услуга в наборе',
  })
  @IsOptional()
  @ValidateIf((o) => o.type === LandingPromotionType.ONE_PLUS_ONE)
  @IsString()
  serviceIdB?: string;

  @ApiPropertyOptional({
    description: 'Для ONE_PLUS_ONE и SERVICE_BUNDLE: одна общая цена за весь набор услуг',
    minimum: 0,
  })
  @IsOptional()
  @ValidateIf(
    (o) =>
      o.type === LandingPromotionType.ONE_PLUS_ONE ||
      o.type === LandingPromotionType.SERVICE_BUNDLE,
  )
  @IsInt()
  @Min(0)
  bundlePrice?: number;
}
