# Полный гайдлайн по использованию Backend API для Lovable

Документ описывает, как фронтенд (Lovable) должен подключаться к бэкенду AIDA: базовый URL, авторизация, форматы запросов/ответов и список основных эндпоинтов.

---

## Base URL и окружение

| Окружение | Base URL |
|-----------|----------|
| **Демо (текущий)** | `https://demo-studio-production.up.railway.app` |

Все пути в этом документе указаны относительно Base URL. Например:

- Полный URL входа: `https://demo-studio-production.up.railway.app/auth/login`
- Swagger: `https://demo-studio-production.up.railway.app/docs`

**Загрузка файлов (аватар, портфолио):**  
URL картинок формируется как `{BASE_URL}/uploads/{filename}`.  
Например: `https://demo-studio-production.up.railway.app/uploads/avatar-xxx.jpg`

**Важно:** В запросах к API используйте один и тот же Base URL (через переменную окружения или константу), чтобы легко переключаться между демо и продом.

---

## Демо-доступ

Для демо-студии можно использовать пользователя-владельца, созданного скриптом `npm run seed:demo`:

- **Телефон:** `+77001234567`
- **Пароль:** `Demo123!`

Вход только по номеру телефона и паролю (поле `email` для входа не используется).

---

## Авторизация (JWT)

### 1. Вход — получение токенов

**POST** `/auth/login`

**Body (только эти поля):**
```json
{
  "phone": "+77001234567",
  "password": "Demo123!"
}
```

**Не отправлять:** `emailOrPhone`, `email` — бэкенд их не принимает (валидация `forbidNonWhitelisted`).

**Успешный ответ (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "demo@demo-studio.example",
    "phone": "+77001234567",
    "role": "OWNER",
    "studioId": "uuid",
    "staffProfile": null
  }
}
```

**Ошибки:**  
- `401` — неверный телефон или пароль (сообщение: `Invalid credentials`).  
- `400` — ошибка валидации (пустой/некорректный телефон или пароль короче 6 символов).

---

### 2. Обновление access token

**POST** `/auth/refresh`

**Headers:** не требуют Bearer (используется тело запроса).

**Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Успешный ответ (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Access token живёт ~15 минут, refresh — дольше (например, 7 дней). При истечении access token вызывать refresh и повторять исходный запрос с новым access token.

---

### 3. Текущий пользователь

**GET** `/auth/me`

**Headers:** `Authorization: Bearer <accessToken>`

**Успешный ответ (200):** объект пользователя с полями вроде `id`, `email`, `phone`, `role`, `studioId`, `studio`, `staffProfile`, `isActive`, `createdAt`, `updatedAt` и т.д.

---

### 4. Тема (предпочтение)

**PATCH** `/auth/me/theme`

**Headers:** `Authorization: Bearer <accessToken>`

**Body:**
```json
{
  "themePreference": "light"
}
```

Допустимые значения: `light`, `dark`, `system` (или как описано в API).

---

## Использование токена в запросах

Все защищённые эндпоинты требуют заголовок:

```
Authorization: Bearer <accessToken>
```

Рекомендуется: при ответе `401` — попробовать обновить токен через `/auth/refresh` и повторить запрос; при повторном `401` — разлогинить пользователя.

---

## Формат ошибок

При любой ошибке API возвращает JSON:

```json
{
  "statusCode": 400,
  "message": "Текст ошибки или массив сообщений валидации",
  "code": "OPTIONAL_CODE",
  "timestamp": "2026-02-21T12:00:00.000Z"
}
```

Типичные коды ответа:

- `400` — ошибка валидации или неверный запрос  
- `401` — не авторизован (нет/неверный/истёкший токен)  
- `403` — нет прав доступа  
- `404` — ресурс не найден  
- `500` — внутренняя ошибка сервера  

На фронте достаточно проверять `statusCode` и показывать `message` пользователю.

---

## Роли пользователей

Кратко (подробно — в [LOVABLE_USER_ROLES.md](./LOVABLE_USER_ROLES.md)):

| Роль | Описание |
|------|----------|
| **OWNER** | Полный доступ ко всем студиям |
| **DEPUTY_OWNER** | Как OWNER, но не может управлять владельцами и заместителями |
| **ADMIN** | Только своя студия |
| **MANAGER** | Все студии, но не может удалять клиентов/записи |
| **MASTER** | Только своя студия, только свои записи; телефон клиента скрыт |

Проверка прав выполняется на бэкенде; фронт может скрывать/показывать кнопки по `user.role` для удобства.

---

## Сводка эндпоинтов по ресурсам

Ниже — список основных маршрутов. Тело запросов и ответов при необходимости уточнять в Swagger: `{BASE_URL}/docs`.

### Auth (без Bearer для login/refresh)

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/auth/login` | Вход (phone + password) |
| POST | `/auth/refresh` | Обновление access token |
| GET | `/auth/me` | Текущий пользователь |
| PATCH | `/auth/me/theme` | Обновить тему |

### Studios

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/studios` | Список студий |
| POST | `/studios` | Создать студию |
| GET | `/studios/:studioId` | Студия по ID |

### Staff (персонал)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/studios/:studioId/staff` | Список сотрудников |
| POST | `/studios/:studioId/staff` | Добавить сотрудника |
| PATCH | `/staff/:userId` | Обновить сотрудника |
| DELETE | `/staff/:userId` | Уволить (isActive: false, не удаление) |
| GET | `/staff/:userId/profile` | Профиль сотрудника |
| PATCH | `/staff/:userId/profile` | Обновить профиль |
| GET | `/staff/:staffUserId/services` | Услуги сотрудника |
| POST | `/staff/:staffUserId/services` | Привязать услуги |
| DELETE | `/staff/:staffUserId/services/:serviceId` | Отвязать услугу |
| GET/POST/PATCH/DELETE | `/staff/:staffUserId/services/:serviceId/override` | Переопределение цены/длительности |
| GET | `/staff/:staffUserId/overrides` | Все переопределения |

### Clients (клиенты)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/studios/:studioId/clients?q=...` | Список клиентов (поиск по q) |
| GET | `/studios/:studioId/clients/segments` | Сегменты (Спящие, Пропавшие и т.д.) |
| POST | `/studios/:studioId/clients` | Создать клиента |
| GET | `/clients/:id` | Карточка клиента |
| PATCH | `/clients/:id` | Обновить клиента |
| GET | `/clients/:id/statistics` | Статистика (визиты, средний чек — только DONE) |
| GET | `/clients/:id/appointments` | Записи клиента (только завершённые в карточке по договорённости) |

В списке клиентов в каждом элементе есть `totalVisits` и `lastVisitAt` (только завершённые визиты). Подробнее: [LOVABLE_CLIENT_VISITS_COLUMNS.md](./LOVABLE_CLIENT_VISITS_COLUMNS.md), [LOVABLE_CLIENT_SEGMENTS.md](./LOVABLE_CLIENT_SEGMENTS.md), [LOVABLE_CLIENT_CARD.md](./LOVABLE_CLIENT_CARD.md).

### Services (услуги)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/studios/:studioId/services` | Список услуг |
| POST | `/studios/:studioId/services` | Создать услугу |
| PATCH | `/studios/:studioId/services/:id` | Обновить услугу |

### Schedule (график работы)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/studios/:studioId/schedule?date=YYYY-MM-DD` | График на дату |
| POST | `/studios/:studioId/schedule` | Создать/обновить день |
| POST | `/studios/:studioId/schedule/generate` | Сгенерировать по шаблону (5/2, 6/1) |
| PATCH | `/schedule/day/:id` | Обновить день |
| DELETE | `/schedule/day/:id` | Удалить день |

### Busy slots (занятые слоты)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/studios/:studioId/busy-slots?date=...` | Занятые слоты |
| POST | `/studios/:studioId/busy-slots` | Создать слот |
| PATCH | `/busy-slots/:id` | Обновить |
| DELETE | `/busy-slots/:id` | Удалить |

### Appointments (записи)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/studios/:studioId/appointments?date=...` | Записи на дату |
| POST | `/studios/:studioId/appointments` | Создать запись |
| PATCH | `/appointments/:id` | Обновить запись |
| POST | `/appointments/:id/no-show` | Не пришёл |
| POST | `/appointments/:id/mark-late` или `studios/:studioId/appointments/:id/mark-late` | Отметить опоздание |
| POST | `/appointments/:id/arrived` | Отметить прибытие |
| POST | `/appointments/:id/done` | Завершить запись |

Визиты и средний чек считаются только по записям со статусом DONE. Кнопка «Опоздал» и логика предоплаты: [LOVABLE_MARK_LATE_BUTTON.md](./LOVABLE_MARK_LATE_BUTTON.md).

### Upsells (допродажи к записи)

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/appointments/:appointmentId/upsells` | Добавить апселл |
| GET | `/appointments/:appointmentId/upsells` | Список апселлов |
| PATCH | `/upsells/:id` | Обновить |
| DELETE | `/upsells/:id` | Удалить |

### Blacklist (чёрный список)

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/clients/:clientId/blacklist/request` | Заявка на добавление |
| POST | `/clients/:clientId/blacklist/add` | Добавить (при наличии прав) |
| GET | `/studios/:studioId/blacklist/requests` | Заявки на чёрный список |
| PATCH | `/blacklist/requests/:requestId/approve` | Одобрить |
| PATCH | `/blacklist/requests/:requestId/reject` | Отклонить |
| GET | `/studios/:studioId/blacklist` | Список в чёрном списке |
| PATCH | `/clients/:clientId/blacklist/remove` | Убрать из чёрного списка |

Подробнее: [LOVABLE_BLACKLIST_UPDATES.md](./LOVABLE_BLACKLIST_UPDATES.md).

### Notifications

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/notifications` | Список уведомлений |
| GET | `/notifications/unread` | Непрочитанные |
| GET | `/notifications/unread/count` | Количество непрочитанных |
| PATCH | `/notifications/:id/read` | Отметить прочитанным |
| PATCH | `/notifications/read-all` | Прочитать все |
| DELETE | `/notifications/:id` | Удалить |

### Dashboard

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/studios/:studioId/dashboard` | Дашборд студии |
| GET | `/dashboard/all` | Сводный дашборд (для ролей с доступом ко всем студиям) |

Доступ по ролям и фильтр по дате: [LOVABLE_DASHBOARD.md](./LOVABLE_DASHBOARD.md), [LOVABLE_DASHBOARD_ACCESS_RESTRICTION.md](./LOVABLE_DASHBOARD_ACCESS_RESTRICTION.md), [LOVABLE_DASHBOARD_DATE_FILTER.md](./LOVABLE_DASHBOARD_DATE_FILTER.md).

### Warehouse (склад)

**Центральный склад (owner/deputy):**

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/warehouse/central` | Данные центрального склада |
| GET | `/warehouse/central/branches` | Склады филиалов |
| GET | `/warehouse/central/history` | История движения |
| GET | `/warehouse/central/products` | Товары |
| POST | `/warehouse/central/products` | Добавить товар |
| PATCH | `/warehouse/central/products/:id` | Обновить товар |
| DELETE | `/warehouse/central/products/:id` | Удалить товар |
| POST | `/warehouse/central/transfer` | Перемещение на филиал |

**Склад филиала (studioId):**

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/studios/:studioId/warehouse` | Склад филиала |
| GET | `/studios/:studioId/warehouse/history` | История движения филиала |
| GET | `/studios/:studioId/warehouse/products` | Товары филиала |
| POST | `/studios/:studioId/warehouse/products` | Добавить товар |
| PATCH | `/studios/:studioId/warehouse/products/:productId` | Обновить |
| DELETE | `/studios/:studioId/warehouse/products/:productId` | Удалить |
| POST | `/studios/:studioId/warehouse/transfer` | Перемещение |
| POST | `/studios/:studioId/warehouse/receipt` | Приход |
| POST | `/studios/:studioId/warehouse/write-off` | Списание |

Подробнее: [LOVABLE_WAREHOUSE.md](./LOVABLE_WAREHOUSE.md), [LOVABLE_WAREHOUSE_HISTORY.md](./LOVABLE_WAREHOUSE_HISTORY.md).

### Uploads

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/upload/avatar` | Загрузка аватара (multipart) |
| POST | `/upload/portfolio` | Загрузка фото портфолио (multipart) |

Файлы отдаются по `{BASE_URL}/uploads/{filename}`.

### Health

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/health` | Проверка доступности API (без авторизации) |

---

## Дополнительные документы Lovable

- [LOVABLE_PHONE_LOGIN.md](./LOVABLE_PHONE_LOGIN.md) — вход только по телефону (не `emailOrPhone`)
- [LOVABLE_USER_ROLES.md](./LOVABLE_USER_ROLES.md) — роли и права доступа
- [LOVABLE_DISMISS_STAFF.md](./LOVABLE_DISMISS_STAFF.md) — увольнение сотрудников (без удаления)
- [LOVABLE_CLIENT_VISITS_COLUMNS.md](./LOVABLE_CLIENT_VISITS_COLUMNS.md) — колонки «Визиты» и «Последний визит»
- [LOVABLE_CLIENT_SEGMENTS.md](./LOVABLE_CLIENT_SEGMENTS.md) — сегменты клиентов
- [LOVABLE_CLIENT_CARD.md](./LOVABLE_CLIENT_CARD.md) — карточка клиента (только завершённые посещения)
- [LOVABLE_MARK_LATE_BUTTON.md](./LOVABLE_MARK_LATE_BUTTON.md) — кнопка «Опоздал» и предоплата
- [LOVABLE_BLACKLIST_UPDATES.md](./LOVABLE_BLACKLIST_UPDATES.md) — чёрный список
- [LOVABLE_WAREHOUSE.md](./LOVABLE_WAREHOUSE.md), [LOVABLE_WAREHOUSE_HISTORY.md](./LOVABLE_WAREHOUSE_HISTORY.md) — склад и история
- Остальные `LOVABLE_*.md` в `docs/` — точечные фичи (расписание, услуги, дашборд, тема и т.д.)

---

## Чеклист интеграции фронта с бэкендом

- [ ] Base URL задан как `https://demo-studio-production.up.railway.app` (или через env).
- [ ] Вход: только `phone` + `password`, без `emailOrPhone` и `email`.
- [ ] Токены: сохранение `accessToken` и `refreshToken`, отправка `Authorization: Bearer <accessToken>`.
- [ ] При 401: попытка refresh, затем повтор запроса или выход.
- [ ] Ошибки: отображение `message` из ответа с учётом `statusCode`.
- [ ] Роли: скрытие/показ кнопок и разделов по `user.role` (см. LOVABLE_USER_ROLES).
- [ ] Картинки: URL вида `{BASE_URL}/uploads/{filename}`.
- [ ] Даты: бэкенд может возвращать даты в таймзоне студии; фронт при необходимости нормализует к локальной/UTC.
- [ ] Пустые списки: ответ `[]` — не ошибка, показывать «Нет данных».

После выполнения этих пунктов интеграция с текущим демо-бэкендом будет соответствовать описанному гайдлайну.
