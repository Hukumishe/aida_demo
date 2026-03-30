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

  @ApiProperty({ 
    example: '2024-01-15T10:00:00+06:00',
    description: 'ISO 8601 date-time string with timezone offset. For Almaty use +06:00 (e.g., 2024-01-15T09:00:00+06:00 for 9:00 AM Almaty time)'
  })
  @IsDateString()
  @IsNotEmpty()
  startAt: string;

  @ApiProperty({ example: 1000, required: false })
  @IsInt()
  @IsOptional()
  @Min(0)
  prepaymentAmount?: number;

  @ApiProperty({
    required: false,
    description:
      'Реферальный код другого клиента, если у нового клиента ещё не указан пригласивший и это первая запись в системе. Не промокод лендинга.',
    example: 'ABC123',
  })
  @IsOptional()
  @IsString()
  referralCode?: string;
}


