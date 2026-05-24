import { Module } from '@nestjs/common';
import { NextbotBirthdayController } from './nextbot-birthday.controller';
import { NextbotBirthdaySettingsService } from './nextbot-birthday-settings.service';
import { NextbotBirthdayOrchestratorService } from './nextbot-birthday-orchestrator.service';
import { NextbotBirthdayScheduler } from './nextbot-birthday.scheduler';
import { NextbotAutoMessagesModule } from '../nextbot-auto-messages/nextbot-auto-messages.module';

@Module({
  imports: [NextbotAutoMessagesModule],
  controllers: [NextbotBirthdayController],
  providers: [
    NextbotBirthdaySettingsService,
    NextbotBirthdayOrchestratorService,
    NextbotBirthdayScheduler,
  ],
  exports: [NextbotBirthdayOrchestratorService, NextbotBirthdaySettingsService],
})
export class NextbotBirthdayModule {}
