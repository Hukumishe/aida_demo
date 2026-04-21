# Python для Nextbot — только функции xmind

**Партнёрам:** см. полное руководство **[`docs/PARTNER_NEXTBOT_AIDA_GUIDE.md`](../../docs/PARTNER_NEXTBOT_AIDA_GUIDE.md)** (и PDF в той же папке `docs/`).

Каждый файл — **один цельный скрипт** для функции Python в Nextbot ([документация](https://doc.nextbot.ru/functional/functions/sending-result/python)): переменная **`result`** обязательна, параметры сценария — в **`args`**.

**Импорты:** в редакторе Nextbot предупреждение «импорты библиотек не работают» — **не пиши `import json`**. Используй глобальные **`json.loads` / `json.dumps`** (они в whitelist среды) и для POST тела — **`requests.post(..., json=словарь)`** вместо `data=json.dumps(...)`.

## Общие ключи `args` (задай в конструкторе функции)

| Ключ | Где нужен |
|------|-----------|
| `base_url` | Везде (только хост, без `/nextbot`, напр. `https://api.example.com`) |
| `api_key` | Везде (`NEXTBOT_API_KEY` → заголовок `X-API-Key`) |
| `studio_id` | Все маршруты с `:studioId` в пути — **реальный id** из ответа `get_company_context` |

Не подставляй в URL литералы вроде `{{studioId}}` — только реальная строка id.

### Динамический `studio_id` из переписки (Python Script)

Скрипт **не угадывает** филиал сам: в `args["studio_id"]` попадает то, что **передала платформа** при вызове функции.

1. **Переменная сценария**  
   В сценарии Nextbot заведи строковую переменную, например **`studio_id`** (имя должно совпасть с тем, как ты свяжешь параметр ниже).

2. **Когда записывать значение**  
   После **`get_company_context`** модель/сценарий выбирает одну студию (по словам клиента, кнопке «филиал 1/2» и т.д.) и в **`id`** из JSON — это и есть нужный `studio_id`.  
   Запиши его в переменную сценария **до** вызова `get_services_and_prices` и остальных запросов с `:studioId`.

3. **Параметр функции в Nextbot**  
   В карточке функции **«Параметры функции»** добавь параметр с именем **`studio_id`** (как в Python: `args.get("studio_id")`).  
   В настройках параметра укажи **источник значения** = переменная сценария (в интерфейсе это часто поле вроде «значение из переменной» / `{{studio_id}}` — точная подпись зависит от версии Nextbot).  
   Тогда при каждом вызове инструмента в `args` подставится актуальный id текущего диалога.

4. **Один филиал**  
   Если студия одна, можно один раз после первого `get_company_context` записать её `id` в `studio_id` и не трогать до конца диалога.

5. **Промпт**  
   В системном промпте зафиксируй: *не выдумывать id; брать только из последнего ответа `get_company_context`; при неоднозначности — уточнить у клиента*.  
   Подробнее: **`docs/NEXTBOT_STUDIO_SELECTION.md`**, **`docs/NEXTBOT_FUNCTION_CALLING_STUDIO.md`**.

**Пошаговый алгоритм целиком:** [`docs/NEXTBOT_STUDIO_ID_PYTHON_ALGORITHM.md`](../../docs/NEXTBOT_STUDIO_ID_PYTHON_ALGORITHM.md).

## Как протестировать в Nextbot («Тестировать код»)

1. Вставь скрипт, нажми **«Тестировать код»**, прокрути вниз до **«Тестовые аргументы»**.
2. Укажи три ключа (имена как в коде — snake_case):

| Ключ | Пример значения |
|------|-----------------|
| `base_url` | `https://твой-backend.up.railway.app` — **только хост**, без `/nextbot` в конце |
| `api_key` | значение `NEXTBOT_API_KEY` с сервера AIDA |
| `studio_id` | реальный id филиала из ответа `get_company_context` (поле `id` у студии) |

3. Нажми **«Запустить тест»**. В `result` смотри `ok`, `status`, `data`.

**Про «base»:** в коде нет отдельного параметра `base` — это локальная переменная `base = base_url без последнего /`. Если тест падает с пустым URL, значит в `args` не пришёл `base_url`: либо не заполнены тестовые аргументы, либо в карточке функции **нет параметров** с именами `base_url`, `api_key`, `studio_id`. Добавь их кнопкой **«Новый параметр»** (тип строка/секрет для ключа).

## Список файлов

| Файл | Назначение |
|------|------------|
| `get_company_context.py` | контекст / список студий |
| `verify_client_status.py` | клиент по `q` |
| `get_client_appointments.py` | предстоящие записи; можно без `client_id` — тогда по `phone` / `phone_lookup` и verify |
| `register_new_client.py` | регистрация |
| `update_old_client_profile.py` | обновление профиля (`PATCH /nextbot/clients/:id/update`); без `client_id` — поиск по `phone` / `phone_lookup` |
| `process_survey_answers.py` | анкета |
| `get_services_and_prices.py` | услуги и цены |
| `get_active_promotions.py` | акции |
| `check_loyalty_status.py` | лояльность |
| `get_referral_code.py` | реферальный код по `phone` (client_id не нужен; имя только в диалоге) |
| `check_availability.py` | сырые слоты |
| `check_availability_reschedule.py` | сырые слоты для переноса (берёт prompt `check_availability_reschedule`) |
| `create_booking_request.py` | создание записи |
| `modify_booking.py` | любые правки записи (тело `patch_json`) |
| `cancel_booking.py` | отмена `POST .../appointments/:id/update`, в result только `data.id`, `data.status` и `prompt` |
| `reschedule_booking.py` | перенос → `startAt` (обёртка) |
| `process_survey_answers_failed.py` | заглушка 501 |
| `add_to_waitlist.py` | заглушка 501 |
| `request_manager_invoice.py` | заглушка 501 |
| `generate_payment_link.py` | заглушка 501 |
| `verify_receipt_nighttime.py` | заглушка 501 |
| `purchase_certificate.py` | заглушка 501 |
| `validate_certificate_code.py` | заглушка 501 |
| `create_escalation_ticket.py` | заглушка 501 |
| `dev_error_report.py` | заглушка 501 |

`get_user_id` в HTTP нет — только логика Nextbot.

Маршруты: **`docs/NEXTBOT_XMIND_API.md`**. Ограничения среды: [Python Script в Nextbot](https://doc.nextbot.ru/functional/functions/sending-result/python).
