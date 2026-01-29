import { IsString, IsOptional, IsInt, IsDateString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateBusySlotDto {
  @ApiProperty({ example: '2024-01-15T10:00:00Z', required: false })
  @IsDateString()
  @IsOptional()
  startAt?: string;

  @ApiProperty({ example: '2024-01-15T12:00:00Z', required: false })
  @IsDateString()
  @IsOptional()
  endAt?: string;

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

