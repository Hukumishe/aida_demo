# Автосообщения Nextbot — справка API

> Промпт для вёрстки в Lovable: **`LOVABLE_NEXTBOT_AUTO_MESSAGES_PROMPT.md`**  
> Промокоды Target (CRM): **`LOVABLE_TARGET_PROMOS.md`**

## Навигация UI (Lovable)

> Единый промпт: **`LOVABLE_NEXTBOT_TABS_RESTRUCTURE_PROMPT.md`** — вкладки «Интеграции» (только DEVELOPER), «Шаблоны» (оценка визита + ДР + CRUD шаблонов), «Журнал».

## Настройки интеграции

`GET/PATCH /studios/:studioId/settings` — дополнительные поля:

| Поле | Уровень | Описание |
|------|---------|----------|
| `nextbotOutboundWebhookUrl` | организация | URL webhook — **только роль DEVELOPER** (GET/PATCH) |
| `nextbotOutboundWebhookApiKey` | организация | Bearer для webhook — **только DEVELOPER** |
| `feedbackLowRatingTaskTitle` | организация | Заголовок задачи при оценке ≤3 — вкладка «Шаблоны» |
| `feedbackTwoGisUrl` | **филиал** | Ссылка 2GIS после оценки 4–5 — вкладка «Шаблоны» |

Тело webhook Nextbot (POST, snake_case):

```json
{
  "dialog_id": 12345,
  "content_type": "text",
  "text": "Текст сообщения",
  "message_type": "forwarded_output",
  "message_id": "apt_..."
}
```

`message_type: forwarded_output` — сообщение уходит клиенту в мессенджер. `message_id` опционально (AIDA подставляет `appointmentId` для трассировки).

## Шаблоны

`GET/POST/PATCH/DELETE /studios/:studioId/nextbot-auto-messages`

`GET .../presets` — типовые пресеты из ТЗ.

`GET .../variables` — переменные `{{name}}`, `{{service}}`, `{{comment}}`, `{{prepayment}}`, …

`GET .../logs` — журнал отправок (PENDING/SENT/SKIPPED/…).

### Тестовая отправка (свои данные)

`POST /studios/:studioId/nextbot-auto-messages/test-send` — только **owner** / **deputy** / **developer**.

Перед тестом задайте `nextbotOutboundWebhookUrl` в настройках студии.

```json
{
  "dialogId": 14325361,
  "messageText": "Тест, {{name}}! Услуга: {{service}}.",
  "appointmentId": "apt_xxxxxxxxxx",
  "variables": {
    "name": "Анна"
  }
}
```

- `messageText` **или** `templateId` (текст из шаблона филиала)
- `appointmentId` — подставить переменные из записи
- `variables` — свои значения (перекрывают appointment)
- Ответ: `{ "ok": true, "dialogId", "renderedText", "variablesUsed" }`
- В очередь автосообщений **не** попадает

### Поля шаблона

| Поле | Описание |
|------|----------|
| `triggerType` | `BOOKING_CONFIRMED`, `REMINDER_BEFORE_VISIT`, `HOLD_EXPIRY_WARNING`, `FOLLOWUP_AFTER_VISIT`, `FEEDBACK_REQUEST`, **`CUSTOM_SCHEDULED`** (своё расписание) |
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

### Своё сообщение (`CUSTOM_SCHEDULED`)

Произвольный текст + категория + смещение **до** или **после** процедуры.

- **До:** `APPOINTMENT_START` + `BEFORE` — при `BOOKED`, за N мин/ч/дн до визита; опционально `minLeadDays`.
- **После:** `VISIT_DONE_AT` + `AFTER` — при `DONE`, через N мин/ч/дн после завершения; при новой брони в той же категории — отмена (как follow-up).

`GET .../custom-schedule-schema` — схема формы для UI.  
Промпт Lovable: **`LOVABLE_NEXTBOT_CUSTOM_AUTO_MESSAGES.md`**.

### День рождения

Отдельные настройки: `GET/PUT /studios/:studioId/nextbot-birthday/settings`, журнал `.../logs`.  
Промпт Lovable: **`LOVABLE_NEXTBOT_BIRTHDAY.md`**.

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
