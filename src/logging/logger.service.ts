import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
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
  private readonly enableDbLogging: boolean;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.enableDbLogging = this.configService.get<string>('ENABLE_DB_LOGGING', 'true') === 'true';
    
    // Configure Winston logger
    this.winstonLogger = winston.createLogger({
      level: this.configService.get<string>('LOG_LEVEL', 'info'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      defaultMeta: { service: 'aida-backend' },
      transports: [
        // Write all logs to console
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
            }),
          ),
        }),
        // Write all logs to file
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
      ],
    });
  }

  async logMessage(
    level: LogLevel,
    type: LogType,
    message: string,
    context?: LogContext,
  ) {
    // Log to Winston (file and console)
    const winstonLevel = level.toLowerCase() as 'error' | 'warn' | 'info' | 'debug' | 'verbose';
    this.winstonLogger.log(winstonLevel, message, context);

    // Log to database (async, don't wait)
    if (this.enableDbLogging) {
      this.logToDatabase(level, type, message, context).catch((err) => {
        // If DB logging fails, log to Winston only
        this.winstonLogger.error('Failed to log to database', err);
      });
    }
  }

  private async logToDatabase(
    level: LogLevel,
    type: LogType,
    message: string,
    context?: LogContext,
  ) {
    try {
      await this.prisma.log.create({
        data: {
          level,
          type,
          message,
          context: context ? JSON.stringify(context) : null,
          userId: context?.userId,
          studioId: context?.studioId,
          ip: context?.ip,
          userAgent: context?.userAgent,
          method: context?.method,
          url: context?.url,
          statusCode: context?.statusCode,
          error: context?.error,
          duration: context?.duration,
        },
      });
    } catch (error) {
      // Silently fail - don't break the application if logging fails
      this.winstonLogger.error('Database logging error', error);
    }
  }

  // NestJS LoggerService interface methods
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

  // Custom methods for specific log types
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
    const level = statusCode >= 500 ? LogLevel.ERROR : statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
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

  logError(
    message: string,
    error: Error | string,
    context?: LogContext,
  ) {
    const errorString = error instanceof Error ? error.stack || error.message : error;
    this.logMessage(LogLevel.ERROR, LogType.ERROR, message, {
      ...context,
      error: errorString,
    });
  }

  logAuth(
    message: string,
    userId?: string,
    ip?: string,
    context?: LogContext,
  ) {
    this.logMessage(LogLevel.INFO, LogType.AUTH, message, {
      userId,
      ip,
      ...context,
    });
  }

  logDatabase(
    message: string,
    context?: LogContext,
  ) {
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

