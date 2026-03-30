import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { StudioLoyaltyMode } from '@prisma/client';

export class StudioLoyaltyTierItemDto {
  @ApiProperty({ minimum: 0, description: 'Порядок уровня: 0 = базовый' })
  @IsInt()
  @Min(0)
  sortOrder: number;

  @ApiProperty({ example: 'Серебро' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsInt()
  @Min(0)
  @Max(100)
  cashbackPercent: number;

  @ApiPropertyOptional({
    description:
      'Только ручное назначение (VIP). Не участвует в авто-переходах по вехам; в milestones нельзя ссылаться на этот sortOrder.',
  })
  @IsOptional()
  @IsBoolean()
  manualOnly?: boolean;
}

export class StudioLoyaltyMilestoneItemDto {
  @ApiProperty({ minimum: 0, description: 'Сумма оплат в студии (₸), с которой действует переход' })
  @IsInt()
  @Min(0)
  minTotalPaid: number;

  @ApiProperty({
    description:
      'На какой уровень (sortOrder) перейти при достижении порога. Можно перескочить уровни (например сразу на sortOrder 2).',
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  targetSortOrder: number;
}

export class UpdateStudioLoyaltyDto {
  @ApiProperty({ enum: StudioLoyaltyMode })
  @IsEnum(StudioLoyaltyMode)
  loyaltyMode: StudioLoyaltyMode;

  @ApiPropertyOptional({
    type: [StudioLoyaltyTierItemDto],
    description: 'Обязательно, если loyaltyMode = CUSTOM',
  })
  @ValidateIf((o) => o.loyaltyMode === StudioLoyaltyMode.CUSTOM)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => StudioLoyaltyTierItemDto)
  tiers?: StudioLoyaltyTierItemDto[];

  @ApiPropertyOptional({
    type: [StudioLoyaltyMilestoneItemDto],
    description:
      'Вехи перехода. Должна быть веха с minTotalPaid = 0 (обычно targetSortOrder = 0). Для классики: (0,0), (50000,1), (120000,2).',
  })
  @ValidateIf((o) => o.loyaltyMode === StudioLoyaltyMode.CUSTOM)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => StudioLoyaltyMilestoneItemDto)
  milestones?: StudioLoyaltyMilestoneItemDto[];
}
