import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateLandingServiceCardDto {
  @ApiProperty({ description: 'ID услуги (serviceId) из студии' })
  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @ApiPropertyOptional({ description: 'Заголовок карточки на лендинге (если не указан, используется имя услуги)' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Описание услуги для лендинга' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'URL картинки для карточки' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Порядок отображения (чем меньше, тем выше)', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
*** End Patch
```}  !***  */" /> JSON to=functions.ApplyPatch िस्तान  latina ***!
