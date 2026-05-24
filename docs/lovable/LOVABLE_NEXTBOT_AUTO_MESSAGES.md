# Автосообщения Nextbot — Lovable

## Настройки интеграции

`GET/PATCH /studios/:studioId/settings` — дополнительные поля:

| Поле | Уровень | Описание |
|------|---------|----------|
| `nextbotOutboundWebhookUrl` | организация | URL webhook исходящих сообщений (задаётся с frontend) |
| `nextbotOutboundWebhookApiKey` | организация | Bearer для webhook, опционально |
| `feedbackLowRatingTaskTitle` | организация | Заголовок задачи при оценке ≤3 |
| `feedbackTwoGisUrl` | **филиал** | Ссылка 2GIS после оценки 4–5 |

Тело webhook (POST): `{ dialogId, text, appointmentId?, clientId?, templateId? }`.

## Шаблоны

`GET/POST/PATCH/DELETE /studios/:studioId/nextbot-auto-messages`

`GET .../presets` — типовые пресеты из ТЗ.

`GET .../variables` — переменные `{{name}}`, `{{service}}`, …

`GET .../logs` — журнал отправок (PENDING/SENT/SKIPPED/…).

### Поля шаблона

| Поле | Описание |
|------|----------|
| `triggerType` | `BOOKING_CONFIRMED`, `REMINDER_BEFORE_VISIT`, `HOLD_EXPIRY_WARNING`, `FOLLOWUP_AFTER_VISIT`, `FEEDBACK_REQUEST` |
| `anchor` | `NONE`, `APPOINTMENT_START`, `HOLD_EXPIRES_AT`, `VISIT_DONE_AT` |
| `direction` | `BEFORE` / `AFTER` относительно anchor |
| `offsetValue` + `offsetUnit` | MINUTES / HOURS / DAYS |
| `minLeadDays` | Только для напоминаний: мин. суток между `bookedAt` и `startAt` |
| `serviceCategoryId` | null — без фильтра; для follow-up/feedback **обязательна** |
| `messageText` | Текст с `{{переменными}}` |
| `isActive` | Выключение не отменяет уже стоящие в очереди PENDING |

### Пресеты (подсказки)

1. **BOOKING_CONFIRMED** — сразу при `BOOKED`
2. **REMINDER** −1 день, `minLeadDays: 2`
3. **REMINDER** −4 часа
4. **HOLD_EXPIRY_WARNING** — за 5 мин до `holdExpiresAt` (ночной холд)
5. **FOLLOWUP** +24 дня после `DONE` (категория)
6. **FEEDBACK** +N мин после `DONE` (категория)

## Оценка после визита

`POST /nextbot/appointments/:appointmentId/feedback`

```json
{ "rating": 5, "positiveFollowUpText": "опционально" }
```

- Один раз на запись, только `DONE`
- 4–5: исходящее с `feedbackTwoGisUrl` филиала
- ≤3: задача менеджеру организации
- Оценка в таблице `appointment_feedbacks`

Сценарий Nextbot: после сообщения `FEEDBACK_REQUEST` клиент пишет оценку → вызов API.

## Поведение движка (бэкенд)

- При `BOOKED`: подтверждение + планирование напоминаний; `bookedAt` фиксируется
- При переносе `startAt`: пересчёт PENDING напоминаний; правило `minLeadDays` перепроверяется
- При `CANCELLED`: отмена всех PENDING по записи
- При `DONE`: follow-up + feedback по категории
- При новом `BOOKED` в той же категории: отмена старых PENDING follow-up/feedback клиента по этой категории
- Чёрный список / нет `nextbotDialogId` → SKIPPED в логе
- Крон каждую минуту отправляет `scheduledAt <= now`
- Выключили шаблон: **уже в очереди** — отправятся; **новые** — не планируются

## Категории для селекта

`GET /services/categories?studioId=...` — только `isOfferedInStudio === true`.

## Права

Редактирование шаблонов: **OWNER**, **DEPUTY_OWNER**, **DEVELOPER**.
