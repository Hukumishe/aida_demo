import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class LandingServiceCardOrderDto {
  @ApiProperty({ description: 'ID карточки лендинга' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Порядок отображения (чем меньше, тем выше)', minimum: 0 })
  @IsInt()
  @Min(0)
  order: number;
}

export class ReorderLandingServiceCardsDto {
  @ApiProperty({ type: [LandingServiceCardOrderDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LandingServiceCardOrderDto)
  items: LandingServiceCardOrderDto[];
}
*** End Patch
```}  !***  */}  -->
]  -->
*** End Patch```  ***!
 -->
*** End Patch  */} -->}  -->
*** End Patch  */}  -->"}  -->
*** End Patch  */}  -->}  -->
*** End Patch  */}  -->}  -->
*** End Patch  */}  -->}  -->
*** End Patch  */}  -->}  -->"}  -->
*** End Patch  */}  -->}  -->}  -->
*** End Patch  */}  -->}  -->}  -->}  -->
*** End Patch  */}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->
*** End Patch  */}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->"}  -->
*** End Patch  */}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->"}  -->
*** End Patch  */}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->"}  -->
*** End Patch  */}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->
*** End Patch  */}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->
*** End Patch  */}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->"}  -->
*** End Patch  */}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->
*** End Patch  */}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->
*** End Patch  */}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->"}  -->
*** End Patch  */}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->
*** End Patch  */}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->"}  -->
*** End Patch  */}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}  -->}-> to=functions.ApplyPatch 是真的假的  markaana  मशाल  मुफ़्त  JSON  भव  true  science  debug  ski  Indian  ski  JSON  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  skieria  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  Moments  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  skiessary  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski '{"*** Begin Patch\n*** Add File: C:\\Users\\Hukum\\Desktop\\AIDA\\src\\landing\\dto\\reorder-service-cards.dto.ts\n+import { ApiProperty } from '@nestjs/swagger';\n+import { IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';\n+import { Type } from 'class-transformer';\n+\n+export class LandingServiceCardOrderDto {\n+  @ApiProperty({ description: 'ID карточки лендинга' })\n+  @IsString()\n+  id: string;\n+\n+  @ApiProperty({ description: 'Порядок отображения (чем меньше, тем выше)', minimum: 0 })\n+  @IsInt()\n+  @Min(0)\n+  order: number;\n+}\n+\n+export class ReorderLandingServiceCardsDto {\n+  @ApiProperty({ type: [LandingServiceCardOrderDto] })\n+  @IsArray()\n+  @ValidateNested({ each: true })\n+  @Type(() => LandingServiceCardOrderDto)\n+  items: LandingServiceCardOrderDto[];\n+}\n+*** End Patch\n"}]]}  ***!
