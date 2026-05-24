import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  NextbotAutoMessageAnchor,
  NextbotAutoMessageDirection,
  NextbotAutoMessageOffsetUnit,
  NextbotAutoMessageTriggerType,
} from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateNextbotAutoMessageTemplateDto {
  @ApiPropertyOptional({ enum: NextbotAutoMessageTriggerType })
  @IsOptional()
  @IsEnum(NextbotAutoMessageTriggerType)
  triggerType?: NextbotAutoMessageTriggerType;

  @ApiPropertyOptional({ enum: NextbotAutoMessageAnchor })
  @IsOptional()
  @IsEnum(NextbotAutoMessageAnchor)
  anchor?: NextbotAutoMessageAnchor;

  @ApiPropertyOptional({ enum: NextbotAutoMessageDirection })
  @IsOptional()
  @IsEnum(NextbotAutoMessageDirection)
  direction?: NextbotAutoMessageDirection;

  @ApiPropertyOptional({ description: 'null — снять привязку к категории' })
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsString()
  serviceCategoryId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  offsetValue?: number;

  @ApiPropertyOptional({ enum: NextbotAutoMessageOffsetUnit })
  @IsOptional()
  @IsEnum(NextbotAutoMessageOffsetUnit)
  offsetUnit?: NextbotAutoMessageOffsetUnit;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsInt()
  @Min(1)
  @Max(365)
  minLeadDays?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  messageText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
