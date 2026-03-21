# Nextbot ↔ AIDA backend: что реализовано в `nextbot/`, что частично, чего нет

Документ дополняет Python-пакет `nextbot/`: функции без HTTP-контракта остаются в `nextbot/placeholders.py` и бросают `NotImplementedError`.

---

## Полностью на текущем API (реализовано в `nextbot/`)

| Функция | Эндпоинт | Модуль |
|--------|----------|--------|
| `get_company_context` | `GET /studios` | `company.py` |
| `get_studio_details` | `GET /studios/:studioId` | `company.py` |
| `verify_client_status` | `GET /studios/:studioId/clients?q=` + при необходимости `GET /clients/:id` | `clients.py` |
| `register_new_client` | `POST /studios/:studioId/clients` | `clients.py` |
| `get_client_profile` | `GET /clients/:id` | `clients.py` |
| `list_client_appointments` | `GET /clients/:id/appointments?upcoming=` | `clients.py` |
| `check_loyalty_status` | через поиск + профиль | `clients.py` |
| `get_referral_code` | через поиск + профиль | `clients.py` |
| `get_services_and_prices` | `GET /studios/:studioId/services` | `services.py` |
| `get_active_promotions` | `GET /studios/:studioId/landing/promotions` | `landing.py` |
| `check_availability` | `GET .../schedule`, `.../busy-slots`, `.../appointments` | `schedule.py` |
| `create_booking_request` | `POST /studios/:studioId/appointments` | `appointments.py` |
| `modify_booking` | `PATCH /appointments/:id` | `appointments.py` |
| `reschedule_booking` | обёртка над `modify_booking` (`startAt`) | `appointments.py` |
| `cancel_booking` | `PATCH` со `status: CANCELLED` (если бизнес-логика это допускает) | `appointments.py` |
| `list_prompts` / `get_prompt` | `GET /prompts`, `GET /prompts/:id` (роль SERVICE / API-key) | `prompts.py` |

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

## Пока нет в backend (заглушки в `nextbot/placeholders.py`)

Эти вызовы из промпта **нельзя** честно реализовать только существующими маршрутами:

| Функция | Зачем нужен backend |
|--------|---------------------|
| `add_to_waitlist` | Модель и CRUD листа ожидания |
| `request_manager_invoice` | Заявки на счёт / задачи менеджеру |
| `generate_payment_link` | Платёжный провайдер + хранение платежей |
| `verify_receipt_nighttime` | Приём файла чека + привязка к платежу; `POST /upload/avatar` только для картинок аватара |
| `purchase_certificate` | Подарочные сертификаты |
| `validate_certificate_code` | Проверка кода сертификата |
| `create_escalation_ticket` | Тикеты/задачи в CRM (не путать с внутренними `Notification` при записи) |
| `dev_error_report` | Приём технических логов от бота (отдельный endpoint / очередь) |

---

## Рекомендуемые следующие шаги на backend (кратко)

1. `PATCH /appointments/:id` — опционально `serviceId` + пересчёт `endAt` и проверка доступности.  
2. Опционально: `GET .../schedule|busy-slots|appointments?staffUserId=` для фильтра по мастеру.  
3. Отдельные модули или эндпоинты под waitlist, payments, certificates, tickets, `dev_error_report`.
