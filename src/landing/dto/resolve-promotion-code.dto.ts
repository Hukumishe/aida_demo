import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ResolvePromotionCodeDto {
  @ApiProperty({ example: 'ABC123', description: 'Промокод акции' })
  @IsString()
  @IsNotEmpty()
  code: string;
}
