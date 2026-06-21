## Lovable: вкладка «Лендинг» в админке

Нужно добавить во фронтенд вкладку **«Лендинг»** в админке (только для ролей `SERVICE`, `OWNER`, `DEPUTY_OWNER`). Внутри вкладки три раздела:

1. **Акции**
2. **Мастера**
3. **Услуги**

Типовой backend уже реализован (NestJS + Prisma). Все запросы к этим эндпоинтам делаются с заголовком `Authorization: Bearer <accessToken>`.

---

### 1. Раздел «Акции» (Promotions)

**API (только для ролей OWNER / DEPUTY_OWNER / SERVICE):**

- `GET /studios/:studioId/landing/promotions`  
  Возвращает массив акций. У каждой акции:
  - промо‑поля: `id`, `studioId`, `type` (`DISCOUNT` или `ONE_PLUS_ONE`), `title`, `description`, `isActive`, `discountPercent?`, `serviceIdA?`, `serviceIdB?`, `bundlePrice?`, `createdAt`, `updatedAt`
  - `services`: массив объектов вида `{ id, promotionId, serviceId, service }`, где `service` — объект услуги (`id`, `name`, `defaultPrice`, `defaultDurationMin`, …)
  - `codes`: массив промокодов `{ id, promotionId, code, usageLimit, usedCount, expiresAt, isActive, createdAt }`

- `POST /studios/:studioId/landing/promotions`  
  Создать акцию. Тело (JSON):

  ```json
  {
    "type": "DISCOUNT",
    "title": "2 услуги со скидкой",
    "description": "Описание акции",
    "discountPercent": 10,
    "serviceIds": ["SERVICE_ID_1", "SERVICE_ID_2"]
  }
  ```

  или для 1+1:

  ```json
  {
    "type": "ONE_PLUS_ONE",
    "title": "Маникюр + педикюр за 15000",
    "description": "Описание акции 1+1",
    "serviceIdA": "SERVICE_ID_A",
    "serviceIdB": "SERVICE_ID_B",
    "bundlePrice": 15000
  }
  ```

  - для `DISCOUNT` обязательно `discountPercent` и массив `serviceIds` (услуги, на которые действует скидка);
  - для `ONE_PLUS_ONE` обязательны `serviceIdA`, `serviceIdB`, `bundlePrice`.

  Backend автоматически создаёт **один промокод** для акции (поле `codes[0].code` в ответе).

- `PATCH /studios/:studioId/landing/promotions/:id`  
  Частичное обновление тех же полей (все опциональны). Для DISCOUNT при передаче `serviceIds` список услуг полностью перезаписывается.

- `DELETE /studios/:studioId/landing/promotions/:id`  
  Удаление акции.

**UI‑требования:**

- Показать список акций в виде таблицы или карточек:
  - колонки: заголовок (`title`), тип (Скидка / 1+1), краткое описание, список услуг и % для DISCOUNT, две услуги и `bundlePrice` для ONE_PLUS_ONE, а также основной промокод (например, первый из `codes`).
- Кнопка «Создать акцию»:
  1. Шаг 1 — выбор типа: `"Скидка"` (`DISCOUNT`) или `"1+1"` (`ONE_PLUS_ONE`).
  2. Шаг 2:
     - если скидка:
       - выпадающий список услуг (подтягивать из `GET /studios/:studioId/services`),
       - возможность выбрать одну или несколько услуг,
       - поле ввода процента скидки `discountPercent` (0–100);
     - если 1+1:
       - выбор **двух** услуг `serviceIdA` и `serviceIdB` (также через список услуг студии),
       - поле ввода `bundlePrice` (общая цена за две услуги).
- После успешного создания выводить сгенерированный промокод (например, рядом с акцией или в модалке подтверждения).
- Поддержать редактирование (модалка с формой + `PATCH`) и удаление (`DELETE`) акций.

---

### 2. Раздел «Мастера» (Masters)

Раздел предназначен для управления тем, **какие мастера отображаются на лендинге**, и в каком порядке. Настройки **единые для всей сети** (organization), не per-филиал.

**API (админка — использовать этот):**

- `GET /organizations/:organizationId/landing/masters`  
  `:organizationId` из JWT (`auth/me`).

  Ответ:

  ```json
  {
    "organizationId": "org_...",
    "items": [
      {
        "staffUserId": "usr_...",
        "isVisible": true,
        "order": 0,
        "primaryStudioId": "stu_...",
        "primaryStudioName": "Филиал 1",
        "workStudios": [{ "id": "stu_...", "name": "Филиал 1" }],
        "staff": { "...": "..." }
      }
    ]
  }
  ```

- `PATCH /organizations/:organizationId/landing/masters`  
  Полностью обновляет конфигурацию видимости и порядка **для всей сети**. Тело:

  ```json
  {
    "items": [
      { "staffUserId": "USER_ID_1", "isVisible": true,  "order": 0 },
      { "staffUserId": "USER_ID_2", "isVisible": false, "order": 1 }
    ]
  }
  ```

  В `items` можно передавать мастеров из **разных филиалов**.

**API (публичный лендинг):**

- `GET /studios/:studioId/landing/masters` — только мастера, **работающие в этом филиале**, с общими флагами `isVisible` / `order`. Не использовать для экрана настроек админки.

**Legacy:** `PATCH /studios/:studioId/landing/masters` — alias (то же сохранение на organization). Новый UI — только organization endpoints.

Промпт Lovable: `LOVABLE_LANDING_MASTERS_UNIFIED_PROMPT.md`.

**UI‑требования:**

- **Один экран** на всю сеть, не дублировать по филиалам CRM.
- Показать всех активных сотрудников **всех филиалов** из `items`:
  - имя и фамилия (из `staff.staffProfile.firstName`/`lastName`),
  - должность (`title`),
  - аватар,
  - **филиал** — `primaryStudioName` или `workStudios`.
- Для каждого мастера:
  - чекбокс «Показывать на сайте» (`isVisible`),
  - drag-and-drop для `order`.
- Сохранение: один `PATCH /organizations/:organizationId/landing/masters` с полным массивом `items`.

---

### 3. Раздел «Услуги» (Service cards)

Раздел для настройки карточек услуг, которые будут показаны на лендинге. Цена берётся из базы, а в карточке настраиваются заголовок, описание и картинка + порядок.

**API:**

- `GET /studios/:studioId/landing/services`  
  Возвращает массив карточек:

  ```ts
  {
    id: string;
    studioId: string;
    serviceId: string;
    title: string | null;
    description: string | null;
    imageUrl: string | null;
    order: number;
    createdAt: string;
    updatedAt: string;
    service: {
      id: string;
      name: string;
      defaultPrice: number | null;
      defaultDurationMin: number;
      // другие поля услуги
    };
  }
  ```

- `POST /studios/:studioId/landing/services`  
  Создать карточку услуги. Тело:

  ```json
  {
    "serviceId": "SERVICE_ID",
    "title": "Опциональный заголовок",
    "description": "Опциональное описание",
    "imageUrl": "https://example.com/image.jpg",
    "order": 0
  }
  ```

  - `serviceId` — обязательный, должен существовать среди услуг студии;
  - `order` можно не передавать: backend выставит следующий по порядку.

- `PATCH /studios/:studioId/landing/services/:id`  
  Частичное обновление полей карточки (`title?`, `description?`, `imageUrl?`).

- `DELETE /studios/:studioId/landing/services/:id`  
  Удаление карточки услуги с лендинга.

- `PATCH /studios/:studioId/landing/services/reorder`  
  Обновление порядка карточек (используется после drag&drop). Тело:

  ```json
  {
    "items": [
      { "id": "CARD_ID_1", "order": 0 },
      { "id": "CARD_ID_2", "order": 1 }
    ]
  }
  ```

**UI‑требования:**

- Показать карточки услуг в порядке `order`. Для каждой карточки:
  - заголовок: `title` если задан, иначе `service.name`,
  - цена: `service.defaultPrice` (если null, можно показывать «по запросу» или не выводить),
  - описание: `description`,
  - картинка: `imageUrl` (если нет — использовать плейсхолдер).
- Кнопка «Добавить услугу»:
  - выпадающий список услуг (получать из `GET /studios/:studioId/services`),
  - поля `title`, `description`, `imageUrl`,
  - по сохранению вызывать `POST /studios/:studioId/landing/services`.
- Поддержать редактирование существующей карточки (модалка + `PATCH`) и удаление (`DELETE`).
- Реализовать drag&drop‑перестановку карточек:
  - после перестановки пересчитать `order` (0,1,2,…) и отправить один `PATCH /studios/:studioId/landing/services/reorder` с массивом `items`.

---

### 4. Права доступа и общие моменты

- Вкладка **«Лендинг»** и все запросы к `/studios/:studioId/landing/...` должны быть доступны только ролям: `SERVICE`, `OWNER`, `DEPUTY_OWNER`.
- Если роль пользователя не входит в этот список — вкладку лендинга не показывать и запросы к этим эндпоинтам не выполнять.
- Соблюдать существующий визуальный стиль админки (кнопки, таблицы/карточки, модалки, drag&drop).
- Покрыть стандартные состояния: загрузка, ошибка, пустые списки (нет акций/мастеров/услуг).

