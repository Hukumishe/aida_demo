# Пакет `nextbot`

**Партнёрам (настройка Nextbot):** **[`docs/PARTNER_NEXTBOT_AIDA_GUIDE.md`](../docs/PARTNER_NEXTBOT_AIDA_GUIDE.md)** — пошаговое руководство без знаний backend; PDF: `docs/PARTNER_NEXTBOT_AIDA_GUIDE.pdf`.

HTTP-клиент к backend AIDA для оркестратора Nextbot. Публичные имена **совпадают с функциями из xmind** (`aida_xmind.pdf`).

### Готовый Python для вставки в Nextbot (только xmind)

Скопируй содержимое файлов из **`xmind_python/`** — в каждом скрипте `args` и **`result`**, без зависимостей от остального репозитория. Описание переменных: **`xmind_python/README.md`**.

Все вызовы xmind идут на префикс **`/nextbot`** (см. `src/nextbot/nextbot.controller.ts` и **`docs/NEXTBOT_XMIND_API.md`**).

- **`AidaConfig.base_url`** — только хост backend **без** `/nextbot` (например `https://demo.example.com`). Сборка путей: `nextbot_api_root(cfg)` → `{base_url}/nextbot`.
- Краткая ссылка: **`docs/NEXTBOT_PYTHON_SCRIPTS.md`**, [документация Python Nextbot](https://doc.nextbot.ru/functional/functions/sending-result/python).

Вспомогательные модули вне `/nextbot` (например `get_client_profile`, `list_client_appointments`, `get_studio_details`) обращаются к обычным CRM-маршрутам и не входят в экспорт `nextbot.__init__`.

## Структура

| Папка | Содержимое |
|-------|------------|
| `config.py` | `AidaConfig`, `build_headers`, `nextbot_api_root` |
| `company/` | `get_company_context` → `GET /nextbot/context` |
| `clients/` | `verify_client_status`, `register_new_client`, `process_survey_answers`, `check_loyalty_status`, `get_referral_code` |
| `appointments/` | `create_booking_request`, `modify_booking`, `reschedule_booking`, `cancel_booking` |
| `services/` | `get_services_and_prices` |
| `landing/` | `get_active_promotions` |
| `schedule/` | `check_availability` |
| `placeholders/` | xmind-функции без CRM: `NotImplementedError` |
| `prompts/` | Вспомогательные вызовы к `GET /prompts` (не в xmind / не в `/nextbot`) |

`from nextbot import …` — см. `__init__.py`.
