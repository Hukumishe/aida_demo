import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateStaffPhoneDto {
  @ApiProperty({ example: '+77001234567', description: 'Новый телефон для входа в CRM' })
  @IsString()
  @IsNotEmpty()
  phone: string;
}
