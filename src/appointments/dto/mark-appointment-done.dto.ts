import { IsOptional, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class MarkAppointmentDoneDto {
  @ApiPropertyOptional({
    description: 'Сколько бонусов клиент использовал при оплате этого визита',
    example: 500,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bonusesUsed?: number;
}
