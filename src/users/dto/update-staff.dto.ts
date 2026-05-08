import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsBoolean,
  MinLength,
  IsArray,
  IsUrl,
  ArrayUnique,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../common/decorators/roles.decorator';

export class UpdateStaffDto {
  @ApiProperty({ example: 'john@example.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '+79991234567', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'password123', required: false })
  @IsString()
  @IsOptional()
  @MinLength(6)
  password?: string;

  @ApiProperty({ enum: UserRole, required: false })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiProperty({ example: 'John', required: false })
  @IsString()
  @IsOptional()
  firstName?: string;

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
  @IsBoolean()
  providesServices?: boolean;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

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

  @ApiProperty({
    required: false,
    type: [String],
    description:
      'Полный список филиалов, где работает сотрудник (только если у пользователя есть привязка к филиалу, studioId ≠ null). Первый элемент — основной филиал (user.studioId).',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMinSize(1)
  @IsString({ each: true })
  studioIds?: string[];
}




