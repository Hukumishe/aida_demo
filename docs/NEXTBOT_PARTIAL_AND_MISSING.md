# Nextbot ↔ AIDA backend: что реализовано в `nextbot/`, что частично, чего нет

Документ дополняет Python-пакет `nextbot/`: каждая функция лежит в отдельном файле внутри подпакетов (`nextbot/clients/`, `nextbot/appointments/`, …). Заглушки без HTTP — в `nextbot/placeholders/` и бросают `NotImplementedError`.

**HTTP-агрегатор для Nextbot (без Python в сценарии):** префикс **`/nextbot`** — те же сценарии, что и функции в `nextbot/`, но одним вызовом из блока «HTTP» в Nextbot. Авторизация: **`Authorization: Bearer <JWT>`** или **`X-API-Key`** / **`Authorization: ApiKey <key>`** (= `NEXTBOT_API_KEY`), см. `JwtAuthGuard`.

**Карта `/nextbot` = только функции xmind:** [`docs/NEXTBOT_XMIND_API.md`](./NEXTBOT_XMIND_API.md). Кратко: [`docs/NEXTBOT_ENDPOINTS.md`](./NEXTBOT_ENDPOINTS.md).

**Выбор филиала → `studioId`:** [`docs/NEXTBOT_STUDIO_SELECTION.md`](./NEXTBOT_STUDIO_SELECTION.md) (через `get_company_context`).

**`modify_booking` / перенос / отмена:** [`docs/NEXTBOT_PROMPT_FUNCTIONS.md`](./NEXTBOT_PROMPT_FUNCTIONS.md).

| Сценарий (xmind) | Метод и путь `/nextbot` |
|------------------|-------------------------|
| `get_company_context` | `GET /nextbot/context` |
| `verify_client_status` | `GET /nextbot/studios/:studioId/clients/verify?q=` |
| `register_new_client` | `POST /nextbot/studios/:studioId/clients/register` |
| `process_survey_answers` | `POST /nextbot/clients/:clientId/survey` |
| `process_survey_answers_failed` | `POST /nextbot/clients/:clientId/survey-failed` → **501** |
| `get_services_and_prices` | `GET /nextbot/studios/:studioId/services` |
| `get_active_promotions` | `GET /nextbot/studios/:studioId/landing/promotions` |
| `check_loyalty_status` | `GET /nextbot/studios/:studioId/clients/loyalty?q=` |
| `get_referral_code` | `GET /nextbot/studios/:studioId/clients/referral?q=` |
| `check_availability` | `GET /nextbot/studios/:studioId/availability-raw?date=&staffUserId=` |
| `create_booking_request` | `POST /nextbot/studios/:studioId/appointments` |
| `modify_booking` (в т.ч. отмена `status:CANCELLED`) | `POST /nextbot/appointments/:id/update` |
| `add_to_waitlist`, счета, оплата, чеки, сертификаты, тикеты, `dev_error_report` | см. **501** в [`NEXTBOT_XMIND_API.md`](./NEXTBOT_XMIND_API.md) |

---

## Полностью на текущем API (реализовано в `nextbot/`)

| Функция | Эндпоинт | Модуль |
|--------|----------|--------|
| `get_company_context` | `GET /studios` | `company/get_company_context.py` |
| `get_studio_details` | `GET /studios/:studioId` | `company/get_studio_details.py` |
| `verify_client_status` | `GET /studios/:studioId/clients?q=` + при необходимости `GET /clients/:id` | `clients/verify_client_status.py` |
| `register_new_client` | `POST /studios/:studioId/clients` | `clients/register_new_client.py` |
| `get_client_profile` | `GET /clients/:id` | `clients/get_client_profile.py` |
| `list_client_appointments` | `GET /clients/:id/appointments?upcoming=` | `clients/list_client_appointments.py` |
| `check_loyalty_status` | через поиск + профиль | `clients/check_loyalty_status.py` |
| `get_referral_code` | через поиск + профиль | `clients/get_referral_code.py` |
| `get_services_and_prices` | `GET /studios/:studioId/services` | `services/get_services_and_prices.py` |
| `get_active_promotions` | `GET /studios/:studioId/landing/promotions` | `landing/get_active_promotions.py` |
| `check_availability` | `GET .../schedule`, `.../busy-slots`, `.../appointments` | `schedule/check_availability.py` |
| `create_booking_request` | `POST /studios/:studioId/appointments` | `appointments/create_booking_request.py` |
| `modify_booking` | `PATCH /appointments/:id` | `appointments/modify_booking.py` |
| `reschedule_booking` | обёртка над `modify_booking` (`startAt`) | `appointments/reschedule_booking.py` |
| `cancel_booking` | `PATCH` со `status: CANCELLED` (если бизнес-логика это допускает) | `appointments/cancel_booking.py` |
| `list_prompts` / `get_prompt` | `GET /prompts`, `GET /prompts/:id` (роль SERVICE / API-key) | `prompts/list_prompts.py`, `prompts/get_prompt.py` |

**Авторизация:** заголовок `X-API-Key` = значение `NEXTBOT_API_KEY` в `.env` backend (см. `JwtAuthGuard`).

---

## Частично (обходной путь или ограничения API)

| Функция / сценарий | Почему «частично» | Что делать сейчас |
|-------------------|-------------------|-------------------|
| `process_survey_answers` | Нет отдельной сущности «анкета»; только общие поля клиента | Реализовано через `PATCH /clients/:id` → поле `notes` (блок `[NEXTBOT_SURVEY] {...}`). Не подходит для жёсткой аналитики без парсинга `notes`. |
| `register_new_client` (канал без телефона) | `CreateClientDto` требует `phone` | Instagram-only идентификатор без телефона **не пройдёт** валидацию backend; нужен номер или расширение модели/API. |
| `check_availability` | API не отдаёт готовый список «приоритетных слотов» | Nextbot считает слоты из трёх ответов. Query `staffUserId` может **игнорироваться** backend, если фильтр не добавлен в контроллеры. |
| `modify_booking` | `UpdateAppointmentDto`: только `startAt`, `prepaymentAmount`, `status` | Смена **услуги** (`serviceId`) через PATCH **не поддерживается** DTO — только отмена + новая запись или доработка backend. |
| `cancel_booking` | Зависит от того, разрешает ли `AppointmentsService` переход в `CANCELLED` через PATCH | Проверить вручную сценарий отмены; иначе нужен отдельный endpoint отмены, если он появится в API. |
| `get_services_and_prices` | Список может включать неактивные услуги | Фильтровать по `isActive` на стороне бота или добавить query в backend. |
| `get_user_id` (из промпта) | Не HTTP; настраивается в UI Nextbot | Не входит в пакет `nextbot/` — переменная сценария Nextbot. |

---

## Пока нет бизнес-логики в CRM

В **`/nextbot`** для этих функций xmind отдаётся **501** (тело ответа с `code: NOT_IMPLEMENTED`). В Python по-прежнему **`nextbot/placeholders/*.py`** → `NotImplementedError`.

| Функция | Зачем нужен backend |
|--------|---------------------|
| `process_survey_answers_failed` | Отдельная ветка CRM при отказе от анкеты |
| `add_to_waitlist` | Модель и CRUD листа ожидания |
| `request_manager_invoice` | Заявки на счёт / задачи менеджеру |
| `generate_payment_link` | Платёжный провайдер + хранение платежей |
| `verify_receipt_nighttime` | Приём файла чека + привязка к платежу |
| `purchase_certificate` | Подарочные сертификаты |
| `validate_certificate_code` | Проверка кода сертификата |
| `create_escalation_ticket` | Тикеты/задачи в CRM |
| `dev_error_report` | Приём технических логов от бота |

---

## Рекомендуемые следующие шаги на backend (кратко)

1. `PATCH /appointments/:id` — опционально `serviceId` + пересчёт `endAt` и проверка доступности.  
2. Опционально: `GET .../schedule|busy-slots|appointments?staffUserId=` для фильтра по мастеру.  
3. Отдельные модули или эндпоинты под waitlist, payments, certificates, tickets, `dev_error_report`.
