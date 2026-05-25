# Автор записи (журнал мастеров / дэшборд)

## Поля в API

У каждой записи (`GET /studios/:studioId/appointments`, ответ `POST` создания):

| Поле | Описание |
|------|----------|
| `createdSource` | `CRM` \| `NEXTBOT` \| `LANDING` |
| `createdByUserId` | id сотрудника CRM или `null` (бот/лендинг) |
| `createdByUser` | объект пользователя с `staffProfile` (если есть) |
| `author` | готовая подпись для UI, напр. `Айгуль Смагулова (Администратор)` или `Nextbot` |

Старые записи: `createdSource = CRM`, `createdByUserId = null`, `author = "CRM"`.

## Фильтр «только мои записи»

`GET /studios/:studioId/appointments?onlyMine=true` — записи, где автор = текущий пользователь.

Или явно: `?createdByUserId=<userId>`.

## UI

- В карточке/строке записи в журнале мастеров показывать колонку **«Автор»** (`author`).
- Кнопка «Только мои» → запрос с `onlyMine=true` (для дэшборда менеджера за месяц).

## Деплой

На сервере: `npx prisma migrate deploy`.
