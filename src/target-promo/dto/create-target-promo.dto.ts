import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TargetPromoMechanicsType } from '@prisma/client';
import {
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

export class CreateTargetPromoDto {
  @ApiProperty({ description: 'Внутреннее название акции' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description:
      'Текст из рекламы Target — клиент должен написать его дословно (после trim)',
    example: 'ХОЧУ СКИДКУ 20',
  })
  @IsString()
  @IsNotEmpty()
  promoText: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional({ enum: TargetPromoMechanicsType })
  @IsOptional()
  @IsEnum(TargetPromoMechanicsType)
  mechanicsType?: TargetPromoMechanicsType;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @ValidateIf((o) => o.mechanicsType === TargetPromoMechanicsType.DISCOUNT_PERCENT)
  @IsInt()
  @Min(1)
  @Max(100)
  discountPercent?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @ValidateIf((o) => o.mechanicsType === TargetPromoMechanicsType.BONUS_POINTS)
  @IsInt()
  @Min(1)
  bonusPoints?: number;

  @ApiPropertyOptional({ description: 'Кратко для CRM / подсказка агенту' })
  @IsOptional()
  @IsString()
  mechanicsNote?: string;

  @ApiProperty({
    description: 'Инструкции для агента Nextbot после срабатывания промо',
  })
  @IsString()
  @IsNotEmpty()
  agentPrompt: string;

  @ApiPropertyOptional({ description: 'Лимит активаций (null — без лимита)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxActivations?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
