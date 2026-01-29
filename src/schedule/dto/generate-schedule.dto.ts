import {
  IsString,
  IsNotEmpty,
  IsEnum,
  Matches,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum SchedulePattern {
  FIVE_TWO = '5/2',
  SIX_ONE = '6/1',
}

export class GenerateScheduleDto {
  @ApiProperty({ example: '5/2', enum: SchedulePattern })
  @IsEnum(SchedulePattern)
  @IsNotEmpty()
  pattern: SchedulePattern;

  @ApiProperty({ example: 'user-uuid' })
  @IsString()
  @IsNotEmpty()
  staffUserId: string;

  @ApiProperty({ example: '2024-01-01' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' })
  dateFrom: string;

  @ApiProperty({ example: '2024-01-31' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' })
  dateTo: string;

  @ApiProperty({ example: '09:00' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Time must be in HH:MM format' })
  startTime: string;

  @ApiProperty({ example: '18:00' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Time must be in HH:MM format' })
  endTime: string;

  @ApiProperty({ example: '13:00', required: false })
  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Time must be in HH:MM format' })
  breakStart?: string;

  @ApiProperty({ example: '14:00', required: false })
  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Time must be in HH:MM format' })
  breakEnd?: string;
}

