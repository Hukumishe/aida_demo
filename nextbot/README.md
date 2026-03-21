# Nextbot → HTTP API

Интеграция бота с платформой делается **через REST**, префикс **`/nextbot`**.

Реализация в коде: `src/nextbot/` (NestJS-модуль `NextbotModule`).

Старые Python-обёртки из этой папки **удалены** — используйте эндпоинты ниже или Swagger (`/docs`, тег **nextbot**).

Подробная таблица: **[docs/NEXTBOT_HTTP_API.md](../docs/NEXTBOT_HTTP_API.md)**  
Ограничения и сценарии без API: **[docs/NEXTBOT_BACKEND_GAPS.md](../docs/NEXTBOT_BACKEND_GAPS.md)**

## Авторизация

Так же, как у остального backend:

- заголовок **`X-API-Key`**: значение `NEXTBOT_API_KEY` из `.env`, или  
- **`Authorization: Bearer …`** (JWT)

## Быстрый пример

```http
GET /nextbot/context?currentStudioId=stu_xxx
X-API-Key: <NEXTBOT_API_KEY>
```

```http
GET /nextbot/studios/stu_xxx/clients/lookup?q=%2B77001234567
X-API-Key: <NEXTBOT_API_KEY>
```
