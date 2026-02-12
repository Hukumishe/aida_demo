import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsEnum,
  MinLength,
  IsArray,
  IsUrl,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../common/decorators/roles.decorator';

export class CreateStaffDto {
  @ApiProperty({ example: 'john@example.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '+79991234567', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ enum: UserRole, example: UserRole.MASTER })
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;

  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe', required: false })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ example: 'Senior Master', required: false })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({ example: 'Hair Stylist', required: false })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  providesServices?: boolean;

  @ApiProperty({ example: 'https://example.com/avatar.jpg', required: false })
  @IsString()
  @IsOptional()
  @IsUrl()
  avatar?: string;

  @ApiProperty({ example: 'Опытный мастер с 10-летним стажем', required: false })
  @IsString()
  @IsOptional()
  bio?: string;

  @ApiProperty({
    example: ['https://example.com/work1.jpg', 'https://example.com/work2.jpg'],
    required: false,
    type: [String],
  })
  @IsArray()
  @IsOptional()
  @IsUrl({}, { each: true })
  portfolioPhotos?: string[];

  @ApiProperty({ example: '1-я категория', required: false })
  @IsString()
  @IsOptional()
  rank?: string;
}




