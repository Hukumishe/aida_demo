# Справочник args и result для функций Nextbot

(nextbot / xmind_python ↔ backend AIDA)

Этот файл описывает, что принимает каждая функция сценария Nextbot (и соответствующий HTTP-эндпоинт в NestJS) и что возвращается в теле ответа. Для Python-обёрток поверх HTTP часто используется единый объект `result` (см. ниже); при **прямых** вызовах REST тело ответа — это обычно JSON из колонки «ответ backend».

---

## Что означает `[]` в названиях полей

- `data[]` — массив; каждый элемент — объект одного типа.
- `data[].id` — поле `id` у каждого элемента массива `data` (аналогично `data[0].id`, `data[1].id`, …).
- `freeSlots[].startAt` — поле `startAt` у каждого объекта в массиве `freeSlots`.

**Пример:**

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

---

## Единый формат result (у Python-обёрток над HTTP)

Если ваш скрипт оборачивает ответ backend в общую структуру:

```text
result = {
  "ok": bool,
  "status": int,
  "data": object | list | str
}
```

**Расшифровка полей:**

| Поле     | Значение |
|----------|----------|
| `ok`     | Успешный HTTP-вызов (`True`, если статус 2xx). |
| `status` | HTTP-код ответа backend (`200`, `201`, `400`, `404`, `501`, …). |
| `data`   | Полезная нагрузка: при успехе обычно JSON-объект или массив; при ошибке может быть строка с текстом ошибки или объект NestJS. |

При **прямом** `curl`/клиенте без обёртки вы получаете только JSON-тело ответа (без оболочки `ok`/`status`, если сами её не добавляете).

---

## Авторизация и базовые параметры

**HTTP (реальный backend):**

| Параметр | Описание |
|----------|----------|
| `base_url` | Базовый URL backend (например `https://demo-studio-production.up.railway.app`), **без** лишнего суффикса `/api`, если у вас не настроен глобальный префикс. |
| Заголовок | Либо `Authorization: Bearer <accessToken>` (после `POST /auth/login`), либо при настроенном `NEXTBOT_API_KEY`: `X-API-Key: <ключ>` или `Authorization: ApiKey <ключ>`. |
| `studio_id` | Идентификатор филиала; для подстановки в путь берётся из **`GET /nextbot/context`** → элемент массива → поле `id`. **Нельзя** оставлять в URL шаблоны вида `{studioId}` или `{{studioId}}` — guard вернёт 400 с подсказкой. |

**Контекст организации (мультиарендность):**

- У пользователя в JWT после входа есть **`organizationId`**. Каталог услуг, маркетинговые акции лендинга, лояльность и «приведи друга» настроены на уровне **организации**; филиалы (`studios`) принадлежат организации.
- В ответе **`get_company_context`** каждый филиал содержит **`organizationId`** (связь с организацией). Отдельные лимиты бонусов и реферальные поля **не** дублируются в этом списке филиалов — они на организации (см. CRM-эндпоинты настроек студии/организации при необходимости).

**Соответствие имени Python-скрипта и HTTP:**

| № | Функция (xmind / Python) | HTTP |
|---|---------------------------|------|
| 1 | `get_company_context.py` | `GET /nextbot/context` |
| 2 | `verify_client_status.py` | `GET /nextbot/studios/:studioId/clients/verify?q=` |
| 3 | `register_new_client.py` | `POST /nextbot/studios/:studioId/clients/register` |
| 4 | `process_survey_answers.py` | `POST /nextbot/clients/:clientId/survey` |
| 5 | `get_services_and_prices.py` | `GET /nextbot/studios/:studioId/services` |
| 6 | `get_active_promotions.py` | `GET /nextbot/studios/:studioId/landing/promotions` |
| 7 | `check_loyalty_status.py` | `GET /nextbot/studios/:studioId/clients/loyalty?q=` |
| 8 | `get_referral_code.py` | `GET /nextbot/studios/:studioId/clients/referral?q=` |
| 9 | `check_availability.py` | `GET /nextbot/studios/:studioId/availability-raw?date=...&...` |
| 10 | `create_booking_request.py` | `POST /nextbot/studios/:studioId/appointments` |
| 11 | `modify_booking.py` | `POST /nextbot/appointments/:id/update` |

**Args (логические, как в PDF):**

| Имя | Описание |
|-----|----------|
| `base_url` | Адрес backend. |
| `api_key` / Bearer | Ключ `X-API-Key` или токен `Authorization: Bearer ...`. |
| `studio_id` | Подставляется в путь как `:studioId`. |
| `organization_id` | Не всегда в URL: приходит в JWT (`/auth/login`, `/auth/me`) и в объектах филиала как `organizationId`. |

---

## 1) `get_company_context.py`

**HTTP:** `GET /nextbot/context`

### Args

| Поле | Описание |
|------|----------|
| `base_url` | Адрес backend. |
| `api_key` или Bearer | См. раздел авторизации. |

### `result.data` (что означает)

Ответ — **массив филиалов** (в Python-обёртке это может быть обёрнуто в `{ "data": [...] }` в зависимости от реализации; у прямого HTTP тело — массив).

| Поле | Описание |
|------|----------|
| `data[].id` | Id филиала (studio); дальше подставляется как `studio_id` в путях. |
| `data[].organizationId` | Id организации (сеть). |
| `data[].name` | Название филиала. |
| `data[].address` | Адрес (может быть `null`). |
| `data[].timezone` | Часовой пояс (например `Asia/Almaty`). |
| `data[].createdAt` | Дата/время создания записи о филиале. |
| `data[].updatedAt` | Дата/время последнего изменения. |

**Важно:** лимит оплаты бонусами и настройки «приведи друга» / режим лояльности относятся к **организации**, а не к строке филиала в этом списке. Раньше в старых версиях глоссария они ошибочно указывались как поля студии.

---

## 2) `verify_client_status.py`

**HTTP:** `GET /nextbot/studios/:studioId/clients/verify?q=...`

### Args

| Поле | Описание |
|------|----------|
| `base_url` | Адрес backend. |
| `api_key` / Bearer | Авторизация. |
| `studio_id` | В каком филиале искать (контекст для списка и профиля клиента). |
| `q` | Поисковый запрос (телефон, имя, фрагмент данных клиента). |

### `result.data` (что означает)

| Поле | Описание |
|------|----------|
| `found` | Найден ли клиент (`true` / `false`). |
| `client` | Расширенный объект клиента из CRM, если найден; иначе `null`. |

Основные поля `client` (при успехе), в т.ч.:

| Поле | Описание |
|------|----------|
| `client.id` | Id клиента. |
| `client.organizationId` | Организация клиента. |
| `client.firstName` | Имя. |
| `client.lastName` | Фамилия (`null` возможен). |
| `client.phone` | Телефон. |
| `client.birthDate` | Дата рождения (`null` возможен). |
| `client.notes` | Заметки. |
| `client.level` | Уровень лояльности (`BRONZE` / `SILVER` / `GOLD` / `DIAMOND`). |
| `client.bonuses` | Бонусный баланс. |
| `client.discount` | Персональная скидка (%). |
| `client.balance` | Денежный баланс (историческое поле). |
| `client.referralCode` | Реферальный код клиента (уникален в пределах организации). |
| `client.referredCount` | Сколько клиентов пришло по коду этого клиента. |
| `client.referredList` | Список приглашённых (если есть). |
| `client.cashbackPercent` | Кэшбэк-процент по текущему уровню / кастомной лояльности. |
| `client.levelProgress` | Прогресс до следующего уровня. |
| `client.organizationLoyalty` | Блок кастомной лояльности по **организации клиента** (режим CUSTOM у организации). |
| `client.studioLoyalty` | Устаревший алиас того же объекта, что и `organizationLoyalty` (для старых клиентов API). |

---

## 3) `register_new_client.py`

**HTTP:** `POST /nextbot/studios/:studioId/clients/register`  
**Тело:** JSON (поля как в CRM `CreateClientDto`).

### Args

| Поле | Описание |
|------|----------|
| `base_url` | Адрес backend. |
| `api_key` / Bearer | Авторизация. |
| `studio_id` | Филиал, в контексте которого создаётся клиент (организация берётся с филиала). |
| `payload_json` | Если в обёртке передаётся готовое тело запроса, отдельные поля ниже могут не дублироваться. |
| `first_name` | Имя клиента. |
| `phone` | Телефон (уникален в пределах **организации**). |
| `last_name` | Фамилия (опционально). |
| `birth_date` | `YYYY-MM-DD` (опционально). |
| `notes` | Заметка (опционально). |
| `bonuses`, `discount`, `balance` | Стартовые значения (опционально). |
| `referrerCode` / `referralCode` | Код другого клиента той же организации (не промокод лендинга). |
| `referralLinkId` | Id маркетинговой реферальной ссылки организации (опционально). |

### `result.data` (что означает)

Созданный объект клиента. Обычно HTTP **201**.

---

## 4) `process_survey_answers.py`

**HTTP:** `POST /nextbot/clients/:clientId/survey`

**Тело JSON:**

| Поле | Описание |
|------|----------|
| `answers` | Объект с ответами анкеты (произвольная структура). |
| `mergeIntoNotes` | Объединять с текущими `notes` (`true`, по умолчанию) или перезаписать блок (`false`). |
| `surveyPrefix` | Префикс блока в `notes` (по умолчанию `[NEXTBOT_SURVEY]`). |

### `result.data` (что означает)

Обновлённый объект клиента после записи анкеты в `notes`.

---

## 5) `get_services_and_prices.py`

**HTTP:** `GET /nextbot/studios/:studioId/services`

### Args

| Поле | Описание |
|------|----------|
| `base_url` | Адрес backend. |
| `api_key` / Bearer | Авторизация. |
| `studio_id` | Филиал; услуги отдаются по **организации** этого филиала. |

### `result.data` (что означает)

Массив услуг организации (в ответе backend к услуге подмешан объект `category`).

| Поле | Описание |
|------|----------|
| `data[].id` | Id услуги. |
| `data[].organizationId` | Организация. |
| `data[].name` | Название. |
| `data[].defaultPrice` | Базовая цена. |
| `data[].defaultDurationMin` | Длительность в минутах (в старых текстах могло называться `durationMinutes` — смысл тот же). |
| `data[].isActive` | Активна ли услуга. |
| `data[].bonusAccrualEnabled` | Начислять ли бонусы за услугу. |
| `data[].category` | Категория услуги (вложенный объект). |
| `data[].audience` | Аудитория услуги. |
| `data[].createdAt` | Создание. |
| `data[].updatedAt` | Изменение. |

---

## 6) `get_active_promotions.py`

**HTTP:** `GET /nextbot/studios/:studioId/landing/promotions`

### Args

| Поле | Описание |
|------|----------|
| `base_url` | Адрес backend. |
| `api_key` / Bearer | Авторизация. |
| `studio_id` | Филиал; промо загружаются для организации этого филиала. |

### `result.data` (что означает)

Массив активных промо-акций лендинга (поля зависят от модели `LandingPromotion` в backend).

| Поле | Описание |
|------|----------|
| `data[].id` | Id промо. |
| `data[].title` | Заголовок. |
| `data[].description` | Описание (если есть в модели). |
| `data[].isActive` | Активна ли акция. |
| `data[].createdAt` | Создание. |
| `data[].updatedAt` | Изменение. |

---

## 7) `check_loyalty_status.py`

**HTTP:** `GET /nextbot/studios/:studioId/clients/loyalty?q=...`

### Args

| Поле | Описание |
|------|----------|
| `base_url` | Адрес backend. |
| `api_key` / Bearer | Авторизация. |
| `studio_id` | Филиал (для контекста кастомной лояльности в `rawClient`). |
| `q` | Поисковый запрос клиента. |

### `result.data` (что означает)

| Поле | Описание |
|------|----------|
| `found` | Найден ли клиент. |
| `clientId` | Id клиента или `null`. |
| `level` | Уровень лояльности (preset) или `null`. |
| `loyaltyTierName` | Название текущего кастомного тира (если применимо), иначе `null`. |
| `bonuses` | Текущие бонусы. |
| `discount` | Текущая скидка. |
| `rawClient` | Полный объект клиента из CRM (те же поля, что в `verify_client_status`). |

---

## 8) `get_referral_code.py`

**HTTP:** `GET /nextbot/studios/:studioId/clients/referral?q=...`

### Args

| Поле | Описание |
|------|----------|
| `base_url` | Адрес backend. |
| `api_key` / Bearer | Авторизация. |
| `studio_id` | Филиал (контекст поиска). |
| `q` | Поисковый запрос клиента. |

### `result.data` (что означает)

| Поле | Описание |
|------|----------|
| `found` | Найден ли клиент. |
| `clientId` | Id или `null`. |
| `referralCode` | Реферальный код или `null`. |
| `rawClient` | Полный объект клиента из CRM. |

---

## 9) `check_availability.py` (главное)

**HTTP:** `GET /nextbot/studios/:studioId/availability-raw`

**Query-параметры:**

| Поле | Описание |
|------|----------|
| `date` | **Обязательно:** дата `YYYY-MM-DD`. |
| `staffUserId` | Id мастера (опционально; для роли MASTER принудительно «свой» id). |
| `serviceId` | Id услуги; если передан, длительность и override мастера берутся из CRM. |
| `durationMinutes` | Если **нет** `serviceId` — длительность слота (по умолчанию 60). |
| `slotStepMinutes` | Шаг сетки (по умолчанию 15; допустимо 5…120). |

### `result.data` (что означает)

| Поле | Описание |
|------|----------|
| `date` | Дата расчёта. |
| `studioId` | Id филиала. |
| `durationMinutes` | Итоговая длительность слота (мин). |
| `slotStepMinutes` | Шаг сетки (мин). |
| `freeSlots[]` | Только свободные окна. |
| `freeSlots[].staffUserId` | Id мастера. |
| `freeSlots[].staffName` | Имя мастера. |
| `freeSlots[].startAt` | Начало окна (ISO datetime). |
| `freeSlots[].endAt` | Конец окна (ISO datetime). |
| `check_availability` | Готовый текст-промпт для LLM/бота по найденным окнам. |

**Пример формы ответа:**

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

**HTTP:** `POST /nextbot/studios/:studioId/appointments`

### Args

| Поле | Описание |
|------|----------|
| `base_url` | Адрес backend. |
| `api_key` / Bearer | Авторизация. |
| `studio_id` | Филиал записи. |
| `payload_json` | При необходимости — готовое тело запроса. |
| `staff_user_id` | Id мастера. |
| `client_id` | Id клиента. |
| `service_id` | Id услуги. |
| `start_at` | Начало в ISO 8601. |
| `prepayment_amount` | Предоплата (если используется). |

### `result.data` (что означает)

Созданная запись (`appointment`). Обычно HTTP **201**.

| Поле | Описание |
|------|----------|
| `data.id` | Id записи. |
| `data.studioId` | Филиал. |
| `data.staffUserId` | Мастер. |
| `data.clientId` | Клиент. |
| `data.serviceId` | Услуга. |
| `data.startAt` | Начало (ISO). |
| `data.endAt` | Конец (ISO). |
| `data.status` | `BOOKED`, `ARRIVED`, `DONE`, `CANCELLED`, … |
| `data.prepaymentAmount` | Предоплата или `null`. |
| `data.forfeitedPrepaymentAmount` | Сгоревшая предоплата или `null`. |
| `data.completedBonusesUsed` | Бонусы при завершении (если применимо). |
| `data.completedMoneyPaid` | Оплата деньгами при завершении. |
| `data.arrivedAt` | Время прихода или `null`. |
| `data.arrivedByUserId` | Кто отметил приход или `null`. |
| `data.createdAt` | Создание записи. |
| `data.updatedAt` | Последнее изменение. |

---

## 11) `modify_booking.py`

**HTTP:** `POST /nextbot/appointments/:id/update`

### Args

| Поле | Описание |
|------|----------|
| `base_url` | Адрес backend. |
| `api_key` / Bearer | Авторизация. |
| `appointment_id` | Id записи в пути `:id`. |
| `patch_json` | JSON с полями обновления (`UpdateAppointmentDto`). |

Типичные поля тела:

| Поле | Описание |
|------|----------|
| `startAt` | Новое время начала (перенос). |
| `prepaymentAmount` | Новая предоплата. |
| `status` | Новый статус (`CANCELLED` для отмены). |

### `result.data` (что означает)

Обновлённый объект записи (те же поля, что в п. 10).

**Связанные обёртки в сценариях:**

- **Отмена:** тело `{"status":"CANCELLED"}`.
- **Перенос:** тело `{"startAt":"<ISO datetime>"}`.

Отдельных HTTP «cancel_booking» / «reschedule_booking» в backend нет — используется этот же эндпоинт.

---

## 12) Заглушки `501 NOT_IMPLEMENTED`

Скрипты/маршруты без реализации CRM (возвращают HTTP 501 и тело с кодом `NOT_IMPLEMENTED`):

| Функция | HTTP |
|---------|------|
| `process_survey_answers_failed.py` | `POST /nextbot/clients/:clientId/survey-failed` |
| `add_to_waitlist.py` | `POST /nextbot/add-to-waitlist` |
| `request_manager_invoice.py` | `POST /nextbot/request-manager-invoice` |
| `generate_payment_link.py` | `POST /nextbot/generate-payment-link` |
| `verify_receipt_nighttime.py` | `POST /nextbot/verify-receipt-nighttime` |
| `purchase_certificate.py` | `POST /nextbot/purchase-certificate` |
| `validate_certificate_code.py` | `POST /nextbot/validate-certificate-code` |
| `create_escalation_ticket.py` | `POST /nextbot/create-escalation-ticket` |
| `dev_error_report.py` | `POST /nextbot/dev-error-report` |

### Args (общие)

| Поле | Описание |
|------|----------|
| `base_url` | Адрес backend. |
| `api_key` / Bearer | Авторизация. |
| `client_id` | Только там, где он в пути (например survey-failed). |
| `body_json` | Опциональное тело. |

### `result.data` (что означает)

Обычно объект:

```json
{
  "function": "xmind_function_name",
  "code": "NOT_IMPLEMENTED",
  "message": "Эндпоинт зарезервирован под сценарий xmind; логика в backend ещё не реализована."
}
```

---

## Связь с остальной документацией

- Расширенный REST-глоссарий (curl, все модули): [`API_GLOSSARY.md`](./API_GLOSSARY.md).
- Этот файл сознательно повторяет структуру PDF «Справочник args и result», но **синхронизирован** с текущим кодом (`nextbot.controller.ts`, `nextbot.service.ts`) и моделью **Organization + Studio**.
