import { IsString, IsNotEmpty, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateServiceDto {
  @ApiProperty({ example: 'Haircut' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 60 })
  @IsInt()
  @Min(1)
  defaultDurationMin: number;

  @ApiProperty({ example: 2000, required: false })
  @IsInt()
  @IsOptional()
  @Min(0)
  defaultPrice?: number;

  @ApiProperty({ example: 1, required: false, description: 'Количество человек для выполнения услуги' })
  @IsInt()
  @IsOptional()
  @Min(1)
  requiredStaffCount?: number;
}




