import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class StaffProfileQueryDto {
  @ApiPropertyOptional({
    description: 'Начало периода (YYYY-MM-DD или ISO datetime). По умолчанию — 1-е число текущего месяца в TZ филиала.',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Конец периода (YYYY-MM-DD или ISO datetime). По умолчанию — последний день текущего месяца в TZ филиала.',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    description:
      'Филиал для подсчёта. По умолчанию — текущий филиал пользователя (JWT). Для owner без studioId — все филиалы, где работает мастер.',
  })
  @IsOptional()
  @IsString()
  studioId?: string;
}
