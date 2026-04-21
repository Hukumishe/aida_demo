import { IsString, IsOptional, IsInt, Min, Max, Matches, ValidateIf, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClientLevel, ClientGender } from '@prisma/client';

export class UpdateClientDto {
  @ApiProperty({ example: 'John', required: false })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({ example: 'Doe', required: false })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ example: 'Петрович', required: false, description: 'Отчество. null — очистить.' })
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsString()
  patronymic?: string | null;

  @ApiProperty({
    example: '@username',
    required: false,
    description: 'Instagram. null — очистить.',
  })
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsString()
  instagram?: string | null;

  @ApiProperty({
    required: false,
    description:
      'Источник (маркетинговая реферальная ссылка и т.п.). Обычно задаётся сервером при referralLinkId при создании; можно править вручную. null — очистить.',
  })
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsString()
  registrationSource?: string | null;

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

  @ApiPropertyOptional({
    enum: ClientGender,
    description:
      'Пол клиента: MALE / FEMALE. Передать null чтобы очистить (= «не указано»).',
  })
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsEnum(ClientGender)
  gender?: ClientGender | null;

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
      'Персональный переключатель программы лояльности клиента. false = не списываются и не начисляются бонусы/кэшбэк/реферальные бонусы.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  loyaltyEnabled?: boolean;

  @ApiPropertyOptional({
    description:
      'Режим CUSTOM: id организации клиента для ручного уровня или сброса (вместе с customLoyaltyTierId или customLoyaltyClearManual). Должен совпадать с organizationId клиента.',
  })
  @IsOptional()
  @IsString()
  customLoyaltyOrganizationId?: string;

  @ApiPropertyOptional({
    description:
      'Устарело: id студии; сервер преобразует в organizationId. Предпочтительно customLoyaltyOrganizationId.',
  })
  @IsOptional()
  @IsString()
  customLoyaltyStudioId?: string;

  @ApiPropertyOptional({
    description: 'ID записи StudioLoyaltyTier — зафиксировать уровень вручную в организации клиента (CUSTOM)',
  })
  @IsOptional()
  @IsString()
  customLoyaltyTierId?: string;

  @ApiPropertyOptional({
    description:
      'С customLoyaltyOrganizationId: снять ручной уровень и пересчитать по сумме оплат по организации',
  })
  @IsOptional()
  @IsBoolean()
  customLoyaltyClearManual?: boolean;
}




