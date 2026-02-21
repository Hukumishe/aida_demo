import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectBlacklistRequestDto {
  @ApiProperty({
    example: 'Недостаточно оснований',
    required: false,
    description: 'Причина отклонения запроса',
  })
  @IsOptional()
  @IsString()
  rejectedReason?: string;
}


