import { IsString, IsNotEmpty, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUpsellDto {
  @ApiProperty({ example: 'service-uuid', description: 'ID дополнительной услуги' })
  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @ApiProperty({ example: 1, description: 'Количество', required: false, default: 1 })
  @IsInt()
  @IsOptional()
  @Min(1)
  quantity?: number;

  @ApiProperty({ example: 5000, description: 'Цена за единицу в тенге' })
  @IsInt()
  @IsNotEmpty()
  @Min(0)
  price: number;

  @ApiProperty({ example: 'Дополнительно продали крем', required: false })
  @IsString()
  @IsOptional()
  comment?: string;
}

