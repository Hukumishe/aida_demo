import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateLandingCategoryCardDto {
  @ApiProperty({ description: 'ID категории услуг из CRM' })
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @ApiPropertyOptional({
    description: 'Заголовок карточки на лендинге (если не указан, используется имя категории)',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Описание для лендинга (если не указано, используется description категории из CRM)',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Порядок отображения (чем меньше, тем выше)', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
