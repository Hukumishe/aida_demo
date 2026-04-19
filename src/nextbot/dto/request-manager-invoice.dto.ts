import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Тело POST /nextbot/request-manager-invoice.
 * Бэкенд сам определяет день/ночь по локальному времени студии и настройкам организации:
 *   • day  → ставит задачу менеджеру филиала на выставление счёта Kaspi;
 *   • night → активирует 30-минутный таймер удержания предварительной брони
 *             (holdExpiresAt = now + 30 min) и возвращает промпт со статичными реквизитами Kaspi.
 */
export class RequestManagerInvoiceDto {
  @ApiProperty({
    description: 'ID предварительной брони (из create_booking_request).',
    example: 'appt_01H...',
  })
  @IsString()
  @IsNotEmpty()
  appointmentId: string;

  @ApiProperty({
    description:
      'Номер телефона клиента, к которому привязан Kaspi Банк. Используется менеджером при выставлении счёта.',
    example: '+77011234567',
  })
  @IsString()
  @IsNotEmpty()
  kaspiDetails: string;

  @ApiPropertyOptional({
    description:
      'Универсальный номер клиента (whatsapp). Опционален — используется только как вспомогательная информация для менеджера, при рассинхроне с Kaspi.',
    example: '+77011234567',
  })
  @IsOptional()
  @IsString()
  phone?: string;
}
