import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

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
}
