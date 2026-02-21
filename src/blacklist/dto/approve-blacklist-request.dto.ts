import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApproveBlacklistRequestDto {
  @ApiProperty({
    example: 'Одобрено',
    required: false,
    description: 'Комментарий при одобрении',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}


