# Справочник `args` и `result` для функций Nextbot (`nextbot/xmind_python`)

Этот файл описывает, что принимает каждая Python-функция из `nextbot/xmind_python` и что именно она возвращает в `result`.

## Что означает `[]` в названиях полей

- `data[]` — это массив, где каждый элемент является объектом одного типа.
- `data[].id` — поле `id` у каждого элемента массива `data`.
- То же самое можно читать как `data[0].id`, `data[1].id`, `data[2].id` и т.д.
- `freeSlots[].startAt` — поле `startAt` у каждого объекта в массиве `freeSlots`.

Пример:

```json
{
  "data": [
    { "id": "studio_1", "name": "AIDA Центр" },
    { "id": "studio_2", "name": "AIDA Юг" }
  ],
  "freeSlots": [
    { "staffUserId": "u1", "startAt": "2026-03-21T10:00:00.000Z" }
  ]
}
```

## Единый формат `result` (у всех скриптов)

```python
result = {
  "ok": bool,
  "status": int,
  "data": object | list | str
}
```

Расшифровка полей:
- `ok` — признак успешного HTTP-вызова (`True`, если статус 2xx).
- `status` — HTTP-код ответа backend (`200`, `201`, `400`, `404`, `501` и т.д.).
- `data` — полезная нагрузка:
  - при успехе обычно JSON-объект или JSON-массив;
  - при ошибке может быть строка с текстом ошибки.

## Базовые `args` (используются почти везде)

- `base_url` — базовый URL backend (например `https://demo-studio-production.up.railway.app`).
- `api_key` — ключ API для заголовка `X-API-Key`.
- `studio_id` — идентификатор студии; берется из `get_company_context` (`data[].id`).

---

## 1) `get_company_context.py`

### Args
- `base_url` — адрес backend.
- `api_key` — ключ API.

### `result.data` (что означает)
- `data` — массив студий.
- `data[].id` — id студии (дальше подставляется как `studio_id`).
- `data[].name` — название студии.
- `data[].address` — адрес студии (может быть `null`).
- `data[].timezone` — часовой пояс студии (например `Asia/Almaty`).
- `data[].globalBonusPaymentLimitPercent` — лимит оплаты бонусами в процентах.
- `data[].createdAt` — дата/время создания студии.
- `data[].updatedAt` — дата/время последнего изменения студии.

---

## 2) `verify_client_status.py`

### Args
- `base_url` — адрес backend.
- `api_key` — ключ API.
- `studio_id` — в какой студии искать клиента.
- `q` — поисковый запрос (телефон, имя, фрагмент данных клиента).

### `result.data` (что означает)
- `found` — найден ли клиент (`true`/`false`).
- `client` — объект клиента, если найден; иначе `null`.
- `client.id` — id клиента.
- `client.firstName` — имя клиента.
- `client.lastName` — фамилия клиента (может быть `null`).
- `client.phone` — телефон клиента.
- `client.birthDate` — дата рождения (может быть `null`).
- `client.notes` — заметки по клиенту.
- `client.level` — уровень лояльности (`BRONZE`/`SILVER`/`GOLD`/`DIAMOND`).
- `client.bonuses` — бонусный баланс.
- `client.discount` — персональная скидка.
- `client.balance` — денежный баланс (историческое поле).
- `client.referralCode` — реферальный код клиента.
- `client.referredCount` — сколько клиентов пришло по коду этого клиента.
- `client.referredList` — список приглашенных клиентов (если есть).
- `client.cashbackPercent` — кэшбэк-процент по текущему уровню.
- `client.levelProgress` — прогресс до следующего уровня.

---

## 3) `register_new_client.py`

### Args
- `base_url` — адрес backend.
- `api_key` — ключ API.
- `studio_id` — студия, куда создается клиент.
- `payload_json` — готовый JSON для тела запроса (если передан, остальные поля можно не передавать).
- `first_name` — имя клиента.
- `phone` — телефон клиента.
- `last_name` — фамилия клиента (опционально).
- `birth_date` — дата рождения `YYYY-MM-DD` (опционально).
- `notes` — заметка по клиенту (опционально).
- `bonuses` — стартовые бонусы (опционально).
- `discount` — стартовая скидка в процентах/единицах модели (опционально).
- `balance` — стартовый баланс клиента (опционально).

### `result.data` (что означает)
- `data` — созданный объект клиента.
- Обычно приходит HTTP `201`.

---

## 4) `process_survey_answers.py`

### Args
- `base_url` — адрес backend.
- `api_key` — ключ API.
- `client_id` — id клиента, в которого пишется анкета.
- `answers_json` — JSON-строка с ответами анкеты.
- `merge_into_notes` — объединять с текущими `notes` (`true`) или перезаписать блок анкеты (`false`).
- `survey_prefix` — префикс/маркер блока анкеты в `notes` (по умолчанию `[NEXTBOT_SURVEY]`).

### `result.data` (что означает)
- `data` — обновленный объект клиента после записи анкеты.

---

## 5) `get_services_and_prices.py`

### Args
- `base_url` — адрес backend.
- `api_key` — ключ API.
- `studio_id` — студия, по которой грузятся услуги.

### `result.data` (что означает)
- `data` — массив услуг студии.
- `data[].id` — id услуги.
- `data[].name` — название услуги.
- `data[].defaultPrice` — базовая цена услуги.
- `data[].durationMinutes` — длительность услуги в минутах.
- `data[].isActive` — активна ли услуга.
- `data[].createdAt` — дата/время создания услуги.
- `data[].updatedAt` — дата/время изменения услуги.

---

## 6) `get_active_promotions.py`

### Args
- `base_url` — адрес backend.
- `api_key` — ключ API.
- `studio_id` — студия, по которой грузятся акции.

### `result.data` (что означает)
- `data` — массив активных промо-акций.
- `data[].id` — id промо.
- `data[].title` — заголовок акции.
- `data[].description` — описание акции.
- `data[].isActive` — активна ли акция.
- `data[].createdAt` — дата/время создания акции.
- `data[].updatedAt` — дата/время изменения акции.

---

## 7) `check_loyalty_status.py`

### Args
- `base_url` — адрес backend.
- `api_key` — ключ API.
- `studio_id` — студия, где проверяется лояльность.
- `q` — поисковый запрос клиента.

### `result.data` (что означает)
- `found` — найден ли клиент.
- `clientId` — id найденного клиента (или `null`).
- `level` — уровень лояльности клиента.
- `bonuses` — текущие бонусы клиента.
- `discount` — текущая скидка клиента.
- `rawClient` — полный объект клиента из CRM. Обычно содержит:
  - `rawClient.id` — id клиента.
  - `rawClient.firstName` — имя.
  - `rawClient.lastName` — фамилия.
  - `rawClient.phone` — телефон.
  - `rawClient.notes` — заметки.
  - `rawClient.birthDate` — дата рождения.
  - `rawClient.level` — уровень лояльности.
  - `rawClient.bonuses` — бонусы.
  - `rawClient.discount` — скидка.
  - `rawClient.balance` — баланс.
  - `rawClient.referralCode` — реферальный код.
  - `rawClient.referredCount` — число приглашенных.
  - `rawClient.referredList` — список приглашенных.
  - `rawClient.cashbackPercent` — процент кэшбэка.
  - `rawClient.levelProgress` — прогресс уровня.

---

## 8) `get_referral_code.py`

### Args
- `base_url` — адрес backend.
- `api_key` — ключ API.
- `studio_id` — студия, где искать клиента.
- `q` — поисковый запрос клиента.

### `result.data` (что означает)
- `found` — найден ли клиент.
- `clientId` — id клиента (или `null`).
- `referralCode` — реферальный код клиента.
- `rawClient` — полный объект клиента из CRM (те же поля, что описаны выше в `check_loyalty_status`).

---

## 9) `check_availability.py` (главное)

### Args
- `base_url` — адрес backend.
- `api_key` — ключ API.
- `studio_id` — студия, в которой проверяется расписание.
- `date` — дата проверки в формате `YYYY-MM-DD` (обязательно).
- `staff_user_id` — id конкретного мастера для фильтра (опционально).
- `service_id` — id услуги; если передан, длительность/ограничения берутся из услуги.
- `duration_minutes` — длительность слота в минутах (используется, когда `service_id` не передан).
- `slot_step_minutes` — шаг перебора времени в минутах (обычно `15`, допустимо `5..120`).

### `result.data` (что означает)
- `date` — дата, по которой считалась доступность.
- `studioId` — id студии, для которой считалась доступность.
- `durationMinutes` — итоговая длительность одного слота (в минутах), которую использовал backend.
- `slotStepMinutes` — шаг сетки (в минутах), с которым генерировались слоты.
- `freeSlots` — массив только свободных окон.
- `freeSlots[].staffUserId` — id мастера, у которого найдено окно.
- `freeSlots[].staffName` — отображаемое имя мастера.
- `freeSlots[].startAt` — начало свободного окна в ISO datetime.
- `freeSlots[].endAt` — конец свободного окна в ISO datetime.
- `check_availability` — готовый текст-промпт для LLM/бота по найденным свободным окнам.

Пример формы ответа:

```json
{
  "date": "2026-03-21",
  "studioId": "cm123...",
  "durationMinutes": 60,
  "slotStepMinutes": 15,
  "freeSlots": [
    {
      "staffUserId": "cmStaff1",
      "staffName": "Анна",
      "startAt": "2026-03-21T10:00:00.000Z",
      "endAt": "2026-03-21T11:00:00.000Z"
    }
  ],
  "check_availability": "..."
}
```

---

## 10) `create_booking_request.py`

### Args
- `base_url` — адрес backend.
- `api_key` — ключ API.
- `studio_id` — студия, в которой создается запись.
- `payload_json` — готовый JSON тела (если передан, можно не передавать отдельные поля ниже).
- `staff_user_id` — id мастера, к которому создается запись.
- `client_id` — id клиента.
- `service_id` — id выбранной услуги.
- `start_at` — дата/время начала в ISO 8601.
- `prepayment_amount` — сумма предоплаты.

### `result.data` (что означает)
- `data` — созданная запись (appointment).
- `data.id` — id записи.
- `data.studioId` — id студии.
- `data.staffUserId` — id мастера.
- `data.clientId` — id клиента.
- `data.serviceId` — id услуги.
- `data.startAt` — время начала (ISO datetime).
- `data.endAt` — время окончания (ISO datetime).
- `data.status` — статус записи (`BOOKED`, `ARRIVED`, `DONE`, `CANCELLED`, и т.д.).
- `data.prepaymentAmount` — сумма предоплаты (может быть `null`).
- `data.forfeitedPrepaymentAmount` — сгоревшая предоплата (может быть `null`).
- `data.completedBonusesUsed` — сколько бонусов списано при `DONE`.
- `data.completedMoneyPaid` — сколько денег оплачено при `DONE`.
- `data.arrivedAt` — время отметки прихода (может быть `null`).
- `data.arrivedByUserId` — кто отметил приход (может быть `null`).
- `data.createdAt` — дата/время создания записи.
- `data.updatedAt` — дата/время изменения записи.
- Обычно приходит HTTP `201`.

---

## 11) `modify_booking.py`

### Args
- `base_url` — адрес backend.
- `api_key` — ключ API.
- `appointment_id` — id записи, которую нужно изменить.
- `patch_json` — JSON-строка с изменениями.
- `patch_json.startAt` — новое время начала записи (перенос).
- `patch_json.prepaymentAmount` — новая сумма предоплаты.
- `patch_json.status` — новый статус записи (`CANCELLED` для отмены).

### `result.data` (что означает)
- `data` — обновленный объект записи.
- `data.id` — id записи.
- `data.studioId` — id студии.
- `data.staffUserId` — id мастера.
- `data.clientId` — id клиента.
- `data.serviceId` — id услуги.
- `data.startAt` — текущее время начала.
- `data.endAt` — текущее время окончания.
- `data.status` — текущий статус записи.
- `data.prepaymentAmount` — текущая предоплата.
- `data.forfeitedPrepaymentAmount` — сгоревшая предоплата (если есть).
- `data.completedBonusesUsed` — списанные бонусы при завершении.
- `data.completedMoneyPaid` — оплаченные деньги при завершении.
- `data.arrivedAt` — время прихода (если отмечен).
- `data.arrivedByUserId` — пользователь, отметивший приход.
- `data.createdAt` — дата/время создания записи.
- `data.updatedAt` — дата/время последнего изменения записи.

Связанные обертки:
- `cancel_booking.py`
  - args: `base_url`, `api_key`, `appointment_id`
  - отправляет фиксированно: `{"status":"CANCELLED"}`
- `reschedule_booking.py`
  - args: `base_url`, `api_key`, `appointment_id`, `start_at`
  - отправляет: `{"startAt":"<значение start_at>"}`.

---

## 12) Заглушки `501 NOT_IMPLEMENTED`

Скрипты:
- `process_survey_answers_failed.py`
- `add_to_waitlist.py`
- `request_manager_invoice.py`
- `generate_payment_link.py`
- `verify_receipt_nighttime.py`
- `purchase_certificate.py`
- `validate_certificate_code.py`
- `create_escalation_ticket.py`
- `dev_error_report.py`

### Args
- `base_url` — адрес backend.
- `api_key` — ключ API.
- `client_id` — только для `process_survey_answers_failed.py` (id клиента).
- `body_json` — опциональный JSON для тела запроса (для большинства заглушек).

### `result.data` (что означает)
Обычно объект:
- `function` — имя функции из xmind, для которой вызвана заглушка.
- `code` — машинный код ошибки (`NOT_IMPLEMENTED`).
- `message` — человекочитаемое объяснение, что логика еще не реализована.

```json
{
  "function": "xmind_function_name",
  "code": "NOT_IMPLEMENTED",
  "message": "Эндпоинт зарезервирован..."
}
```
