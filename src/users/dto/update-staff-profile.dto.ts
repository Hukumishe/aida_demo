import { IsString, IsOptional, IsArray, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateStaffProfileDto {
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
}












