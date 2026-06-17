import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class LandingCategoryCardOrderDto {
  @ApiProperty({ description: 'ID карточки категории на лендинге' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Порядок отображения (чем меньше, тем выше)', minimum: 0 })
  @IsInt()
  @Min(0)
  order: number;
}

export class ReorderLandingCategoryCardsDto {
  @ApiProperty({ type: [LandingCategoryCardOrderDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LandingCategoryCardOrderDto)
  items: LandingCategoryCardOrderDto[];
}
