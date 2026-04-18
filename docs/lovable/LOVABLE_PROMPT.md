# Backend API Documentation for Lovable

## Base URL
```
https://aidaproject-production.up.railway.app
```

## Swagger Documentation
Полная интерактивная документация доступна по адресу:
```
https://aidaproject-production.up.railway.app/docs
```

## Authentication

API использует JWT (JSON Web Tokens) для аутентификации. Большинство эндпоинтов требуют авторизации.

### 1. Login (Получить токены)

**POST** `/auth/login`

**Body:**
```json
{
  "emailOrPhone": "owner@example.com",
  "password": "owner123"
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
    "studioId": "uuid",
    "staffProfile": null
  }
}
```

### 2. Refresh Token (Обновить access token)

**POST** `/auth/refresh`

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

### 3. Get Current User

**GET** `/auth/me`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "id": "uuid",
  "email": "owner@example.com",
  "phone": "+79991234567",
  "role": "OWNER",
  "studioId": "uuid",
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "studio": {
    "id": "uuid",
    "name": "Beauty Studio Almaty",
    "address": "Almaty, Abay Ave 150",
    "timezone": "Asia/Almaty"
  },
  "staffProfile": null
}
```

## Using Authentication in Requests

Все защищенные эндпоинты требуют заголовок:
```
Authorization: Bearer <accessToken>
```

Access token живет 15 минут, после истечения используйте refresh token для получения нового.

## User Roles

- **OWNER**: Доступ ко всем студиям, может создавать студии, управлять всем
- **MANAGER**: Доступ только к своей студии, может управлять персоналом, клиентами, услугами
- **MASTER**: Доступ только к своей студии, может видеть и управлять только своим расписанием и записями

## API Endpoints

### Studios (Студии)

#### Get All Studios
**GET** `/studios`

**Headers:** `Authorization: Bearer <token>`

**Response:**
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

#### Create Studio (OWNER only)
**POST** `/studios`

**Body:**
```json
{
  "name": "New Beauty Studio",
  "address": "Address line",
  "timezone": "Asia/Almaty"
}
```

#### Get Studio by ID
**GET** `/studios/:studioId`

---

### Staff (Персонал)

#### Get All Staff
**GET** `/studios/:studioId/staff`

**Response:**
```json
[
  {
    "id": "uuid",
    "email": "master@example.com",
    "phone": "+79991234569",
    "role": "MASTER",
    "studioId": "uuid",
    "isActive": true,
    "staffProfile": {
      "userId": "uuid",
      "firstName": "Master",
      "lastName": "User",
      "title": "Senior Hair Stylist",
      "category": "Hair Stylist",
      "providesServices": true
    }
  }
]
```

#### Create Staff Member
**POST** `/studios/:studioId/staff`

**Body:**
```json
{
  "email": "newmaster@example.com",
  "phone": "+79991234570",
  "password": "password123",
  "role": "MASTER",
  "firstName": "John",
  "lastName": "Doe",
  "title": "Hair Stylist",
  "category": "Hair Stylist",
  "providesServices": true
}
```

#### Update Staff Member
**PATCH** `/staff/:userId`

**Body:**
```json
{
  "firstName": "Updated Name",
  "isActive": true
}
```

---

### Clients (Клиенты)

#### Get All Clients
**GET** `/studios/:studioId/clients?q=search`

**Query Parameters:**
- `q` (optional): Search query (searches in firstName, lastName, phone)

**Response (200):**
```json
[
  {
    "id": "uuid",
    "studioId": "uuid",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+79991234570",
    "notes": "Regular client",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

**Note:** Если клиентов нет, вернется пустой массив `[]` (не ошибка)

#### Create Client
**POST** `/studios/:studioId/clients`

**Body:**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "phone": "+79991234571",
  "notes": "Prefers morning appointments"
}
```

#### Get Client by ID
**GET** `/clients/:id`

#### Update Client
**PATCH** `/clients/:id`

**Body:**
```json
{
  "firstName": "Updated Name",
  "phone": "+79991234572"
}
```

---

### Services (Услуги)

#### Get All Services
**GET** `/studios/:studioId/services`

**Response:**
```json
[
  {
    "id": "uuid",
    "studioId": "uuid",
    "name": "Haircut",
    "defaultDurationMin": 60,
    "defaultPrice": 2000,
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### Create Service
**POST** `/studios/:studioId/services`

**Body:**
```json
{
  "name": "Hair Coloring",
  "defaultDurationMin": 120,
  "defaultPrice": 5000
}
```

#### Update Service
**PATCH** `/services/:id`

**Body:**
```json
{
  "name": "Updated Service Name",
  "isActive": false
}
```

---

### Schedule (График работы)

#### Get Schedule
**GET** `/studios/:studioId/schedule?date=2024-01-15`

**Query Parameters:**
- `date` (optional): Filter by date (YYYY-MM-DD format)

**Response:**
```json
[
  {
    "id": "uuid",
    "studioId": "uuid",
    "staffUserId": "uuid",
    "date": "2024-01-15",
    "startTime": "09:00",
    "endTime": "18:00",
    "breakStart": "13:00",
    "breakEnd": "14:00",
    "isDayOff": false,
    "staff": {
      "id": "uuid",
      "staffProfile": {
        "firstName": "Master",
        "lastName": "User"
      }
    }
  }
]
```

#### Create/Update Schedule Day
**POST** `/studios/:studioId/schedule`

**Body:**
```json
{
  "staffUserId": "uuid",
  "date": "2024-01-15",
  "startTime": "09:00",
  "endTime": "18:00",
  "breakStart": "13:00",
  "breakEnd": "14:00",
  "isDayOff": false
}
```

#### Generate Schedule from Template
**POST** `/studios/:studioId/schedule/generate`

**Body:**
```json
{
  "pattern": "5/2",
  "staffUserId": "uuid",
  "dateFrom": "2024-01-01",
  "dateTo": "2024-01-31",
  "startTime": "09:00",
  "endTime": "18:00",
  "breakStart": "13:00",
  "breakEnd": "14:00"
}
```

**Pattern options:**
- `"5/2"`: Monday-Friday work, Saturday-Sunday off
- `"6/1"`: Monday-Saturday work, Sunday off

#### Update Schedule Day
**PATCH** `/schedule/day/:id`

**Body:**
```json
{
  "startTime": "10:00",
  "endTime": "19:00",
  "isDayOff": false
}
```

---

### Busy Slots (Занятые слоты)

#### Get Busy Slots
**GET** `/studios/:studioId/busy-slots?date=2024-01-15`

**Response:**
```json
[
  {
    "id": "uuid",
    "studioId": "uuid",
    "staffUserId": "uuid",
    "startAt": "2024-01-15T10:00:00+06:00",
    "endAt": "2024-01-15T12:00:00.000Z",
    "comment": "Personal appointment",
    "forfeitedPrepaymentAmount": 1000,
    "staff": {
      "id": "uuid",
      "staffProfile": {
        "firstName": "Master",
        "lastName": "User"
      }
    }
  }
]
```

#### Create Busy Slot
**POST** `/studios/:studioId/busy-slots`

**Body:**
```json
{
  "staffUserId": "uuid",
  "startAt": "2024-01-15T10:00:00+06:00",
  "endAt": "2024-01-15T12:00:00+06:00",
  "comment": "Personal appointment",
  "forfeitedPrepaymentAmount": 1000
}
```

#### Update Busy Slot
**PATCH** `/busy-slots/:id`

**Body:**
```json
{
  "startAt": "2024-01-15T11:00:00+06:00",
  "endAt": "2024-01-15T13:00:00+06:00",
  "comment": "Updated comment"
}
```

#### Delete Busy Slot
**DELETE** `/busy-slots/:id`

---

### Appointments (Записи)

#### Get Appointments
**GET** `/studios/:studioId/appointments?date=2024-01-15`

**Response (200):**
```json
[
  {
    "id": "uuid",
    "studioId": "uuid",
    "staffUserId": "uuid",
    "clientId": "uuid",
    "serviceId": "uuid",
    "startAt": "2024-01-15T10:00:00+06:00",
    "endAt": "2024-01-15T11:00:00.000Z",
    "status": "BOOKED",
    "prepaymentAmount": 1000,
    "arrivedAt": null,
    "arrivedByUserId": null,
    "staff": {
      "id": "uuid",
      "staffProfile": {
        "firstName": "Master",
        "lastName": "User"
      }
    },
    "client": {
      "id": "uuid",
      "firstName": "John",
      "lastName": "Doe",
      "phone": "+79991234570"
    },
    "service": {
      "id": "uuid",
      "name": "Haircut",
      "defaultDurationMin": 60,
      "defaultPrice": 2000
    }
  }
]
```

**Note:** Если записей нет, вернется пустой массив `[]` (не ошибка). Фронтенд должен проверять `response.length === 0` и показывать соответствующее сообщение.

#### Create Appointment
**POST** `/studios/:studioId/appointments`

**Body:**
```json
{
  "staffUserId": "uuid",
  "clientId": "uuid",
  "serviceId": "uuid",
  "startAt": "2024-01-15T10:00:00.000Z",
  "prepaymentAmount": 1000
}
```

**Note:** `endAt` вычисляется автоматически на основе длительности услуги (service.defaultDurationMin или staff override).

**Status values:**
- `BOOKED` - Забронировано
- `CANCELLED` - Отменено
- `ARRIVED` - Клиент прибыл
- `DONE` - Выполнено

#### Update Appointment
**PATCH** `/appointments/:id`

**Body:**
```json
{
  "startAt": "2024-01-15T11:00:00.000Z",
  "prepaymentAmount": 1500,
  "status": "BOOKED"
}
```

#### Cancel Appointment
**POST** `/appointments/:id/cancel`

**Response:**
```json
{
  "id": "uuid",
  "status": "CANCELLED",
  ...
}
```

#### Mark Appointment as Arrived
**POST** `/appointments/:id/arrived`

**Response:**
```json
{
  "id": "uuid",
  "status": "ARRIVED",
  "arrivedAt": "2024-01-15T10:05:00.000Z",
  "arrivedByUserId": "uuid",
  ...
}
```

---

### Health Check

#### Health Endpoint
**GET** `/health`

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

## Error Handling

API возвращает стандартные HTTP коды статуса:

- **200**: Success
- **201**: Created
- **400**: Bad Request (validation errors)
- **401**: Unauthorized (invalid/missing token)
- **403**: Forbidden (insufficient permissions)
- **404**: Not Found
- **409**: Conflict (e.g., appointment time slot conflict)

**Error Response Format:**
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

## Important Notes

1. **Empty Results:**
   - Когда таблицы пустые, API возвращает пустой массив `[]` (не ошибку)
   - Это нормальное поведение - фронтенд должен проверять длину массива и показывать соответствующее сообщение
   - Пример: `GET /studios` вернет `[]`, если студий нет
   - Пример: `GET /studios/:studioId/clients` вернет `[]`, если клиентов нет

2. **Time Formats:**
   - Dates: `YYYY-MM-DD` (e.g., "2024-01-15")
   - Times: `HH:MM` (e.g., "09:00", "18:00")
   - DateTime: ISO 8601 format (e.g., "2024-01-15T10:00:00.000Z")

3. **UUIDs:** Все ID являются UUID строками

4. **Validation Rules:**
   - Appointments нельзя создать, если время пересекается с busy slot или другим appointment
   - Appointments должны быть в пределах рабочего времени
   - Busy slots должны быть в пределах рабочего графика

5. **CORS:** API настроен на CORS, но может потребоваться добавить ваш домен в переменную `CORS_ORIGIN` в Railway

6. **Token Expiration:**
   - Access token: 15 минут
   - Refresh token: 7 дней

## Example Usage Flow

1. **Login:**
```javascript
const response = await fetch('https://aidaproject-production.up.railway.app/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    emailOrPhone: 'owner@example.com',
    password: 'owner123'
  })
});
const { accessToken, refreshToken, user } = await response.json();
```

2. **Get Studios:**
```javascript
const response = await fetch('https://aidaproject-production.up.railway.app/studios', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
const studios = await response.json();
```

3. **Create Appointment:**
```javascript
const response = await fetch(`https://aidaproject-production.up.railway.app/studios/${studioId}/appointments`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    staffUserId: 'uuid',
    clientId: 'uuid',
    serviceId: 'uuid',
    startAt: '2024-01-15T10:00:00.000Z',
    prepaymentAmount: 1000
  })
});
```

## Testing Accounts

Для тестирования можно использовать seed данные (если они были созданы):
- Owner: `owner@example.com` / `owner123`
- Manager: `manager@example.com` / `manager123`
- Master: `master@example.com` / `master123`

