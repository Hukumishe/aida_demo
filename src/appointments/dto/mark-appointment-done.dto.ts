import { IsOptional, IsInt, Min, IsString, MaxLength, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VisitPaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';

export class MarkAppointmentDoneDto {
  @ApiPropertyOptional({
    description:
      'Устарело и игнорируется: сумма оплаты считается на сервере (GET /appointments/:id/done-checkout).',
    deprecated: true,
    example: 8500,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  completedMoneyPaid?: number;

  @ApiPropertyOptional({
    description: 'Сколько бонусов (кэшбека) списано при оплате',
    example: 500,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bonusesUsed?: number;

  @ApiPropertyOptional({
    enum: VisitPaymentMethod,
    description: 'Тип оплаты: наличные, перевод, Kaspi Pay',
    example: VisitPaymentMethod.CASH,
  })
  @IsOptional()
  @IsEnum(VisitPaymentMethod)
  paymentMethod?: VisitPaymentMethod;

  @ApiPropertyOptional({
    description:
      'Устарело: реферальный код задаётся при создании клиента или первой записи. Поле игнорируется.',
    example: 'ABC123',
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  referralCode?: string;

  /** @deprecated Используйте bonusesUsed */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  completedBonusesUsed?: number;
}
