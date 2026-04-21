import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateServiceSubcategoryDto {
  @ApiProperty({ example: 'Ўугаринг женский 1 категори€' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({
    example: 0,
    required: false,
    description: 'ѕор€док сортировки внутри категории (меньше Ч выше)',
  })
  @IsInt()
  @IsOptional()
  @Min(0)
  sortOrder?: number;

  @ApiProperty({
    required: false,
    default: true,
    description: 'ƒоступность подкатегории в каталоге',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}