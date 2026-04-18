# Nextbot: get_services_and_prices

Целевой срез прайс-листа конкретного филиала. Оркестратор уже собрал фильтры
(филиал, организация, категория, гендерная аудитория) и передаёт их единым пакетом —
бэкенд на своей стороне отсекает всё лишнее и отдаёт агенту только те услуги,
которые оказываются в данной студии для выбранного пола клиента.

## HTTP

```
GET /nextbot/studios/{studioId}/services
Headers:
  X-API-Key: <api-key>
  X-Organization-Id: <org id>  (или Bearer JWT)
Query:
  organizationId — опционально, для совместимости (реально берётся из JWT/API-ключа)
  category       — id или имя категории (case-insensitive), например "cat_hair" или "Лазерная эпиляция"
  audience       — MEN | WOMEN (принимаются и "мужской"/"женский", "male"/"female", "м"/"ж" и т.п.)
```

Совместимость: старый путь `GET /nextbot/services?studioId=...` сохранён как alias и
также принимает `category` и `audience` в query. Новый код должен использовать путь с `studioId` в пути.

## Правила фильтрации (на бэкенде)

В ответ попадают услуги, удовлетворяющие всем условиям:

- `service.organizationId` = организация текущего пользователя;
- `service.isActive = true`;
- `service.category.isActive = true`;
- услуга **не** отключена в выбранном филиале (`StudioDisabledService`);
- категория услуги **не** отключена в выбранном филиале (`StudioDisabledCategory`);
- если передан `category` — только эта категория (по id, а если нет — по имени);
- если передан `audience` — только услуги этого прайса (`MEN` / `WOMEN`);

Если `category` передан, но в БД такой категории нет — возвращается пустой `data: []`,
а не 404, чтобы бот корректно отработал ответ через свой субпромпт.

## Ответ

```json
{
  "data": [
    {
      "id": "svc_laser_legs",
      "name": "Лазерная эпиляция: ноги полностью",
      "defaultPrice": 4500,
      "defaultDurationMin": 60
    }
  ],
  "get_services_and_prices": "<субпромпт для агента>"
}
```

Ответу намеренно оставлены только поля `id`, `name`, `defaultPrice`, `defaultDurationMin` —
чтобы не засорять память LLM. Всё остальное (расходники, бонусы, связи с сотрудниками)
в ответ этой функции не попадает.

## Субпромпт

Ключ субпромпта — `get_services_and_prices` (= имя xmind-функции).
Если в таблице `prompts` для организации нет записи, отдаётся fallback из
`NEXTBOT_GET_SERVICES_AND_PRICES_PROMPT`:

- презентация услуг по `name` + `defaultPrice`;
- фиксация `id` выбранных услуг и суммирование `defaultDurationMin`;
- переход к `check_availability` для подбора окон.

Чтобы переопределить — добавить запись в `prompts` с ключом `get_services_and_prices`
(по организации или глобально).

## Python-обёртка

`nextbot/xmind_python/get_services_and_prices.py` делает GET на
`/nextbot/studios/{studio_id}/services` с заголовками `X-API-Key` / `X-Organization-Id`
и query-параметрами `organizationId`, `category`, `audience`.

Возвращает:

```python
{
  "ok": bool,           # True при 2xx
  "status": int,
  "data": [             # уже отфильтрованный срез, без прочих полей
    {"id": "...", "name": "...", "defaultPrice": 4500, "defaultDurationMin": 60}
  ],
  "prompt": "<строка субпромпта>"
}
```

При сетевой ошибке — `{"ok": False, "status": 0, "data": [], "prompt": "", "error": "request_failed", "error_message": "..."}`.
