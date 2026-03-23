# Nextbot: Python (xmind-only)

**Партнёрам (настройка без backend):** полное руководство — **[`PARTNER_NEXTBOT_AIDA_GUIDE.md`](./PARTNER_NEXTBOT_AIDA_GUIDE.md)** / PDF **`PARTNER_NEXTBOT_AIDA_GUIDE.pdf`**.

Готовые скрипты для вставки в функцию **Python** в Nextbot — **только xmind**, по одному файлу на функцию:

**→ [`nextbot/xmind_python/`](../nextbot/xmind_python/README.md)** (внутри — отдельные `.py` и описание `args`).

Ограничения среды: [документация Nextbot Python](https://doc.nextbot.ru/functional/functions/sending-result/python) (`args`, `requests`, **`json.loads` / `json.dumps` без строки `import json`**, обязательная **`result`**). В UI Nextbot импорты отключены — в скриптах репозитория используется **`requests.post(..., json={...})`** вместо `data=json.dumps(...)`.

Маршруты и статусы эндпоинтов: **`NEXTBOT_XMIND_API.md`**.

Полный справочник «что принимает / что отдаёт» (в т.ч. для PDF): **`NEXTBOT_FUNCTIONS_REFERENCE.md`** → **`NEXTBOT_FUNCTIONS_REFERENCE.pdf`**.

Пакет **`nextbot/*.py`** (вне `xmind_python/`) — библиотека для локальных тестов/оркестрации, для Nextbot не обязателен.
