import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateClientDto {
  @ApiProperty({ example: 'John', required: false })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({ example: 'Doe', required: false })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ example: '+79991234567', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'Regular client, prefers morning appointments', required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ example: 100, required: false, description: 'Бонусные баллы' })
  @IsInt()
  @Min(0)
  @IsOptional()
  bonuses?: number;

  @ApiProperty({ example: 10, required: false, description: 'Скидка в процентах (0-100)' })
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  discount?: number;

  @ApiProperty({ example: 5000, required: false, description: 'Баланс в тенге' })
  @IsInt()
  @Min(0)
  @IsOptional()
  balance?: number;
}




