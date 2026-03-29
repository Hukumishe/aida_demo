import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Matches, Min } from 'class-validator';
import {
  READABLE_ENTITY_ID_MESSAGE,
  READABLE_ENTITY_ID_REGEX,
} from '../../common/id-generator';

export class CreateTransferDto {
  @ApiProperty({
    description: 'ID склада назначения (филиала)',
    example: 'whs_abc12defgh3',
  })
  @Matches(READABLE_ENTITY_ID_REGEX, { message: READABLE_ENTITY_ID_MESSAGE })
  toWarehouseId: string;

  @ApiProperty({ description: 'ID товара', example: 'prd_abc12defgh3' })
  @Matches(READABLE_ENTITY_ID_REGEX, { message: READABLE_ENTITY_ID_MESSAGE })
  productId: string;

  @ApiProperty({ example: 5, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class TransferToBranchDto {
  @ApiProperty({ description: 'ID товара', example: 'prd_abc12defgh3' })
  @Matches(READABLE_ENTITY_ID_REGEX, { message: READABLE_ENTITY_ID_MESSAGE })
  productId: string;

  @ApiProperty({ example: 5, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}
