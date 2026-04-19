import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
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

  @ApiPropertyOptional({
    description:
      'Рабочие часы ОТДЕЛА МАРКЕТИНГА: ЧАС НАЧАЛА смены по локальному времени студии (0..23). ' +
      'Nextbot использует интервал [marketingHoursStartHour, marketingHoursEndHour) для маршрутизации оплаты: ' +
      'внутри интервала — дневной путь (задача маркетинг-менеджеру на выставление счёта Kaspi), вне — ночной путь (статичные реквизиты Kaspi + 30-мин таймер удержания брони). ' +
      'Передайте null для обоих полей, чтобы выключить ночной режим.',
    minimum: 0,
    maximum: 23,
    example: 9,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  @Min(0)
  @Max(23)
  marketingHoursStartHour?: number | null;

  @ApiPropertyOptional({
    description:
      'Рабочие часы ОТДЕЛА МАРКЕТИНГА: ЧАС ОКОНЧАНИЯ смены по локальному времени студии (0..23). ' +
      'Пара с marketingHoursStartHour; поддерживается переход через полночь (например 22 → 6).',
    minimum: 0,
    maximum: 23,
    example: 22,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  @Min(0)
  @Max(23)
  marketingHoursEndHour?: number | null;

  @ApiPropertyOptional({
    description:
      'Статичные реквизиты Kaspi: номер телефона получателя (используется в ночном промпте request_manager_invoice). ' +
      'Передайте null/пустую строку, чтобы очистить значение.',
    example: '+77011234567',
    maxLength: 32,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(32)
  paymentKaspiPhone?: string | null;

  @ApiPropertyOptional({
    description: 'Статичные реквизиты Kaspi: ФИО держателя карты (как показывать клиенту).',
    example: 'Иванов И. И.',
    maxLength: 128,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(128)
  paymentKaspiCardHolder?: string | null;

  @ApiPropertyOptional({
    description:
      'Ночной режим Nextbot: сколько МИНУТ держится предварительная бронь (TENTATIVE) до авто-отмены кроном, ' +
      'если клиент не прислал чек. Разумный диапазон 5..120. null → используется дефолт 30.',
    minimum: 1,
    maximum: 1440,
    example: 30,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  @Min(1)
  @Max(1440)
  nightHoldMinutes?: number | null;

  @ApiPropertyOptional({
    description:
      'Дневной путь request_manager_invoice: дедлайн задачи менеджеру на выставление счёта Kaspi, в ЧАСАХ ' +
      'от момента создания. Разумный диапазон 1..8. null → используется дефолт 2.',
    minimum: 1,
    maximum: 48,
    example: 2,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  @Min(1)
  @Max(48)
  dayInvoiceTaskDeadlineHours?: number | null;

  @ApiPropertyOptional({
    description:
      'Ночной путь verify_receipt_nighttime: дедлайн утренней задачи менеджеру на сверку чека с выпиской Kaspi, ' +
      'в ЧАСАХ от момента создания. Разумный диапазон 4..24. null → используется дефолт 12.',
    minimum: 1,
    maximum: 48,
    example: 12,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  @Min(1)
  @Max(48)
  nightReceiptTaskDeadlineHours?: number | null;
}
