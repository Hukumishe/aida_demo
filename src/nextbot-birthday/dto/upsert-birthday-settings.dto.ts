import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BirthdayBonusType, ClientLevel } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpsertBirthdaySettingsDto {
  @ApiPropertyOptional({ description: 'Включить сценарий «День рождения»' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    enum: ClientLevel,
    description: 'Минимальный ранг лояльности (включительно)',
    default: 'BRONZE',
  })
  @IsOptional()
  @IsEnum(ClientLevel)
  minClientLevel?: ClientLevel;

  @ApiPropertyOptional({
    example: 3,
    description: 'За сколько дней до дня рождения отправить (0 — в день ДР)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  daysBeforeBirthday?: number;

  @ApiPropertyOptional({ enum: BirthdayBonusType })
  @IsOptional()
  @IsEnum(BirthdayBonusType)
  bonusType?: BirthdayBonusType;

  @ApiPropertyOptional({
    example: 500,
    description: 'Баллы или % скидки в зависимости от bonusType',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000)
  bonusValue?: number;

  @ApiPropertyOptional({
    example: 7,
    description: 'Срок действия скидки в сутках (обязательно для DISCOUNT_PERCENT)',
  })
  @IsOptional()
  @ValidateIf((o) => o.bonusType === BirthdayBonusType.DISCOUNT_PERCENT)
  @IsInt()
  @Min(1)
  @Max(365)
  discountValidDays?: number;

  @ApiPropertyOptional({
    example:
      '{{name}}, с наступающим днём рождения! Дарим {{bonusDescription}}. Ждём вас в {{studio}}.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  messageText?: string;
}
