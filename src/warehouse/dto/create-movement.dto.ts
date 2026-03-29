import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsInt, Min } from 'class-validator';

export class CreateReceiptDto {
  @ApiProperty({ description: 'ID товара' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 10, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateWriteOffDto {
  @ApiProperty({ description: 'ID товара' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({
    description:
      'ID мастера филиала (User с ролью MASTER), в пользу которого оформляется списание',
  })
  @IsUUID()
  forStaffUserId: string;
}
