import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateIf } from 'class-validator';

export class TargetPromoActivateDto {
  @ApiPropertyOptional({
    description: 'Текст сообщения клиента (должен совпадать с promoText)',
    example: 'ХОЧУ СКИДКУ 20',
  })
  @ValidateIf((o) => !o.promoId?.trim())
  @IsString()
  @IsNotEmpty()
  promoText?: string;

  @ApiPropertyOptional({ description: 'ID промо из get_company_context.targetPromos' })
  @ValidateIf((o) => !o.promoText?.trim())
  @IsString()
  @IsNotEmpty()
  promoId?: string;

  @ApiPropertyOptional({ example: '+77001234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 14325361 })
  @IsOptional()
  @IsInt()
  @Min(1)
  dialogId?: number;
}
