# Промпт для Lovable: карточка клиента (отчество, Instagram, источник) + запись по рефералке

Скопируйте блок ниже в Lovable как задачу на фронтенд. Бэкенд уже поддерживает описанное поведение.

---

## API карточки клиента (AIDA)

Базовый URL API: переменная окружения фронта (например production). Все запросы с заголовком **`Authorization: Bearer <accessToken>`**, кроме явно публичных эндпоинтов.

### `GET /clients/:id` — загрузка карточки

**Query (опционально)**

| Параметр | Когда |
|----------|--------|
| `organizationId` | Только роль **DEVELOPER**: клиент должен принадлежать этой организации (контекст экрана). |

Устаревший query `studioId` в Swagger может быть помечен как не влияющий на лояльность — для карточки ориентируйтесь на `organizationId` клиента из ответа.

**Ответ `200`** — объект клиента **плюс вычисляемые поля** для UI.

**Скалярные поля клиента** (из БД; в JSON глобальный interceptor **убирает** `createdAt` и `updatedAt` у объектов, но сами даты в полях вроде `birthDate` остаются):

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | ID клиента |
| `organizationId` | string | Организация (сеть) |
| `firstName` | string | Имя |
| `lastName` | string \| null | Фамилия |
| `patronymic` | string \| null | Отчество |
| `instagram` | string \| null | Instagram |
| `phone` | string | Телефон (**для роли MASTER в ответе скрывается** — поле может отсутствовать) |
| `notes` | string \| null | Заметки |
| `gender` | `MALE` \| `FEMALE` \| null | Пол |
| `birthDate` | string (ISO) \| null | День рождения |
| `level` | `BRONZE` \| `SILVER` \| `GOLD` \| `DIAMOND` | Уровень (PRESET) |
| `levelSetManually` | boolean | DIAMOND / ручной уровень и т.п. |
| `totalPaidForLevel` | number | Сумма оплат для уровня (PRESET) |
| `bonuses` | number | Баллы |
| `discount` | number | Скидка % |
| `balance` | number | Баланс |
| `isBlacklisted` | boolean | Чёрный список |
| `blacklistReason` | string \| null | Причина ЧС |
| `referralCode` | string \| null | Код «приведи друга» |
| `registrationSource` | string \| null | **Источник** (текст; часто с маркетинговой реф. ссылки) |
| `studioReferralLinkId` | string \| null | ID маркетинговой ссылки, если был |
| `referredByClientId` | string \| null | Кто привёл (клиент) |
| `referralFirstVisitBonusApplies` / начисления | boolean | Флаги реф. программы (см. поля в ответе) |
| `referredByClient` | object \| null | Укороченный профиль пригласившего: `id`, `firstName`, `lastName`, `referralCode`, `phone` |

**Дополнительно в ответе `findOne`** (не колонки таблицы `clients`, а вычисления для карточки):

| Поле | Описание |
|------|----------|
| `referredCount` | Число приведённых клиентов |
| `referredList` | Массив `{ clientId, firstName, lastName, usedAt }` — когда «сработал» реферал |
| `cashbackPercent` | Кэшбэк % для отображения (PRESET или CUSTOM) |
| `levelProgress` | Прогресс уровня (зависит от режима лояльности организации) |
| `organizationLoyalty` | Для **CUSTOM**: уровни, milestones, `currentTier`, `nextStep` и т.д. |
| `studioLoyalty` | **Устарело** — дублирует `organizationLoyalty` |
| `referralCodeInputDisabled` | Блокировать ввод реф. кода до первого визита с рефералом |
| `referralFirstVisitDiscountApplies` | Скидка за первый визит по реф. (по настройкам орг.) |
| `referralFirstVisitBonusApplies` | Бонусы за первый визит по реф. |

**Ошибки:** `404` — нет клиента; `403` — нет доступа (в т.ч. MASTER не может открыть карточку по этому маршруту).

---

### `PATCH /clients/:id` — сохранение карточки

Тело — **`UpdateClientDto`**: передавайте **только изменённые** поля (частичное обновление).

| Поле в JSON | Тип | Примечание |
|-------------|-----|------------|
| `firstName` | string | |
| `lastName` | string | |
| `patronymic` | string \| **null** | `null` — очистить отчество |
| `instagram` | string \| **null** | `null` — очистить |
| `registrationSource` | string \| **null** | Источник; `null` — очистить |
| `phone` | string | Уникальность в рамках организации |
| `birthDate` | `YYYY-MM-DD` \| **null** | `null` — сбросить дату рождения |
| `gender` | `MALE` \| `FEMALE` \| **null** | `null` — «не указано» |
| `notes` | string | |
| `level` | `BRONZE` \| `SILVER` \| `GOLD` \| `DIAMOND` | DIAMOND — только Owner/Deputy |
| `levelSetManually` | boolean | |
| `bonuses` | number ≥ 0 | |
| `discount` | number 0–100 | |
| `balance` | number ≥ 0 | |
| `customLoyaltyOrganizationId` | string | Режим CUSTOM лояльности |
| `customLoyaltyStudioId` | string | Устарело; сервер мапит на организацию |
| `customLoyaltyTierId` | string | Назначить tier вручную |
| `customLoyaltyClearManual` | boolean | Сбросить ручной tier |

**Ответ `200`** — обновлённый клиент (как в `GET`, без полного блока лояльности из `findOne` — после PATCH обычно делают повторный `GET` при необходимости).

**Ошибки:** `400` (дубликат телефона и т.д.), `403`, `404`.

---

### `POST /clients` — создание клиента (для справки)

Тело — **`CreateClientDto`**: обязательны **`firstName`**, **`phone`**. Опционально: `lastName`, `patronymic`, `instagram`, `gender`, `birthDate`, `notes`, `bonuses`, `discount`, `balance`, `referrerCode` / `referralCode` (код другого клиента), **`referralLinkId`** (маркетинговая ссылка → сервер выставит `registrationSource` и `studioReferralLinkId`).

Поиск в списке: **`GET /clients?q=`** — поиск по имени, фамилии, **отчеству**, телефону.

---

## Контекст API: рефералка и источник (кратко)

| UI (рус.)   | JSON в API              | Примечание |
|------------|-------------------------|------------|
| Отчество   | `patronymic`            | Строка, опционально |
| Instagram  | `instagram`             | `@username` или URL |
| Источник   | `registrationSource`    | Текст источника (часто с маркетинговой реф. ссылки). При **`POST /clients`** с **`referralLinkId`** сервер подставляет `sourceName` из ссылки. В карточке можно править вручную через **`PATCH`** или очистить `null`. |

### Реферальная ссылка (лендинг)

Публичная проверка ссылки до отправки формы:

`GET /studios/:studioId/referral-links/resolve/:linkId`

Ответ при успехе: `{ valid: true, sourceName, cashbackEnabled, cashbackPercent }`.

Используйте `sourceName` чтобы **показать** пользователю поле «Источник» (read-only или prefilled).

При **создании клиента** (запись с лендинга) передайте в теле **`referralLinkId`** = тот же `linkId` из URL. Сервер сам выставит `registrationSource` = названию источника ссылки; подделать текст с фронта нельзя — только id ссылки.

### Nextbot (если актуально)

`POST /nextbot/clients/register` — в теле те же поля CreateClientDto, в т.ч. `referralLinkId`, `patronymic`, `instagram`.

---

## Задача для Lovable

1. **Карточка клиента (CRM)**  
   - Добавить поля: **Отчество** (`patronymic`), **Instagram** (`instagram`), **Источник** (`registrationSource`).  
   - Отображать и сохранять через существующие `GET/PATCH /clients/:id` (или как у вас заведено).  
   - Подпись «Источник» — показывать значение `registrationSource`; если пусто — «не указан».

2. **Лендинг: переход по рефералке → окно записи**  
   - Реализовать URL с параметром, например: `?ref=<linkId>` (или отдельный path-сегмент), где `linkId` — id из CRM «маркетинговая реферальная ссылка».  
   - При загрузке страницы с `ref`:  
     - вызвать `GET /studios/:studioId/referral-links/resolve/:linkId`;  
     - если `valid: true`, **открыть модальное окно записи** (то же, что и по кнопке «Записаться») и подставить в форму **поле «Источник»** текстом `sourceName` (только отображение; в submit уходит `referralLinkId`).  
   - При отправке формы создания клиента / записи передавать **`referralLinkId`** = значение из `ref`, чтобы в карточке клиента **источник сохранился на бэкенде** автоматически.

3. **Безопасность UX**  
   - Не отправлять «источник» свободным текстом вместо id ссылки для автозаполнения из рефералки; для сценария рефералки всегда передавать `referralLinkId`.

4. **StudioId**  
   - `studioId` для resolve и записи брать из контекста лендинга (текущий салон страницы).

После деплоя бэкенда выполните миграцию БД на Railway (`prisma migrate deploy`), чтобы появились колонки `patronymic` и `instagram`.
