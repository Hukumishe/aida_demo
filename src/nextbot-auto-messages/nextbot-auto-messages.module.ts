import { Module } from '@nestjs/common';
import { NextbotAutoMessagesController } from './nextbot-auto-messages.controller';
import { NextbotAutoMessagesService } from './nextbot-auto-messages.service';

@Module({
  controllers: [NextbotAutoMessagesController],
  providers: [NextbotAutoMessagesService],
  exports: [NextbotAutoMessagesService],
})
export class NextbotAutoMessagesModule {}
