import { IsInt, IsOptional, IsBoolean, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateServiceOverrideDto {
  @ApiProperty({
    example: 90,
    description: 'Custom duration in minutes for this service',
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMin?: number;

  @ApiProperty({
    example: 5000,
    description: 'Custom price for this service (in smallest currency unit, e.g., tenge)',
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @ApiProperty({
    example: true,
    description: 'Whether this override is active',
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}










