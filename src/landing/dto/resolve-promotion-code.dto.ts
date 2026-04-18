import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ResolvePromotionCodeDto {
  @ApiProperty({ example: 'ABC123', description: 'Промокод акции' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    example: 'org_23456789ab',
    description:
      'ID организации. Обязателен для публичного вызова (без JWT). При вызове с JWT берётся из токена, query можно не передавать (DEVELOPER — опционально, чтобы указать чужую организацию).',
  })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({
    description:
      'ID филиала (опционально). Если передан, услуги в ответе фильтруются по тому, что реально доступно для записи в этом филиале (учитывается StudioDisabledService / StudioDisabledCategory). Если не передан — отдаётся каталог в рамках организации без фильтрации.',
  })
  @IsOptional()
  @IsString()
  studioId?: string;
}
