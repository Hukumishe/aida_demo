import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClientStaffDiaryVisibility } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateClientStaffDiaryEntryDto {
  @ApiProperty({
    description: 'Текст заметки',
    example: 'Аллергия на компонент X, предпочитает тихую музыку',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body: string;

  @ApiPropertyOptional({
    enum: ClientStaffDiaryVisibility,
    default: ClientStaffDiaryVisibility.PRIVATE,
    description:
      'PRIVATE — личная (в UI: «видите только вы»); SHARED — общая для всех с доступом к клиенту',
  })
  @IsOptional()
  @IsEnum(ClientStaffDiaryVisibility)
  visibility?: ClientStaffDiaryVisibility;
}
