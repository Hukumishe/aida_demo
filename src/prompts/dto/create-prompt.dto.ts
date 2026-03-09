import { IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const KEY_PATTERN = /^[a-zA-Z0-9_]+$/; // Строго латиница, цифры, подчёркивание, без пробелов

export class CreatePromptDto {
  @ApiProperty({ description: 'Название промпта: только латиница без пробелов', example: 'welcome_message' })
  @IsString()
  @Matches(KEY_PATTERN, {
    message: 'Название промпта должно содержать только латинские буквы, цифры и подчёркивание, без пробелов',
  })
  @MaxLength(128)
  key: string;

  @ApiProperty({ description: 'Описание промпта (произвольный текст, эмодзи поддерживаются)', example: 'Приветствие для новых клиентов 👋' })
  @IsString()
  description: string;
}
