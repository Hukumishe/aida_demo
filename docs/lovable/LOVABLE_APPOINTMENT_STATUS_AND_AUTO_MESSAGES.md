# Статус «Ожидаем предоплату» и автосообщения по смене статуса

## Новый статус записи

| API value | Подпись в UI |
|-----------|----------------|
| `AWAITING_PREPAYMENT` | Ожидаем предоплату |

Список всех статусов: `GET /appointment-statuses` (JWT).

В журнале записей и при `PATCH /appointments/:id` можно выставить `status: "AWAITING_PREPAYMENT"` (как и другие статусы).

## Автосообщения: триггер «Смена статуса»

### API для формы шаблона

| Метод | Путь |
|-------|------|
| GET | `/studios/:studioId/nextbot-auto-messages/status-change-schema` |
| GET | `/studios/:studioId/nextbot-auto-messages/appointment-statuses` |
| GET | `/studios/:studioId/nextbot-auto-messages/presets` — есть пресет для предоплаты |

### Создание шаблона

`POST /studios/:studioId/nextbot-auto-messages`

```json
{
  "triggerType": "STATUS_CHANGED",
  "triggerOnStatus": "AWAITING_PREPAYMENT",
  "messageText": "{{name}}, ждём предоплату {{prepayment}} ₸ по записи на {{appointmentDate}} {{appointmentTime}}.",
  "serviceCategoryId": null
}
```

Поля `anchor`, `direction`, `offsetValue`, `offsetUnit` для этого типа **не обязательны** (сервер подставит NONE / AFTER / 1 MINUTES).

### UI (вкладка «Шаблоны» Nextbot)

1. Тип сценария: **«Смена статуса записи»**.
2. Поле **«Если статус сменили на»** — select из `appointment-statuses` или `status-change-schema.triggerOnStatus.options`.
3. Текст сообщения с переменными `{{name}}`, `{{prepayment}}`, …

Сообщение уходит **сразу** после смены статуса в CRM (или при создании записи сразу в этом статусе).

### Пример сценария

1. Менеджер переводит запись в **Ожидаем предоплату**.
2. Клиенту уходит шаблон с реквизитами / суммой.
3. После оплаты менеджер переводит в `BOOKED` — при необходимости второй шаблон с `triggerOnStatus: "BOOKED"`.

## Деплой

`npx prisma migrate deploy` (миграция `20260602120000_awaiting_prepayment_status_changed`).
