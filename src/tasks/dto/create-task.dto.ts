import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsNotEmpty, IsOptional, IsString, ArrayUnique } from 'class-validator';

export class CreateStudioTaskDto {
  @ApiProperty({ description: 'Название задачи' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Описание' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Ответственный — id сотрудника филиала (любая роль штата)' })
  @IsString()
  @IsNotEmpty()
  assigneeUserId: string;

  @ApiPropertyOptional({
    description: 'Постановщики/контролёры — id менеджеров филиала (роли MANAGER или ADMIN)',
    type: [String],
    default: [],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  controllerUserIds?: string[];

  @ApiProperty({ description: 'Крайний срок (ISO 8601)' })
  @IsDateString()
  deadlineAt: string;
}
