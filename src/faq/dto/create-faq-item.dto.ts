import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Создание элемента FAQ. category/isPublished/sortOrder опциональные — если
 * не переданы, бэкенд поставит разумные дефолты (null / true / «в конец списка»).
 */
export class CreateFaqItemDto {
  @ApiProperty({
    description: 'Вопрос. Отображается как заголовок аккордеона на лендинге.',
    example: 'Как отменить запись?',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(500)
  question: string;

  @ApiProperty({
    description:
      'Ответ в формате Markdown. Поддерживаются заголовки, списки, ссылки, **жирный**, ' +
      '*курсив*. Рендерится на лендинге и в превью админки.',
    example:
      'Запись можно отменить **не позднее чем за 2 часа** до её начала:\n' +
      '1. В личном кабинете на странице «Мои записи»\n' +
      '2. Или написать администратору: +7 (701) 123-45-67',
    maxLength: 10000,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(10000)
  answer: string;

  @ApiPropertyOptional({
    description:
      'Произвольный тег/категория для группировки элементов на лендинге ' +
      '(«Оплата», «Запись», «Бонусы»…). Пустая строка трактуется как null.',
    example: 'Запись',
    maxLength: 64,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string | null;

  @ApiPropertyOptional({
    description:
      'Опубликовано ли. false = черновик, виден только в админке; true = на публичном лендинге. ' +
      'По умолчанию true.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({
    description:
      'Порядок сортировки (чем меньше, тем выше). Если не передан, ' +
      'элемент ставится в конец: max(sortOrder) + 10.',
    minimum: 0,
    maximum: 1_000_000,
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  sortOrder?: number;
}
