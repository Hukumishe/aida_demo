import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AppointmentStatus,
  NextbotAutoMessageAnchor,
  NextbotAutoMessageDirection,
  NextbotAutoMessageOffsetUnit,
  NextbotAutoMessageTriggerType,
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
  ValidateIf,
} from 'class-validator';

export class CreateNextbotAutoMessageTemplateDto {
  @ApiProperty({ enum: NextbotAutoMessageTriggerType })
  @IsEnum(NextbotAutoMessageTriggerType)
  triggerType: NextbotAutoMessageTriggerType;

  @ApiPropertyOptional({ enum: NextbotAutoMessageAnchor })
  @ValidateIf((o) => o.triggerType !== NextbotAutoMessageTriggerType.STATUS_CHANGED)
  @IsEnum(NextbotAutoMessageAnchor)
  anchor?: NextbotAutoMessageAnchor;

  @ApiPropertyOptional({ enum: NextbotAutoMessageDirection })
  @ValidateIf((o) => o.triggerType !== NextbotAutoMessageTriggerType.STATUS_CHANGED)
  @IsEnum(NextbotAutoMessageDirection)
  direction?: NextbotAutoMessageDirection;

  @ApiPropertyOptional({
    description:
      'Категория услуг. Не передавать — без фильтра (подтверждение, напоминания, холд). Для follow-up/feedback — обязательна.',
  })
  @IsOptional()
  @IsString()
  serviceCategoryId?: string;

  @ApiPropertyOptional({
    enum: AppointmentStatus,
    description:
      'Для STATUS_CHANGED: статус записи, при переходе в который отправить сообщение.',
  })
  @ValidateIf((o) => o.triggerType === NextbotAutoMessageTriggerType.STATUS_CHANGED)
  @IsEnum(AppointmentStatus)
  triggerOnStatus?: AppointmentStatus;

  @ApiPropertyOptional({
    example: 2,
    description: 'Не используется для STATUS_CHANGED (можно 1).',
  })
  @ValidateIf((o) => o.triggerType !== NextbotAutoMessageTriggerType.STATUS_CHANGED)
  @IsInt()
  @Min(1)
  @Max(365)
  offsetValue?: number;

  @ApiPropertyOptional({ enum: NextbotAutoMessageOffsetUnit })
  @ValidateIf((o) => o.triggerType !== NextbotAutoMessageTriggerType.STATUS_CHANGED)
  @IsEnum(NextbotAutoMessageOffsetUnit)
  offsetUnit?: NextbotAutoMessageOffsetUnit;

  @ApiPropertyOptional({
    example: 2,
    description:
      'Только для REMINDER_BEFORE_VISIT: мин. суток между bookedAt и startAt (например 2 для напоминания за сутки).',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  minLeadDays?: number;

  @ApiProperty({
    example:
      'Здравствуйте, {{name}}! Напоминаем о записи на {{service}} {{appointmentDate}} в {{appointmentTime}}.',
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
