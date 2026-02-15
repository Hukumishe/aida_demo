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
   * Date объект из базы данных хранится в UTC, нужно конвертировать в Алмату
   * Алмата = UTC + 6 часов
   */
  private convertToAlmatyISO(date: Date): string {
    // Создаем копию даты и добавляем 6 часов (offset для Алматы)
    const almatyDate = new Date(date.getTime() + 6 * 60 * 60 * 1000);

    // Получаем компоненты из скорректированной даты
    const year = almatyDate.getUTCFullYear();
    const month = String(almatyDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(almatyDate.getUTCDate()).padStart(2, '0');
    const hours = String(almatyDate.getUTCHours()).padStart(2, '0');
    const minutes = String(almatyDate.getUTCMinutes()).padStart(2, '0');
    const seconds = String(almatyDate.getUTCSeconds()).padStart(2, '0');
    const milliseconds = String(almatyDate.getUTCMilliseconds()).padStart(3, '0');

    // Формируем ISO строку с таймзоной +06:00
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}+06:00`;
  }
}

