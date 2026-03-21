# HTTP API для Nextbot (`/nextbot`)

Все маршруты в группе Swagger **`nextbot`**. Авторизация: **`X-API-Key`** (как `NEXTBOT_API_KEY` в `.env`) или JWT.

Базовый URL: `{BASE_URL}/nextbot/...` (например `http://localhost:3000`).

---

## Контекст и студия

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/nextbot/context` | Список студий + опционально `?currentStudioId=` → `currentStudio` |
| GET | `/nextbot/studios/:studioId` | Карточка студии |

---

## Клиенты

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/nextbot/studios/:studioId/clients/lookup?q=` | Поиск и полный профиль: `{ found, client }` |
| GET | `/nextbot/studios/:studioId/clients/loyalty?q=` | Кратко: уровень, бонусы, скидка |
| GET | `/nextbot/studios/:studioId/clients/referral?q=` | Реферальный код |
| POST | `/nextbot/studios/:studioId/clients` | Регистрация — тело как `CreateClientDto` |
| GET | `/nextbot/clients/:id` | Профиль |
| PATCH | `/nextbot/clients/:id` | Обновление — `UpdateClientDto` |
| POST | `/nextbot/clients/:id/survey` | Анкета в `notes` — тело `NextbotSurveyDto` (`answers`, `merge?`, `label?`) |
| GET | `/nextbot/clients/:id/appointments` | Записи; `?upcoming=true` |

---

## Услуги и лендинг

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/nextbot/studios/:studioId/services` | Прайс / услуги CRM |
| GET | `/nextbot/studios/:studioId/landing/promotions` | Акции |
| GET | `/nextbot/studios/:studioId/landing/services` | Карточки услуг лендинга |
| GET | `/nextbot/studios/:studioId/landing/masters` | Мастера лендинга |

---

## Расписание и записи

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/nextbot/studios/:studioId/availability` | Агрегат: `scheduleDays`, `busySlots`, `appointments` + подсказки. Query: **`date`** (обяз.), `serviceId`, `staffUserId` |
| POST | `/nextbot/studios/:studioId/appointments` | Создать запись — `CreateAppointmentDto` |
| PATCH | `/nextbot/appointments/:id` | Изменить — `UpdateAppointmentDto` |
| POST | `/nextbot/appointments/:id/cancel` | Отмена (`status: CANCELLED`); см. отличие от no-show в GAPS |

---

## Соответствие старым Python-функциям

| Было (Python) | Стало (HTTP) |
|---------------|----------------|
| `get_company_context` | `GET /nextbot/context` |
| `get_studio_details` | `GET /nextbot/studios/:studioId` |
| `verify_client_status` | `GET .../clients/lookup` |
| `register_new_client` | `POST .../clients` |
| `process_survey_answers` | `POST /nextbot/clients/:id/survey` |
| `get_client_appointments` | `GET /nextbot/clients/:id/appointments` |
| `check_loyalty_status` | `GET .../clients/loyalty` |
| `get_referral_code` | `GET .../clients/referral` |
| `get_services_and_prices` | `GET .../services` |
| `get_active_promotions` | `GET .../landing/promotions` |
| `get_landing_service_cards` | `GET .../landing/services` |
| `get_landing_masters` | `GET .../landing/masters` |
| `check_availability` | `GET .../availability` |
| `create_booking_request` | `POST .../appointments` |
| `modify_booking` | `PATCH /nextbot/appointments/:id` |
| `cancel_booking_status` | `POST /nextbot/appointments/:id/cancel` |

Функции без backend (waitlist, оплата, сертификаты, тикеты, `dev_error_report`) — по-прежнему в **[NEXTBOT_BACKEND_GAPS.md](./NEXTBOT_BACKEND_GAPS.md)**.
