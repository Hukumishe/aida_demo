import { IsString, IsNotEmpty, IsOptional, IsInt, IsDateString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBusySlotDto {
  @ApiProperty({ example: 'user-uuid' })
  @IsString()
  @IsNotEmpty()
  staffUserId: string;

  @ApiProperty({ example: '2024-01-15T10:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  startAt: string;

  @ApiProperty({ example: '2024-01-15T12:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  endAt: string;

  @ApiProperty({ example: 'Personal appointment', required: false })
  @IsString()
  @IsOptional()
  comment?: string;

  @ApiProperty({ example: 1000, required: false })
  @IsInt()
  @IsOptional()
  @Min(0)
  forfeitedPrepaymentAmount?: number;
}

