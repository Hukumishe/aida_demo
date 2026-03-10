# Глоссарий API AIDA

Справочник по API для цикла **НБ (бэкенд)** ↔ **Клиент (фронтенд)** ↔ **AI-DA**. Для каждого метода даны примеры запросов и описание полей ответа.

---

## Быстрый старт

**Базовый URL:** `https://ваш-сервер.com` (без префикса типа `/api`).

**Шаг 1 — получить токен (вход):**

```bash
curl -X POST https://ваш-сервер.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone": "+77001234567", "password": "ServiceAccount1!"}'
```

В ответе будут `accessToken` и `refreshToken`. Сохраните их.

**Шаг 2 — вызывать любой защищённый метод с токеном:**

```bash
curl -X GET "https://ваш-сервер.com/studios/ВАШ_STUDIO_ID/clients" \
  -H "Authorization: Bearer ВАШ_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

Все запросы (кроме `/auth/login`, `/auth/refresh`, `/health`) требуют заголовок:

```
Authorization: Bearer <accessToken>
```

---

## 1. Аутентификация (Auth)

### Вход в систему

**POST** `/auth/login` — публичный, без токена.

**Пример запроса:**

```bash
curl -X POST https://ваш-сервер.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+77001234567",
    "password": "ServiceAccount1!"
  }'
```

**Тело запроса:**

| Поле       | Тип   | Обязательно | Описание              |
|-----------|--------|-------------|------------------------|
| `phone`   | string | да          | Телефон, например +7…  |
| `password`| string | да          | Пароль (минимум 6 символов) |

**Пример ответа:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": null,
    "phone": "+77001234567",
    "role": "SERVICE",
    "studioId": null,
    "staffProfile": null
  }
}
```

| Поле в ответе   | Описание |
|-----------------|----------|
| `accessToken`   | Токен для заголовка `Authorization: Bearer ...` |
| `refreshToken`  | Токен для обновления access (при 401) |
| `user.id`       | UUID пользователя |
| `user.role`     | OWNER \| DEPUTY_OWNER \| SERVICE \| ADMIN \| MANAGER \| MASTER |
| `user.studioId` | UUID студии или null |
| `user.staffProfile` | Профиль сотрудника или null |

---

### Обновление токена

**POST** `/auth/refresh` — публичный, в теле передаётся только refreshToken.

**Пример запроса:**

```bash
curl -X POST https://ваш-сервер.com/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "eyJhbGciOiJIUzI1NiIs..."}'
```

**Ответ:** `{ "accessToken": "новый_токен..." }`

---

### Текущий пользователь

**GET** `/auth/me` — нужен Bearer-токен.

**Пример запроса:**

```bash
curl -X GET https://ваш-сервер.com/auth/me \
  -H "Authorization: Bearer ВАШ_ACCESS_TOKEN"
```

**Пример ответа (поля):** `id`, `email`, `phone`, `role`, `studioId`, `isActive`, `themePreference`, `createdAt`, `updatedAt`, `studio` (объект: `id`, `name`, `address`, `timezone`), `staffProfile`.

---

### Смена темы

**PATCH** `/auth/me/theme`

**Пример запроса:**

```bash
curl -X PATCH https://ваш-сервер.com/auth/me/theme \
  -H "Authorization: Bearer ВАШ_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"themePreference": "dark"}'
```

**Тело:** `themePreference` — строка: `"light"` \| `"dark"` \| `"system"`.

---

## 2. Студии (Studios)

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/studios` | Список студий |
| POST | `/studios` | Создать студию |
| GET | `/studios/:studioId` | Одна студия |
| GET | `/studios/:studioId/settings` | Настройки (лимит бонусов) |
| PATCH | `/studios/:studioId/settings` | Обновить настройки (только OWNER) |

**Пример — список студий:**

```bash
curl -X GET https://ваш-сервер.com/studios \
  -H "Authorization: Bearer ВАШ_ACCESS_TOKEN"
```

**Ответ:** массив объектов с полями: `id`, `name`, `address`, `timezone`, `globalBonusPaymentLimitPercent`, `createdAt`, `updatedAt`.

**Пример — создать студию:**

```bash
curl -X POST https://ваш-сервер.com/studios \
  -H "Authorization: Bearer ВАШ_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Салон красоты Центр",
    "address": "ул. Абая 150",
    "timezone": "Asia/Almaty"
  }'
```

**Пример — настройки студии (GET):**

Ответ: `{ "globalBonusPaymentLimitPercent": 30 }` (0–100).

**PATCH settings — тело:** `{ "globalBonusPaymentLimitPercent": 40 }` (опционально).

---

## 3. Клиенты (Clients)

Клиенты общие для всех студий. В URL указывается `studioId` только для проверки прав доступа.

### Список клиентов

**GET** `/studios/:studioId/clients`

**Пример запроса:**

```bash
# Все клиенты
curl -X GET "https://ваш-сервер.com/studios/STUDIO_UUID/clients" \
  -H "Authorization: Bearer ВАШ_ACCESS_TOKEN"

# Поиск по имени/фамилии/телефону
curl -X GET "https://ваш-сервер.com/studios/STUDIO_UUID/clients?q=Иван" \
  -H "Authorization: Bearer ВАШ_ACCESS_TOKEN"
```

**Query:** `q` (опционально) — строка поиска.

**Ответ:** массив. В каждом элементе поля модели Client плюс:
- `totalVisits` — число завершённых записей (DONE)
- `lastVisitAt` — дата последнего визита (ISO) или null

Поля Client: `id`, `firstName`, `lastName`, `phone`, `notes`, `birthDate`, `level`, `levelSetManually`, `totalPaidForLevel`, `bonuses`, `discount`, `balance`, `isBlacklisted`, `blacklistReason`, `referralCode`, `referredByClientId`, `referralFirstVisitBonusCredited`, `createdAt`, `updatedAt`.

---

### Сегменты клиентов

**GET** `/studios/:studioId/clients/segments`

**Пример запроса:**

```bash
curl -X GET "https://ваш-сервер.com/studios/STUDIO_UUID/clients/segments" \
  -H "Authorization: Bearer ВАШ_ACCESS_TOKEN"
```

**Ответ:**

```json
{
  "new": 10,
  "neverVisited": 5,
  "sleeping": 20,
  "missing": 15
}
```

---

### Рефереры (кто привёл клиентов)

**GET** `/studios/:studioId/clients/referrers`

**Ответ:** массив объектов: `clientId`, `firstName`, `lastName`, `phone`, `referralCode`, `referredCount`.

---

### Приведённые клиенты

**GET** `/studios/:studioId/clients/referred`

**Ответ:** массив: `clientId`, `clientFirstName`, `clientLastName`, `clientPhone`, `referrerId`, `referrerFirstName`, `referrerLastName`, `referrerCode`.

---

### Создать клиента

**POST** `/studios/:studioId/clients`

**Пример запроса:**

```bash
curl -X POST "https://ваш-сервер.com/studios/STUDIO_UUID/clients" \
  -H "Authorization: Bearer ВАШ_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Анна",
    "lastName": "Петрова",
    "phone": "+77071234567",
    "birthDate": "1990-05-15",
    "notes": "Предпочитает утренние записи",
    "bonuses": 0,
    "discount": 0
  }'
```

**Тело запроса:**

| Поле        | Тип    | Обязательно | Описание |
|------------|--------|-------------|----------|
| `firstName`| string | да          | Имя |
| `lastName` | string | нет         | Фамилия |
| `phone`    | string | да          | Уникальный телефон |
| `birthDate`| string | нет         | YYYY-MM-DD |
| `notes`    | string | нет         | Заметки |
| `bonuses`  | number | нет         | Бонусные баллы (≥ 0) |
| `discount` | number | нет         | Скидка 0–100% |
| `balance`  | number | нет         | Баланс в тенге |

**Ответ:** объект клиента (поля модели Client).

---

### Карточка клиента

**GET** `/clients/:id`

**Пример запроса:**

```bash
curl -X GET "https://ваш-сервер.com/clients/CLIENT_UUID" \
  -H "Authorization: Bearer ВАШ_ACCESS_TOKEN"
```

**Ответ:** все поля Client плюс:
- `referredCount` — сколько человек воспользовались его реферальным кодом
- `referredList` — массив `{ clientId, firstName, lastName, usedAt }`
- `cashbackPercent` — процент кэшбэка по уровню
- `levelProgress` — прогресс по уровню

---

### Обновить клиента

**PATCH** `/clients/:id`

**Пример запроса:**

```bash
curl -X PATCH "https://ваш-сервер.com/clients/CLIENT_UUID" \
  -H "Authorization: Bearer ВАШ_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"firstName": "Анна", "notes": "Обновлённые заметки"}'
```

Все поля в теле опциональны: `firstName`, `lastName`, `phone`, `birthDate` (или null), `notes`, `level`, `levelSetManually`, `bonuses`, `discount`, `balance`, `isBlacklisted`, `blacklistReason`.

---

### Статистика клиента

**GET** `/clients/:id/statistics`

**Ответ:** `{ "totalVisits": 15, "averageCheck": 2500, "totalSpent": 37500 }`

---

### Записи клиента

**GET** `/clients/:id/appointments`

**Пример запроса:**

```bash
# Все записи
curl -X GET "https://ваш-сервер.com/clients/CLIENT_UUID/appointments" \
  -H "Authorization: Bearer ВАШ_ACCESS_TOKEN"

# Только предстоящие
curl -X GET "https://ваш-сервер.com/clients/CLIENT_UUID/appointments?upcoming=true" \
  -H "Authorization: Bearer ВАШ_ACCESS_TOKEN"
```

**Ответ:** массив записей (Appointment) с вложенными `staff`, `client`, `service`.

---

### История бонусов

**GET** `/clients/:id/bonus-history`

**Ответ:** массив объектов: `id`, `clientId`, `studioId`, `amount`, `type`, `appointmentId`, `performedByUserId`, `comment`, `createdAt`.

---

### Ручная корректировка бонусов

**POST** `/clients/:id/bonus-adjustment` — только роль уровня владельца.

**Пример запроса:**

```bash
curl -X POST "https://ваш-сервер.com/clients/CLIENT_UUID/bonus-adjustment" \
  -H "Authorization: Bearer ВАШ_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 500, "comment": "Подарок ко дню рождения"}'
```

**Тело:** `amount` (число: положительное — начисление, отрицательное — списание), `comment` (опционально).

---

## 4. Услуги (Services)

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/studios/:studioId/services` | Список услуг |
| POST | `/studios/:studioId/services` | Создать услугу |
| PATCH | `/studios/:studioId/services/:id` | Обновить услугу |

**Пример — список услуг:**

```bash
curl -X GET "https://ваш-сервер.com/studios/STUDIO_UUID/services" \
  -H "Authorization: Bearer ВАШ_ACCESS_TOKEN"
```

**Ответ:** массив объектов с полями: `id`, `studioId`, `name`, `defaultDurationMin`, `defaultPrice`, `requiredStaffCount`, `isActive`, `bonusAccrualEnabled`, `createdAt`, `updatedAt`.

**Пример — создать услугу:**

```bash
curl -X POST "https://ваш-сервер.com/studios/STUDIO_UUID/services" \
  -H "Authorization: Bearer ВАШ_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Стрижка женская",
    "defaultDurationMin": 60,
    "defaultPrice": 5000,
    "requiredStaffCount": 1,
    "isActive": true,
    "bonusAccrualEnabled": true
  }'
```

---

## 5. Сотрудники (Staff)

| Метод | URL |
|-------|-----|
| GET | `/studios/:studioId/staff` |
| POST | `/studios/:studioId/staff` |
| PATCH | `/staff/:userId` |
| GET | `/staff/:staffUserId/services` |
| POST | `/staff/:staffUserId/services` |
| DELETE | `/staff/:staffUserId/services/:serviceId` |
| GET | `/staff/:userId/profile` |
| PATCH | `/staff/:userId/profile` |
| DELETE | `/staff/:userId` (только OWNER) |
| GET/POST/PATCH/DELETE | `/staff/:staffUserId/services/:serviceId/override` и `/staff/:staffUserId/overrides` |

**Профиль сотрудника (StaffProfile):** `userId`, `firstName`, `lastName`, `title`, `category`, `providesServices`, `avatar`, `bio`, `portfolioPhotos`, `rank`.

**Оверрайд услуги (StaffServiceOverride):** `id`, `studioId`, `staffUserId`, `serviceId`, `durationMin`, `price`, `isActive`, `createdAt`, `updatedAt`.

---

## 6. Расписание (Schedule)

| Метод | URL |
|-------|-----|
| GET | `/studios/:studioId/schedule` |
| POST | `/studios/:studioId/schedule` |
| POST | `/studios/:studioId/schedule/generate` |
| PATCH | `/schedule/day/:id` |
| DELETE | `/schedule/day/:id` |

**День расписания (WorkScheduleDay):** `id`, `studioId`, `staffUserId`, `date`, `startTime`, `endTime`, `breakStart`, `breakEnd`, `isDayOff`, `createdAt`, `updatedAt`. Время в формате HH:MM.

---

## 7. Занятые слоты (Busy slots)

| Метод | URL |
|-------|-----|
| GET | `/studios/:studioId/busy-slots` (query: `date`, `staffUserId`) |
| POST | `/studios/:studioId/busy-slots` |
| PATCH | `/busy-slots/:id` |
| DELETE | `/busy-slots/:id` |

**BusySlot:** `id`, `studioId`, `staffUserId`, `startAt`, `endAt`, `comment`, `forfeitedPrepaymentAmount`, `createdAt`, `updatedAt`.

---

## 8. Записи (Appointments)

### Список записей

**GET** `/studios/:studioId/appointments`

**Пример запроса:**

```bash
# Записи на дату (YYYY-MM-DD)
curl -X GET "https://ваш-сервер.com/studios/STUDIO_UUID/appointments?date=2024-03-15" \
  -H "Authorization: Bearer ВАШ_ACCESS_TOKEN"
```

**Ответ:** массив записей с `staff` (и staffProfile), `client`, `service`, `arrivedByUser`, `upsells`.

---

### Создать запись

**POST** `/studios/:studioId/appointments`

**Пример запроса:**

```bash
curl -X POST "https://ваш-сервер.com/studios/STUDIO_UUID/appointments" \
  -H "Authorization: Bearer ВАШ_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "staffUserId": "USER_UUID",
    "clientId": "CLIENT_UUID",
    "serviceId": "SERVICE_UUID",
    "startAt": "2024-03-15T10:00:00+06:00",
    "prepaymentAmount": 2000
  }'
```

**Тело запроса:**

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `staffUserId` | string (UUID) | да | Сотрудник |
| `clientId` | string (UUID) | да | Клиент |
| `serviceId` | string (UUID) | да | Услуга |
| `startAt` | string (ISO 8601) | да | Время начала (с таймзоной, напр. +06:00) |
| `prepaymentAmount` | number | нет | Сумма предоплаты |

**Ответ:** объект записи (Appointment) с вложенными сущностями.

---

### Другие действия с записью

| Метод | URL | Описание |
|-------|-----|----------|
| PATCH | `/appointments/:id` | Изменить запись |
| POST | `/appointments/:id/no-show` | Отметить неявку |
| POST | `/appointments/:id/mark-late` | Поздняя отмена (сгорание предоплаты) |
| POST | `/appointments/:id/arrived` | Клиент пришёл |
| POST | `/appointments/:id/done` | Завершить запись |

**Завершить запись (POST /appointments/:id/done):**

**Пример запроса:**

```bash
curl -X POST "https://ваш-сервер.com/appointments/APPOINTMENT_UUID/done" \
  -H "Authorization: Bearer ВАШ_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bonusesUsed": 500, "moneyPaid": 4500}'
```

**Тело:** `bonusesUsed` (опционально), `moneyPaid` (опционально) — для учёта оплаты и кэшбэка.

**Поля записи (Appointment):** `id`, `studioId`, `staffUserId`, `clientId`, `serviceId`, `startAt`, `endAt`, `status` (BOOKED \| CANCELLED \| ARRIVED \| DONE), `prepaymentAmount`, `forfeitedPrepaymentAmount`, `completedBonusesUsed`, `completedMoneyPaid`, `arrivedAt`, `arrivedByUserId`, `createdAt`, `updatedAt`.

---

## 9. Допродажи (Upsells)

| Метод | URL |
|-------|-----|
| POST | `/appointments/:appointmentId/upsells` |
| GET | `/appointments/:appointmentId/upsells` |
| PATCH | `/upsells/:id` |
| DELETE | `/upsells/:id` |

**AppointmentUpsell:** `id`, `appointmentId`, `serviceId`, `quantity`, `price`, `totalAmount`, `comment`, `createdAt`, `updatedAt`.

---

## 10. Уведомления (Notifications)

| Метод | URL |
|-------|-----|
| GET | `/notifications` (query: `isRead` — true/false) |
| GET | `/notifications/unread` |
| GET | `/notifications/unread/count` |
| PATCH | `/notifications/:id/read` |
| PATCH | `/notifications/read-all` |
| DELETE | `/notifications/:id` |

**Пример — количество непрочитанных:**

```bash
curl -X GET "https://ваш-сервер.com/notifications/unread/count" \
  -H "Authorization: Bearer ВАШ_ACCESS_TOKEN"
```

**Ответ:** `{ "count": 3 }`

**Notification:** `id`, `userId`, `studioId`, `type`, `title`, `message`, `data` (JSON string), `isRead`, `readAt`, `createdAt`.

---

## 11. Чёрный список (Blacklist)

| Метод | URL |
|-------|-----|
| POST | `/clients/:clientId/blacklist/request` |
| POST | `/clients/:clientId/blacklist/add` (OWNER/DEPUTY/SERVICE) |
| GET | `/studios/:studioId/blacklist/requests` |
| PATCH | `/blacklist/requests/:requestId/approve` |
| PATCH | `/blacklist/requests/:requestId/reject` |
| GET | `/studios/:studioId/blacklist` |
| PATCH | `/clients/:clientId/blacklist/remove` |

**BlacklistRequest:** `id`, `studioId`, `clientId`, `requestedByUserId`, `approvedByUserId`, `status` (PENDING \| APPROVED \| REJECTED), `reason`, `rejectedReason`, `createdAt`, `updatedAt`, `approvedAt`, `rejectedAt`.

---

## 12. Дашборд (Dashboard)

Доступ: OWNER, DEPUTY_OWNER, SERVICE.

### Дашборд по одной студии

**GET** `/studios/:studioId/dashboard`

**Пример запроса:**

```bash
# За период по умолчанию (последние 30 дней)
curl -X GET "https://ваш-сервер.com/studios/STUDIO_UUID/dashboard" \
  -H "Authorization: Bearer ВАШ_ACCESS_TOKEN"

# За указанные даты
curl -X GET "https://ваш-сервер.com/studios/STUDIO_UUID/dashboard?startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer ВАШ_ACCESS_TOKEN"

# За период (day | week | month | year | all)
curl -X GET "https://ваш-сервер.com/studios/STUDIO_UUID/dashboard?period=month" \
  -H "Authorization: Bearer ВАШ_ACCESS_TOKEN"
```

**Query:** `startDate` (YYYY-MM-DD), `endDate` (YYYY-MM-DD), `period` (day \| week \| month \| year \| all).

**Ответ:**
- `period`: `{ start, end }` (ISO строки)
- `overview`: `totalAppointments`, `revenue`, `noShowRevenue`, `upsellRevenue`, `cancellationRate`, `completionRate`
- `statusCounts`: `BOOKED`, `CANCELLED`, `ARRIVED`, `DONE` (числа)
- `popularServices`: массив `{ name, count, revenue }`
- `topStaff`: массив `{ id, name, count, revenue }`
- `dailyChart`: массив `{ date, count, revenue }`

---

### Сводка по всем студиям

**GET** `/dashboard/all`

**Ответ:** `period`, `overview` (totalStudios, totalAppointments, totalRevenue, cancellationRate, completionRate), `aggregatedStatusCounts`, `studios` (массив: studioId, studioName, totalAppointments, revenue, statusCounts).

---

## 13. Аналитика (Analytics)

**GET** `/studios/:studioId/analytics/service-sales`

**Пример запроса:**

```bash
curl -X GET "https://ваш-сервер.com/studios/STUDIO_UUID/analytics/service-sales?startDate=2024-01-01&endDate=2024-12-31" \
  -H "Authorization: Bearer ВАШ_ACCESS_TOKEN"
```

**Query:** `startDate`, `endDate` (YYYY-MM-DD), `serviceId` (UUID), `period` (опционально).

**Ответ:**
- `period`: `{ start, end }`
- `groupBy`: `"month"`
- `data`: массив `{ month` (YYYY-MM), `services`: массив `{ serviceId, serviceName, revenue, appointmentsCount }` }

---

## 14. Склад (Warehouse)

**Центральный склад** (OWNER/DEPUTY/SERVICE):  
`/warehouse/central`, `/warehouse/central/branches`, `/warehouse/central/history`, `/warehouse/central/products` (GET/POST), `/warehouse/central/products/:id` (PATCH/DELETE), `/warehouse/central/transfer`, `/warehouse/central/receipt`.

**Склад филиала:**  
`/studios/:studioId/warehouse`, `/studios/:studioId/warehouse/history`, `/studios/:studioId/warehouse/products`, `/studios/:studioId/warehouse/transfer`, `/studios/:studioId/warehouse/receipt`, `/studios/:studioId/warehouse/write-off`.

**Product:** `id`, `name`, `description`, `article`, `unit` (KG \| PCS \| ML), `createdAt`, `updatedAt`.

---

## 15. Промпты (Prompts) — только роль SERVICE

| Метод | URL |
|-------|-----|
| POST | `/prompts` |
| GET | `/prompts` |
| GET | `/prompts/:id` |
| PATCH | `/prompts/:id` |
| DELETE | `/prompts/:id` |

**Пример — создать промпт:**

```bash
curl -X POST "https://ваш-сервер.com/prompts" \
  -H "Authorization: Bearer ВАШ_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "welcome_message",
    "description": "Приветствие для новых клиентов 👋"
  }'
```

**Тело:** `key` — латиница без пробелов (буквы, цифры, подчёркивание); `description` — произвольный текст (эмодзи разрешены).

**Ответ (Prompt):** `id`, `key`, `description`, `createdAt`, `updatedAt`.

---

## 16. Загрузка файлов (Upload)

| Метод | URL | Описание |
|-------|-----|----------|
| POST | `/upload/avatar` | Аватар (multipart/form-data) |
| POST | `/upload/portfolio` | Фото портфолио (multipart) |

---

## 17. Проверка работы API (Health)

**GET** `/health` — публичный, без токена.

**Пример запроса:**

```bash
curl -X GET https://ваш-сервер.com/health
```

---

## Сводка сущностей (переменные для НБ ↔ Клиент ↔ AI-DA)

| Сущность | Основные поля |
|----------|----------------|
| **User** | id, email, phone, role, studioId, isActive, themePreference, studio, staffProfile |
| **Studio** | id, name, address, timezone, globalBonusPaymentLimitPercent |
| **Client** | id, firstName, lastName, phone, notes, birthDate, level, bonuses, discount, referralCode, isBlacklisted, blacklistReason; плюс totalVisits, lastVisitAt, referredCount, referredList, cashbackPercent, levelProgress |
| **Appointment** | id, studioId, staffUserId, clientId, serviceId, startAt, endAt, status, prepaymentAmount, staff, client, service, upsells |
| **Service** | id, name, defaultDurationMin, defaultPrice, isActive |
| **Notification** | id, type, title, message, data, isRead, readAt, createdAt |
| **Prompt** | id, key, description |

Даты в ответах — ISO 8601. Все идентификаторы — UUID (string).
