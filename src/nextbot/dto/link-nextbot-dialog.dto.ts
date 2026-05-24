import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class LinkNextbotDialogDto {
  @ApiProperty({
    example: '+77001234567',
    description: 'Телефон клиента в организации (как в CRM)',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    example: 14325361,
    description: 'dialog_id из Nextbot для исходящих сообщений',
  })
  @IsInt()
  @Min(1)
  dialogId: number;

  @ApiPropertyOptional({
    description: 'Алиас dialogId',
    example: 14325361,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  nextbotDialogId?: number;
}
