import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateClientDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe', required: false })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ example: '+79991234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: '1990-05-15', required: false, description: 'День рождения (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'birthDate must be YYYY-MM-DD' })
  birthDate?: string;

  @ApiProperty({ example: 'Regular client, prefers morning appointments', required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ example: 0, required: false, description: 'Бонусные баллы' })
  @IsInt()
  @Min(0)
  @IsOptional()
  bonuses?: number;

  @ApiProperty({ example: 0, required: false, description: 'Скидка в процентах (0-100)' })
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  discount?: number;

  @ApiProperty({ example: 0, required: false, description: 'Баланс в тенге' })
  @IsInt()
  @Min(0)
  @IsOptional()
  balance?: number;
}




