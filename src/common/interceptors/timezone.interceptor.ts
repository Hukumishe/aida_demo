import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Интерцептор для преобразования всех DateTime полей в таймзону Asia/Almaty
 * Все даты в ответах API будут возвращаться с offset +06:00
 */
@Injectable()
export class TimezoneInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => this.transformDates(data)),
    );
  }

  private transformDates(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    // Если это массив, обрабатываем каждый элемент
    if (Array.isArray(data)) {
      return data.map((item) => this.transformDates(item));
    }

    // Если это объект, обрабатываем каждое поле
    if (typeof data === 'object' && data.constructor === Object) {
      const transformed: any = {};
      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          const value = data[key];
          
          // Если это Date объект, конвертируем в ISO строку с таймзоной Алматы
          if (value instanceof Date) {
            transformed[key] = this.convertToAlmatyISO(value);
          } else if (typeof value === 'object' && value !== null) {
            // Рекурсивно обрабатываем вложенные объекты
            transformed[key] = this.transformDates(value);
          } else {
            transformed[key] = value;
          }
        }
      }
      return transformed;
    }

    return data;
  }

  /**
   * Конвертирует Date объект в ISO строку с таймзоной Asia/Almaty (+06:00)
   */
  private convertToAlmatyISO(date: Date): string {
    // Используем Intl.DateTimeFormat для получения компонентов в таймзоне Алматы
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Almaty',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    // Форматируем дату
    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    const hour = parts.find(p => p.type === 'hour')?.value;
    const minute = parts.find(p => p.type === 'minute')?.value;
    const second = parts.find(p => p.type === 'second')?.value;
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0');

    // Формируем ISO строку с таймзоной +06:00
    return `${year}-${month}-${day}T${hour}:${minute}:${second}.${milliseconds}+06:00`;
  }
}

