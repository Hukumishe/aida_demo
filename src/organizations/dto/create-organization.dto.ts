import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { IsIanaTimezone } from '../../common/validators/is-iana-timezone.decorator';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Сеть салонов Aurora' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    required: false,
    example: 'aurora',
    description: 'Уникальный slug (латиница, цифры, дефис)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]*$/i, { message: 'slug: только латиница, цифры и дефис' })
  slug?: string;

  @ApiPropertyOptional({
    example: 'Asia/Almaty',
    description: 'Часовой пояс организации (IANA). По умолчанию Asia/Almaty.',
  })
  @IsOptional()
  @IsString()
  @IsIanaTimezone()
  ianaTimezone?: string;
}
