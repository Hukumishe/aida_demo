import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SubmitAppointmentFeedbackDto {
  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({
    description:
      'Опциональный текст после оценки 4–5 (иначе шаблон с feedbackTwoGisUrl студии)',
  })
  @IsOptional()
  @IsString()
  positiveFollowUpText?: string;
}
