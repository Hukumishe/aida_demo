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

## Фильтр по мастеру (исполнитель визита)

`GET /studios/:studioId/appointments?staffUserId=<userId>` — только записи к указанному мастеру.

Комбинируется с фильтром автора, например:

`?onlyMine=true&staffUserId=<masterUserId>` — мои созданные записи к этому мастеру.

Для **MASTER** параметр игнорируется — сервер всегда отдаёт только свои приёмы.

Те же query работают на `GET /studios/:studioId/appointment-log?date=YYYY-MM-DD` (личное время в ответе тоже фильтруется по `staffUserId`).

## UI

- В карточке/строке записи в журнале мастеров показывать колонку **«Автор»** (`author`).
- Кнопка «Только мои» → запрос с `onlyMine=true` (для дэшборда менеджера за месяц).

## Деплой

На сервере: `npx prisma migrate deploy`.
