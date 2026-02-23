import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, Min } from 'class-validator';
import { ProductUnit } from '@prisma/client';

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'Воск для депиляции' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'Для чувствительной кожи' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'ART-001' })
  @IsString()
  @IsOptional()
  article?: string;

  @ApiPropertyOptional({ enum: ProductUnit })
  @IsEnum(ProductUnit)
  @IsOptional()
  unit?: ProductUnit;
}
