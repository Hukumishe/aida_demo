import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsInt, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class LandingMasterConfigDto {
  @ApiProperty({ description: 'ID сотрудника (userId) из студии' })
  @IsString()
  staffUserId: string;

  @ApiProperty({ description: 'Показывать ли мастера на лендинге' })
  @IsBoolean()
  isVisible: boolean;

  @ApiProperty({ description: 'Порядок отображения (чем меньше, тем выше)', minimum: 0 })
  @IsInt()
  @Min(0)
  order: number;
}

export class UpdateLandingMastersDto {
  @ApiProperty({ type: [LandingMasterConfigDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LandingMasterConfigDto)
  items: LandingMasterConfigDto[];
}
*** End Patch
```}  !***  */}

