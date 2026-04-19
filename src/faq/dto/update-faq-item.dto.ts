import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Частичное обновление элемента FAQ. Все поля опциональные — бэкенд
 * трогает только те, что были переданы в теле. Пустая строка в category
 * трактуется как очистка (сохраняется null).
 */
export class UpdateFaqItemDto {
  @ApiPropertyOptional({ description: 'Вопрос', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  question?: string;

  @ApiPropertyOptional({ description: 'Ответ (Markdown)', maxLength: 10000 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  answer?: string;

  @ApiPropertyOptional({
    description: 'Категория (тег). null или "" — очистить.',
    maxLength: 64,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(64)
  category?: string | null;

  @ApiPropertyOptional({ description: 'Опубликовано / черновик' })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({
    description: 'Порядок сортировки',
    minimum: 0,
    maximum: 1_000_000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  sortOrder?: number;
}
