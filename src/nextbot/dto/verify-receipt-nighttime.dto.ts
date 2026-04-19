import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Тело POST /nextbot/verify-receipt-nighttime.
 *
 * Вызывается агентом строго ПОСЛЕ того, как:
 *   1) `request_manager_invoice` вернул ночной путь (holdExpiresAt проставлен),
 *   2) клиент прислал скрин/файл чека,
 *   3) агент (vision-моделью) уже визуально сверил на чеке название ИП, дату и сумму.
 *
 * Бэкенд:
 *   • переводит запись из TENTATIVE в PENDING_CONFIRMATION,
 *   • сбрасывает `holdExpiresAt` (крон больше не отменит бронь),
 *   • ставит утреннюю задачу на менеджера — сверить чек с выпиской Kaspi.
 *
 * Никаких тяжёлых артефактов чека в запросе нет — сам чек остаётся в чате
 * Nextbot → менеджер разберётся из переписки.
 */
export class VerifyReceiptNighttimeDto {
  @ApiProperty({
    description:
      'ID предварительной брони (TENTATIVE), созданной в ночном режиме через request_manager_invoice.',
    example: 'appt_01H...',
  })
  @IsString()
  @IsNotEmpty()
  appointmentId: string;

  @ApiPropertyOptional({
    description:
      'Универсальный номер клиента (whatsapp). Передаётся для привязки чека к профилю ' +
      'в описании утренней задачи; не используется для поиска записи.',
    example: '+77011234567',
  })
  @IsOptional()
  @IsString()
  phone?: string;
}
