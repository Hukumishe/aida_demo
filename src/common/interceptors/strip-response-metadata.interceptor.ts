import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

const STRIP_KEYS = new Set(['createdAt', 'updatedAt', 'timezone']);

/**
 * Убирает из JSON-ответов служебные поля (даты создания/обновления и строку timezone),
 * рекурсивно по вложенным объектам и массивам.
 */
@Injectable()
export class StripResponseMetadataInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => this.strip(data)));
  }

  private strip(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }
    if (value instanceof StreamableFile) {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.strip(item));
    }
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === 'object' && this.isPlainObject(value)) {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(value as Record<string, unknown>)) {
        if (STRIP_KEYS.has(key)) {
          continue;
        }
        out[key] = this.strip((value as Record<string, unknown>)[key]);
      }
      return out;
    }
    return value;
  }

  private isPlainObject(v: unknown): v is Record<string, unknown> {
    if (v === null || typeof v !== 'object') return false;
    if (Array.isArray(v)) return false;
    if (v instanceof Date) return false;
    const proto = Object.getPrototypeOf(v);
    return proto === null || proto === Object.prototype;
  }
}
