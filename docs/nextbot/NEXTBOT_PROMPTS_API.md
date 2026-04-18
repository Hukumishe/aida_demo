# Документация: получение промптов для Nextbot

## Эндпоинты

Используйте CRM API (не `/nextbot`):

- `GET /prompts` — получить список всех промптов
- `GET /prompts/{id}` — получить конкретный промпт по `id`

Базовый URL: `https://<your-host>`  
Пример полного URL: `https://<your-host>/prompts`

## Заголовки запроса

При API-key авторизации:

```http
X-API-Key: <YOUR_API_KEY>
X-Organization-Id: <ORG_ID>
Accept: application/json
Content-Type: application/json
```

## Что брать из ответа

- `key` — название промпта
- `description` — начинка промпта (текст промпта)

---

## Пример ответа `GET /prompts`

```json
[
  {
    "id": "prm_abc123",
    "key": "welcome_message",
    "description": "Приветствие для новых клиентов 👋",
    "createdAt": "2026-04-17T09:10:11.000Z",
    "updatedAt": "2026-04-17T09:10:11.000Z"
  }
]
```

## Пример ответа `GET /prompts/{id}`

```json
{
  "id": "prm_abc123",
  "key": "welcome_message",
  "description": "Приветствие для новых клиентов 👋",
  "createdAt": "2026-04-17T09:10:11.000Z",
  "updatedAt": "2026-04-17T09:10:11.000Z"
}
```

## Быстрый маппинг для интеграции

- `"Название промпта"` → `response.key`
- `"Начинка промпта"` → `response.description`
