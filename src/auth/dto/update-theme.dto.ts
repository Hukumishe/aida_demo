import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ThemePreference {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system',
}

export class UpdateThemeDto {
  @ApiProperty({
    enum: ThemePreference,
    example: ThemePreference.DARK,
    description: 'Theme preference: light, dark, or system',
  })
  @IsEnum(ThemePreference)
  @IsNotEmpty()
  themePreference: ThemePreference;
}








