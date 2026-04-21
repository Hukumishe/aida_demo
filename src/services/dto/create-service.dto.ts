import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  Min,
  IsEnum,
  Matches,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ServiceAudience } from '@prisma/client';
import {
  READABLE_ENTITY_ID_MESSAGE,
  READABLE_ENTITY_ID_REGEX,
} from '../../common/id-generator';

export class CreateServiceDto {
  @ApiProperty({ example: 'Haircut' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 60 })
  @IsInt()
  @Min(1)
  defaultDurationMin: number;

  @ApiProperty({ example: 2000, required: false })
  @IsInt()
  @IsOptional()
  @Min(0)
  defaultPrice?: number;

  @ApiProperty({ example: 1, required: false, description: 'Количество человек для выполнения услуги' })
  @IsInt()
  @IsOptional()
  @Min(1)
  requiredStaffCount?: number;

  @ApiProperty({
    description: 'ID категории услуги этой студии (обязательно; категории создаются отдельно)',
    example: 'sca_abc12defgh3',
  })
  @Matches(READABLE_ENTITY_ID_REGEX, { message: READABLE_ENTITY_ID_MESSAGE })
  categoryId: string;

  @ApiProperty({
    description:
      'ID подкатегории внутри categoryId (опционально). Если задан, подкатегория должна принадлежать выбранной категории.',
    example: 'ssc_abc12defgh3',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Matches(READABLE_ENTITY_ID_REGEX, { message: READABLE_ENTITY_ID_MESSAGE })
  subcategoryId?: string | null;

  @ApiProperty({
    enum: ServiceAudience,
    required: false,
    default: 'WOMEN',
    description: 'Аудитория: только одно значение — для мужчин или для женщин (по умолчанию WOMEN)',
    example: ServiceAudience.WOMEN,
  })
  @IsOptional()
  @IsEnum(ServiceAudience)
  audience?: ServiceAudience;
}




