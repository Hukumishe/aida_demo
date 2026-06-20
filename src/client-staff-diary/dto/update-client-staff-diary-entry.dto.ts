import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateClientStaffDiaryEntryDto {
  @ApiProperty({ description: 'Обновлённый текст заметки' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body: string;
}
