# `/nextbot` — только функции из xmind (`aida_xmind.pdf`)

Префикс **`/nextbot`** повторяет **имена и смысл функций** из системного промпта. Лишних маршрутов нет.

**Не в HTTP (только платформа Nextbot):** `get_user_id`.

**Base (пример):** `https://demo-studio-production.up.railway.app`  
**Auth:** `X-API-Key: <NEXTBOT_API_KEY>` или `Authorization: ApiKey …` или Bearer JWT.

> **Важно (Nextbot Custom API):** в URL вместо **`:studioId`** должна быть **реальная строка id** из ответа `GET /nextbot/context` (поле `id` у студии). Нельзя вставлять буквально `{studioId}` или `STUDIO_ID` из примеров в доке — иначе запрос пойдёт на несуществующую студию. В конструкторе Nextbot подставь **переменную сценария** (синтаксис платформы, часто двойные фигурные скобки), куда ты записал id после первого вызова context.

**Готовые тексты «что куда вставить»** (промпт + Nextbot + схема `{}`): [`NEXTBOT_FUNCTION_CALLING_STUDIO.md`](./NEXTBOT_FUNCTION_CALLING_STUDIO.md).

Все изменения записи (перенос, отмена, статус, предоплата) — **одна функция в xmind: `modify_booking`** → **POST** `.../nextbot/appointments/{id}/update` с JSON (`startAt`, `prepaymentAmount`, `status`). Отмена: `{"status":"CANCELLED"}`.

---

## Реализовано (200/201)

| Функция xmind | Метод | Путь |
|---------------|--------|------|
| `get_company_context` | GET | `/nextbot/context` |
| `verify_client_status` | GET | `/nextbot/studios/:studioId/clients/verify?q=` |
| `register_new_client` | POST | `/nextbot/studios/:studioId/clients/register` |
| `process_survey_answers` | POST | `/nextbot/clients/:clientId/survey` |
| `get_services_and_prices` | GET | `/nextbot/studios/:studioId/services` |
| `get_active_promotions` | GET | `/nextbot/studios/:studioId/landing/promotions` |
| `check_loyalty_status` | GET | `/nextbot/studios/:studioId/clients/loyalty?q=` |
| `get_referral_code` | GET | `/nextbot/studios/:studioId/clients/referral?q=` |
| `check_availability` | GET | `/nextbot/studios/:studioId/availability-raw?date=YYYY-MM-DD&staffUserId=` |
| `create_booking_request` | POST | `/nextbot/studios/:studioId/appointments` |
| `modify_booking` | POST | `/nextbot/appointments/:id/update` |

`studioId` в URL — из ответа **`get_company_context`** (поле `id` у нужной студии) или из сценария Nextbot.

---

## Заглушка 501 NOT_IMPLEMENTED

Тело запроса опционально (JSON). Ответ: `{ "function": "...", "code": "NOT_IMPLEMENTED", "message": "..." }`.

| Функция xmind | Метод | Путь |
|---------------|--------|------|
| `process_survey_answers_failed` | POST | `/nextbot/clients/:clientId/survey-failed` |
| `add_to_waitlist` | POST | `/nextbot/add-to-waitlist` |
| `request_manager_invoice` | POST | `/nextbot/request-manager-invoice` |
| `generate_payment_link` | POST | `/nextbot/generate-payment-link` |
| `verify_receipt_nighttime` | POST | `/nextbot/verify-receipt-nighttime` |
| `purchase_certificate` | POST | `/nextbot/purchase-certificate` |
| `validate_certificate_code` | POST | `/nextbot/validate-certificate-code` |
| `create_escalation_ticket` | POST | `/nextbot/create-escalation-ticket` |
| `dev_error_report` | POST | `/nextbot/dev-error-report` |

---

## Примеры curl (полный base)

```bash
# get_company_context
curl -sS -H "X-API-Key: $K" "https://demo-studio-production.up.railway.app/nextbot/context"

# modify_booking — отмена
curl -sS -X POST -H "X-API-Key: $K" -H "Content-Type: application/json" \
  -d '{"status":"CANCELLED"}' \
  "https://demo-studio-production.up.railway.app/nextbot/appointments/APPT_ID/update"
```

Исходник маршрутов: `src/nextbot/nextbot.controller.ts`.
