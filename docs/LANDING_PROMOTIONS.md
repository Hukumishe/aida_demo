# Акции лендинга (organization-level)

Акции действуют **на всю организацию** (сеть салонов), а не на отдельный филиал. Все эндпоинты теперь **без `studioId`**. Старые `/studios/:studioId/landing/promotions*` удалены.

## Эндпоинты

### Публичные (для лендинга, без JWT)

- `GET /landing/promotions?organizationId=<id>`
  - Возвращает список активных акций организации (`isActive=true` не обязателен — отдаются все, чтобы админка видела отключённые; публичный лендинг сам фильтрует по `isActive`).
  - Ответ: массив акций с `services`, `codes`, и всеми полями `LandingPromotion`.

- `POST /landing/promotions/resolve-code`
  ```json
  {
    "code": "ABC123",
    "organizationId": "org_xxx",
    "studioId": "studio_xxx"   // опционально
  }
  ```
  - Проверяет промокод и возвращает данные для автоподстановки в форму записи.
  - Если `studioId` передан — услуги фильтруются по тому, что реально доступно для записи в этом филиале (учёт `StudioDisabledService` / `StudioDisabledCategory`).
  - Если `studioId` не передан — возвращаются все услуги организации, на которые распространяется акция.

### Авторизованные (админка)

Роли: `DEVELOPER`, `OWNER`, `DEPUTY_OWNER`, `SERVICE`.

- `POST /landing/promotions` — создать акцию.
- `PATCH /landing/promotions/:id` — изменить (в т.ч. `isActive` для on/off).
- `DELETE /landing/promotions/:id` — удалить.

Организация берётся из JWT (`user.organizationId`). **DEVELOPER** может передать `?organizationId=<id>` чтобы работать в чужой организации.

## Для бота (nextbot)

- `GET /nextbot/landing/promotions` — активные акции организации, определяется по JWT / API-ключу. `studioId` не требуется.

## Что удалено

Убраны старые (studio-scoped):
- `GET /studios/:studioId/landing/promotions`
- `POST /studios/:studioId/landing/promotions`
- `POST /studios/:studioId/landing/promotions/resolve-code`
- `PATCH /studios/:studioId/landing/promotions/:id`
- `DELETE /studios/:studioId/landing/promotions/:id`
- `GET /nextbot/studios/:studioId/landing/promotions`

Данные в БД не трогались: `LandingPromotion.organizationId` — уже было так.
