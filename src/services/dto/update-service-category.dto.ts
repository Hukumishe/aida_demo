import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, ValidateIf } from 'class-validator';

export class UpdateServiceCategoryDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

  @ApiProperty({ required: false })
  @IsInt()
  @IsOptional()
  @Min(0)
  sortOrder?: number;

  @ApiProperty({
    required: false,
    description:
      'Включить/выключить категорию в каталоге сети. Все услуги в категории получают тот же isActive.',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Описание категории. Передайте null, чтобы очистить.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(10000)
  description?: string | null;
}
