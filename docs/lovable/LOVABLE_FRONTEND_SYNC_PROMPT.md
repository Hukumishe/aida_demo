# Промпт для Lovable: синхронизация фронта с бэкендом AIDA

Скопируйте блок **«Задача»** в чат Lovable. Детали контрактов API — в репозитории бэкенда в `docs/CLIENT_CARD_API.md` и в `docs/lovable/*.md`.

---

## Контекст

Бэкенд — NestJS + Prisma (репозиторий **aida_demo**). Авторизация CRM: **`Authorization: Bearer <JWT>`**.  
Глобально из JSON-ответов могут вырезаться **`createdAt`**, **`updatedAt`**, **`timezone`** (рекурсивно).

---

## Задача

### 1. Карточка клиента

- Ориентируйтесь на **`GET /clients/:id`** и **`PATCH /clients/:id`** — полный перечень полей запроса/ответа: **`docs/CLIENT_CARD_API.md`**.
- Отобразить и сохранять: **имя, фамилия, отчество** (`patronymic`), **телефон**, **Instagram** (`instagram`), **источник** (`registrationSource`), пол, ДР, заметки, бонусы/скидка/баланс, уровень, ЧС, реферальные поля — как в документе.
- **`registrationSource`** при создании через маркетинг задаётся сервером при **`referralLinkId`** в **`POST /clients`**; в карточке можно править через **`PATCH`** или очистить `null`.
- После **`PATCH`** ответ — упрощённый объект клиента; при необходимости обновления лояльности/рефералок сделайте повторный **`GET /clients/:id`**.

### 2. Список клиентов

- **`GET /clients?q=`** — поиск по имени, фамилии, **отчеству**, телефону.

### 3. Лендинг: модалка «Запись в удобное время»

- Сценарий URL **`?ref=<referralLinkId>`**, resolve: **`GET /studios/:studioId/referral-links/resolve/:linkId`**, подстановка источника, отправка **`referralLinkId`** при создании клиента — см. **`docs/lovable/LOVABLE_LANDING_CALLBACK_MODAL_PROMPT.md`**.
- Форма заявки: склеивание «удобное время» + комментарий в **`notes`** с префиксом `[Заявка с лендинга]`, если отдельного поля в API нет.

### 4. Журнал записей и лист ожидания

- Обычные записи: **`GET /studios/:studioId/appointments`** (как сейчас).
- **Лист ожидания** (когда слот занят по полной длительности услуги, но заявку нужно сохранить):
  - Список: **`GET /studios/:studioId/waitlist-entries`** (query: `date`, `status` — по умолчанию на бэкенде **PENDING**; `status=all` — все статусы).
  - Отмена: **`POST .../waitlist-entries/:entryId/cancel`**.
  - Перевод в запись: **`POST .../waitlist-entries/:entryId/convert`** (если слот освободился).
- Создание записи с фолбэком в лист: в теле **`POST /studios/:studioId/appointments`** для каналов лендинга/CRM — **`preferWaitlist: true`**, **`waitlistSource: LANDING`** (или как договоритесь с бэкендом). Ответ может быть **`{ outcome: 'booked', appointment }`** или **`{ outcome: 'waitlist', waitlistEntry }`**. Nextbot с бэкенда **`preferWaitlist`** НЕ шлёт: при занятом слоте **`create_booking_request`** возвращает **409 Conflict** (без авто-очереди), а постановка в очередь выполняется отдельной функцией **`add_to_waitlist`** (`POST /nextbot/add-to-waitlist`) по явному согласию клиента.

### 5. Запись и слоты: длительность услуги

- Длительность записи на бэкенде считается от **`Service.defaultDurationMin`** (и override мастера), не фиксированные «60 мин».
- **`GET .../nextbot/studios/:studioId/availability-raw`** (check_availability): нужно передать **`serviceId`** (предпочтительно после выбора услуги) **или** явный **`durationMinutes`**; без обоих — ошибка **400**.

### 6. Прайс и категории (Nextbot)

- Категории: **`GET /nextbot/service-categories`**.
- Услуги: **`GET /nextbot/studios/:studioId/services`** с query **`organizationId`**, **`category`**, **`audience`** — см. обёртки в `nextbot/xmind_python/`.

---

## Ограничения

- Не подменяйте **`registrationSource`** произвольной строкой вместо **`referralLinkId`** для маркетинговой рефералки — источник фиксируется сервером.
- Публичный лендинг без JWT не может напрямую вызывать **`POST /clients`** — нужен прокси с учётными данными или отдельный публичный эндпоинт (согласовать с бэкендом).

---

*Обновляйте экраны при изменении `docs/CLIENT_CARD_API.md` и Swagger бэкенда.*
