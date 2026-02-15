import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty } from 'class-validator';

export class AddStaffServiceDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Service ID to add to staff member',
  })
  @IsUUID()
  @IsNotEmpty()
  serviceId: string;
}





