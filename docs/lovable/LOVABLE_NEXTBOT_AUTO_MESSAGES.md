# Автосообщения Nextbot (шаблоны) — Lovable

Блок настройки в **Маркетинг / Nextbot** (или аналог): шаблоны исходящих сообщений по записям для выбранного **филиала**.

## Категории услуг (п.2)

Список для селекта — существующий API:

`GET /services/categories?studioId={studioId}`

Показывать только категории с **`isOfferedInStudio === true`** (категория активна в сети и не отключена в филиале).

## Переменные в тексте (п.4)

`GET /studios/{studioId}/nextbot-auto-messages/variables`

```json
{
  "syntax": "{{variableKey}}",
  "variables": [
    { "key": "name", "label": "Имя клиента", "description": "...", "example": "Анна" }
  ]
}
```

В редакторе текста — кнопки «вставить переменную», вставляют `{{name}}`, `{{service}}` и т.д.

Доступные ключи: `name`, `patronymic`, `lastName`, `phone`, `service`, `services`, `category`, `studio`, `appointmentDate`, `appointmentTime`, `master`.

## CRUD шаблонов

Базовый путь: `/studios/{studioId}/nextbot-auto-messages`

| Метод | Путь | Описание |
|--------|------|----------|
| GET | `.../variables` | Справочник переменных |
| GET | `...` | Список шаблонов филиала |
| GET | `.../{templateId}` | Один шаблон |
| POST | `...` | Создать |
| PATCH | `.../{templateId}` | Обновить |
| DELETE | `.../{templateId}` | Удалить |

Права на **запись**: OWNER, DEPUTY_OWNER, MARKETER, SERVICE, DEVELOPER.  
**Чтение**: все роли с доступом к филиалу (JWT + `studioId` в пути).

### Создание (POST body)

```json
{
  "serviceCategoryId": "sca_xxxxxxxxxx",
  "timing": "BEFORE_PROCEDURE",
  "offsetValue": 2,
  "offsetUnit": "HOURS",
  "messageText": "Здравствуйте, {{name}}! Напоминаем о записи на {{service}} {{appointmentDate}} в {{appointmentTime}}.",
  "isActive": true,
  "sortOrder": 0
}
```

**timing**

- `BEFORE_PROCEDURE` — **до** процедуры (п.1 «До процедуры»)
- `AFTER_PROCEDURE` — **после** процедуры (п.1 «После процедуры»)

**offsetUnit** + **offsetValue** (п.3)

- До: «за сколько» → `BEFORE_PROCEDURE` + например `{ "offsetValue": 1, "offsetUnit": "DAYS" }`
- После: «через сколько» → `AFTER_PROCEDURE` + например `{ "offsetValue": 30, "offsetUnit": "MINUTES" }`

Допустимые единицы: `MINUTES`, `HOURS`, `DAYS`.  
`offsetValue`: 1–365 (в сумме не больше 365 дней).

### Ответ шаблона

```json
{
  "id": "nat_xxxxxxxxxx",
  "studioId": "stu_xxxxxxxxxx",
  "serviceCategoryId": "sca_xxxxxxxxxx",
  "serviceCategoryName": "Маникюр",
  "timing": "BEFORE_PROCEDURE",
  "offsetValue": 2,
  "offsetUnit": "HOURS",
  "messageText": "...",
  "isActive": true,
  "sortOrder": 0,
  "createdAt": "...",
  "updatedAt": "..."
}
```

## UI (рекомендуемый блок)

1. **Когда** — radio: «До процедуры» / «После процедуры» → `timing`.
2. **Категория** — select из `GET /services/categories?studioId=...` (только `isOfferedInStudio`).
3. **Тайминг** — число + select единицы (минуты / часы / дни) → `offsetValue`, `offsetUnit`.
4. **Текст** — textarea + панель переменных из `.../variables`.
5. Список сохранённых шаблонов — таблица/карточки с toggle `isActive`, редактирование, удаление.

## Отправка

Сейчас бэкенд хранит **шаблоны**; крон/отправка в Nextbot webhook — отдельный этап (нужен `nextbotDialogId` у клиента и интеграция с API Nextbot).
