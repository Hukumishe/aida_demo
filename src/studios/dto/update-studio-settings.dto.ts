import { IsInt, Min, Max, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateStudioSettingsDto {
  @ApiProperty({ example: 30, minimum: 0, maximum: 100, description: 'Глобальный лимит оплаты бонусами, % (только Owner)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  globalBonusPaymentLimitPercent?: number;
}
