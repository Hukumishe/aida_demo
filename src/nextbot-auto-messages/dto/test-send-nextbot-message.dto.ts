import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class TestSendNextbotMessageDto {
  @ApiProperty({
    example: 14325361,
    description: 'dialog_id чата в Nextbot (ваш или тестовый)',
  })
  @IsInt()
  @Min(1)
  dialogId: number;

  @ApiPropertyOptional({
    description:
      'Текст сообщения с {{переменными}}. Обязателен, если не передан templateId.',
    example: 'Тест: здравствуйте, {{name}}!',
  })
  @IsOptional()
  @IsString()
  messageText?: string;

  @ApiPropertyOptional({
    description:
      'Взять messageText из шаблона филиала (игнорируется messageText в теле, если оба — приоритет у messageText)',
  })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({
    description:
      'Запись для подстановки {{name}}, {{service}}, {{appointmentDate}} и т.д.',
  })
  @IsOptional()
  @IsString()
  appointmentId?: string;

  @ApiPropertyOptional({
    description:
      'Свои значения переменных (перекрывают данные из appointmentId). Ключи: name, service, …',
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { name: 'Анна', service: 'Маникюр' },
  })
  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;
}
