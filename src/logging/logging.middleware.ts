import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LoggerService } from './logger.service';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  constructor(private logger: LoggerService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') || '';
    
    // Extract user info from request (set by guards)
    const user = (req as any).user;
    const userId = user?.id;
    const studioId = user?.studioId;

    // Log request
    this.logger.logHttpRequest(
      method,
      originalUrl,
      ip,
      userAgent,
      userId,
      studioId,
    );

    // Capture response
    const originalSend = res.send;
    const logger = this.logger;
    res.send = function (body) {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Log response
      logger.logHttpResponse(
        method,
        originalUrl,
        statusCode,
        duration,
        ip,
        userId,
        studioId,
      );

      return originalSend.call(this, body);
    };

    next();
  }
}

