import { IsString, IsInt, IsOptional, IsBoolean, Min, IsEnum, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ServiceAudience } from '@prisma/client';
import {
  READABLE_ENTITY_ID_MESSAGE,
  READABLE_ENTITY_ID_REGEX,
} from '../../common/id-generator';

export class UpdateServiceDto {
  @ApiProperty({ example: 'Haircut', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  // defaultDurationMin НЕ включено - стандартное время нельзя изменить после создания услуги
  // Для изменения времени конкретного мастера используйте StaffServiceOverride

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

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ example: true, required: false, description: 'Начислять ли кэшбэк за эту услугу' })
  @IsBoolean()
  @IsOptional()
  bonusAccrualEnabled?: boolean;

  @ApiProperty({
    required: false,
    description: 'Сменить категорию услуги (другой id категории этой же студии)',
    example: 'sca_abc12defgh3',
  })
  @IsOptional()
  @Matches(READABLE_ENTITY_ID_REGEX, { message: READABLE_ENTITY_ID_MESSAGE })
  categoryId?: string;

  @ApiProperty({ enum: ServiceAudience, required: false })
  @IsEnum(ServiceAudience)
  @IsOptional()
  audience?: ServiceAudience;
}




