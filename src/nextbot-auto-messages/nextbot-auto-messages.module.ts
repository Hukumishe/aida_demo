import { Module } from '@nestjs/common';
import { NextbotAutoMessagesController } from './nextbot-auto-messages.controller';
import { NextbotAutoMessagesService } from './nextbot-auto-messages.service';
import { NextbotOutboundService } from './nextbot-outbound.service';
import { NextbotAutoMessageOrchestratorService } from './nextbot-auto-message-orchestrator.service';
import { NextbotAutoMessageDispatchScheduler } from './nextbot-auto-message-dispatch.scheduler';
import { NextbotAppointmentFeedbackService } from './nextbot-appointment-feedback.service';

@Module({
  controllers: [NextbotAutoMessagesController],
  providers: [
    NextbotAutoMessagesService,
    NextbotOutboundService,
    NextbotAutoMessageOrchestratorService,
    NextbotAutoMessageDispatchScheduler,
    NextbotAppointmentFeedbackService,
  ],
  exports: [
    NextbotAutoMessagesService,
    NextbotAutoMessageOrchestratorService,
    NextbotAppointmentFeedbackService,
  ],
})
export class NextbotAutoMessagesModule {}
