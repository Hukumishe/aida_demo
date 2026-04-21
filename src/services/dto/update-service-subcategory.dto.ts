import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateServiceSubcategoryDto {
  @ApiProperty({ required: false, example: 'Шугаринг женский ТОП мастеры' })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

  @ApiProperty({ required: false, example: 0 })
  @IsInt()
  @IsOptional()
  @Min(0)
  sortOrder?: number;

  @ApiProperty({ required: false, description: 'Включить/выключить подкатегорию в каталоге' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}