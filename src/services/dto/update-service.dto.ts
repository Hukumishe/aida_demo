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

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

