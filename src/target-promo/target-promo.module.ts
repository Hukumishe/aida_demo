import { Module } from '@nestjs/common';
import { TargetPromoController } from './target-promo.controller';
import { TargetPromoService } from './target-promo.service';

@Module({
  controllers: [TargetPromoController],
  providers: [TargetPromoService],
  exports: [TargetPromoService],
})
export class TargetPromoModule {}
