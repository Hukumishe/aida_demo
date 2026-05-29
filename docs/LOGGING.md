# Система логирования

## Обзор

В проекте логирование идёт **только в консоль** (Winston → stdout). На Railway смотрите вкладку **Logs** деплоя.

Запись в таблицу `logs` в PostgreSQL **отключена** — чтобы не занимать пул соединений Prisma и не тормозить API.

## Что логируется

### 1. HTTP Запросы и Ответы
- Все входящие HTTP запросы (метод, URL, IP, user-agent)
- Все HTTP ответы (статус код, время выполнения)
- Автоматически через `LoggingMiddleware`

### 2. Ошибки
- Все исключения и ошибки
- Stack trace
- Контекст запроса (пользователь, студия, IP)
- Автоматически через `HttpExceptionFilter`

### 3. Аутентификация
- Успешные и неуспешные попытки входа
- Обновление токенов
- Выход из системы

### 4. Бизнес-логика
- Важные действия пользователей
- Создание/обновление/удаление записей
- Изменения в расписании
- И т.д.

### 5. База данных
- Критические операции с БД
- Медленные запросы
- Ошибки подключения

## Таблица `logs` в БД (устарело)

Модель `Log` в Prisma может оставаться в схеме, но **приложение в неё не пишет**. Для аудита используйте логи платформы (Railway) или внешний APM.

<details>
<summary>Бывшая структура Log (справочно)</summary>

```prisma
model Log {
  id          String   @id @default(uuid())
  level       LogLevel
  type        LogType
  message     String
  context     String?
  userId      String?
  studioId    String?   // ID студии
  ip          String?   // IP адрес
  userAgent   String?   // User agent
  method      String?   // HTTP метод
  url         String?   // URL запроса
  statusCode  Int?      // HTTP статус код
  error       String?   // Stack trace или детали ошибки
  duration    Int?      // Время выполнения в мс
  createdAt   DateTime  @default(now())
}
```

</details>

### Уровни логирования (LogLevel)

- **ERROR** - Критические ошибки
- **WARN** - Предупреждения
- **INFO** - Информационные сообщения
- **DEBUG** - Отладочная информация
- **VERBOSE** - Подробная информация

### Типы логов (LogType)

- **HTTP_REQUEST** - Входящие HTTP запросы
- **HTTP_RESPONSE** - Исходящие HTTP ответы
- **ERROR** - Ошибки и исключения
- **AUTH** - Аутентификация и авторизация
- **DATABASE** - Операции с базой данных
- **BUSINESS_LOGIC** - Бизнес-логика приложения
- **SYSTEM** - Системные события

## Использование LoggerService

### Базовое использование

```typescript
import { LoggerService } from '../logging/logger.service';

@Injectable()
export class MyService {
  constructor(private logger: LoggerService) {}

  someMethod() {
    // Простое логирование
    this.logger.log('Информационное сообщение');
    this.logger.error('Ошибка', 'Stack trace');
    this.logger.warn('Предупреждение');
    this.logger.debug('Отладочная информация');
  }
}
```

### Логирование HTTP запросов

Автоматически через `LoggingMiddleware` - ничего делать не нужно.

### Логирование ошибок

Автоматически через `HttpExceptionFilter` - ничего делать не нужно.

### Логирование аутентификации

```typescript
// Успешный вход
this.logger.logAuth('User logged in', userId, ip);

// Неудачная попытка входа
this.logger.logAuth('Login failed', null, ip, { email });

// Выход
this.logger.logAuth('User logged out', userId, ip);
```

### Логирование бизнес-логики

```typescript
// Создание записи
this.logger.logBusinessLogic(
  'Appointment created',
  userId,
  studioId,
  { appointmentId, clientId, serviceId }
);

// Обновление профиля
this.logger.logBusinessLogic(
  'Staff profile updated',
  userId,
  studioId,
  { profileId, changes }
);
```

### Логирование с кастомным контекстом

```typescript
this.logger.logError(
  'Failed to process payment',
  error,
  {
    userId,
    studioId,
    orderId: '123',
    amount: 5000,
    paymentMethod: 'card',
  }
);
```

## Конфигурация

### Переменные окружения

```env
# Уровень логирования (error, warn, info, debug, verbose)
LOG_LEVEL=info
```

Переменная `ENABLE_DB_LOGGING` больше не используется.

## Запросы к логам в БД (устарело)

### Получить все ошибки за последний час

```typescript
const errors = await prisma.log.findMany({
  where: {
    level: 'ERROR',
    createdAt: {
      gte: new Date(Date.now() - 3600000), // последний час
    },
  },
  orderBy: {
    createdAt: 'desc',
  },
});
```

### Получить логи конкретного пользователя

```typescript
const userLogs = await prisma.log.findMany({
  where: {
    userId: 'user-uuid',
  },
  orderBy: {
    createdAt: 'desc',
  },
  take: 100, // последние 100 записей
});
```

### Получить медленные запросы (>1 секунды)

```typescript
const slowRequests = await prisma.log.findMany({
  where: {
    type: 'HTTP_RESPONSE',
    duration: {
      gt: 1000, // больше 1 секунды
    },
  },
  orderBy: {
    duration: 'desc',
  },
});
```

### Получить логи по студии

```typescript
const studioLogs = await prisma.log.findMany({
  where: {
    studioId: 'studio-uuid',
    createdAt: {
      gte: new Date('2024-01-01'),
    },
  },
  orderBy: {
    createdAt: 'desc',
  },
});
```

## Рекомендации

1. **Не логируйте чувствительные данные:**
   - Пароли
   - Полные токены (только первые/последние символы)
   - Персональные данные клиентов

2. **Используйте правильный уровень:**
   - ERROR - только для критических ошибок
   - WARN - для предупреждений
   - INFO - для важных событий
   - DEBUG - для отладки (только в development)

3. **Добавляйте контекст:**
   - Всегда указывайте userId и studioId когда возможно
   - Добавляйте релевантные данные в context

4. **Мониторинг:**
   - Регулярно проверяйте логи на ошибки
   - Настройте алерты на критические ошибки
   - Анализируйте медленные запросы

## Миграция

После добавления модели Log нужно применить миграцию:

```bash
# Локально
npm run prisma:migrate

# На Railway
railway run npx prisma migrate deploy
```

## Производительность

- Логирование в БД происходит асинхронно и не блокирует запросы
- Если логирование в БД не удалось, ошибка логируется только в Winston (файлы)
- Логирование в файлы синхронное, но быстрое
- Рекомендуется периодически очищать старые логи из БД (например, старше 90 дней)












