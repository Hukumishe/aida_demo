import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpdateLandingWhatsAppSettingsDto {
  @ApiPropertyOptional({
    description:
      'Номер WhatsApp менеджера для лендинга. Передайте null или пустую строку, чтобы очистить.',
    example: '+77011234567',
    nullable: true,
    maxLength: 32,
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(32)
  whatsappPhone?: string | null;

  @ApiPropertyOptional({
    description:
      'Приветственный текст, который подставляется в WhatsApp перед отправкой. Передайте null или пустую строку, чтобы очистить.',
    example: 'Здравствуйте! Хочу записаться на услугу.',
    nullable: true,
    maxLength: 1000,
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(1000)
  whatsappPrefillMessage?: string | null;
}
