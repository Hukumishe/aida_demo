import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class LandingServiceCardOrderDto {
  @ApiProperty({ description: 'ID карточки лендинга' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Порядок отображения (чем меньше, тем выше)', minimum: 0 })
  @IsInt()
  @Min(0)
  order: number;
}

export class ReorderLandingServiceCardsDto {
  @ApiProperty({ type: [LandingServiceCardOrderDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LandingServiceCardOrderDto)
  items: LandingServiceCardOrderDto[];
}

