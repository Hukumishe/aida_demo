# Nextbot × AIDA backend: что закрыто API и что нет

Основной контракт для бота: префикс **`/nextbot`** (см. **[NEXTBOT_HTTP_API.md](./NEXTBOT_HTTP_API.md)**). Старые Python-обёртки удалены; интеграция только через HTTP.

---

## Полностью через `/nextbot` (и базовый REST)

| Сценарий | HTTP (предпочтительно) |
|----------|-------------------------|
| Контекст студий | `GET /nextbot/context`, `GET /nextbot/studios/:studioId` |
| Проверка клиента | `GET /nextbot/studios/:studioId/clients/lookup?q=` |
| Регистрация | `POST /nextbot/studios/:studioId/clients` |
| Анкета | `POST /nextbot/clients/:id/survey` или `PATCH /nextbot/clients/:id` |
| История записей | `GET /nextbot/clients/:id/appointments` |
| Услуги / лендинг | `GET /nextbot/studios/:studioId/services`, `.../landing/promotions`, `.../landing/services`, `.../landing/masters` |
| Лояльность / реферал | `GET .../clients/loyalty?q=`, `GET .../clients/referral?q=` |
| Слоты (агрегат) | `GET /nextbot/studios/:studioId/availability?date=...` |
| Запись | `POST .../appointments`, `PATCH /nextbot/appointments/:id`, `POST /nextbot/appointments/:id/cancel` |

Те же операции возможны и «напрямую» через классические пути (`/studios/...`, `/clients/...`), но **`/nextbot`** даёт единый контракт для оркестратора.

**Авторизация:** JWT или **`X-API-Key`** (`NEXTBOT_API_KEY`).

---

## Частично (обходной путь есть, эталон промпта не полный)

| Сценарий | Почему «частично» |
|----------|-------------------|
| **Контекст «Tone of Voice»** | `/nextbot/context` отдаёт студии; отдельного блока ToV/правил бота нет — см. `/prompts` или отдельный endpoint при необходимости. |
| **Поиск по Instagram** | `lookup?q=` — по имени/фамилии/телефону; отдельного поля instagram нет. |
| **Анкета** | `POST .../survey` пишет в `notes`; отдельной сущности анкеты в БД нет. |
| **Доступность** | `availability` отдаёт сырьё; готовые «приоритетные окна» считает клиент (Nextbot). |
| **Смена услуги у записи** | `PATCH /appointments/:id` без `serviceId` в DTO — смена услуги не поддержана. |
| **Отмена vs no-show** | `POST .../cancel` ставит `CANCELLED`; это не эквивалент `POST .../no-show`. |
| **Прайс vs лендинг** | Разные источники: `services` vs `landing/services`. |

---

## Нет в API (нужны новые эндпоинты / модели)

| Сценарий | Причина |
|----------|---------|
| `add_to_waitlist` | Нет waitlist. |
| `request_manager_invoice` | Нет задач/счетов под бота. |
| `generate_payment_link` | Нет платёжной интеграции. |
| `verify_receipt_nighttime` | Нет приёма чека + задачи; `upload/*` только изображения. |
| `purchase_certificate` / `validate_certificate_code` | Нет сертификатов. |
| `create_escalation_ticket` | Нет тикетов. |
| `dev_error_report` | Нет endpoint для отчёта от бота. |

---

## Внутренняя функция Nextbot (платформа)

| Функция | Где живёт |
|---------|-----------|
| `get_user_id` | Переменные канала Nextbot, не backend. |

---

*Обновляйте этот файл при добавлении новых `/nextbot` или CRM-фич.*
