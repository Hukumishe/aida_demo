# Пакет `nextbot`

HTTP-клиент к backend AIDA для оркестратора Nextbot.

**Если в Nextbot неудобно выполнять Python:** используйте готовые маршруты backend с префиксом **`/nextbot`** (один HTTP-запрос вместо нескольких и без встроенных функций). Список путей — в `docs/NEXTBOT_PARTIAL_AND_MISSING.md`.

## Структура

| Папка | Содержимое |
|-------|------------|
| `config.py` | `AidaConfig`, `build_headers` |
| `clients/` | Одна функция = один файл (`verify_client_status.py`, `register_new_client.py`, …) |
| `appointments/` | `create_booking_request`, `modify_booking`, `reschedule_booking`, `cancel_booking` |
| `company/` | `get_company_context`, `get_studio_details` |
| `services/` | `get_services_and_prices` |
| `landing/` | `get_active_promotions` |
| `schedule/` | `check_availability` |
| `prompts/` | `list_prompts`, `get_prompt` |
| `placeholders/` | Заглушки для API, которых ещё нет в backend |

Публичный API по-прежнему: `from nextbot import …` (см. `__init__.py`).

См. также `docs/NEXTBOT_PARTIAL_AND_MISSING.md`.
