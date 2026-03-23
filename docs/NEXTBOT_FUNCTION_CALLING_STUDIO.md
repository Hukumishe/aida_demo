# Что куда вставить: `studioId` в URL, не в аргументах функции

Инструкция для **Nextbot** и **системного промпта**, чтобы не было ошибок *unknown argument* (`studioId`, `selected_studio_id`).

---

## A. Системный промпт (xmind / PDF / поле «Системный промпт» в Nextbot)

**Куда:** в начало **§ 3** (после «ПОШАГОВЫЙ АЛГОРИТМ») **или** сразу после блока **ЭТАП 0** про `get_company_context`, **или** в **§ 2** как отдельный подпункт «Интеграция с порталом».

**Вставь целиком:**

```text
ИНТЕГРАЦИЯ NEXTBOT И ПАРАМЕТР studioId
Для всех функций портала, у которых в HTTP-пути есть сегмент со студией (get_services_and_prices, verify_client_status, get_active_promotions, check_loyalty_status, get_referral_code, check_availability, create_booking_request, register_new_client и т.д.), идентификатор студии передаётся ТОЛЬКО в URL через переменную сценария Nextbot (например {{studio_id}}), а НЕ в JSON-аргументах вызова инструмента.
Перед таким вызовом сценарий обязан записать выбранный id филиала из ответа get_company_context в переменную studio_id (или эквивалент, совпадающую с подстановкой в URL).
При вызове инструмента не передавай параметры studioId, selected_studio_id и любые синонимы — иначе платформа вернёт ошибку валидации аргументов. Достаточно вызова инструмента с пустым объектом аргументов {} или только с параметрами, явно описанными в схеме этого инструмента (например date для слотов).
Логически продолжай считать выбранный филиал selected_studio_id в рассуждениях, но в теле tool-call для перечисленных функций это значение не дублируй — оно уже в URL.
```

---

## B. Nextbot — переменная сценария

**Куда:** настройки сценария / переменные диалога (название может называться «Переменные», «Контекст», «Memory» — зависит от версии Nextbot).

1. Создай (или используй) переменную **`studio_id`** (тип строка).
2. **Когда заполнять:** после того как из ответа **`get_company_context`** выбран конкретный филиал — запиши в `studio_id` значение поля **`id`** этой студии из JSON.

**Если в Nextbot есть шаг «Выполнить действие после ответа API»:** привяжи к успешному `get_company_context` скрипт/маппинг, который кладёт нужный `id` в `studio_id` (или сделай выбор филиала кнопками, где в значение кнопки заранее прописан `id` из списка).

---

## C1. Nextbot — Python Script и динамический `studio_id`

Если действие — **Python Script** (не Custom API), в URL шаблон `{{studio_id}}` **не используется**: скрипт читает **`args["studio_id"]`**.

1. Заведи **переменную сценария** (например `studio_id`).
2. После **`get_company_context`** и выбора филиала запиши в неё **`id`** выбранной студии из JSON.
3. В **параметрах функции** добавь параметр с именем **`studio_id`** и привяжи его к этой переменной (источник значения / подстановка из контекста — как в справке твоей версии Nextbot).
4. Имена параметров функции должны **совпадать** с ключами в `args` в скрипте (`studio_id`, `base_url`, `api_key`).

Детали и тесты: **`nextbot/xmind_python/README.md`**.

---

## C. Nextbot — Custom API для `get_services_and_prices`

**Куда:** раздел интеграций / Custom API / действие, привязанное к функции **`get_services_and_prices`**.

| Поле | Значение |
|------|----------|
| Метод | `GET` |
| URL | `https://<ТВОЙ_ХОСТ>/nextbot/studios/{{studio_id}}/services` |
| Заголовки | `X-API-Key: <ключ>` или как у тебя настроена авторизация |
| Тело запроса | пусто |

Подставь свой хост вместо `<ТВОЙ_ХОСТ>`. Синтаксис переменной (`{{studio_id}}` или `{{ studio_id }}`) возьми из документации своей версии Nextbot.

---

## D. Nextbot — схема функции (JSON parameters)

**Куда:** настройка **Function calling** / **OpenAPI** / «Параметры функции» для каждого инструмента, где `studioId` только в пути.

**Вставь для `get_services_and_prices` (и аналогично для других GET без query-параметров):**

```json
{
  "type": "object",
  "properties": {},
  "required": []
}
```

Если интерфейс просит **весь** объект функции:

```json
{
  "name": "get_services_and_prices",
  "description": "Получить актуальный список услуг и цен для студии. Студия задаётся переменной сценария studio_id в URL интеграции; в аргументах функции ничего не передавать.",
  "parameters": {
    "type": "object",
    "properties": {},
    "required": []
  }
}
```

Для **`check_availability`** в `properties` оставь только то, что реально уходит в query (например `date` как string), **без** `studioId`.

---

## E. Остальные пути с `:studioId`

Тот же шаблон URL и пустые `parameters`, если в пути только `{{studio_id}}`:

| Функция | Шаблон URL (фрагмент) |
|---------|------------------------|
| `verify_client_status` | `.../nextbot/studios/{{studio_id}}/clients/verify?q={{user_contact}}` (или как настроишь `q`) |
| `get_active_promotions` | `.../nextbot/studios/{{studio_id}}/landing/promotions` |
| `check_loyalty_status` | `.../nextbot/studios/{{studio_id}}/clients/loyalty?q=...` |
| `get_referral_code` | `.../nextbot/studios/{{studio_id}}/clients/referral?q=...` |
| `check_availability` | `.../nextbot/studios/{{studio_id}}/availability-raw?date=...` |
| `create_booking_request` | `POST .../nextbot/studios/{{studio_id}}/appointments` (тело — JSON записи) |
| `register_new_client` | `POST .../nextbot/studios/{{studio_id}}/clients/register` |

`modify_booking` — путь **`/nextbot/appointments/{{appointment_id}}/update`**, там **`studio_id` не нужен** в URL.

---

## F. Проверка

1. В логах бэкенда URL должен быть вида `/nextbot/studios/e1e86707-.../services`, **не** `/studios/{studioId}/...`.
2. В отладке Nextbot вызов функции **`get_services_and_prices`** с аргументами **`{}`** без ошибки валидации.

---

## G. Ошибка 400: в URL «`{{studioId}}`» / `%7B%7BstudioId%7D%7D`

Если в логах бэкенда путь вида **`/nextbot/studios/%7B%7BstudioId%7D%7D/...`** — axios ушёл с **буквальным** текстом `{{studioId}}`, подстановка **не выполнилась**.

**Что проверить в Nextbot:**

1. **Переменная заполнена до запроса** — после `get_company_context` (и выбора филиала) в `studioId` должен лежать реальный `id` (например `e1e86707-...` или `stu_...`). Если шаг verify идёт раньше записи переменной — будет литерал.
2. **Имя в URL = имя переменной** — в шаблоне `{{studioId}}`, а в сценарии переменная называется иначе (`studio_id`, `CLIENT_STUDIO_ID`) → подстановка не найдётся.
3. **Синтаксис именно вашей версии Nextbot** — не везде в поле «URL» работают `{{...}}`; иногда переменные задаются отдельным списком, префиксом `$`, или подстановка только в теле, а не в пути. Открой справку Nextbot по «переменные в HTTP / Custom API».
4. **Тест** — временно впиши в URL **конкретный uuid** студии: если запрос проходит, проблема только в подстановке переменной.

См. также [`NEXTBOT_STUDIO_SELECTION.md`](./NEXTBOT_STUDIO_SELECTION.md), [`NEXTBOT_XMIND_API.md`](./NEXTBOT_XMIND_API.md).
