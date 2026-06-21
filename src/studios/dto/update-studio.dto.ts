import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStudioDto {
  @ApiPropertyOptional({ example: 'БЦ LOTOS' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({
    example: 'Макатаева 117',
    nullable: true,
    description: 'null или пустая строка — очистить адрес',
  })
  @IsOptional()
  @IsString()
  address?: string | null;
}
