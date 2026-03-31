import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';

export class CreateStudioReferralLinkDto {
  @ApiProperty({ description: 'Подставляется в поле «Источник» у клиента при регистрации по ссылке' })
  @IsString()
  @IsNotEmpty()
  sourceName: string;

  @ApiProperty({ description: 'Если true — начисляется % кэшбэка от оплаты деньгами (как логика бонусов)' })
  @IsBoolean()
  cashbackEnabled: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, description: 'Обязателен при cashbackEnabled = true' })
  @ValidateIf((o) => o.cashbackEnabled === true)
  @IsInt()
  @Min(1)
  @Max(100)
  cashbackPercent?: number;
}
