import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class NextbotSurveyDto {
  @ApiProperty({ description: 'Ответы анкеты (произвольная структура)' })
  @IsObject()
  answers: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Дописать к существующим notes вместо замены' })
  @IsOptional()
  @IsBoolean()
  merge?: boolean;

  @ApiPropertyOptional({ example: 'nextbot_survey' })
  @IsOptional()
  @IsString()
  label?: string;
}
