import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LandingBookingRequestDto {
  @ApiProperty({ description: 'Филиал записи' })
  @IsString()
  @IsNotEmpty()
  studioId: string;

  @ApiProperty({ example: 'Айгуль' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  patronymic?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instagram?: string;

  @ApiProperty({ example: '+77001234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({ description: 'Услуга из карточки лендинга (service.id)' })
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiPropertyOptional({
    description: 'Мастер; не передавать при «Любой мастер» — обязателен staffUserId из выбранного слота',
  })
  @IsOptional()
  @IsString()
  staffUserId?: string;

  @ApiPropertyOptional({
    description: 'ISO 8601 с offset, напр. 2026-05-24T14:00:00+06:00',
  })
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({ description: 'Маркетинговая ссылка ?ref=' })
  @IsOptional()
  @IsString()
  referralLinkId?: string;

  @ApiPropertyOptional({ description: 'Промокод акции лендинга' })
  @IsOptional()
  @IsString()
  promoCode?: string;
}
