import { HttpException, HttpStatus } from '@nestjs/common';

export class ConflictException extends HttpException {
  constructor(message: string, code?: string) {
    super(
      {
        statusCode: HttpStatus.CONFLICT,
        message,
        code,
      },
      HttpStatus.CONFLICT,
    );
  }
}


