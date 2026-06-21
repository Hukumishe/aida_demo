import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListAppointmentsQueryDto {
  @ApiPropertyOptional({ description: 'Один день (YYYY-MM-DD). Не комбинировать с from/to.' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Начало периода (YYYY-MM-DD). С to — ответ с summary и items.',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Конец периода (YYYY-MM-DD). С from — ответ с summary и items.',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    description: 'Только записи, созданные указанным пользователем (автор)',
  })
  @IsOptional()
  @IsString()
  createdByUserId?: string;

  @ApiPropertyOptional({
    description: 'true — только записи, созданные текущим пользователем',
  })
  @IsOptional()
  @IsString()
  onlyMine?: string;

  @ApiPropertyOptional({
    description: 'Только записи к указанному мастеру (исполнитель визита)',
  })
  @IsOptional()
  @IsString()
  staffUserId?: string;

  @ApiPropertyOptional({
    description: 'Пагинация: размер страницы (только с from+to). summary.count — по всему периоду.',
    minimum: 1,
    maximum: 500,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @ApiPropertyOptional({ description: 'Пагинация: смещение (только с from+to)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
