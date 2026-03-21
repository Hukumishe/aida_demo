import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/** В CRM id услуги — строка (часто префикс `srv_`), не обязательно UUID. */
export class AddStaffServiceDto {
  @ApiProperty({
    example: 'srv_a1b2c3d4e5',
    description: 'ID услуги из каталога студии (формат srv_… или иной строковый id)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(128)
  serviceId: string;
}













