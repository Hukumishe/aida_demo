import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAppointmentDto {
  @ApiProperty({ example: 'user-uuid' })
  @IsString()
  @IsNotEmpty()
  staffUserId: string;

  @ApiProperty({ example: 'client-uuid' })
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({ example: 'service-uuid' })
  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @ApiProperty({ example: '2024-01-15T10:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  startAt: string;

  @ApiProperty({ example: 1000, required: false })
  @IsInt()
  @IsOptional()
  @Min(0)
  prepaymentAmount?: number;
}

