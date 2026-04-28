import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateEscalationTicketDto {
  @ApiPropertyOptional({
    description: 'Телефон клиента (для контекста задачи менеджерам)',
    example: '+77015554433',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    description: 'Краткое описание проблемы клиента; попадёт в описание задачи',
    example: 'Клиент не может зарегистрироваться, повторные попытки неуспешны.',
  })
  @IsString()
  issueSummary!: string;
}

