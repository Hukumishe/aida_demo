import { IsInt, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BonusAdjustmentDto {
  @ApiProperty({ example: 500, description: 'Сумма корректировки: положительная — начисление, отрицательная — списание' })
  @IsInt()
  amount: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  comment?: string;
}
