import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LandingPromoQuoteDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  studioId: string;

  @ApiProperty({ example: 'PROMO15' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    type: [String],
    description: 'Услуги в корзине (для DISCOUNT обычно одна из списка акции)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  serviceIds: string[];

  @ApiPropertyOptional({
    description: 'Мастер из выбранного слота — для цены/duration override',
  })
  @IsOptional()
  @IsString()
  staffUserId?: string;
}
