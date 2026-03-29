import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Matches, Min } from 'class-validator';
import {
  READABLE_ENTITY_ID_MESSAGE,
  READABLE_ENTITY_ID_REGEX,
} from '../../common/id-generator';

export class CreateReceiptDto {
  @ApiProperty({ description: 'ID товара', example: 'prd_abc12defgh3' })
  @Matches(READABLE_ENTITY_ID_REGEX, { message: READABLE_ENTITY_ID_MESSAGE })
  productId: string;

  @ApiProperty({ example: 10, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateWriteOffDto {
  @ApiProperty({ description: 'ID товара', example: 'prd_abc12defgh3' })
  @Matches(READABLE_ENTITY_ID_REGEX, { message: READABLE_ENTITY_ID_MESSAGE })
  productId: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({
    description:
      'ID мастера филиала (User с ролью MASTER), в пользу которого оформляется списание',
    example: 'usr_xyz98abc12',
  })
  @Matches(READABLE_ENTITY_ID_REGEX, { message: READABLE_ENTITY_ID_MESSAGE })
  forStaffUserId: string;
}
