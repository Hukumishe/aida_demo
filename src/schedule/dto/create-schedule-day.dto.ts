import { IsString, IsNotEmpty, IsOptional, IsBoolean, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateScheduleDayDto {
  @ApiProperty({ example: 'user-uuid' })
  @IsString()
  @IsNotEmpty()
  staffUserId: string;

  @ApiProperty({ example: '2024-01-15' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' })
  date: string;

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

  @ApiProperty({ example: false, required: false })
  @IsBoolean()
  @IsOptional()
  isDayOff?: boolean;
}

