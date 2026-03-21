# Пакет `nextbot`

HTTP-клиент к backend AIDA для оркестратора Nextbot. Публичные имена **совпадают с функциями из xmind** (`aida_xmind.pdf`).

**Маршруты HTTP префикса `/nextbot`** (для Custom API без Python): см. **`docs/NEXTBOT_XMIND_API.md`**.

## Структура

| Папка | Содержимое |
|-------|------------|
| `config.py` | `AidaConfig`, `build_headers` |
| `company/` | `get_company_context` |
| `clients/` | `verify_client_status`, `register_new_client`, `process_survey_answers`, `check_loyalty_status`, `get_referral_code` |
| `appointments/` | `create_booking_request`, `modify_booking`, `reschedule_booking`, `cancel_booking` |
| `services/` | `get_services_and_prices` |
| `landing/` | `get_active_promotions` |
| `schedule/` | `check_availability` |
| `placeholders/` | xmind-функции без CRM: `NotImplementedError` |
| `prompts/` | Вспомогательные вызовы к `GET /prompts` (не в xmind / не в `/nextbot`) |

`from nextbot import …` — см. `__init__.py`.
