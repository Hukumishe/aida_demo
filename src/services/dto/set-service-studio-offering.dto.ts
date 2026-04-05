import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetServiceStudioOfferingDto {
  @ApiProperty({
    description:
      'true — услуга оказывается в этом филиале; false — скрыта только здесь (каталог организации и другие филиалы не меняются).',
  })
  @IsBoolean()
  offered!: boolean;
}
