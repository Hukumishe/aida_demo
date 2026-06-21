import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClientStaffDiaryVisibility } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateClientStaffDiaryEntryDto {
  @ApiProperty({ description: 'Обновлённый текст заметки' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body: string;

  @ApiPropertyOptional({
    enum: ClientStaffDiaryVisibility,
    description: 'Сменить тип заметки (только автор-мастер)',
  })
  @IsOptional()
  @IsEnum(ClientStaffDiaryVisibility)
  visibility?: ClientStaffDiaryVisibility;
}
