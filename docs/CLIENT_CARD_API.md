# API карточки клиента (CRM)

Базовый префикс: **`/clients`** (вместе с базовым URL бэкенда, например `https://api.example.com`).

Авторизация: **`Authorization: Bearer <accessToken>`** (JWT).  
Для роли **DEVELOPER** во многих методах доступен query-параметр **`organizationId`**, чтобы работать в контексте выбранной сети.

Глобальный interceptor убирает из JSON-ответов поля **`createdAt`**, **`updatedAt`** и **`timezone`** (рекурсивно). В «сыром» объекте клиента в БД они есть; в типичном ответе API их может не быть.

---

## Получить карточку: `GET /clients/:id`

### Query

| Параметр | Обязательный | Описание |
|----------|--------------|----------|
| `organizationId` | Нет | Только **DEVELOPER**: клиент должен принадлежать этой организации. |

Устаревший query `studioId` для этой ручки **не влияет** на лояльность и рефералку (оставлен для совместимости старых клиентов, если ещё где-то передаётся).

### Ответ `200`

Тело — объект **клиента** плюс **вычисляемые поля** для экрана карточки.

#### Поля из модели клиента (как в БД)

Идентичность и контакт:

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | ID клиента |
| `organizationId` | string | Организация (сеть) |
| `firstName` | string | Имя |
| `lastName` | string \| null | Фамилия |
| `patronymic` | string \| null | Отчество |
| `instagram` | string \| null | Instagram |
| `phone` | string | Телефон |
| `notes` | string \| null | Заметки |
| `gender` | `MALE` \| `FEMALE` \| null | Пол |
| `birthDate` | string (дата) \| null | День рождения (в JSON обычно ISO-дата) |

Финансы и уровень (режим **PRESET** по умолчанию):

| Поле | Тип | Описание |
|------|-----|----------|
| `level` | `BRONZE` \| `SILVER` \| `GOLD` \| `DIAMOND` | Уровень |
| `levelSetManually` | boolean | В т.ч. ручной DIAMOND |
| `totalPaidForLevel` | number | Сумма оплат по DONE для уровня (PRESET) |
| `bonuses` | number | Бонусные баллы |
| `discount` | number | Скидка, % |
| `balance` | number | Баланс (₸) |

Чёрный список и рефералка:

| Поле | Тип | Описание |
|------|-----|----------|
| `isBlacklisted` | boolean | В чёрном списке |
| `blacklistReason` | string \| null | Причина |
| `referralCode` | string \| null | Код «приведи друга» (уникален в организации) |
| `registrationSource` | string \| null | **Источник** (в т.ч. название маркетинговой ссылки) |
| `studioReferralLinkId` | string \| null | Связь с маркетинговой реферальной ссылкой |
| `referredByClientId` | string \| null | Кто привёл (клиент-реферер) |
| `referralFirstVisitBonusCredited` | boolean | Бонус за первый визит по рефералке уже начислен |

Вложенно приходит **`referredByClient`** (если есть пригласивший):

```json
{
  "id": "cli_…",
  "firstName": "…",
  "lastName": "…",
  "referralCode": "…",
  "phone": "…"
}
```

#### Дополнительные поля ответа (не колонки `clients`)

| Поле | Тип | Описание |
|------|-----|----------|
| `referredCount` | number | Сколько человек привёл этот клиент |
| `referredList` | array | Список приглашённых: `clientId`, `firstName`, `lastName`, `usedAt` (ISO) |
| `cashbackPercent` | number | Кэшбэк % (PRESET или из кастомного tier) |
| `levelProgress` | object | Прогресс уровня (PRESET или CUSTOM — см. ниже) |
| `organizationLoyalty` | object \| null | Блок кастомной лояльности (**CUSTOM**), иначе часто `null` |
| `studioLoyalty` | object \| null | **Устарело:** дубликат `organizationLoyalty` |
| `referralCodeInputDisabled` | boolean | Заблокировать ввод реф. кода до первого DONE (сценарий «приведи друга») |
| `referralFirstVisitDiscountApplies` | boolean | Скидка на первый визит по программе |
| `referralFirstVisitBonusApplies` | boolean | Бонусы на первый визит по программе |

При **`loyaltyMode: CUSTOM`** у организации в **`organizationLoyalty`** может быть, в частности:

- `organizationId`, `loyaltyMode`, `totalPaid`
- `currentTier` (текущий tier), `levelSetManually`
- `milestones`, `nextStep` (пороги и остаток до следующего уровня)

Структура **`levelProgress`** зависит от режима лояльности (PRESET vs CUSTOM).

### Примеры

#### Запрос (PRESET-лояльность, типичный кейс)

```http
GET /clients/cli_a7b3c9d2e1 HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

С контекстом DEVELOPER:

```http
GET /clients/cli_a7b3c9d2e1?organizationId=org_k4m2n8p5q0 HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Ответ `200` — фрагмент (режим PRESET, с пригласившим и рефералами)

```json
{
  "id": "cli_a7b3c9d2e1",
  "organizationId": "org_k4m2n8p5q0",
  "firstName": "Анна",
  "lastName": "Иванова",
  "patronymic": "Сергеевна",
  "instagram": "@anna_iv",
  "phone": "+77001234567",
  "notes": "Предпочитает утро",
  "gender": "FEMALE",
  "birthDate": "1992-03-15T00:00:00.000Z",
  "level": "GOLD",
  "levelSetManually": false,
  "totalPaidForLevel": 125000,
  "bonuses": 1500,
  "discount": 10,
  "balance": 0,
  "isBlacklisted": false,
  "blacklistReason": null,
  "referralCode": "ZK8H2M1P",
  "registrationSource": "Instagram — летняя акция",
  "studioReferralLinkId": "srl_x9y8z7w6v5",
  "referredByClientId": "cli_ref_parent01",
  "referralFirstVisitBonusCredited": true,
  "referredByClient": {
    "id": "cli_ref_parent01",
    "firstName": "Мария",
    "lastName": "Петрова",
    "referralCode": "AB12CD34",
    "phone": "+77009876543"
  },
  "referredCount": 2,
  "referredList": [
    {
      "clientId": "cli_child01",
      "firstName": "Олег",
      "lastName": "Смирнов",
      "usedAt": "2025-11-01T14:30:00.000Z"
    },
    {
      "clientId": "cli_child02",
      "firstName": "Елена",
      "lastName": "Ким",
      "usedAt": ""
    }
  ],
  "cashbackPercent": 10,
  "levelProgress": {
    "currentTotalPaid": 125000,
    "nextLevel": "DIAMOND",
    "nextLevelThreshold": 200000,
    "remainingToNext": 75000
  },
  "organizationLoyalty": null,
  "studioLoyalty": null,
  "referralCodeInputDisabled": false,
  "referralFirstVisitDiscountApplies": false,
  "referralFirstVisitBonusApplies": false
}
```

Поля **`levelProgress`** в PRESET приходят из `getLevelProgress` / порогов уровней организации — точные ключи могут отличаться; ориентируйтесь на фактический ответ Swagger/сети.

#### Ответ `200` — укороченный (без пригласившего, без приведённых)

```json
{
  "id": "cli_newvisitor99",
  "organizationId": "org_k4m2n8p5q0",
  "firstName": "Иван",
  "lastName": null,
  "patronymic": null,
  "instagram": null,
  "phone": "+77005551122",
  "registrationSource": null,
  "referredByClient": null,
  "referredCount": 0,
  "referredList": [],
  "organizationLoyalty": null,
  "referralCodeInputDisabled": false,
  "referralFirstVisitDiscountApplies": false,
  "referralFirstVisitBonusApplies": false
}
```

#### Ошибки — примеры тела (NestJS)

**404** — клиент не найден:

```json
{
  "statusCode": 404,
  "message": "Client with ID cli_unknown not found",
  "error": "Not Found"
}
```

**403** — нет прав (например MASTER на карточку):

```json
{
  "statusCode": 403,
  "message": "Masters cannot access client details",
  "error": "Forbidden"
}
```

### Особенности по ролям

- **`MASTER`**: доступ к **`GET /clients/:id`** запрещён (**403**), поэтому «карточка клиента» этим методом для мастера не предназначена.
- Если бы ответ для мастера когда-либо отдавался, **`phone`** маскируется (скрывается).

### Ошибки

- **404** — клиент не найден  
- **403** — нет доступа к организации / роли  

---

## Обновить карточку: `PATCH /clients/:id`

### Query

| Параметр | Обязательный | Описание |
|----------|--------------|----------|
| `organizationId` | Нет | Только **DEVELOPER** |

### Тело (JSON) — все поля опциональны

**Контакт и ФИО**

| Поле | Описание |
|------|----------|
| `firstName` | string |
| `lastName` | string |
| `patronymic` | string \| **null** — очистить отчество |
| `instagram` | string \| **null** — очистить Instagram |
| `phone` | string (уникален в паре с организацией) |
| `registrationSource` | string \| **null** — **источник**; `null` очищает |

**Прочее**

| Поле | Описание |
|------|----------|
| `notes` | string |
| `birthDate` | `YYYY-MM-DD` \| **null** — очистить ДР |
| `gender` | `MALE` \| `FEMALE` \| **null** — «не указано» |
| `level` | `BRONZE` \| `SILVER` \| `GOLD` \| `DIAMOND` |
| `levelSetManually` | boolean |
| `bonuses` | integer ≥ 0 |
| `discount` | integer 0–100 |
| `balance` | integer ≥ 0 |

**Кастомная лояльность (CUSTOM)** — только с нужными правами:

| Поле | Описание |
|------|----------|
| `customLoyaltyOrganizationId` | string — должен совпадать с `organizationId` клиента |
| `customLoyaltyStudioId` | string — устарело; сервер маппит в organization |
| `customLoyaltyTierId` | string — зафиксировать tier вручную |
| `customLoyaltyClearManual` | boolean — снять ручной tier и пересчитать по оплатам |

### Ответ `200`

Обновлённая запись клиента из Prisma (**без** обогащения лояльностью/рефералками как в `GET /clients/:id` — это «плоский» результат `client.update`).

### Примеры `PATCH`

#### Частичное обновление (только ФИО и источник)

```http
PATCH /clients/cli_a7b3c9d2e1 HTTP/1.1
Host: api.example.com
Authorization: Bearer …
Content-Type: application/json

{
  "firstName": "Анна",
  "lastName": "Иванова-Петрова",
  "patronymic": "Сергеевна",
  "registrationSource": "Реклама у подъезда — исправлено вручную"
}
```

#### Очистка полей через `null`

```json
{
  "patronymic": null,
  "instagram": null,
  "registrationSource": null,
  "birthDate": null,
  "gender": null
}
```

#### Смена телефона

```json
{
  "phone": "+77007778899"
}
```

Если номер уже занят другим клиентом в этой организации — **400**:

```json
{
  "statusCode": 400,
  "message": "Клиент с таким номером телефона уже существует",
  "error": "Bad Request"
}
```

#### Кастомная лояльность (фрагмент; права Owner/Deputy)

```json
{
  "customLoyaltyOrganizationId": "org_k4m2n8p5q0",
  "customLoyaltyTierId": "slt_gold_tier_id"
}
```

Сброс ручного уровня и пересчёт по оплатам:

```json
{
  "customLoyaltyOrganizationId": "org_k4m2n8p5q0",
  "customLoyaltyClearManual": true
}
```

#### Ответ `200` после PATCH (плоский клиент)

```json
{
  "id": "cli_a7b3c9d2e1",
  "organizationId": "org_k4m2n8p5q0",
  "firstName": "Анна",
  "lastName": "Иванова-Петрова",
  "patronymic": "Сергеевна",
  "instagram": null,
  "phone": "+77001234567",
  "registrationSource": "Реклама у подъезда — исправлено вручную",
  "gender": "FEMALE",
  "birthDate": "1992-03-15T00:00:00.000Z",
  "level": "GOLD",
  "bonuses": 1500,
  "discount": 10,
  "balance": 0
}
```

После сохранения карточки сделайте **`GET /clients/:id`**, если нужны актуальные `referredList`, `levelProgress`, `organizationLoyalty`.

---

## Создать клиента: `POST /clients` (справочно для карточки)

Используется при создании нового клиента из CRM; тело — **`CreateClientDto`**.

**Обязательно:** `firstName`, `phone`.

**Опционально:** `lastName`, `patronymic`, `instagram`, `gender`, `birthDate`, `notes`, `bonuses`, `discount`, `balance`, `referrerCode` / `referralCode` (код другого клиента), **`referralLinkId`** (id маркетинговой ссылки — сервер заполнит `registrationSource` и связь).

**Query:** `organizationId` — только для **DEVELOPER**.

### Примеры `POST /clients`

#### Минимум (имя + телефон)

```http
POST /clients HTTP/1.1
Host: api.example.com
Authorization: Bearer …
Content-Type: application/json

{
  "firstName": "Пётр",
  "phone": "+77003334455"
}
```

#### Полная карточка + маркетинговая реферальная ссылка

Сервер сам заполнит **`registrationSource`** (и **`studioReferralLinkId`**) из ссылки `srl_…`:

```json
{
  "firstName": "Светлана",
  "lastName": "Нурланова",
  "patronymic": "Омаровна",
  "instagram": "@sveta_n",
  "phone": "+77001112233",
  "gender": "FEMALE",
  "birthDate": "1988-07-22",
  "notes": "Аллергия на латекс — уточнить",
  "referralLinkId": "srl_x9y8z7w6v5"
}
```

#### С реферальным кодом другого клиента (не промокод лендинга)

```json
{
  "firstName": "Арман",
  "phone": "+77004445566",
  "referrerCode": "AB12CD34"
}
```

#### Ответ `201` (фрагмент)

```json
{
  "id": "cli_newlycreated01",
  "organizationId": "org_k4m2n8p5q0",
  "firstName": "Светлана",
  "lastName": "Нурланова",
  "phone": "+77001112233",
  "referralCode": "XY99ZZ88",
  "registrationSource": "Лето 2025 — партнёры",
  "studioReferralLinkId": "srl_x9y8z7w6v5",
  "referredByClient": null
}
```

#### Ошибка: дубликат телефона

**400** — тот же текст, что и при конфликте в PATCH.

---

## Связанные эндпоинты карточки

| Метод | Назначение |
|-------|------------|
| `GET /clients/:id/statistics` | Статистика визитов / средний чек |
| `GET /clients/:id/appointments` | Записи клиента (`upcoming=true` — только предстоящие) |
| `GET /clients/:id/bonus-history` | История бонусов |
| `POST /clients/:id/bonus-adjustment` | Ручная корректировка бонусов (ограничения по ролям) |

### Примеры связанных запросов

Query `organizationId` везде, где указано в Swagger для **DEVELOPER**, — по тому же правилу, что и у `GET /clients/:id`.

#### Статистика визитов (`GET …/statistics`)

Учитываются только записи со статусом **`DONE`**. Сумма и средний чек — цена основной услуги (с учётом override мастера, если есть) плюс апсейлы; предоплата не входит.

```http
GET /clients/cli_a7b3c9d2e1/statistics HTTP/1.1
Host: api.example.com
Authorization: Bearer …
```

**200:**

```json
{
  "totalVisits": 15,
  "averageCheck": 2500,
  "totalSpent": 37500
}
```

#### Записи клиента (`GET …/appointments`)

Без `upcoming` — все записи, **сортировка по `startAt` по убыванию**. С `upcoming=true` — только будущие **`BOOKED`** и **`ARRIVED`**, сортировка по возрастанию.

```http
GET /clients/cli_a7b3c9d2e1/appointments?upcoming=true HTTP/1.1
Host: api.example.com
Authorization: Bearer …
```

**200** — массив объектов записи с вложенными `staff` (в т.ч. `staffProfile`), `service`, опционально `arrivedByUser`, `upsells`. Полный набор полей — в Swagger. Фрагмент:

```json
[
  {
    "id": "apt_k3j8m2n1",
    "studioId": "stu_branch01",
    "startAt": "2026-04-22T11:00:00.000Z",
    "endAt": "2026-04-22T12:30:00.000Z",
    "status": "BOOKED",
    "service": {
      "id": "svc_haircut",
      "name": "Стрижка",
      "defaultPrice": 8000
    },
    "staff": {
      "id": "usr_master01",
      "staffProfile": {
        "firstName": "Айгуль",
        "lastName": "Нурланова"
      }
    }
  }
]
```

#### История бонусов (`GET …/bonus-history`)

До **100** последних операций, новые сверху. Типы встречаются, например: `CASHBACK`, `PAYMENT_USE`, `REFERRAL_NEW_CLIENT`, `REFERRAL_REFERRER`, `REFERRAL_LINK_CASHBACK`, `MANUAL_ADJUSTMENT`.

Глобальный interceptor может убирать **`createdAt`** / **`updatedAt`** из объектов ответа — ориентируйтесь на живой ответ API.

```json
[
  {
    "id": "bhe_01",
    "clientId": "cli_a7b3c9d2e1",
    "organizationId": "org_k4m2n8p5q0",
    "amount": 240,
    "type": "CASHBACK",
    "appointmentId": "apt_done123",
    "comment": null
  },
  {
    "id": "bhe_02",
    "amount": -500,
    "type": "MANUAL_ADJUSTMENT",
    "appointmentId": null,
    "performedByUserId": "usr_owner01",
    "comment": "Корректировка по просьбе клиента"
  }
]
```

#### Ручная корректировка бонусов (`POST …/bonus-adjustment`)

Доступно только ролям **owner level** (владелец / заместитель и т.п., см. код). Тело: целое **`amount`** (начисление — положительное, списание — отрицательное), опционально **`comment`**.

```http
POST /clients/cli_a7b3c9d2e1/bonus-adjustment HTTP/1.1
Host: api.example.com
Authorization: Bearer …
Content-Type: application/json

{
  "amount": 500,
  "comment": "Бонус за отзыв"
}
```

**201** — обновлённые бонусы клиента:

```json
{
  "id": "cli_a7b3c9d2e1",
  "bonuses": 2000
}
```

**400** — если баланс ушёл бы в минус:

```json
{
  "statusCode": 400,
  "message": "Adjustment would result in negative bonus balance",
  "error": "Bad Request"
}
```

#### Маркетинговая ссылка для лендинга (`GET /studios/:studioId/referral-links/resolve/:linkId`)

Публичный метод **без** заголовка `Authorization`: проверка, что ссылка активна и принадлежит организации филиала. Результат используют на лендинге; для CRM при создании клиента в тело **`POST /clients`** передаётся **`referralLinkId`** (тот же id, что в URL).

```http
GET /studios/stu_branch01/referral-links/resolve/srl_x9y8z7w6v5 HTTP/1.1
Host: api.example.com
```

**200** — ссылка найдена и активна:

```json
{
  "valid": true,
  "sourceName": "Лето 2025 — партнёры",
  "cashbackEnabled": true,
  "cashbackPercent": 5
}
```

**200** — не найдена или неактивна:

```json
{
  "valid": false
}
```

---

*Актуально по коду в репозитории AIDA; при изменении DTO или `findOne` обновите этот файл.*
