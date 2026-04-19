import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsInt,
  IsOptional,
  Min,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WaitlistEntrySource } from '@prisma/client';

export class CreateAppointmentDto {
  @ApiProperty({ example: 'user-uuid' })
  @IsString()
  @IsNotEmpty()
  staffUserId: string;

  @ApiProperty({ example: 'client-uuid' })
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({ example: 'service-uuid' })
  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @ApiProperty({ 
    example: '2024-01-15T10:00:00+06:00',
    description: 'ISO 8601 date-time string with timezone offset. For Almaty use +06:00 (e.g., 2024-01-15T09:00:00+06:00 for 9:00 AM Almaty time)'
  })
  @IsDateString()
  @IsNotEmpty()
  startAt: string;

  @ApiProperty({ example: 1000, required: false })
  @IsInt()
  @IsOptional()
  @Min(0)
  prepaymentAmount?: number;

  @ApiProperty({
    required: false,
    description:
      'Реферальный код другого клиента, если у нового клиента ещё не указан пригласивший и это первая запись в системе. Не промокод лендинга.',
    example: 'ABC123',
  })
  @IsOptional()
  @IsString()
  referralCode?: string;

  @ApiPropertyOptional({
    description:
      'Промокод акции с лендинга (передаётся с фронта после resolve-code; бэкенд принимает поле, чтобы не падала валидация). Хранение в записи — при появлении поля в модели.',
    example: 'NV2MHFM8',
  })
  @IsOptional()
  @IsString()
  promoCode?: string;

  @ApiPropertyOptional({
    description:
      'Если true и выбранный слот занят (пересечение с другой записью/перерывом/busy по полной длительности услуги) — создаётся заявка в листе ожидания вместо ответа 409. Для лендинга и Nextbot.',
  })
  @IsOptional()
  @IsBoolean()
  preferWaitlist?: boolean;

  @ApiPropertyOptional({
    enum: WaitlistEntrySource,
    description: 'Откуда заявка при preferWaitlist (по умолчанию CRM, если не передано).',
  })
  @IsOptional()
  @IsEnum(WaitlistEntrySource)
  waitlistSource?: WaitlistEntrySource;
}


