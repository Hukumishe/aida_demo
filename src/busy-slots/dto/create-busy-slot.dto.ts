import { IsString, IsNotEmpty, IsOptional, IsInt, IsDateString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBusySlotDto {
  @ApiProperty({ example: 'user-uuid' })
  @IsString()
  @IsNotEmpty()
  staffUserId: string;

  @ApiProperty({ 
    example: '2024-01-15T10:00:00+06:00',
    description: 'ISO 8601 date-time string with timezone offset. For Almaty use +06:00'
  })
  @IsDateString()
  @IsNotEmpty()
  startAt: string;

  @ApiProperty({ 
    example: '2024-01-15T12:00:00+06:00',
    description: 'ISO 8601 date-time string with timezone offset. For Almaty use +06:00'
  })
  @IsDateString()
  @IsNotEmpty()
  endAt: string;

  @ApiProperty({
    example: 'Личные дела',
    required: false,
    description:
      'Причина брони / комментарий. Обязательно для личного времени MASTER; для ADMIN при брони мастера — тоже обязательно.',
  })
  @IsString()
  @IsOptional()
  comment?: string;

  @ApiProperty({ example: 1000, required: false })
  @IsInt()
  @IsOptional()
  @Min(0)
  forfeitedPrepaymentAmount?: number;
}


