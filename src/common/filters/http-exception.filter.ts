import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { LoggerService } from '../../logging/logger.service';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(LoggerService)
    private readonly logger: LoggerService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code: string | undefined;
    let errorDetails: any = null;

    let errorCode: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const body = exceptionResponse as Record<string, unknown>;
        message = (body.message as string) || exception.message;
        code = (body.code as string) || undefined;
        // Reschedule / domain errors: { error: "SLOT_BUSY", message: "..." }
        errorCode =
          typeof body.error === 'string' ? body.error : code;
        errorDetails = exceptionResponse;
      } else {
        message = exceptionResponse as string;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      errorDetails = {
        name: exception.name,
        stack: exception.stack,
      };
    }

    // Extract user info from request
    const user = (request as any).user;
    const userId = user?.id;
    const studioId = user?.studioId;

    // Log error
    this.logger.logError(
      `HTTP ${status}: ${message}`,
      exception instanceof Error ? exception : new Error(message),
      {
        userId,
        studioId,
        ip: request.ip,
        userAgent: request.get('user-agent'),
        method: request.method,
        url: request.originalUrl,
        statusCode: status,
        error: errorDetails ? JSON.stringify(errorDetails) : undefined,
      },
    );

    const payload: Record<string, unknown> = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    };
    if (errorCode) {
      payload.error = errorCode;
    }
    if (code && code !== errorCode) {
      payload.code = code;
    }
    // Пробрасываем доп. поля домена (например conflictingAppointmentId)
    if (
      errorDetails &&
      typeof errorDetails === 'object' &&
      !Array.isArray(errorDetails)
    ) {
      for (const key of Object.keys(errorDetails)) {
        if (
          key === 'statusCode' ||
          key === 'message' ||
          key === 'error' ||
          key === 'code'
        ) {
          continue;
        }
        payload[key] = (errorDetails as Record<string, unknown>)[key];
      }
    }

    response.status(status).json(payload);
  }
}




