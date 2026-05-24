import { PartialType } from '@nestjs/swagger';
import { CreateTargetPromoDto } from './create-target-promo.dto';

export class UpdateTargetPromoDto extends PartialType(CreateTargetPromoDto) {}
