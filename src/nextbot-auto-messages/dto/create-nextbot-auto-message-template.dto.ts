import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NextbotAutoMessageOffsetUnit,
  NextbotAutoMessageTiming,
} from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateNextbotAutoMessageTemplateDto {
  @ApiProperty({
    description: 'Категория услуг (должна быть доступна в выбранном филиале)',
  })
  @IsString()
  @IsNotEmpty()
  serviceCategoryId: string;

  @ApiProperty({
    enum: NextbotAutoMessageTiming,
    description: 'BEFORE_PROCEDURE — до процедуры; AFTER_PROCEDURE — после',
  })
  @IsEnum(NextbotAutoMessageTiming)
  timing: NextbotAutoMessageTiming;

  @ApiProperty({ example: 2, description: 'Число единиц смещения (минут/часов/дней)' })
  @IsInt()
  @Min(1)
  @Max(365)
  offsetValue: number;

  @ApiProperty({ enum: NextbotAutoMessageOffsetUnit })
  @IsEnum(NextbotAutoMessageOffsetUnit)
  offsetUnit: NextbotAutoMessageOffsetUnit;

  @ApiProperty({
    example: 'Здравствуйте, {{name}}! Напоминаем о записи на {{service}} {{appointmentDate}} в {{appointmentTime}}.',
    description: 'Текст с переменными {{name}}, {{service}}, … — см. GET .../variables',
  })
  @IsString()
  @IsNotEmpty()
  messageText: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
