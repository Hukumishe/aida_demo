# Полная документация Backend - AIDA Beauty Platform

## Обзор

Backend для MVP платформы записи бьюти-студий, построенный на **NestJS** с **TypeScript**, **Prisma ORM** и **PostgreSQL**. Развернут на **Railway** с автоматическими миграциями и Swagger документацией.

**Base URL:** `https://aidaproject-production.up.railway.app`  
**Swagger:** `https://aidaproject-production.up.railway.app/docs`  
**Health Check:** `https://aidaproject-production.up.railway.app/health`

---

## Технологический стек

- **Framework:** NestJS 10.3.0
- **Language:** TypeScript 5.3.3
- **Database:** PostgreSQL (Railway Postgres)
- **ORM:** Prisma 5.7.1
- **Authentication:** JWT (Access + Refresh tokens)
- **Validation:** class-validator, class-transformer
- **Documentation:** Swagger/OpenAPI
- **Deployment:** Railway (Nixpacks)

---

## Структура проекта

```
src/
├── app.module.ts              # Главный модуль приложения
├── main.ts                    # Точка входа, настройка CORS, Swagger, валидации
├── app.controller.ts          # Health check endpoint
│
├── auth/                      # Модуль аутентификации
│   ├── auth.module.ts
│   ├── auth.controller.ts     # POST /auth/login, POST /auth/refresh, GET /auth/me
│   ├── auth.service.ts        # Логика входа, генерация токенов, получение профиля
│   ├── strategies/
│   │   ├── jwt.strategy.ts    # Passport стратегия для access token
│   │   └── jwt-refresh.strategy.ts  # Passport стратегия для refresh token
│   └── dto/
│       ├── login.dto.ts
│       └── refresh.dto.ts
│
├── studios/                   # Модуль студий
│   ├── studios.module.ts
│   ├── studios.controller.ts  # GET /studios, POST /studios, GET /studios/:id
│   ├── studios.service.ts
│   └── dto/
│       └── create-studio.dto.ts
│
├── users/                     # Модуль персонала (staff)
│   ├── users.module.ts
│   ├── users.controller.ts    # GET /studios/:id/staff, POST /studios/:id/staff, PATCH /staff/:id
│   ├── users.service.ts
│   └── dto/
│       ├── create-staff.dto.ts
│       └── update-staff.dto.ts
│
├── clients/                   # Модуль клиентов
│   ├── clients.module.ts
│   ├── clients.controller.ts  # GET /studios/:id/clients, POST /studios/:id/clients, GET /clients/:id, PATCH /clients/:id
│   ├── clients.service.ts
│   └── dto/
│       ├── create-client.dto.ts
│       └── update-client.dto.ts
│
├── services/                  # Модуль услуг
│   ├── services.module.ts
│   ├── services.controller.ts # GET /studios/:id/services, POST /studios/:id/services, PATCH /services/:id
│   ├── services.service.ts
│   └── dto/
│       ├── create-service.dto.ts
│       └── update-service.dto.ts
│
├── schedule/                  # Модуль расписания работы
│   ├── schedule.module.ts
│   ├── schedule.controller.ts # GET /studios/:id/schedule, POST /studios/:id/schedule/generate, PATCH /schedule/day/:id
│   ├── schedule.service.ts
│   └── dto/
│       ├── create-schedule-day.dto.ts
│       ├── generate-schedule.dto.ts
│       └── update-schedule-day.dto.ts
│
├── busy-slots/                # Модуль занятых слотов
│   ├── busy-slots.module.ts
│   ├── busy-slots.controller.ts # GET /studios/:id/busy-slots, POST /studios/:id/busy-slots, PATCH /busy-slots/:id, DELETE /busy-slots/:id
│   ├── busy-slots.service.ts
│   └── dto/
│       ├── create-busy-slot.dto.ts
│       └── update-busy-slot.dto.ts
│
├── appointments/              # Модуль записей
│   ├── appointments.module.ts
│   ├── appointments.controller.ts # GET /studios/:id/appointments, POST /studios/:id/appointments, PATCH /appointments/:id, POST /appointments/:id/cancel, POST /appointments/:id/arrived
│   ├── appointments.service.ts
│   └── dto/
│       ├── create-appointment.dto.ts
│       └── update-appointment.dto.ts
│
├── availability/              # Сервис проверки доступности времени
│   ├── availability.module.ts
│   ├── availability.service.ts # checkAppointmentAvailability, checkBusySlotAllowed
│   └── availability.service.spec.ts
│
└── common/                    # Общие модули
    ├── common.module.ts       # Глобальный модуль с PrismaService
    ├── prisma/
    │   └── prisma.service.ts  # Prisma Client сервис
    ├── guards/
    │   ├── jwt-auth.guard.ts  # Guard для проверки JWT access token
    │   ├── jwt-refresh.guard.ts # Guard для проверки refresh token
    │   ├── roles.guard.ts    # Guard для проверки ролей (RBAC)
    │   └── studio-access.guard.ts # Guard для проверки доступа к студии
    ├── decorators/
    │   ├── current-user.decorator.ts # @CurrentUser() - получение текущего пользователя
    │   ├── roles.decorator.ts # @Roles() - указание требуемых ролей
    │   └── public.decorator.ts # @Public() - публичные эндпоинты без авторизации
    ├── filters/
    │   └── http-exception.filter.ts # Глобальный фильтр обработки ошибок
    └── exceptions/
        └── conflict.exception.ts # Кастомное исключение для конфликтов (409)
```

---

## База данных (Prisma Schema)

### Модели

#### 1. **Studio** (Студия)
```prisma
model Studio {
  id        String   @id @default(uuid())
  name      String
  address   String?
  timezone  String   @default("Asia/Almaty")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  users              User[]
  clients            Client[]
  workSchedules      WorkScheduleDay[]
  busySlots          BusySlot[]
  services           Service[]
  appointments       Appointment[]
  staffServiceOverrides StaffServiceOverride[]
}
```

#### 2. **User** (Пользователь)
```prisma
model User {
  id           String   @id @default(uuid())
  email        String?  @unique
  phone        String?  @unique
  passwordHash String
  role         UserRole  # OWNER | MANAGER | MASTER
  studioId     String?
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  studio       Studio?
  staffProfile StaffProfile?
  workSchedules WorkScheduleDay[]
  busySlots    BusySlot[]
  appointments Appointment[]
  serviceOverrides StaffServiceOverride[]
  arrivedAppointments Appointment[] @relation("ArrivedByUser")
}
```

#### 3. **StaffProfile** (Профиль сотрудника)
```prisma
model StaffProfile {
  userId          String  @id
  firstName       String
  lastName        String?
  title           String?
  category        String?
  providesServices Boolean @default(true)
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

#### 4. **Client** (Клиент)
```prisma
model Client {
  id        String   @id @default(uuid())
  studioId  String
  firstName String
  lastName  String?
  phone     String
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  studio       Studio
  appointments Appointment[]
  
  @@unique([studioId, phone])  # Уникальный телефон в рамках студии
}
```

#### 5. **WorkScheduleDay** (Расписание работы на день)
```prisma
model WorkScheduleDay {
  id         String   @id @default(uuid())
  studioId   String
  staffUserId String
  date       DateTime @db.Date
  startTime  String   # HH:MM format
  endTime    String   # HH:MM format
  breakStart String?  # HH:MM format
  breakEnd   String?  # HH:MM format
  isDayOff   Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  
  studio     Studio
  staff      User
  
  @@unique([studioId, staffUserId, date])  # Одно расписание на сотрудника на день
}
```

#### 6. **BusySlot** (Занятый слот)
```prisma
model BusySlot {
  id                        String    @id @default(uuid())
  studioId                  String
  staffUserId               String
  startAt                   DateTime
  endAt                     DateTime
  comment                   String?
  forfeitedPrepaymentAmount Int?
  createdAt                 DateTime  @default(now())
  updatedAt                 DateTime  @updatedAt
  
  studio Studio
  staff  User
  
  @@index([studioId, staffUserId, startAt])
}
```

#### 7. **Service** (Услуга)
```prisma
model Service {
  id               String   @id @default(uuid())
  studioId         String
  name             String
  defaultDurationMin Int
  defaultPrice     Int?
  isActive         Boolean  @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  studio           Studio
  staffOverrides   StaffServiceOverride[]
  appointments     Appointment[]
}
```

#### 8. **StaffServiceOverride** (Переопределение услуги для мастера)
```prisma
model StaffServiceOverride {
  id          String   @id @default(uuid())
  studioId    String
  staffUserId String
  serviceId   String
  durationMin Int?
  price       Int?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  studio  Studio
  staff   User
  service Service
  
  @@unique([studioId, staffUserId, serviceId])
}
```

#### 9. **Appointment** (Запись)
```prisma
model Appointment {
  id               String            @id @default(uuid())
  studioId         String
  staffUserId      String
  clientId         String
  serviceId        String
  startAt          DateTime
  endAt            DateTime
  status           AppointmentStatus @default(BOOKED)  # BOOKED | CANCELLED | ARRIVED | DONE
  prepaymentAmount Int?
  arrivedAt        DateTime?
  arrivedByUserId  String?
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  
  studio         Studio
  staff          User
  client         Client
  service        Service
  arrivedByUser  User?   @relation("ArrivedByUser")
  
  @@index([studioId, staffUserId, startAt])
  @@index([studioId, startAt])
  @@index([clientId])
}
```

### Enums

```prisma
enum UserRole {
  OWNER
  MANAGER
  MASTER
}

enum AppointmentStatus {
  BOOKED
  CANCELLED
  ARRIVED
  DONE
}
```

---

## Система аутентификации и авторизации

### JWT Authentication

**Access Token:**
- Секрет: `JWT_SECRET` (env)
- Время жизни: `JWT_EXPIRES_IN` (по умолчанию: 15 минут)
- Payload: `{ sub: userId, role: UserRole, studioId?: string }`

**Refresh Token:**
- Секрет: `JWT_REFRESH_SECRET` (env)
- Время жизни: `JWT_REFRESH_EXPIRES_IN` (по умолчанию: 7 дней)
- Payload: `{ sub: userId, type: 'refresh' }`

### Guards (Защитники)

1. **JwtAuthGuard** - Проверяет наличие и валидность access token
2. **JwtRefreshGuard** - Проверяет refresh token
3. **RolesGuard** - Проверяет, что у пользователя есть требуемая роль
4. **StudioAccessGuard** - Проверяет доступ к студии (MANAGER/MASTER могут работать только со своей студией)

### Декораторы

- `@Public()` - Помечает эндпоинт как публичный (без авторизации)
- `@Roles(UserRole.OWNER)` - Требует определенную роль
- `@CurrentUser()` - Получает текущего пользователя из JWT токена

### Роли и доступ

#### **OWNER** (Владелец)
- Полный доступ ко всем студиям
- Может создавать студии
- Может управлять всеми данными во всех студиях

#### **MANAGER** (Менеджер)
- Доступ только к своей студии (`studioId`)
- Может управлять персоналом, клиентами, услугами, расписанием, записями
- Не может создавать студии

#### **MASTER** (Мастер)
- Доступ только к своей студии (`studioId`)
- Может видеть и редактировать только свои записи
- Может управлять своим расписанием
- Может создавать занятые слоты для себя

---

## API Endpoints

### Health Check

**GET** `/health`
- Публичный эндпоинт
- Возвращает: `{ status: 'ok', timestamp: '...' }`

---

### Authentication

#### POST `/auth/login`
**Публичный эндпоинт**

**Body:**
```json
{
  "emailOrPhone": "owner@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "owner@example.com",
    "phone": "+79991234567",
    "role": "OWNER",
    "studioId": null,
    "staffProfile": null
  }
}
```

#### POST `/auth/refresh`
**Публичный эндпоинт, требует refresh token**

**Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### GET `/auth/me`
**Требует авторизации**

**Headers:** `Authorization: Bearer <accessToken>`

**Response (200):**
```json
{
  "id": "uuid",
  "email": "owner@example.com",
  "phone": "+79991234567",
  "role": "OWNER",
  "studioId": null,
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "studio": null,
  "staffProfile": null
}
```

---

### Studios

#### GET `/studios`
**Требует авторизации**

- OWNER: видит все студии
- MANAGER/MASTER: видит только свою студию

**Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "Beauty Studio Almaty",
    "address": "Almaty, Abay Ave 150",
    "timezone": "Asia/Almaty",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### POST `/studios`
**Требует роль OWNER**

**Body:**
```json
{
  "name": "New Studio",
  "address": "New York, 5th Ave",
  "timezone": "America/New_York"
}
```

#### GET `/studios/:studioId`
**Требует авторизации, проверяет доступ к студии**

---

### Staff (Персонал)

#### GET `/studios/:studioId/staff`
**Требует авторизации, проверяет доступ к студии**

Возвращает список сотрудников (MANAGER и MASTER) студии с их профилями.

**Response (200):**
```json
[
  {
    "id": "uuid",
    "email": "manager@example.com",
    "phone": "+79991234568",
    "role": "MANAGER",
    "studioId": "uuid",
    "isActive": true,
    "staffProfile": {
      "userId": "uuid",
      "firstName": "Manager",
      "lastName": "User",
      "title": "Studio Manager",
      "category": null,
      "providesServices": false
    }
  }
]
```

#### POST `/studios/:studioId/staff`
**Требует роль OWNER или MANAGER, проверяет доступ к студии**

**Body:**
```json
{
  "email": "newmaster@example.com",
  "phone": "+79991234570",
  "password": "password123",
  "role": "MASTER",
  "firstName": "Иван",
  "lastName": "Иванов",
  "title": "Старший мастер",
  "category": "Парикмахер",
  "providesServices": true
}
```

**Валидация:**
- `email` или `phone` обязателен (хотя бы одно)
- `password` минимум 6 символов
- `firstName` обязателен
- `role` не может быть OWNER

#### PATCH `/staff/:userId`
**Требует авторизации**

- OWNER/MANAGER: могут обновлять любого сотрудника своей студии
- MASTER: может обновлять только свой профиль

**Body (все поля опциональны):**
```json
{
  "firstName": "Updated Name",
  "title": "Senior Stylist",
  "isActive": true
}
```

---

### Clients

#### GET `/studios/:studioId/clients?q=<search>`
**Требует авторизации, проверяет доступ к студии**

**Query Parameters:**
- `q` (опционально): Поиск по имени, фамилии или телефону

**Response (200):**
```json
[
  {
    "id": "uuid",
    "studioId": "uuid",
    "firstName": "Иван",
    "lastName": "Петров",
    "phone": "+79991112233",
    "notes": "VIP клиент",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### POST `/studios/:studioId/clients`
**Требует роль OWNER или MANAGER, проверяет доступ к студии**

**Body:**
```json
{
  "firstName": "Иван",
  "lastName": "Петров",
  "phone": "+79991112233",
  "notes": "VIP клиент"
}
```

**Валидация:**
- `phone` должен быть уникальным в рамках студии

#### GET `/clients/:id`
**Требует авторизации, проверяет доступ к клиенту**

#### PATCH `/clients/:id`
**Требует роль OWNER или MANAGER, проверяет доступ к клиенту**

---

### Services

#### GET `/studios/:studioId/services`
**Требует авторизации, проверяет доступ к студии**

**Response (200):**
```json
[
  {
    "id": "uuid",
    "studioId": "uuid",
    "name": "Стрижка",
    "defaultDurationMin": 60,
    "defaultPrice": 2000,
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### POST `/studios/:studioId/services`
**Требует роль OWNER или MANAGER, проверяет доступ к студии**

**Body:**
```json
{
  "name": "Маникюр",
  "defaultDurationMin": 90,
  "defaultPrice": 1200,
  "isActive": true
}
```

#### PATCH `/services/:id`
**Требует роль OWNER или MANAGER, проверяет доступ к услуге**

---

### Schedule (Расписание работы)

#### GET `/studios/:studioId/schedule?date=YYYY-MM-DD`
**Требует авторизации, проверяет доступ к студии**

**Query Parameters:**
- `date` (опционально): Фильтр по дате

**Response (200):**
```json
[
  {
    "id": "uuid",
    "studioId": "uuid",
    "staffUserId": "uuid",
    "date": "2024-01-30T00:00:00.000Z",
    "startTime": "09:00",
    "endTime": "20:00",
    "breakStart": "13:00",
    "breakEnd": "14:00",
    "isDayOff": false,
    "staff": {
      "id": "uuid",
      "staffProfile": {
        "firstName": "Аня",
        "lastName": "Иванова"
      }
    }
  }
]
```

#### POST `/studios/:studioId/schedule/generate`
**Требует роль OWNER или MANAGER, проверяет доступ к студии**

Генерирует расписание по шаблону (5/2 или 6/1).

**Body:**
```json
{
  "pattern": "5/2",  // или "6/1"
  "staffUserId": "uuid",
  "dateFrom": "2024-02-01",
  "dateTo": "2024-02-29",
  "startTime": "10:00",
  "endTime": "19:00",
  "breakStart": "14:00",
  "breakEnd": "15:00"
}
```

**Шаблоны:**
- `5/2`: Понедельник-Пятница работают, Суббота-Воскресенье выходные
- `6/1`: Понедельник-Суббота работают, Воскресенье выходной

**Response (201):**
```json
{
  "count": 20,
  "schedules": [...]
}
```

#### PATCH `/schedule/day/:id`
**Требует авторизации**

- OWNER/MANAGER: могут обновлять любое расписание своей студии
- MASTER: может обновлять только свое расписание

**Body (все поля опциональны):**
```json
{
  "startTime": "09:30",
  "endTime": "18:30",
  "breakStart": "13:00",
  "breakEnd": "14:00",
  "isDayOff": false
}
```

**Валидация:**
- `endTime > startTime`
- `breakEnd > breakStart`
- Перерыв должен быть в пределах рабочих часов

---

### Busy Slots (Занятые слоты)

#### GET `/studios/:studioId/busy-slots?date=YYYY-MM-DD`
**Требует авторизации, проверяет доступ к студии**

**Query Parameters:**
- `date` (опционально): Фильтр по дате

#### POST `/studios/:studioId/busy-slots`
**Требует авторизации, проверяет доступ к студии**

- OWNER/MANAGER: могут создавать для любого сотрудника
- MASTER: может создавать только для себя

**Body:**
```json
{
  "staffUserId": "uuid",
  "startAt": "2024-01-30T10:00:00+06:00",
  "endAt": "2024-01-30T11:00:00+06:00",
  "comment": "Личная встреча",
  "forfeitedPrepaymentAmount": 500
}
```

**Валидация:**
- Должен быть в пределах рабочего расписания
- Не должен пересекаться с перерывом
- `endAt > startAt`

#### PATCH `/busy-slots/:id`
**Требует авторизации**

- OWNER/MANAGER: могут обновлять любой слот своей студии
- MASTER: может обновлять только свои слоты

#### DELETE `/busy-slots/:id`
**Требует авторизации**

- OWNER/MANAGER: могут удалять любой слот своей студии
- MASTER: может удалять только свои слоты

---

### Appointments (Записи)

#### GET `/studios/:studioId/appointments?date=YYYY-MM-DD`
**Требует авторизации, проверяет доступ к студии**

- OWNER/MANAGER: видят все записи студии
- MASTER: видит только свои записи

**Query Parameters:**
- `date` (опционально): Фильтр по дате (YYYY-MM-DD)

**Response (200):**
```json
[
  {
    "id": "uuid",
    "studioId": "uuid",
    "staffUserId": "uuid",
    "clientId": "uuid",
    "serviceId": "uuid",
    "startAt": "2024-01-30T10:00:00.000Z",
    "endAt": "2024-01-30T11:00:00.000Z",
    "status": "BOOKED",
    "prepaymentAmount": 1000,
    "arrivedAt": null,
    "arrivedByUserId": null,
    "staff": {
      "id": "uuid",
      "staffProfile": {
        "firstName": "Аня",
        "lastName": "Иванова"
      }
    },
    "client": {
      "id": "uuid",
      "firstName": "Иван",
      "lastName": "Петров",
      "phone": "+79991112233"
    },
    "service": {
      "id": "uuid",
      "name": "Стрижка",
      "defaultDurationMin": 60,
      "defaultPrice": 2000
    }
  }
]
```

#### POST `/studios/:studioId/appointments`
**Требует роль OWNER или MANAGER, проверяет доступ к студии**

**Body:**
```json
{
  "staffUserId": "uuid",
  "clientId": "uuid",
  "serviceId": "uuid",
  "startAt": "2024-01-30T10:00:00+06:00",
  "prepaymentAmount": 1000
}
```

**Валидация:**
- Проверка доступности времени через `AvailabilityService`
- `endAt` вычисляется автоматически на основе длительности услуги (master override или service default)
- Проверки:
  1. Есть рабочее расписание на дату (`isDayOff = false`)
  2. Время в пределах рабочих часов
  3. Не пересекается с перерывом
  4. Не пересекается с занятыми слотами
  5. Не пересекается с другими записями (кроме CANCELLED)

**Ошибки (409 Conflict):**
- `NO_WORK_SCHEDULE` - Нет рабочего расписания
- `OUT_OF_WORK_HOURS` - Вне рабочих часов
- `OVERLAP_BREAK` - Пересечение с перерывом
- `OVERLAP_BUSY_SLOT` - Пересечение с занятым слотом
- `OVERLAP_APPOINTMENT` - Пересечение с другой записью

#### PATCH `/appointments/:id`
**Требует авторизации**

- OWNER/MANAGER: могут обновлять любую запись своей студии
- MASTER: может обновлять только свои записи

**Body (все поля опциональны):**
```json
{
  "startAt": "2024-01-30T11:00:00+06:00",
  "prepaymentAmount": 1500,
  "status": "BOOKED"
}
```

**При изменении `startAt`:**
- Пересчитывается `endAt` на основе длительности услуги
- Проверяется доступность нового времени (исключая текущую запись)

#### POST `/appointments/:id/cancel`
**Требует авторизации**

- OWNER/MANAGER: могут отменять любую запись своей студии
- MASTER: может отменять только свои записи

**Response (200):**
```json
{
  "id": "uuid",
  "status": "CANCELLED",
  ...
}
```

#### POST `/appointments/:id/arrived`
**Требует роль OWNER или MANAGER, проверяет доступ к записи**

Отмечает запись как "клиент пришел".

**Response (200):**
```json
{
  "id": "uuid",
  "status": "ARRIVED",
  "arrivedAt": "2024-01-30T10:05:00.000Z",
  "arrivedByUserId": "uuid",
  ...
}
```

---

## AvailabilityService (Проверка доступности)

Сервис для проверки доступности времени для записей и занятых слотов.

### Методы

#### `checkAppointmentAvailability(studioId, staffUserId, startAt, endAt, appointmentId?)`
Проверяет доступность времени для записи:
1. Проверяет наличие рабочего расписания на дату
2. Проверяет, что время в пределах рабочих часов
3. Проверяет, что не пересекается с перерывом
4. Проверяет, что не пересекается с занятыми слотами
5. Проверяет, что не пересекается с другими записями (кроме CANCELLED)

**Бросает `ConflictException` с кодом причины:**
- `APPOINTMENT_NO_SCHEDULE`
- `APPOINTMENT_OUTSIDE_HOURS`
- `APPOINTMENT_IN_BREAK`
- `APPOINTMENT_BUSY_SLOT_CONFLICT`
- `APPOINTMENT_APPOINTMENT_CONFLICT`

#### `checkBusySlotAllowed(studioId, staffUserId, startAt, endAt)`
Проверяет, что занятый слот разрешен:
1. Проверяет наличие рабочего расписания на дату
2. Проверяет, что время в пределах рабочих часов
3. Проверяет, что не пересекается с перерывом

**Бросает `ConflictException` с кодом причины:**
- `BUSY_SLOT_NO_SCHEDULE`
- `BUSY_SLOT_OUTSIDE_HOURS`
- `BUSY_SLOT_IN_BREAK`

---

## Валидация и обработка ошибок

### ValidationPipe (Глобальный)
- `whitelist: true` - Удаляет поля, не описанные в DTO
- `forbidNonWhitelisted: true` - Бросает ошибку при наличии лишних полей
- `transform: true` - Автоматически преобразует типы

### HTTP Status Codes

- **200 OK** - Успешный запрос
- **201 Created** - Ресурс создан
- **204 No Content** - Успешное удаление
- **400 Bad Request** - Ошибка валидации DTO
- **401 Unauthorized** - Неверный или отсутствующий токен
- **403 Forbidden** - Недостаточно прав или нет доступа к ресурсу
- **404 Not Found** - Ресурс не найден
- **409 Conflict** - Конфликт данных (пересечение времени, дубликаты)
- **500 Internal Server Error** - Непредвиденная ошибка

### Формат ошибок

**400 Bad Request:**
```json
{
  "statusCode": 400,
  "message": ["emailOrPhone must be a string"],
  "error": "Bad Request"
}
```

**409 Conflict:**
```json
{
  "statusCode": 409,
  "message": "Conflict: Time slot not available. Reason: OVERLAP_APPOINTMENT",
  "error": "Conflict"
}
```

---

## Переменные окружения

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_REFRESH_EXPIRES_IN=7d

# Server
PORT=3000
CORS_ORIGIN=https://example.com,https://another.com
```

---

## Миграции и деплой

### Локальная разработка

```bash
# Установка зависимостей
npm install

# Генерация Prisma Client
npm run prisma:generate

# Применение миграций
npm run prisma:migrate

# Запуск в режиме разработки
npm run start:dev

# Заполнение базы тестовыми данными
npm run seed
```

### Railway Deployment

**Procfile:**
```
release: npx prisma migrate deploy && npx prisma generate
web: sh -c "npm run build && node dist/main.js"
```

**Процесс деплоя:**
1. Railway автоматически определяет проект как Node.js (Nixpacks)
2. Выполняет `npm install`
3. Запускает `release` команду: применяет миграции и генерирует Prisma Client
4. Запускает `web` команду: собирает проект и запускает сервер

**Требуемые переменные окружения в Railway:**
- `DATABASE_URL` - Ссылка на Railway Postgres (можно через Service Reference)
- `JWT_SECRET` - Секретный ключ для access token
- `JWT_REFRESH_SECRET` - Секретный ключ для refresh token
- `PORT` - Порт (Railway устанавливает автоматически)
- `CORS_ORIGIN` (опционально) - Разрешенные origins для CORS

---

## Тестирование

### Unit Tests

**Файлы тестов:**
- `src/availability/availability.service.spec.ts` - Тесты проверки доступности
- `src/common/guards/roles.guard.spec.ts` - Тесты RBAC guard
- `src/common/guards/studio-access.guard.spec.ts` - Тесты проверки доступа к студии

**Запуск тестов:**
```bash
npm test
npm run test:watch
npm run test:cov
```

---

## Seed Data

Скрипт `prisma/seed.ts` создает:
- 1 студию: "Beauty Studio Almaty"
- 1 владельца: `owner@example.com` / `owner123`
- 1 менеджера: `manager@example.com` / `manager123`
- 1 мастера: `master@example.com` / `master123`
- 1 клиента
- 1 услугу: "Haircut"
- Примерное расписание для мастера

**Запуск:**
```bash
npm run seed
```

---

## Важные особенности реализации

### 1. Транзакции для записей
При создании и обновлении записей используется Prisma транзакция для предотвращения race conditions при проверке доступности.

### 2. Автоматический расчет endAt
`endAt` вычисляется автоматически на основе:
- `StaffServiceOverride.durationMin` (если есть и `isActive = true`)
- Иначе `Service.defaultDurationMin`

### 3. Фильтрация по ролям
- MASTER видит только свои записи (фильтрация в `findAll`)
- MANAGER/MASTER могут работать только со своей студией (проверка в guards)

### 4. Уникальность данных
- Email и телефон пользователей уникальны глобально
- Телефон клиента уникален в рамках студии
- Расписание уникально для сотрудника на дату

### 5. Мягкое удаление
Отмененные записи (`CANCELLED`) не удаляются, но исключаются из проверок доступности и могут быть скрыты на фронтенде.

### 6. Пустые массивы
Все GET эндпоинты возвращают пустой массив `[]` вместо ошибки, если данных нет. Это стандартное поведение REST API.

---

## Swagger Documentation

Полная интерактивная документация доступна по адресу:
```
https://aidaproject-production.up.railway.app/docs
```

Документация включает:
- Все эндпоинты с описаниями
- Схемы DTO с примерами
- Возможность тестирования запросов прямо в браузере
- Описание всех статус кодов и ошибок

---

## Заключение

Backend полностью готов к production использованию:
- ✅ Полная реализация всех MVP требований
- ✅ RBAC с проверкой доступа к студиям
- ✅ Сложная валидация доступности времени
- ✅ Swagger документация
- ✅ Готовность к деплою на Railway
- ✅ Обработка ошибок и валидация
- ✅ Unit тесты для критичных компонентов

