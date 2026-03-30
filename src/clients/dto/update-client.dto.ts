import { IsString, IsOptional, IsInt, Min, Max, Matches, ValidateIf, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClientLevel } from '@prisma/client';

export class UpdateClientDto {
  @ApiProperty({ example: 'John', required: false })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({ example: 'Doe', required: false })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ example: '+79991234567', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: '1990-05-15', required: false, description: 'День рождения (YYYY-MM-DD). Передать null чтобы очистить.' })
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'birthDate must be YYYY-MM-DD' })
  birthDate?: string | null;

  @ApiProperty({ example: 'Regular client, prefers morning appointments', required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ enum: ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND'], required: false, description: 'Уровень клиента. DIAMOND — только вручную (Owner/Deputy).' })
  @IsOptional()
  @IsEnum(ClientLevel)
  level?: ClientLevel;

  @ApiProperty({ required: false, description: 'true если уровень DIAMOND назначен вручную (только Owner/Deputy)' })
  @IsOptional()
  @IsBoolean()
  levelSetManually?: boolean;

  @ApiProperty({ example: 100, required: false, description: 'Бонусные баллы' })
  @IsInt()
  @Min(0)
  @IsOptional()
  bonuses?: number;

  @ApiProperty({ example: 10, required: false, description: 'Скидка в процентах (0-100)' })
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  discount?: number;

  @ApiProperty({ example: 5000, required: false, description: 'Баланс в тенге' })
  @IsInt()
  @Min(0)
  @IsOptional()
  balance?: number;

  @ApiPropertyOptional({
    description:
      'Режим CUSTOM у студии: id студии для ручного уровня или сброса (вместе с customLoyaltyTierId или customLoyaltyClearManual)',
  })
  @IsOptional()
  @IsString()
  customLoyaltyStudioId?: string;

  @ApiPropertyOptional({
    description: 'ID записи StudioLoyaltyTier — зафиксировать этот уровень вручную в указанной студии',
  })
  @IsOptional()
  @IsString()
  customLoyaltyTierId?: string;

  @ApiPropertyOptional({
    description: 'С customLoyaltyStudioId: снять ручной уровень и пересчитать по сумме оплат в студии',
  })
  @IsOptional()
  @IsBoolean()
  customLoyaltyClearManual?: boolean;
}




