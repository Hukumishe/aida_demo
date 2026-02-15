import { Module, MiddlewareConsumer, NestModule, Global } from '@nestjs/common';
import { LoggerService } from './logger.service';
import { LoggingMiddleware } from './logging.middleware';
import { CommonModule } from '../common/common.module';

@Global()
@Module({
  imports: [CommonModule],
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggingModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
