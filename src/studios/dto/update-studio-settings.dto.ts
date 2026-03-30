import { IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReferFriendInviteeRewardType, ReferFriendReferrerRewardType } from '@prisma/client';

export class UpdateStudioSettingsDto {
  @ApiPropertyOptional({
    example: 30,
    minimum: 0,
    maximum: 100,
    description: 'Глобальный лимит оплаты бонусами, %',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  globalBonusPaymentLimitPercent?: number;

  @ApiPropertyOptional({
    description: 'Маркетинг: включить акцию «приведи друга». При true в том же или следующем запросе должны быть заданы типы и значения наград.',
  })
  @IsOptional()
  @IsBoolean()
  referFriendEnabled?: boolean;

  @ApiPropertyOptional({ enum: ReferFriendInviteeRewardType })
  @IsOptional()
  @IsEnum(ReferFriendInviteeRewardType)
  referFriendInviteeRewardType?: ReferFriendInviteeRewardType;

  @ApiPropertyOptional({
    description: 'Для приглашённого: % скидки на сумму визита или % бонусов от оплаты деньгами (0–100)',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  referFriendInviteeValue?: number;

  @ApiPropertyOptional({ enum: ReferFriendReferrerRewardType })
  @IsOptional()
  @IsEnum(ReferFriendReferrerRewardType)
  referFriendReferrerRewardType?: ReferFriendReferrerRewardType;

  @ApiPropertyOptional({
    description:
      'Для пригласившего: при PERCENT_OF_PAYMENT — 0–100 (% от оплаты деньгами приглашённого); при FIXED_AMOUNT — сумма в мин. единицах (₸)',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  referFriendReferrerValue?: number;
}
