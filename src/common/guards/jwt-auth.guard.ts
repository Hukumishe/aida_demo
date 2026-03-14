import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as crypto from 'crypto';

/** Пользователь, под которым считаются запросы с валидным API-ключом (роль SERVICE = права уровня владельца) */
const API_KEY_USER = {
  userId: 'api-key',
  role: 'SERVICE',
  studioId: undefined as string | undefined,
};

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private configService: ConfigService,
  ) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = this.configService.get<string>('NEXTBOT_API_KEY');

    // Авторизация по API-ключу: заголовок X-API-Key или Authorization: ApiKey <key>
    if (apiKey && apiKey.length > 0) {
      const raw =
        request.headers['x-api-key'] ??
        (() => {
          const auth = request.headers.authorization;
          if (typeof auth === 'string' && auth.startsWith('ApiKey ')) return auth.slice(7).trim();
          return undefined;
        })();
      const headerKey = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;

      if (headerKey && this.constantTimeCompare(headerKey, apiKey)) {
        request.user = API_KEY_USER;
        return true;
      }
    }

    return super.canActivate(context);
  }

  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }
}




