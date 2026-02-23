import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsInt, Min } from 'class-validator';

export class CreateTransferDto {
  @ApiProperty({ description: 'ID склада назначения (филиала)' })
  @IsUUID()
  toWarehouseId: string;

  @ApiProperty({ description: 'ID товара' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 5, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class TransferToBranchDto {
  @ApiProperty({ description: 'ID товара' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 5, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}
