import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { ProductUnit } from '@prisma/client';

export class CreateProductDto {
  @ApiProperty({ example: 'Воск для депиляции' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Для чувствительной кожи' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'ART-001' })
  @IsString()
  @IsOptional()
  article?: string;

  @ApiProperty({ enum: ProductUnit, example: ProductUnit.KG, description: 'Единица: Кг / шт / мл' })
  @IsEnum(ProductUnit)
  unit: ProductUnit;

  @ApiPropertyOptional({ example: 10, description: 'Начальное кол-во (при добавлении на склад)' })
  @IsInt()
  @Min(0)
  @IsOptional()
  initialQuantity?: number;
}
