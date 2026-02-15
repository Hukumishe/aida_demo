import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Интерцептор для преобразования всех DateTime полей в таймзону студии
 * Динамически определяет таймзону из studioId в запросе или использует дефолтную Asia/Almaty
 */
@Injectable()
export class TimezoneInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const studioId = request.params?.studioId || request.user?.studioId;
    
    // Получаем таймзону студии или используем дефолтную
    let timezone = 'Asia/Almaty';
    if (studioId) {
      try {
        const studio = await this.prisma.studio.findUnique({
          where: { id: studioId },
          select: { timezone: true },
        });
        if (studio?.timezone) {
          timezone = studio.timezone;
        }
      } catch (error) {
        // Если не удалось получить таймзону, используем дефолтную
        console.warn(`Failed to get timezone for studio ${studioId}, using default:`, error);
      }
    }

    return next.handle().pipe(
      map((data) => this.transformDates(data, timezone)),
    );
  }

  private transformDates(data: any, timezone: string): any {
    if (data === null || data === undefined) {
      return data;
    }

    // Если это массив, обрабатываем каждый элемент
    if (Array.isArray(data)) {
      return data.map((item) => this.transformDates(item, timezone));
    }

    // Если это объект, обрабатываем каждое поле
    if (typeof data === 'object' && data.constructor === Object) {
      const transformed: any = {};
      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          const value = data[key];
          
          // Если это Date объект, конвертируем в ISO строку с таймзоной студии
          if (value instanceof Date) {
            transformed[key] = this.convertToTimezoneISO(value, timezone);
          } else if (typeof value === 'object' && value !== null) {
            // Рекурсивно обрабатываем вложенные объекты
            transformed[key] = this.transformDates(value, timezone);
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
   * Конвертирует Date объект в ISO строку с указанной таймзоной
   * Date объект из базы данных хранится в UTC, нужно конвертировать в таймзону студии
   */
  private convertToTimezoneISO(date: Date, timezone: string): string {
    // Получаем offset в минутах для указанной таймзоны
    const offsetMinutes = this.getTimezoneOffset(date, timezone);
    const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
    const offsetMins = Math.abs(offsetMinutes) % 60;
    const offsetSign = offsetMinutes >= 0 ? '+' : '-';
    const offsetString = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`;

    // Создаем копию даты и добавляем offset
    const localDate = new Date(date.getTime() + offsetMinutes * 60 * 1000);

    // Получаем компоненты из скорректированной даты
    const year = localDate.getUTCFullYear();
    const month = String(localDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(localDate.getUTCDate()).padStart(2, '0');
    const hours = String(localDate.getUTCHours()).padStart(2, '0');
    const minutes = String(localDate.getUTCMinutes()).padStart(2, '0');
    const seconds = String(localDate.getUTCSeconds()).padStart(2, '0');
    const milliseconds = String(localDate.getUTCMilliseconds()).padStart(3, '0');

    // Формируем ISO строку с таймзоной
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}${offsetString}`;
  }

  /**
   * Получает offset в минутах для указанной таймзоны относительно UTC
   * Использует маппинг таймзон на offset (надежнее, чем вычисление)
   */
  private getTimezoneOffset(date: Date, timezone: string): number {
    // Маппинг таймзон Казахстана на offset в минутах
    const timezoneOffsets: Record<string, number> = {
      'Asia/Almaty': 360,      // UTC+6 (стандартное время)
      'Asia/Aqtobe': 300,      // UTC+5
      'Asia/Aqtau': 300,       // UTC+5
      'Asia/Oral': 300,        // UTC+5
      'Asia/Qyzylorda': 360,   // UTC+6
      'Asia/Atyrau': 300,      // UTC+5
      'Asia/Astana': 360,      // UTC+6 (старое название Алматы)
    };
    
    // Если таймзона есть в маппинге, используем её
    if (timezoneOffsets[timezone]) {
      return timezoneOffsets[timezone];
    }
    
    // Fallback: пытаемся вычислить через Intl API
    try {
      const formatter = new Intl.DateTimeFormat('en', {
        timeZone: timezone,
        timeZoneName: 'longOffset',
      });
      
      const parts = formatter.formatToParts(date);
      const offsetPart = parts.find(p => p.type === 'timeZoneName');
      
      if (offsetPart && offsetPart.value) {
        const offsetMatch = offsetPart.value.match(/([+-])(\d{2}):(\d{2})/);
        if (offsetMatch) {
          const sign = offsetMatch[1] === '+' ? 1 : -1;
          const hours = parseInt(offsetMatch[2]);
          const minutes = parseInt(offsetMatch[3]);
          return sign * (hours * 60 + minutes);
        }
      }
    } catch (error) {
      // Если не удалось вычислить, используем дефолт
    }
    
    // По умолчанию UTC+6 (Алмата)
    return 360;
  }
}

