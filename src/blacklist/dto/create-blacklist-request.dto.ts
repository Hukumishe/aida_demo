import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBlacklistRequestDto {
  @ApiProperty({
    example: 'Клиент не пришел на запись несколько раз',
    required: true,
    description: 'Причина добавления в черный список',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;
}


