import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateServiceCategoryDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

  @ApiProperty({ required: false })
  @IsInt()
  @IsOptional()
  @Min(0)
  sortOrder?: number;
}
