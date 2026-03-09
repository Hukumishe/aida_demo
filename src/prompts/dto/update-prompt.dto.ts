import { IsString, IsOptional, Matches, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const KEY_PATTERN = /^[a-zA-Z0-9_]+$/;

export class UpdatePromptDto {
  @ApiPropertyOptional({ description: 'Название промпта: только латиница без пробелов' })
  @IsOptional()
  @IsString()
  @Matches(KEY_PATTERN, {
    message: 'Название промпта должно содержать только латинские буквы, цифры и подчёркивание, без пробелов',
  })
  @MaxLength(128)
  key?: string;

  @ApiPropertyOptional({ description: 'Описание промпта (эмодзи поддерживаются)' })
  @IsOptional()
  @IsString()
  description?: string;
}
