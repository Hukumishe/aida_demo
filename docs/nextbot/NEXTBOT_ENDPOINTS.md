# Эндпоинты Nextbot для Custom API

Список маршрутов **строго по функциям из xmind** (`aida_xmind.pdf`) — без лишних путей.

**Полная таблица + 501-заглушки + примеры:** [`NEXTBOT_XMIND_API.md`](./NEXTBOT_XMIND_API.md).

**Кратко:**

- Авторизация: `X-API-Key` / `Authorization: ApiKey …` / Bearer JWT.
- **При авторизации по API-ключу обязателен заголовок `X-Organization-Id`** — ID организации, от имени которой Nextbot выполняет запрос. Без него backend вернёт `400 Bad Request`. Пример:
  ```
  X-API-Key: <ваш ключ>
  X-Organization-Id: org_abc123
  ```
  Это нужно, чтобы `StudioAccessGuard` и сервисы корректно фильтровали данные по организации. При JWT-авторизации `organizationId` берётся из токена — заголовок не требуется.
- Nextbot Custom API обычно только **GET** и **POST** — для изменения записи используй **POST** `/nextbot/appointments/{id}/update` (**`modify_booking`**), в т.ч. отмена: `{"status":"CANCELLED"}`.
- **`get_user_id`** в HTTP не выносится (внутренняя функция Nextbot).

Остальная интеграция (филиал → `studioId`): см. [`NEXTBOT_STUDIO_SELECTION.md`](./NEXTBOT_STUDIO_SELECTION.md).
