import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStudioDto {
  @ApiProperty({ example: 'Beauty Studio Almaty' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Almaty, Abay Ave 150', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ example: 'Asia/Almaty', required: false })
  @IsString()
  @IsOptional()
  timezone?: string;
}


