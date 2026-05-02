import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateServiceCategoryDto {
  @ApiProperty({ example: 'Стрижка' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 0, required: false, description: 'Порядок сортировки (меньше — выше в списке)' })
  @IsInt()
  @IsOptional()
  @Min(0)
  sortOrder?: number;

  @ApiProperty({
    required: false,
    default: true,
    description: 'Доступность категории в каталоге сети',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Текстовое описание категории услуг',
    example: 'Уход и регенерация кожи лица различными методами',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;
}
