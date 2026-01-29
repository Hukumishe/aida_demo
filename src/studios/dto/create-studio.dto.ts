import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStudioDto {
  @ApiProperty({ example: 'Beauty Studio Moscow' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Moscow, Tverskaya st. 1', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ example: 'Europe/Moscow', required: false })
  @IsString()
  @IsOptional()
  timezone?: string;
}

