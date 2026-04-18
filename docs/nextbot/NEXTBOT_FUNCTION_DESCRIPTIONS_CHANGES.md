# Что изменить в **описаниях функций** (xmind / карточки / Nextbot)

Отдельный чеклист для правок **текстов карточек функций** и настроек **Custom API / схемы инструментов** в Nextbot. Системный промпт см. [`AIDA_SYSTEM_PROMPT_NEXTBOT.md`](./AIDA_SYSTEM_PROMPT_NEXTBOT.md).

Общее правило для всех функций с **`/studios/:studioId/`** в пути:

- В описании инструмента укажи: *«Идентификатор студии только в URL через переменную сценария `{{studioId}}`; в параметрах функции (JSON) не передавать `studioId` / `selected_studio_id`, если схема не требует».*
- В Nextbot: URL = `.../nextbot/studios/{{studioId}}/...`, переменная **`studioId`** заполняется **после** выбора филиала из ответа `get_company_context`.

---

## `get_company_context`

| Что поправить | Как |
|----------------|-----|
| Статический список филиалов с адресами (Zara и т.д.), если он **не совпадает** с CRM | Удалить или заменить блоком: список филиалов и адреса для записи — **только из JSON ответа**; если `address` = null — клиенту называть по `name`. |
| Формулировка «опирайся на адреса из этого блока» | Заменить на: **идентификаторы и названия для API — из JSON**; статический текст — максимум для тона, не для выбора `id`. |

---

## `get_user_id`

| Что поправить | Как |
|----------------|-----|
| Связь с verify | Явно: значение сохраняется как **`user_contact`** и подставляется в **`q=`** для `verify_client_status` / loyalty / referral (как настроено в сценарии). |

---

## `verify_client_status`

| Что поправить | Как |
|----------------|-----|
| «Вызывается автоматически при первом сообщении» | **Удалить или переписать:** вызывать **после** фиксации филиала и записи **`studioId`** в сценарий; не первым шагом, если филиал ещё не выбран. |
| Структура ответа (`is_known_client`, `client_profile`) | Привести к фактическому API AIDA: **`found`** (boolean), **`client`** (объект или `null`). Устаревшие ключи убрать или пометить «если портал вернёт иначе — ориентируйся на фактический JSON». |
| Порядок с `get_company_context` | Добавить: сначала контекст и выбор студии, затем verify. |
| HTTP | GET `/nextbot/studios/{{studioId}}/clients/verify?q={{user_contact}}` (имена переменных под твой сценарий). |

---

## `resolve_studio` (если ещё есть в xmind или Nextbot)

| Что поправить | Как |
|----------------|-----|
| Любое описание | **Удалить** действие или карточку: в бэкенде AIDA **нет** `GET /nextbot/studios/resolve`. Филиал — только **`get_company_context`** + переменная **`studioId`**. |

---

## `get_services_and_prices`

| Что поправить | Как |
|----------------|-----|
| Описание параметров инструмента | **Без** `studioId` в JSON; студия только в URL. |
| Содержимое ответа | Если в PDF указаны `categories` / `services` — сверить с реальным ответом `GET .../services`; при расхождении описать фактическую форму или «массив услуг из ответа портала». |

---

## `get_active_promotions`

| Что поправить | Как |
|----------------|-----|
| Параметры инструмента | Как у `get_services_and_prices` — только URL + `{{studioId}}`. |
| Поля ответа (`has_active_promotions`, `promotions`) | Сверить с ответом `GET .../landing/promotions`; при необходимости обновить описание. |

---

## `check_loyalty_status`

| Что поправить | Как |
|----------------|-----|
| Параметры | URL + `{{studioId}}`, query `q` = контакт клиента (как в verify). |
| Поля ответа (`loyalty_tier`, `bonus_balance`, …) | Сверить с [`nextbot.service.ts`](../src/nextbot/nextbot.service.ts) `loyaltySummary`: **`found`**, **`clientId`**, **`level`**, **`bonuses`**, **`discount`**, `rawClient` — при необходимости заменить описание в карточке. |

---

## `get_referral_code`

| Что поправить | Как |
|----------------|-----|
| Параметры | URL + `{{studioId}}`, `q` = контакт. |
| Поля ответа (`referral_link`, …) | Сверить с `referralSummary`: **`found`**, **`referralCode`**, **`clientId`**, `rawClient`. |

---

## `check_availability`

| Что поправить | Как |
|----------------|-----|
| Параметры инструмента | **`studioId`** только в URL; в схеме — только то, что реально уходит в query: **`date`** (YYYY-MM-DD), при необходимости **`staffUserId`** (пустая строка допустима по API). |
| Путь | Реальный маршрут AIDA: `GET .../availability-raw` (см. [`NEXTBOT_XMIND_API.md`](./NEXTBOT_XMIND_API.md), не выдумывать другой путь). |
| Ответ (`is_available`, `available_slots`, «тетрис») | Сверить с фактическим JSON бэкенда; убрать выдуманные поля или пометить как «если вернёт портал». |

---

## `create_booking_request`

| Что поправить | Как |
|----------------|-----|
| Параметры | **`studioId`** в пути через `{{studioId}}`; тело — **DTO записи**, не дублировать studio в теле, если так в API. |
| Ответ (`booking_status`, `booking_details`, …) | Сверить с ответом `POST .../appointments` в CRM. |

---

## `modify_booking`

| Что поправить | Как |
|----------------|-----|
| Путь | **Без** `studioId` в URL: `POST /nextbot/appointments/{{appointment_id}}/update` + JSON (`startAt`, `prepaymentAmount`, `status`). |
| Отдельные имена `cancel_booking` / `reschedule_booking` | В описании указать: в HTTP это **тот же** `modify_booking` (отмена: `{"status":"CANCELLED"}`). |

---

## `register_new_client` · `process_survey_answers`

| Что поправить | Как |
|----------------|-----|
| `register_new_client` | POST `/nextbot/studios/{{studioId}}/clients/register` — **`studioId`** из сценария после выбора филиала. |
| `process_survey_answers` | Путь с **`clientId`**, не со студией; убедиться, что `clientId` берётся из ответа регистрации/CRM. |

---

## Заглушки 501 (`add_to_waitlist`, оплата, сертификаты, эскалация, `dev_error_report`, …)

| Что поправить | Как |
|----------------|-----|
| Ожидание «полного» ответа CRM | В описании честно: пока эндпоинт возвращает **501 NOT_IMPLEMENTED**, бот не должен обещать результат — либо скрыть функцию в Nextbot до реализации, либо в карточке указать статус заглушки (см. [`NEXTBOT_PARTIAL_AND_MISSING.md`](./NEXTBOT_PARTIAL_AND_MISSING.md)). |

---

## Сводная таблица: что проверить в Nextbot для каждой функции

| Функция | URL содержит `{{studioId}}` | Параметры tool = `{}` или только date/query | Сверить с [`NEXTBOT_XMIND_API.md`](./NEXTBOT_XMIND_API.md) |
|--------|------------------------------|---------------------------------------------|-----------------------------------------------------------|
| `get_company_context` | Нет | Нет | — |
| `verify_client_status` | Да | `q` через переменную | Да |
| `get_services_and_prices` | Да | Да (пусто) | Да |
| `get_active_promotions` | Да | Да | Да |
| `check_loyalty_status` | Да | `q` | Да |
| `get_referral_code` | Да | `q` | Да |
| `check_availability` | Да | `date`, опц. `staffUserId` | Да |
| `create_booking_request` | Да | Тело JSON записи | Да |
| `modify_booking` | Нет (только `appointment_id`) | Тело JSON | Да |

---

После правок пересобери PDF/xmind и при необходимости обнови дублирующие описания в [`NEXTBOT_ENDPOINTS.md`](./NEXTBOT_ENDPOINTS.md) только для согласованности документации.

---

# Приложение: полностью готовые описания для вставки

Ниже — тексты **карточек функций** (xmind / PDF) и блоки **Nextbot** (URL, схема parameters). Подставь **`BASE_URL`** = `https://<твой-хост>` (например Railway).

Заголовок карточки = имя функции в xmind.

---

## `get_company_context`

**Назначение:** получить список студий (филиалов) и контекст для выбора студии. Вызывай в начале сессии или когда нужно обновить список филиалов.

**HTTP (Nextbot Custom API):** `GET {{BASE_URL}}/nextbot/context`  
**Переменные в URL:** нет. **Тело:** нет.

**Схема параметров инструмента (OpenAI / Nextbot):**

```json
{
  "type": "object",
  "properties": {},
  "required": []
}
```

**Ответ (AIDA):** массив объектов студий (поля в т.ч. `id`, `name`, `address`, `timezone`, …). Используй **`id`** выбранной студии как значение сценарной переменной **`studioId`**.

**Текст карточки (вставка):**

```text
get_company_context

НАЗНАЧЕНИЕ
Возвращает JSON со списком студий компании. Этот ответ — единственный источник id филиалов для переменной сценария studioId и для сопоставления слов клиента с полями name / address.

КОГДА ВЫЗЫВАТЬ
В начале диалога или при смене контекста компании.

ИНТЕГРАЦИЯ
GET /nextbot/context. Без studioId в пути.

ПОВЕДЕНИЕ
Перечисляй клиенту филиалы для записи только по данным из этого ответа. Если address null — называй филиал по name.
```

---

## `get_user_id`

**Назначение (только Nextbot):** внутренняя функция платформы, HTTP нет.

**Текст карточки:**

```text
get_user_id

НАЗНАЧЕНИЕ
Получить идентификатор пользователя в канале (телефон, id мессенджера и т.д.).

ПОВЕДЕНИЕ
Сохрани результат в переменную сценария user_contact. Используй её в query-параметре q для verify_client_status, check_loyalty_status, get_referral_code (как настроено в интеграции).
```

---

## `verify_client_status`

**HTTP:** `GET {{BASE_URL}}/nextbot/studios/{{studioId}}/clients/verify?q={{user_contact}}`

**Схема parameters (инструмент без studio в JSON):**

```json
{
  "type": "object",
  "properties": {},
  "required": []
}
```

**Ответ (AIDA):** `{ "found": boolean, "client": <объект профиля | null> }`

**Текст карточки:**

```text
verify_client_status

НАЗНАЧЕНИЕ
Проверить, найден ли клиент в CRM выбранной студии по контакту q.

КОГДА ВЫЗЫВАТЬ
Только после get_company_context и фиксации филиала: в сценарии должна быть записана переменная studioId (реальный id из JSON). Не считай вызов обязательным «самым первым сообщением», если филиал ещё не выбран.

ИНТЕГРАЦИЯ
GET /nextbot/studios/{{studioId}}/clients/verify?q={{user_contact}}
Студия только в URL. Параметры studioId в JSON инструмента не передавать.

ОТВЕТ ПОРТАЛА
- found: true — клиент найден; client — профиль (структура от CRM).
- found: false — клиент не найден; client: null.

ПОВЕДЕНИЕ
Используй фактические ключи JSON. Не опирайся на устаревшие имена полей из старых версий документа, если они не совпадают с ответом.
```

---

## `get_services_and_prices`

**HTTP:** `GET {{BASE_URL}}/nextbot/studios/{{studioId}}/services`

**Схема parameters:**

```json
{
  "type": "object",
  "properties": {},
  "required": []
}
```

**Ответ:** массив услуг из CRM (структура `ServicesService.findAll` / Prisma Service).

**Текст карточки:**

```text
get_services_and_prices

НАЗНАЧЕНИЕ
Вернуть актуальный каталог услуг и цен для выбранной студии.

КОГДА ВЫЗЫВАТЬ
Когда зафиксирован studioId.

ИНТЕГРАЦИЯ
GET /nextbot/studios/{{studioId}}/services
Без передачи studioId в JSON аргументах инструмента.

ОГРАНИЧЕНИЯ
Не выдумывай цены и услуги; используй только данные ответа.
```

---

## `get_active_promotions`

**HTTP:** `GET {{BASE_URL}}/nextbot/studios/{{studioId}}/landing/promotions`

**Схема parameters:** как у get_services_and_prices.

**Текст карточки:**

```text
get_active_promotions

НАЗНАЧЕНИЕ
Вернуть активные акции лендинга для студии.

ИНТЕГРАЦИЯ
GET /nextbot/studios/{{studioId}}/landing/promotions

ОГРАНИЧЕНИЯ
Описывай акции только по данным ответа; не придумывай сроки и условия.
```

---

## `check_loyalty_status`

**HTTP:** `GET {{BASE_URL}}/nextbot/studios/{{studioId}}/clients/loyalty?q={{user_contact}}`

**Схема parameters:** `{}` (q и studio в URL/переменных).

**Ответ (AIDA):**  
`{ found, clientId, level, bonuses, discount, rawClient }` — при `found: false` часть полей `null`.

**Текст карточки:**

```text
check_loyalty_status

НАЗНАЧЕНИЕ
Получить сводку по лояльности клиента для студии.

ИНТЕГРАЦИЯ
GET /nextbot/studios/{{studioId}}/clients/loyalty?q={{user_contact}}

ОТВЕТ ПОРТАЛА (ориентир)
found, clientId, level, bonuses, discount, rawClient. При found: false — клиент не найден по q.

ОГРАНИЧЕНИЯ
Не выдумывай баллы и статусы; не выводи сырой JSON клиенту.
```

---

## `get_referral_code`

**HTTP:** `GET {{BASE_URL}}/nextbot/studios/{{studioId}}/clients/referral?q={{user_contact}}`

**Ответ (AIDA):** `{ found, clientId, referralCode, rawClient }`

**Текст карточки:**

```text
get_referral_code

НАЗНАЧЕНИЕ
Получить реферальный код/данные клиента.

ИНТЕГРАЦИЯ
GET /nextbot/studios/{{studioId}}/clients/referral?q={{user_contact}}

ОТВЕТ ПОРТАЛА (ориентир)
found, clientId, referralCode, rawClient.

ОГРАНИЧЕНИЯ
Не выдумывай коды и суммы бонусов.
```

---

## `check_availability`

**HTTP:** `GET {{BASE_URL}}/nextbot/studios/{{studioId}}/availability-raw?date=YYYY-MM-DD&staffUserId=`

`staffUserId` опционален (можно пустым).

**Схема parameters (передавать в tool только то, что реально нужно модели):**

```json
{
  "type": "object",
  "properties": {
    "date": {
      "type": "string",
      "description": "Дата в формате YYYY-MM-DD (часовой пояс — согласовать с студией)"
    },
    "staffUserId": {
      "type": "string",
      "description": "Опционально: id мастера; можно пустая строка"
    }
  },
  "required": ["date"]
}
```

**Ответ (AIDA):** `{ scheduleDays, busySlots, appointments, staffUserIdHint }` — сырые данные расписания; **нет** полей is_available / available_slots в таком виде — интерпретация слотов — на стороне агента или фронта.

**Текст карточки:**

```text
check_availability

НАЗНАЧЕНИЕ
Получить сырые данные расписания, занятости и записей на дату для студии (для предложения окон клиенту).

КОГДА ВЫЗЫВАТЬ
Когда зафиксированы studioId, услуга (логически) и дата date.

ИНТЕГРАЦИЯ
GET /nextbot/studios/{{studioId}}/availability-raw?date=<YYYY-MM-DD>&staffUserId=<опционально>

ОТВЕТ ПОРТАЛА
Объект с полями scheduleDays, busySlots, appointments, staffUserIdHint. Не ожидай полей «is_available / тетрис», если их нет в JSON — ориентируйся на фактическую структуру.

ОГРАНИЧЕНИЯ
Не выдумывай свободные окна; выводи клиенту только на основе данных ответа.
```

---

## `create_booking_request`

**HTTP:** `POST {{BASE_URL}}/nextbot/studios/{{studioId}}/appointments`  
**Тело (JSON):**

```json
{
  "staffUserId": "usr_...",
  "clientId": "cli_...",
  "serviceId": "srv_...",
  "startAt": "2026-03-22T14:00:00+06:00",
  "prepaymentAmount": 0
}
```

`prepaymentAmount` опционально.

**Схема parameters инструмента (если тело передаётся как аргументы — упрости под Nextbot):**

```json
{
  "type": "object",
  "properties": {
    "staffUserId": { "type": "string" },
    "clientId": { "type": "string" },
    "serviceId": { "type": "string" },
    "startAt": { "type": "string", "description": "ISO 8601 с часовым поясом" },
    "prepaymentAmount": { "type": "integer", "minimum": 0 }
  },
  "required": ["staffUserId", "clientId", "serviceId", "startAt"]
}
```

**Текст карточки:**

```text
create_booking_request

НАЗНАЧЕНИЕ
Создать запись (appointment) в CRM.

КОГДА ВЫЗЫВАТЬ
После явного согласия клиента на конкретное время и при известных staffUserId, clientId, serviceId, startAt.

ИНТЕГРАЦИЯ
POST /nextbot/studios/{{studioId}}/appointments
Тело: staffUserId, clientId, serviceId, startAt (ISO 8601 с offset), опционально prepaymentAmount.
studioId только в URL, не дублировать в теле как отдельное поле студии.

ОГРАНИЧЕНИЯ
Не выдумывай id сотрудника, клиента и услуги — бери из CRM / предыдущих ответов.
```

---

## `modify_booking`

**HTTP:** `POST {{BASE_URL}}/nextbot/appointments/{{appointment_id}}/update`  
**Тело (примеры):**

```json
{ "startAt": "2026-03-22T15:00:00+06:00" }
```

```json
{ "status": "CANCELLED" }
```

```json
{ "prepaymentAmount": 1000 }
```

**Схема parameters:**

```json
{
  "type": "object",
  "properties": {
    "startAt": { "type": "string" },
    "prepaymentAmount": { "type": "integer", "minimum": 0 },
    "status": { "type": "string", "enum": ["BOOKED", "CANCELLED", "ARRIVED", "DONE"] }
  },
  "required": []
}
```

(Фактический enum AIDA: `BOOKED` | `CANCELLED` | `ARRIVED` | `DONE`.)

**Текст карточки:**

```text
modify_booking

НАЗНАЧЕНИЕ
Изменить запись: перенос (startAt), предоплата (prepaymentAmount), отмена (status: CANCELLED) и др.

ИНТЕГРАЦИЯ
POST /nextbot/appointments/{{appointment_id}}/update
В пути нет studioId — только id записи appointment_id.

СВЯЗЬ С XMIND
Отмена и перенос в HTTP не разделены: всё через этот эндпоинт. Отмена: тело {"status":"CANCELLED"} после согласия клиента.

ОГРАНИЧЕНИЯ
Не выдумывай appointment_id — из CRM или списка записей.
```

---

## `register_new_client`

**HTTP:** `POST {{BASE_URL}}/nextbot/studios/{{studioId}}/clients/register`  
**Тело (пример `CreateClientDto`):**

```json
{
  "firstName": "Айгуль",
  "lastName": "Нурланова",
  "phone": "+77001234567",
  "birthDate": "1995-03-15",
  "notes": "источник: Nextbot"
}
```

**Текст карточки:**

```text
register_new_client

НАЗНАЧЕНИЕ
Зарегистрировать нового клиента в выбранной студии.

ИНТЕГРАЦИЯ
POST /nextbot/studios/{{studioId}}/clients/register
Тело (обязательно): firstName, phone. Опционально: lastName, birthDate (YYYY-MM-DD), notes, bonuses, discount, balance.

КОГДА
После сбора данных онбординга по сценарию.

studioId только в URL ({{studioId}}). В теле отдельное поле studioId не требуется.
```

---

## `process_survey_answers`

**HTTP:** `POST {{BASE_URL}}/nextbot/clients/{{clientId}}/survey`  
**Тело:**

```json
{
  "answers": { "q1": "...", "q2": "..." },
  "mergeIntoNotes": true,
  "surveyPrefix": "[NEXTBOT_SURVEY]"
}
```

**Схема parameters:**

```json
{
  "type": "object",
  "properties": {
    "answers": { "type": "object", "additionalProperties": true },
    "mergeIntoNotes": { "type": "boolean" },
    "surveyPrefix": { "type": "string" }
  },
  "required": ["answers"]
}
```

**Текст карточки:**

```text
process_survey_answers

НАЗНАЧЕНИЕ
Сохранить ответы анкеты в профиль клиента (в notes блоком с префиксом).

ИНТЕГРАЦИЯ
POST /nextbot/clients/{{clientId}}/survey
Тело: answers (объект), опционально mergeIntoNotes, surveyPrefix.

clientId в пути — из ответа регистрации или CRM, не путать со studioId.
```

---

## `process_survey_answers_failed` и прочие заглушки 501

**Текст-заглушка (универсальный блок для всех):**

```text
<имя_функции>

СТАТУС РЕАЛИЗАЦИИ
На стороне AIDA эндпоинт зарезервирован, ответ 501 NOT_IMPLEMENTED. Не обещай клиенту выполнение операции, пока бэкенд не реализован. В Nextbot лучше отключить вызов или показывать заглушку «функция в разработке».

Список заглушек: process_survey_answers_failed, add_to_waitlist, request_manager_invoice, generate_payment_link, verify_receipt_nighttime, purchase_certificate, validate_certificate_code, create_escalation_ticket, dev_error_report.
```

---

## `resolve_studio` — не использовать

**Текст для удаления из xmind:**

```text
Функция resolve_studio в API AIDA отсутствует. Не создавать HTTP-запросы к /nextbot/studios/resolve. Филиал определяется через get_company_context и переменную studioId.
```

---

## Сводка: JSON-схемы одной строкой

| Функция | parameters |
|---------|------------|
| `get_company_context` | `{}` |
| `verify_client_status` | `{}` |
| `get_services_and_prices` | `{}` |
| `get_active_promotions` | `{}` |
| `check_loyalty_status` | `{}` |
| `get_referral_code` | `{}` |
| `check_availability` | `date` (+ опц. `staffUserId`) |
| `create_booking_request` | тело записи (см. выше) |
| `modify_booking` | `startAt` / `prepaymentAmount` / `status` |
| `process_survey_answers` | `answers` + опции |
