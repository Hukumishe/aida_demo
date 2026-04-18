# Nextbot: get_service_categories

Укрупнённые направления работы (категории услуг) для первичного фильтра диалога.

## HTTP

```
GET /nextbot/service-categories
Headers:
  X-API-Key: <api-key>
  X-Organization-Id: <org id>  (или Bearer JWT)
Query:
  studioId (опционально, принимается для совместимости, НЕ обязателен)
```

Категории общие на всю организацию. `studioId` не влияет на выдачу — он нужен только как контекст вызова из xmind-обёртки.

## Ответ

```json
{
  "data": {
    "categories": [
      {
        "id": "cat_women_hair",
        "name": "Женские стрижки",
        "available_in": ["stu_a", "stu_b"]
      },
      {
        "id": "cat_men_hair",
        "name": "Мужские стрижки",
        "available_in": ["stu_a"]
      }
    ]
  },
  "get_service_categories": "<субпромпт для агента>"
}
```

- В `categories[]` попадают только активные категории (`ServiceCategory.isActive = true`) организации.
- `available_in` — ID филиалов организации, где категория **не** отключена через `StudioDisabledCategory`. Если категория доступна во всех студиях сети — это все их id.
- Поле с субпромптом называется `get_service_categories` (ключ = имя xmind-функции). Если в таблице `prompts` для организации нет записи, отдаётся fallback-текст из `NEXTBOT_GET_SERVICE_CATEGORIES_PROMPT`.

## Субпромпт

Фолбэк-текст описывает правила:
- гендерная идентификация клиента до подбора окон/цен;
- презентация категорий по `name`;
- проверка `available_in` — если категория доступна не во всех филиалах, предупредить клиента;
- после выбора категории — вызывать `get_services_and_prices` с её `id`.

Если нужно переопределить — добавить запись в `prompts` с ключом `get_service_categories` (по организации или глобально).

## Python-обёртка

`nextbot/xmind_python/get_service_categories.py` делает `GET` и возвращает:

```python
{
  "ok": bool,
  "status": int,
  "data": {"categories": [...]},
  "prompt": "<строка субпромпта>"
}
```
