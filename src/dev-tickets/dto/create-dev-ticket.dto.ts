import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDevTicketDto {
  @ApiProperty({ example: 'Не сохраняется запись на лендинге' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title!: string;

  @ApiProperty({ description: 'Суть проблемы' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  problemDescription!: string;

  @ApiPropertyOptional({ description: 'Как воспроизвести / что делали перед ошибкой' })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  howItHappened?: string;

  @ApiPropertyOptional({
    description: 'URL картинок после POST /upload/landing (или других upload-эндпоинтов)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  screenshotUrls?: string[];
}
