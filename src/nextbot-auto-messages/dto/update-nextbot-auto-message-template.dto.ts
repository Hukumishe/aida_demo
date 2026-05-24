import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  NextbotAutoMessageOffsetUnit,
  NextbotAutoMessageTiming,
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
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceCategoryId?: string;

  @ApiPropertyOptional({ enum: NextbotAutoMessageTiming })
  @IsOptional()
  @IsEnum(NextbotAutoMessageTiming)
  timing?: NextbotAutoMessageTiming;

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
