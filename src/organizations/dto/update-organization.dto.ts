import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { IsIanaTimezone } from '../../common/validators/is-iana-timezone.decorator';

export class UpdateOrganizationDto {
  @ApiPropertyOptional({
    example: 'Asia/Almaty',
    description: 'Часовой пояс организации (IANA). Используется как дефолт на уровне тенанта.',
  })
  @IsOptional()
  @IsString()
  @IsIanaTimezone()
  ianaTimezone?: string;
}
