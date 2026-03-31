import { Module } from '@nestjs/common';
import { ReferralLinksController } from './referral-links.controller';
import { ReferralLinksService } from './referral-links.service';

@Module({
  controllers: [ReferralLinksController],
  providers: [ReferralLinksService],
  exports: [ReferralLinksService],
})
export class ReferralLinksModule {}
