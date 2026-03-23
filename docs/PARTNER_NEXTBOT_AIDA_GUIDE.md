# Руководство для партнёра: подключение Nextbot к салону (AIDA)

**Для кого этот документ.** Вы настраиваете бота в **Nextbot**: сценарии, функции, промпты. **Писать код бэкенда и разбираться в сервере не нужно** — используйте готовые скрипты из папки **`nextbot/xmind_python/`** (по одному файлу на функцию).

**Что вы настраиваете.** Бот обращается к **порталу салона (AIDA)** за филиалами, услугами, слотами, записями и клиентами. Ниже — **что передавать в параметрах** и **как выглядит ответ**; значения в примерах условные — подставьте реальные с вашего стенда.

**Документ Nextbot про Python:** [Python Script в Nextbot](https://doc.nextbot.ru/functional/functions/sending-result/python).

---

## 1. Термины простыми словами

| Термин | Что это для вас |
|--------|------------------|
| **Функция (инструмент)** | Действие, которое бот вызывает, чтобы получить данные или выполнить действие в системе салона. |
| **`args`** | Входные параметры скрипта (в Nextbot — «параметры функции» / тестовые аргументы). Имена **как в примерах**: `base_url`, `studio_id`, не `baseUrl`. |
| **`result`** | Ответ скрипта: обычно `ok`, `status` (код HTTP), `data` (данные или текст ошибки). |
| **`base_url`** | Адрес сервера **без** `/nextbot`. Пример: `https://salon-demo.up.railway.app` |
| **`api_key`** | Секрет для заголовка `X-API-Key` (хранить скрыто). |
| **`studio_id`** | Внутренний id филиала из ответа **`get_company_context`** (поле `id` у студии). **Не выдумывать.** |

---

## 2. Главная логика: сначала филиал, потом всё остальное

1. Вызвать **`get_company_context`** — список филиалов с `id`, `name`, `address`.  
2. Сохранить выбранный **`id`** в переменную сценария (часто её называют `studio_id`).  
3. Во всех функциях, где в примере ниже есть `studio_id`, подставлять это значение.

**Один филиал** — один раз записали `id` после контекста. **Несколько** — выбор по диалогу/кнопкам, id только из последнего ответа контекста. Подробнее: **`docs/NEXTBOT_STUDIO_ID_PYTHON_ALGORITHM.md`**.

---

## 3. Шпаргалка по параметрам (`args`)

| Параметр | Когда нужен |
|-----------|-------------|
| `base_url` | Почти всегда |
| `api_key` | Почти всегда |
| `studio_id` | Если в примере функции он указан — всегда реальный id филиала |

Остальные ключи — по таблице в разделе 5.

---

## 4. Как читать ответ

```json
{
  "ok": true,
  "status": 200,
  "data": { }
}
```

- **`ok`** — успешный HTTP-ответ сервера.  
- **`status`** — код (200, 201 — ок; 400, 401, 501 — разбирать с заказчиком).  
- **`data`** — полезная нагрузка (массив, объект) или при ошибке часто строка с текстом от сервера.

**Промпт:** не выводить клиенту сырой JSON; услуги и цены — только из актуального `data` прайса.

---

## 5. Справочник функций: назначение, параметры, примеры

Скрипт для каждой функции: **`nextbot/xmind_python/<имя_функции>.py`**.  
**Не добавляйте** `import json` в редактор Nextbot — в поставочных файлах это уже учтено.

---

### 5.1. `get_company_context`

| | |
|---|---|
| **Зачем** | Список филиалов и их внутренние `id`. |
| **Параметры** | `base_url`, `api_key`. |

**Пример `args` (тестовые аргументы):**

```json
{
  "base_url": "https://salon-demo.up.railway.app",
  "api_key": "nb_xxxxxxxxxxxxxxxx"
}
```

**Пример `result` (успех, фрагмент):**

```json
{
  "ok": true,
  "status": 200,
  "data": [
    {
      "id": "stu_01HZDEMO0001",
      "name": "Филиал Алатау",
      "address": "г. Алматы, ул. Пример, 1"
    }
  ]
}
```

*Дальше в сценарии сохраняете, например, `stu_01HZDEMO0001` как `studio_id`.*

---

### 5.2. `verify_client_status`

| | |
|---|---|
| **Зачем** | Найти клиента по телефону/строке поиска. |
| **Параметры** | `base_url`, `api_key`, `studio_id`, `q`. |

**Пример `args`:**

```json
{
  "base_url": "https://salon-demo.up.railway.app",
  "api_key": "nb_xxxxxxxxxxxxxxxx",
  "studio_id": "stu_01HZDEMO0001",
  "q": "+77001234567"
}
```

**Пример `result` (клиент найден):**

```json
{
  "ok": true,
  "status": 200,
  "data": {
    "found": true,
    "client": {
      "id": "cli_01HZDEMOCLIENT",
      "firstName": "Айгуль",
      "phone": "+77001234567",
      "bonuses": 150
    }
  }
}
```

**Пример `result` (не найден):**

```json
{
  "ok": true,
  "status": 200,
  "data": { "found": false, "client": null }
}
```

---

### 5.3. `register_new_client`

| | |
|---|---|
| **Зачем** | Создать клиента в филиале. |
| **Параметры** | `base_url`, `api_key`, `studio_id` + **либо** отдельные поля, **либо** одна строка `payload_json`. |

**Пример `args` (отдельные поля):**

```json
{
  "base_url": "https://salon-demo.up.railway.app",
  "api_key": "nb_xxxxxxxxxxxxxxxx",
  "studio_id": "stu_01HZDEMO0001",
  "first_name": "Мария",
  "phone": "+77007654321",
  "last_name": "Иванова",
  "birth_date": "1992-03-15",
  "notes": "Источник: WhatsApp бот"
}
```

**Пример `args` (одной строкой тело API — `payload_json`):**

```json
{
  "base_url": "https://salon-demo.up.railway.app",
  "api_key": "nb_xxxxxxxxxxxxxxxx",
  "studio_id": "stu_01HZDEMO0001",
  "payload_json": "{\"firstName\":\"Мария\",\"phone\":\"+77007654321\",\"lastName\":\"Иванова\"}"
}
```

**Пример `result` (успех):**

```json
{
  "ok": true,
  "status": 201,
  "data": {
    "id": "cli_01HZNEWCLIENT01",
    "firstName": "Мария",
    "phone": "+77007654321"
  }
}
```

---

### 5.4. `process_survey_answers`

| | |
|---|---|
| **Зачем** | Записать ответы анкеты в карточку клиента. |
| **Параметры** | `base_url`, `api_key`, `client_id`, `answers_json` (строка JSON); опционально `merge_into_notes`, `survey_prefix`. |

**Пример `args`:**

```json
{
  "base_url": "https://salon-demo.up.railway.app",
  "api_key": "nb_xxxxxxxxxxxxxxxx",
  "client_id": "cli_01HZDEMOCLIENT",
  "answers_json": "{\"кожа\":\"чувствительная\",\"боль\":\"низкая\"}",
  "merge_into_notes": true,
  "survey_prefix": "[NEXTBOT_SURVEY]"
}
```

**Пример `result`:**

```json
{
  "ok": true,
  "status": 200,
  "data": {
    "id": "cli_01HZDEMOCLIENT",
    "notes": "… [NEXTBOT_SURVEY] {\"кожа\":\"чувствительная\"…}"
  }
}
```

---

### 5.5. `get_services_and_prices`

| | |
|---|---|
| **Зачем** | Прайс и услуги выбранного филиала. |
| **Параметры** | `base_url`, `api_key`, `studio_id`. |

**Пример `args`:**

```json
{
  "base_url": "https://salon-demo.up.railway.app",
  "api_key": "nb_xxxxxxxxxxxxxxxx",
  "studio_id": "stu_01HZDEMO0001"
}
```

**Пример `result` (фрагмент `data`):**

```json
{
  "ok": true,
  "status": 200,
  "data": [
    {
      "id": "srv_legs_full",
      "name": "Ноги полностью",
      "price": 12000,
      "durationMin": 60
    }
  ]
}
```

*Реальные поля зависят от CRM салона.*

---

### 5.6. `get_active_promotions`

| | |
|---|---|
| **Зачем** | Акции филиала. |
| **Параметры** | `base_url`, `api_key`, `studio_id`. |

**Пример `args`:** — как у `get_services_and_prices` (те же три ключа).

**Пример `result` (фрагмент):**

```json
{
  "ok": true,
  "status": 200,
  "data": [
    {
      "title": "-15% на первый визит",
      "validUntil": "2025-04-01"
    }
  ]
}
```

---

### 5.7. `check_loyalty_status`

| | |
|---|---|
| **Зачем** | Бонусы / скидка по клиенту. |
| **Параметры** | `base_url`, `api_key`, `studio_id`, `q`. |

**Пример `args`:**

```json
{
  "base_url": "https://salon-demo.up.railway.app",
  "api_key": "nb_xxxxxxxxxxxxxxxx",
  "studio_id": "stu_01HZDEMO0001",
  "q": "+77001234567"
}
```

**Пример `result`:**

```json
{
  "ok": true,
  "status": 200,
  "data": {
    "found": true,
    "clientId": "cli_01HZDEMOCLIENT",
    "level": "Gold",
    "bonuses": 150,
    "discount": 10,
    "rawClient": { }
  }
}
```

---

### 5.8. `get_referral_code`

| | |
|---|---|
| **Зачем** | Реферальный код клиента. |
| **Параметры** | `base_url`, `api_key`, `studio_id`, `q`. |

**Пример `args`:** — как у `check_loyalty_status`.

**Пример `result`:**

```json
{
  "ok": true,
  "status": 200,
  "data": {
    "found": true,
    "clientId": "cli_01HZDEMOCLIENT",
    "referralCode": "SUGAR-AYGUL-01",
    "rawClient": { }
  }
}
```

---

### 5.9. `check_availability`

| | |
|---|---|
| **Зачем** | Только **свободные слоты** на дату + текст промпта для ИИ в поле **`check_availability`**. |
| **Параметры** | `base_url`, `api_key`, `studio_id`, `date` (YYYY-MM-DD); опционально `staff_user_id`, **`service_id`** (длительность из услуги), **`duration_minutes`** (если нет услуги, по умолчанию 60), **`slot_step_minutes`** (шаг сетки, по умолчанию 15). |

**Пример `args`:**

```json
{
  "base_url": "https://salon-demo.up.railway.app",
  "api_key": "nb_xxxxxxxxxxxxxxxx",
  "studio_id": "stu_01HZDEMO0001",
  "date": "2025-03-25",
  "staff_user_id": "usr_master_aliya",
  "service_id": "srv_legs_full",
  "slot_step_minutes": 15
}
```

**Пример `result`:**

```json
{
  "ok": true,
  "status": 200,
  "data": {
    "date": "2025-03-25",
    "studioId": "stu_01HZDEMO0001",
    "durationMinutes": 60,
    "slotStepMinutes": 15,
    "freeSlots": [
      {
        "staffUserId": "usr_master_aliya",
        "staffName": "Алия Нурлан",
        "startAt": "2025-03-25T04:00:00.000Z",
        "endAt": "2025-03-25T05:00:00.000Z"
      }
    ],
    "check_availability": "Используй только массив freeSlots…"
  }
}
```

*Поле `check_availability` — готовая инструкция для модели: опираться только на `freeSlots`.*

---

### 5.10. `create_booking_request`

| | |
|---|---|
| **Зачем** | Создать запись. |
| **Параметры** | `base_url`, `api_key`, `studio_id` + **либо** `payload_json`, **либо** поля ниже. |

**Пример `args` (отдельные поля):**

```json
{
  "base_url": "https://salon-demo.up.railway.app",
  "api_key": "nb_xxxxxxxxxxxxxxxx",
  "studio_id": "stu_01HZDEMO0001",
  "staff_user_id": "usr_master_aliya",
  "client_id": "cli_01HZDEMOCLIENT",
  "service_id": "srv_legs_full",
  "start_at": "2025-03-25T14:00:00+05:00",
  "prepayment_amount": 0
}
```

**Пример `payload_json` (строка):**

```json
{
  "base_url": "https://salon-demo.up.railway.app",
  "api_key": "nb_xxxxxxxxxxxxxxxx",
  "studio_id": "stu_01HZDEMO0001",
  "payload_json": "{\"staffUserId\":\"usr_master_aliya\",\"clientId\":\"cli_01HZDEMOCLIENT\",\"serviceId\":\"srv_legs_full\",\"startAt\":\"2025-03-25T14:00:00+05:00\"}"
}
```

**Пример `result`:**

```json
{
  "ok": true,
  "status": 201,
  "data": {
    "id": "appt_01HZBOOKING01",
    "startAt": "2025-03-25T09:00:00.000Z",
    "clientId": "cli_01HZDEMOCLIENT",
    "serviceId": "srv_legs_full"
  }
}
```

---

### 5.11. `modify_booking`

| | |
|---|---|
| **Зачем** | Перенос, отмена, смена предоплаты/статуса. |
| **Параметры** | `base_url`, `api_key`, `appointment_id`, `patch_json` (строка JSON). |

**Пример `args` (отмена):**

```json
{
  "base_url": "https://salon-demo.up.railway.app",
  "api_key": "nb_xxxxxxxxxxxxxxxx",
  "appointment_id": "appt_01HZBOOKING01",
  "patch_json": "{\"status\":\"CANCELLED\"}"
}
```

**Пример `args` (перенос времени):**

```json
{
  "base_url": "https://salon-demo.up.railway.app",
  "api_key": "nb_xxxxxxxxxxxxxxxx",
  "appointment_id": "appt_01HZBOOKING01",
  "patch_json": "{\"startAt\":\"2025-03-26T10:00:00+05:00\"}"
}
```

**Пример `result`:**

```json
{
  "ok": true,
  "status": 200,
  "data": {
    "id": "appt_01HZBOOKING01",
    "status": "CANCELLED"
  }
}
```

---

### 5.12. `cancel_booking` (скрипт-обёртка)

Те же `base_url`, `api_key`, плюс **`appointment_id`**. Тело запроса к API фиксировано: отмена.

**Пример `args`:**

```json
{
  "base_url": "https://salon-demo.up.railway.app",
  "api_key": "nb_xxxxxxxxxxxxxxxx",
  "appointment_id": "appt_01HZBOOKING01"
}
```

---

### 5.13. `reschedule_booking` (скрипт-обёртка)

**Пример `args`:**

```json
{
  "base_url": "https://salon-demo.up.railway.app",
  "api_key": "nb_xxxxxxxxxxxxxxxx",
  "appointment_id": "appt_01HZBOOKING01",
  "start_at": "2025-03-26T11:00:00+05:00"
}
```

---

## 6. Заглушки (ответ 501)

Функции: `process_survey_answers_failed`, `add_to_waitlist`, `request_manager_invoice`, `generate_payment_link`, `verify_receipt_nighttime`, `purchase_certificate`, `validate_certificate_code`, `create_escalation_ticket`, `dev_error_report`.

**Пример `args` для `add_to_waitlist`:**

```json
{
  "base_url": "https://salon-demo.up.railway.app",
  "api_key": "nb_xxxxxxxxxxxxxxxx",
  "body_json": "{\"phone\":\"+77001234567\",\"serviceId\":\"srv_legs_full\"}"
}
```

**Пример `result` при 501:**

```json
{
  "ok": false,
  "status": 501,
  "data": {
    "function": "add_to_waitlist",
    "code": "NOT_IMPLEMENTED",
    "message": "Эндпоинт зарезервирован под сценарий xmind; логика в backend ещё не реализована."
  }
}
```

*Для `process_survey_answers_failed` добавьте `client_id`; `body_json` везде опционален.*

---

## 7. Частые проблемы

| Симптом | Что проверить |
|---------|----------------|
| 400 на URL с филиалом | В `studio_id` реальный id, не шаблон `{{studioId}}` и не пусто. |
| 401 | `api_key`. |
| Предупреждение про импорты | Нет строки `import json` в скрипте. |
| `base_url` | Без суффикса `/nextbot`. |

---

## 8. Где лежат материалы в проекте

| Путь | Назначение |
|------|------------|
| `nextbot/xmind_python/*.py` | Готовые скрипты |
| `docs/NEXTBOT_FUNCTIONS_REFERENCE.md` | Техническая сводка HTTP + `args` |
| `docs/NEXTBOT_STUDIO_ID_PYTHON_ALGORITHM.md` | Динамический филиал |
| `docs/PARTNER_NEXTBOT_AIDA_GUIDE.pdf` | PDF этой инструкции |

---

## 9. Сборка PDF

```bash
pip install fpdf2
python scripts/generate-nextbot-functions-pdf.py
```

Файл: **`docs/PARTNER_NEXTBOT_AIDA_GUIDE.pdf`**.

---

## 10. `get_user_id`

Отдельного запроса к порталу AIDA нет — идентификатор пользователя чата задаётся в Nextbot.
