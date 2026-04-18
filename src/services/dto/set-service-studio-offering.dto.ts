import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetServiceStudioOfferingDto {
  @ApiProperty({ description: 'Филиал, в котором переключается доступность услуги' })
  @IsString()
  @IsNotEmpty()
  studioId!: string;

  @ApiProperty({
    description:
      'true — услуга оказывается в этом филиале; false — скрыта только здесь (каталог организации и другие филиалы не меняются).',
  })
  @IsBoolean()
  offered!: boolean;
}
