import { PartialType } from '@nestjs/swagger';
import { CreateLandingCategoryCardDto } from './create-category-card.dto';

export class UpdateLandingCategoryCardDto extends PartialType(CreateLandingCategoryCardDto) {}
