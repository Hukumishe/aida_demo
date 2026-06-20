import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateClientStaffDiaryEntryDto {
  @ApiProperty({
    description: 'Текст заметки в личном дневнике мастера',
    example: 'Аллергия на компонент X, предпочитает тихую музыку',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body: string;
}
