import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';
import { ConfigService } from '@nestjs/config';

export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
  VERBOSE = 'VERBOSE',
}

export enum LogType {
  HTTP_REQUEST = 'HTTP_REQUEST',
  HTTP_RESPONSE = 'HTTP_RESPONSE',
  ERROR = 'ERROR',
  AUTH = 'AUTH',
  DATABASE = 'DATABASE',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  SYSTEM = 'SYSTEM',
}

interface LogContext {
  userId?: string;
  studioId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  error?: string;
  duration?: number;
  [key: string]: any;
}

@Injectable()
export class LoggerService implements NestLoggerService {
  private winstonLogger: winston.Logger;

  constructor(private configService: ConfigService) {
    this.winstonLogger = winston.createLogger({
      level: this.configService.get<string>('LOG_LEVEL', 'info'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      defaultMeta: { service: 'aida-backend' },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
            }),
          ),
        }),
      ],
    });
  }

  logMessage(level: LogLevel, type: LogType, message: string, context?: LogContext) {
    const winstonLevel = level.toLowerCase() as 'error' | 'warn' | 'info' | 'debug' | 'verbose';
    this.winstonLogger.log(winstonLevel, message, { type, ...context });
  }

  log(message: string, context?: string) {
    this.logMessage(LogLevel.INFO, LogType.SYSTEM, message, { context });
  }

  error(message: string, trace?: string, context?: string) {
    this.logMessage(LogLevel.ERROR, LogType.ERROR, message, {
      error: trace,
      context,
    });
  }

  warn(message: string, context?: string) {
    this.logMessage(LogLevel.WARN, LogType.SYSTEM, message, { context });
  }

  debug(message: string, context?: string) {
    this.logMessage(LogLevel.DEBUG, LogType.SYSTEM, message, { context });
  }

  verbose(message: string, context?: string) {
    this.logMessage(LogLevel.VERBOSE, LogType.SYSTEM, message, { context });
  }

  logHttpRequest(
    method: string,
    url: string,
    ip?: string,
    userAgent?: string,
    userId?: string,
    studioId?: string,
  ) {
    this.logMessage(LogLevel.INFO, LogType.HTTP_REQUEST, `${method} ${url}`, {
      method,
      url,
      ip,
      userAgent,
      userId,
      studioId,
    });
  }

  logHttpResponse(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    ip?: string,
    userId?: string,
    studioId?: string,
  ) {
    const level =
      statusCode >= 500 ? LogLevel.ERROR : statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    this.logMessage(level, LogType.HTTP_RESPONSE, `${method} ${url} - ${statusCode}`, {
      method,
      url,
      statusCode,
      duration,
      ip,
      userId,
      studioId,
    });
  }

  logError(message: string, error: Error | string, context?: LogContext) {
    const errorString = error instanceof Error ? error.stack || error.message : error;
    this.logMessage(LogLevel.ERROR, LogType.ERROR, message, {
      ...context,
      error: errorString,
    });
  }

  logAuth(message: string, userId?: string, ip?: string, context?: LogContext) {
    this.logMessage(LogLevel.INFO, LogType.AUTH, message, {
      userId,
      ip,
      ...context,
    });
  }

  logDatabase(message: string, context?: LogContext) {
    this.logMessage(LogLevel.DEBUG, LogType.DATABASE, message, context);
  }

  logBusinessLogic(
    message: string,
    userId?: string,
    studioId?: string,
    context?: LogContext,
  ) {
    this.logMessage(LogLevel.INFO, LogType.BUSINESS_LOGIC, message, {
      userId,
      studioId,
      ...context,
    });
  }
}
