import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUpsellDto {
  @ApiProperty({ example: 2, description: 'Количество', required: false })
  @IsInt()
  @IsOptional()
  @Min(1)
  quantity?: number;

  @ApiProperty({ example: 5000, description: 'Цена за единицу в тенге', required: false })
  @IsInt()
  @IsOptional()
  @Min(0)
  price?: number;

  @ApiProperty({ example: 'Обновленный комментарий', required: false })
  @IsString()
  @IsOptional()
  comment?: string;
}

