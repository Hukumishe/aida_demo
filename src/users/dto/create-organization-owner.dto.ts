import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Первый владелец организации (сетевой OWNER, без привязки к филиалу). */
export class CreateOrganizationOwnerDto {
  @ApiProperty({ example: '+79991234567', description: 'Логин в системе — по телефону' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Иван' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Иванов', required: false })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ required: false })
  @IsEmail()
  @IsOptional()
  email?: string;
}
