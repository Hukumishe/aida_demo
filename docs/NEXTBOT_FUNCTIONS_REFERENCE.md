# Справочник функций Nextbot ↔ AIDA (`/nextbot`)

> **Партнёрам:** **`PARTNER_NEXTBOT_AIDA_GUIDE.md`** / **`PARTNER_NEXTBOT_AIDA_GUIDE.pdf`** — примеры `args` и `result` по каждой функции. Здесь — компактно только HTTP и ключи `args`.

**Версия:** по состоянию репозитория AIDA (`src/nextbot/nextbot.controller.ts`).  
**Авторизация HTTP:** заголовок `X-API-Key: <NEXTBOT_API_KEY>` (или JWT, как настроено на backend).  
**Python в Nextbot:** скрипты из `nextbot/xmind_python/`; параметры приходят в словарь **`args`**; результат — переменная **`result`**. Не используйте `import json` — применяйте `json.loads` / `requests.post(..., json=...)`.

---

## Общий формат ответа Python-скрипта

После выполнения запроса скрипт задаёт:

```text
result = { "ok": <bool>, "status": <HTTP-код>, "data": <тело ответа или текст ошибки> }
```

- **`data`** при успехе (`ok: true`) обычно — JSON, распарсенный из ответа API (объект или массив).
- При ошибке HTTP **`data`** может быть строкой (`r.text`).

Ниже для каждой функции указаны: **HTTP**, **аргументы `args` в Nextbot**, **тело/параметры запроса к backend**, **смысл ответа в `data`** (когда `200/201`).

---

## 1. `get_company_context`

| | |
|---|---|
| **HTTP** | `GET /nextbot/context` |
| **Параметры URL** | нет |
| **`args` (Python)** | `base_url`, `api_key` |
| **Ответ API (`data`)** | Массив студий: у каждой элемента поля вроде `id`, `name`, `address`, … (как в CRM `studiosService.findAll`). Используйте `id` как `studio_id` для остальных вызовов. |

---

## 2. `verify_client_status`

| | |
|---|---|
| **HTTP** | `GET /nextbot/studios/:studioId/clients/verify?q=` |
| **Query** | `q` — телефон / имя / строка поиска (опционально) |
| **`args`** | `base_url`, `api_key`, `studio_id`, `q` |
| **Ответ (`data`)** | `{ "found": true\|false, "client": <объект клиента или null> }`. При `found: true` — полный профиль клиента. |

---

## 3. `register_new_client`

| | |
|---|---|
| **HTTP** | `POST /nextbot/studios/:studioId/clients/register` |
| **Тело JSON** | `CreateClientDto`: обязательно `firstName`, `phone`; опционально `lastName`, `birthDate` (YYYY-MM-DD), `notes`, `bonuses`, `discount`, `balance` |
| **`args`** | `base_url`, `api_key`, `studio_id`; **либо** одна строка `payload_json` (полный JSON тела), **либо** поля `first_name`, `phone`, `last_name`, `birth_date`, `notes`, `bonuses`, `discount`, `balance` |
| **Ответ** | Созданный клиент (объект), обычно `201` |

---

## 4. `process_survey_answers`

| | |
|---|---|
| **HTTP** | `POST /nextbot/clients/:clientId/survey` |
| **Тело JSON** | `NextbotSurveyDto`: `answers` (объект), опционально `mergeIntoNotes` (bool, по умолчанию true), `surveyPrefix` (строка, по умолчанию `[NEXTBOT_SURVEY]`) |
| **`args`** | `base_url`, `api_key`, `client_id`, `answers_json` (строка JSON); опционально `merge_into_notes`, `survey_prefix` |
| **Ответ** | Обновлённый клиент после записи в `notes` |

---

## 5. `get_services_and_prices`

| | |
|---|---|
| **HTTP** | `GET /nextbot/studios/:studioId/services` |
| **`args`** | `base_url`, `api_key`, `studio_id` |
| **Ответ (`data`)** | Массив услуг с ценами/длительностью (как в CRM для студии) |

---

## 6. `get_active_promotions`

| | |
|---|---|
| **HTTP** | `GET /nextbot/studios/:studioId/landing/promotions` |
| **`args`** | `base_url`, `api_key`, `studio_id` |
| **Ответ (`data`)** | Массив акций/промо для лендинга студии |

---

## 7. `check_loyalty_status`

| | |
|---|---|
| **HTTP** | `GET /nextbot/studios/:studioId/clients/loyalty?q=` |
| **`args`** | `base_url`, `api_key`, `studio_id`, `q` |
| **Ответ (`data`)** | `{ found, clientId, level, bonuses, discount, rawClient }` — сводка по лояльности; при отсутствии клиента поля обнуляются |

---

## 8. `get_referral_code`

| | |
|---|---|
| **HTTP** | `GET /nextbot/studios/:studioId/clients/referral?q=` |
| **`args`** | `base_url`, `api_key`, `studio_id`, `q` |
| **Ответ (`data`)** | `{ found, clientId, referralCode, rawClient }` |

---

## 9. `check_availability`

| | |
|---|---|
| **HTTP** | `GET /nextbot/studios/:studioId/availability-raw?date=YYYY-MM-DD&staffUserId=&serviceId=&durationMinutes=&slotStepMinutes=` |
| **Query** | `date` — обязательно; `staffUserId` — опционально; `serviceId` — длительность слота из услуги (+ override мастера); без услуги — `durationMinutes` (по умолчанию 60); `slotStepMinutes` — шаг сетки (по умолчанию 15, 5–120) |
| **`args`** | `base_url`, `api_key`, `studio_id`, `date`; опционально `staff_user_id`, `service_id`, `duration_minutes`, `slot_step_minutes` |
| **Ответ (`data`)** | `{ date, studioId, durationMinutes, slotStepMinutes, freeSlots: [{ staffUserId, staffName, startAt, endAt }], check_availability }` — только свободные окна + **строка промпта** для ИИ (`check_availability`) |

---

## 10. `create_booking_request`

| | |
|---|---|
| **HTTP** | `POST /nextbot/studios/:studioId/appointments` |
| **Тело JSON** | `CreateAppointmentDto`: `staffUserId`, `clientId`, `serviceId`, `startAt` (ISO 8601 с таймзоной), опционально `prepaymentAmount` (целое ≥ 0) |
| **`args`** | `base_url`, `api_key`, `studio_id`; **либо** `payload_json`, **либо** `staff_user_id`, `client_id`, `service_id`, `start_at`, опционально `prepayment_amount` |
| **Ответ** | Созданная запись (объект), обычно `201` |

---

## 11. `modify_booking`

| | |
|---|---|
| **HTTP** | `POST /nextbot/appointments/:id/update` |
| **Тело JSON** | `UpdateAppointmentDto`: опционально любое из полей `startAt`, `prepaymentAmount`, `status` (enum статусов записи, в т.ч. `CANCELLED` для отмены) |
| **`args`** | `base_url`, `api_key`, `appointment_id`, `patch_json` (строка JSON) |
| **Ответ** | Обновлённая запись |

### Обёртки (тот же endpoint)

| Функция (скрипт) | Что передаётся в теле |
|------------------|------------------------|
| `cancel_booking` | `{ "status": "CANCELLED" }` |
| `reschedule_booking` | `{ "startAt": "<ISO>" }` |

---

## 12. Заглушки (HTTP 501 NOT_IMPLEMENTED)

Тело запроса к API опционально (любой JSON). В **`data`** при ответе 501 обычно объект вида:

```json
{
  "function": "<имя функции xmind>",
  "code": "NOT_IMPLEMENTED",
  "message": "Эндпоинт зарезервирован под сценарий xmind; логика в backend ещё не реализована."
}
```

| Функция | Метод | Путь |
|---------|--------|------|
| `process_survey_answers_failed` | POST | `/nextbot/clients/:clientId/survey-failed` |
| `add_to_waitlist` | POST | `/nextbot/add-to-waitlist` |
| `request_manager_invoice` | POST | `/nextbot/request-manager-invoice` |
| `generate_payment_link` | POST | `/nextbot/generate-payment-link` |
| `verify_receipt_nighttime` | POST | `/nextbot/verify-receipt-nighttime` |
| `purchase_certificate` | POST | `/nextbot/purchase-certificate` |
| `validate_certificate_code` | POST | `/nextbot/validate-certificate-code` |
| `create_escalation_ticket` | POST | `/nextbot/create-escalation-ticket` |
| `dev_error_report` | POST | `/nextbot/dev-error-report` |

**`args` для Python:** `base_url`, `api_key`; для `survey-failed` — ещё `client_id`; для остальных — опционально `body_json` (строка JSON).

---

## Не в HTTP (только платформа)

| Функция | Примечание |
|---------|------------|
| `get_user_id` | Нет маршрута AIDA; идентификатор пользователя чата задаётся средой Nextbot |

---

## Файлы в репозитории

- Скрипты для вставки: `nextbot/xmind_python/*.py`
- Сводка маршрутов: `docs/NEXTBOT_XMIND_API.md`
- Выбор `studio_id`: `docs/NEXTBOT_STUDIO_ID_PYTHON_ALGORITHM.md`
- **PDF:** `docs/NEXTBOT_FUNCTIONS_REFERENCE.pdf` — `python scripts/generate-nextbot-functions-pdf.py --reference`  
- **Партнёрский PDF:** `docs/PARTNER_NEXTBOT_AIDA_GUIDE.pdf` — `python scripts/generate-nextbot-functions-pdf.py`
