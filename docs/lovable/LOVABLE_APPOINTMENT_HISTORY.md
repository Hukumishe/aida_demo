# Модалка «История» записи (Lovable)

## Задача

В карточке записи (журнал / сетка) добавить кнопку **«История»**, открывающую модальное окно со **всеми действиями** по этой записи: создание, перенос, смена статуса, предоплата, комментарий, «Пришёл», «Завершён», «Не пришёл», опоздание, допродажи.

## API

**GET** `/appointments/:id/history`

**Headers:** `Authorization: Bearer <accessToken>`

**Response (200):**

```json
{
  "appointmentId": "apt_xxx",
  "items": [
    {
      "id": "aph_xxx",
      "action": "CREATED",
      "actionLabel": "Создание",
      "summary": "Создана запись: Иван Иванов, Маникюр, 24.05.2026, 14:00, статус «Забронировано»",
      "payload": { "appointmentId": "apt_xxx", "status": "BOOKED", "startAt": "..." },
      "actor": {
        "id": "usr_xxx",
        "role": "ADMIN",
        "displayName": "Анна Петрова"
      },
      "actorLabel": null,
      "createdAt": "2026-05-24T09:00:00.000Z"
    }
  ]
}
```

- Список отсортирован **от старых к новым** (`createdAt` asc).
- **actor** — сотрудник CRM, если действие из интерфейса; **actorLabel** — подпись для Nextbot/лендинга (`"Nextbot"`, `"Лендинг"`), если нет пользователя.
- После **«Не пришёл»** запись удаляется, но события истории остаются (поиск по `appointmentId` в `payload`).

### Типы действий (`action` / `actionLabel`)

| action | actionLabel |
|--------|-------------|
| CREATED | Создание |
| RESCHEDULED | Перенос |
| STATUS_CHANGED | Статус |
| PREPAYMENT_CHANGED | Предоплата |
| COMMENT_CHANGED | Комментарий |
| CLIENT_ARRIVED | Клиент пришёл |
| VISIT_COMPLETED | Визит завершён |
| NO_SHOW | Не пришёл |
| LATE_PENALTY | Опоздание |
| CANCELLED | Отмена |
| UPSELL_ADDED | Допродажа |
| UPSELL_UPDATED | Допродажа изменена |
| UPSELL_REMOVED | Допродажа удалена |

## UI (рекомендации)

1. В модалке записи — ссылка/кнопка **«История»** (иконка часов).
2. Модалка ~480px: вертикальный **timeline** — слева время (`createdAt` в локали студии), справа `actionLabel` + `summary`, подпись «кто»: `actor.displayName` или `actorLabel` или «Система».
3. Загрузка: skeleton; пустой список — «Пока нет событий» (старые записи до деплоя).
4. Доступ: те же роли, что и к записи (MASTER — только свои записи).

## Промпт для Lovable

```
Добавь в модалку записи кнопку «История». По клику — GET /appointments/{id}/history с Bearer token.
Покажи timeline: дата/время (ru-RU), actionLabel, summary, автор (actor.displayName || actorLabel || «—»).
Стили как у остальной CRM. Обработай 403/404.
```
