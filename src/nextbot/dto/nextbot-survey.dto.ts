import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class NextbotSurveyDto {
  @ApiProperty({
    description: 'Ответы анкеты (произвольный JSON-объект)',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  answers: Record<string, unknown>;

  @ApiProperty({
    required: false,
    default: true,
    description: 'Дописать блок к существующим notes клиента',
  })
  @IsOptional()
  @IsBoolean()
  mergeIntoNotes?: boolean;

  @ApiProperty({
    required: false,
    default: '[NEXTBOT_SURVEY]',
    description: 'Префикс блока в notes',
  })
  @IsOptional()
  @IsString()
  surveyPrefix?: string;
}
