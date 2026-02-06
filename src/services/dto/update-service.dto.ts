import { IsString, IsInt, IsOptional, IsBoolean, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateServiceDto {
  @ApiProperty({ example: 'Haircut', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 60, required: false })
  @IsInt()
  @IsOptional()
  @Min(1)
  defaultDurationMin?: number;

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

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}




