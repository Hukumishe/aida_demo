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

---

## Создать клиента: `POST /clients` (справочно для карточки)

Используется при создании нового клиента из CRM; тело — **`CreateClientDto`**.

**Обязательно:** `firstName`, `phone`.

**Опционально:** `lastName`, `patronymic`, `instagram`, `gender`, `birthDate`, `notes`, `bonuses`, `discount`, `balance`, `referrerCode` / `referralCode` (код другого клиента), **`referralLinkId`** (id маркетинговой ссылки — сервер заполнит `registrationSource` и связь).

**Query:** `organizationId` — только для **DEVELOPER**.

---

## Связанные эндпоинты карточки

| Метод | Назначение |
|-------|------------|
| `GET /clients/:id/statistics` | Статистика визитов / средний чек |
| `GET /clients/:id/appointments` | Записи клиента (`upcoming=true` — только предстоящие) |
| `GET /clients/:id/bonus-history` | История бонусов |
| `POST /clients/:id/bonus-adjustment` | Ручная корректировка бонусов (ограничения по ролям) |

---

*Актуально по коду в репозитории AIDA; при изменении DTO или `findOne` обновите этот файл.*
