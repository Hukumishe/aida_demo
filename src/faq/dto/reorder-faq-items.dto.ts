import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReorderFaqItemDto {
  @ApiProperty({
    description: 'ID элемента FAQ (например, ofq_a1b2c3d4e5).',
    example: 'ofq_a1b2c3d4e5',
  })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    description: 'Новый порядок сортировки. Чем меньше, тем выше на лендинге.',
    minimum: 0,
    maximum: 1_000_000,
    example: 10,
  })
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  sortOrder: number;
}

/**
 * Массовая перестановка (drag-and-drop в админке). Фронт присылает финальный
 * порядок всех видимых элементов одним запросом, бэкенд делает upsert в
 * транзакции. Элементы, не переданные в items, не трогаются.
 */
export class ReorderFaqItemsDto {
  @ApiProperty({
    description: 'Новый порядок элементов FAQ',
    type: [ReorderFaqItemDto],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderFaqItemDto)
  items: ReorderFaqItemDto[];
}
