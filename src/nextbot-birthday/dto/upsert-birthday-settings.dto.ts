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

  @ApiPropertyOptional({
    enum: BirthdayBonusType,
    description: 'Только BONUS_POINTS — начисление бонусных баллов',
  })
  @IsOptional()
  @IsEnum(BirthdayBonusType)
  bonusType?: BirthdayBonusType;

  @ApiPropertyOptional({
    example: 500,
    description: 'Количество бонусных баллов',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000)
  bonusValue?: number;

  @ApiPropertyOptional({
    example:
      '{{name}}, с наступающим днём рождения! Дарим {{bonusDescription}}. Ждём вас в {{studio}}.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  messageText?: string;
}
