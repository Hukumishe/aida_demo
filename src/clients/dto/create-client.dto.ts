import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsBoolean,
  Min,
  Max,
  Matches,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ClientGender } from '@prisma/client';

export class CreateClientDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe', required: false })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ example: 'Петрович', required: false, description: 'Отчество' })
  @IsString()
  @IsOptional()
  patronymic?: string;

  @ApiProperty({
    example: '@username',
    required: false,
    description: 'Instagram: @username или полная ссылка',
  })
  @IsString()
  @IsOptional()
  instagram?: string;

  @ApiProperty({ example: '+79991234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    enum: ClientGender,
    required: false,
    description: 'Пол клиента: MALE / FEMALE. Не передавать (или null) — «не указано».',
  })
  @IsOptional()
  @IsEnum(ClientGender)
  gender?: ClientGender;

  @ApiProperty({ example: '1990-05-15', required: false, description: 'День рождения (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'birthDate must be YYYY-MM-DD' })
  birthDate?: string;

  @ApiProperty({ example: 'Regular client, prefers morning appointments', required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ example: 0, required: false, description: 'Бонусные баллы' })
  @IsInt()
  @Min(0)
  @IsOptional()
  bonuses?: number;

  @ApiProperty({ example: 0, required: false, description: 'Скидка в процентах (0-100)' })
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  discount?: number;

  @ApiProperty({ example: 0, required: false, description: 'Баланс в тенге' })
  @IsInt()
  @Min(0)
  @IsOptional()
  balance?: number;

  @ApiProperty({
    example: true,
    required: false,
    description:
      'Включена ли программа лояльности для клиента. false = не списываются/не начисляются бонусы и кэшбэк.',
  })
  @IsOptional()
  @IsBoolean()
  loyaltyEnabled?: boolean;

  @ApiProperty({
    required: false,
    description:
      'Реферальный код другого клиента (не промокод лендинга). После привязки в профиле отображается пригласивший.',
    example: 'ABC123',
  })
  @IsOptional()
  @IsString()
  referrerCode?: string;

  @ApiProperty({
    required: false,
    description:
      'Алиас для `referrerCode` (некоторые фронты используют имя `referralCode`). Реферальный код другого клиента, не промокод лендинга.',
    example: 'ABC123',
  })
  @IsOptional()
  @IsString()
  referralCode?: string;

  @ApiProperty({
    required: false,
    description:
      'Id маркетинговой реферальной ссылки филиала (из URL ?ref= / GET .../referral-links/resolve/...). Заполняет поле «Источник» у клиента.',
  })
  @IsOptional()
  @IsString()
  referralLinkId?: string;

  @ApiProperty({
    required: false,
    example: 14325361,
    description: 'ID диалога Nextbot (dialog_id) для исходящих сообщений',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  nextbotDialogId?: number;

  @ApiProperty({
    required: false,
    example: 14325361,
    description: 'Алиас nextbotDialogId (как в webhook Nextbot: dialog_id)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  dialogId?: number;
}




