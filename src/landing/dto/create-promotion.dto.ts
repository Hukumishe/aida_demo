import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
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
  @ApiProperty({ enum: LandingPromotionType, description: 'Тип акции: скидка или 1+1' })
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

  // --- DISCOUNT ---

  @ApiPropertyOptional({
    description: 'Для типа DISCOUNT: список услуг, на которые действует акция',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ValidateIf((o) => o.type === LandingPromotionType.DISCOUNT)
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
    description: 'Для типа ONE_PLUS_ONE: общая цена за две услуги',
    minimum: 0,
  })
  @IsOptional()
  @ValidateIf((o) => o.type === LandingPromotionType.ONE_PLUS_ONE)
  @IsInt()
  @Min(0)
  bundlePrice?: number;
}
*** End Patch`"}]} ***!
