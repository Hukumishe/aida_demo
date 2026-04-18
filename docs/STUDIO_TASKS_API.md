# API задач филиала (`StudioTask`)

Базовый URL API обозначен как `{API}` (например переменная окружения фронта). Все запросы с заголовком **`Authorization: Bearer <accessToken>`**.

Задачи хранятся на уровне **организации**, в URL везде указывается **филиал** `studioId` — бэкенд сопоставляет организацию по студии.

**Примечание:** глобальный interceptor убирает из JSON-ответов поля **`createdAt`**, **`updatedAt`** и **`timezone`** (рекурсивно). В примерах ниже эти поля **не показаны**; в сыром ответе без interceptor они могли бы присутствовать.

---

## Модель ответа (фрагменты)

Статус задачи: **`OPEN`** | **`DONE`** | **`CANCELLED`**.

Вложенные пользователи в ответах:

```json
{
  "id": "usr_…",
  "role": "MASTER",
  "staffProfile": { "firstName": "Анна", "lastName": "Иванова" }
}
```

Контролёр в массиве `controllers`:

```json
{
  "id": "stc_…",
  "taskId": "tsk_…",
  "userId": "usr_…",
  "user": {
    "id": "usr_…",
    "role": "MANAGER",
    "staffProfile": { "firstName": "Олег", "lastName": null }
  }
}
```

### Привязка к клиенту и записи

В задаче опционально:

- **`clientId`** / **`appointmentId`** — id в БД (в ответе дублируются на верхнем уровне объекта задачи).
- **`client`** — объект для отображения и перехода в карточку клиента: `id`, `firstName`, `lastName`, `phone` (или `null`, если привязки нет).
- **`appointment`** — объект для отображения и перехода к записи: `id`, `studioId`, `clientId`, `startAt`, `endAt`, `status`, `service: { id, name }` (или `null`).

**Правила бэкенда:**

- Запись (**`appointment`**) должна принадлежать **тому же филиалу**, что в URL (`studioId`), и той же организации.
- Если указана только запись — **`clientId`** берётся из записи автоматически.
- Если указаны и клиент, и запись — **`clientId`** должен совпадать с клиентом записи.

**Навигация во фронте (пример):**

- Клик по клиенту: маршрут к карточке клиента, например **`/studios/:studioId/clients/:clientId`** или ваш эквивалент с `client.id`.
- Клик по записи: маршрут к записи/журналу, например **`/studios/:studioId/appointments`** с выделением `appointment.id` или прямой путь к экрану записи, используя **`appointment.id`** и **`studioId`** из ответа.

---

## `GET /studios/:studioId/tasks`

Список задач организации, к которой относится филиал.

**Параметры:** только path — `studioId`.

**Поведение:**

- Роль **`MASTER`**: только задачи, где **`assigneeUserId`** = текущий пользователь.
- Остальные роли (при доступе к филиалу): все задачи этой организации.

**Пример запроса:**

```http
GET {API}/studios/stu_abc123/tasks
Authorization: Bearer eyJ…
```

**Пример ответа `200`:**

```json
[
  {
    "id": "tsk_01",
    "organizationId": "org_01",
    "title": "Проверить склад",
    "description": "Сверка остатков за неделю",
    "rejectionComment": null,
    "assigneeUserId": "usr_master01",
    "createdByUserId": "usr_admin01",
    "deadlineAt": "2026-04-20T15:00:00.000Z",
    "status": "OPEN",
    "deadlineReminderSentAt": null,
    "clientId": "cli_01",
    "appointmentId": "apt_01",
    "client": {
      "id": "cli_01",
      "firstName": "Иван",
      "lastName": "П.",
      "phone": "+77001234567"
    },
    "appointment": {
      "id": "apt_01",
      "studioId": "stu_abc123",
      "clientId": "cli_01",
      "startAt": "2026-04-19T10:00:00.000Z",
      "endAt": "2026-04-19T11:00:00.000Z",
      "status": "BOOKED",
      "service": { "id": "srv_01", "name": "Стрижка" }
    },
    "assignee": {
      "id": "usr_master01",
      "role": "MASTER",
      "staffProfile": { "firstName": "Анна", "lastName": "К." }
    },
    "createdBy": {
      "id": "usr_admin01",
      "role": "ADMIN",
      "staffProfile": { "firstName": "Олег", "lastName": null }
    },
    "controllers": [
      {
        "id": "stc_01",
        "taskId": "tsk_01",
        "userId": "usr_mgr01",
        "user": {
          "id": "usr_mgr01",
          "role": "MANAGER",
          "staffProfile": { "firstName": "Мария", "lastName": "С." }
        }
      }
    ]
  }
]
```

Сортировка на бэкенде: по **`deadlineAt` asc**, затем **`createdAt` desc**.

---

## `GET /studios/:studioId/tasks/:taskId`

Одна задача. Та же структура объекта, что элемент массива выше.

**Пример:**

```http
GET {API}/studios/stu_abc123/tasks/tsk_01
Authorization: Bearer eyJ…
```

**Доступ `MASTER`:** только если пользователь — исполнитель (`assigneeUserId`).

---

## `POST /studios/:studioId/tasks`

Создание задачи. Доступны роли: **`DEVELOPER`**, **`OWNER`**, **`DEPUTY_OWNER`**, **`SERVICE`**, **`MANAGER`**, **`ADMIN`**.

**Тело:**

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `title` | string | да | Название |
| `description` | string | нет | Описание |
| `assigneeUserId` | string | да | Исполнитель — активный пользователь **этого** `studioId` |
| `controllerUserIds` | string[] | нет | Уникальные id контролёров — активные сотрудники филиала с ролью `MANAGER`, `ADMIN`, `OWNER`, `DEPUTY_OWNER`, `SERVICE`, `DEVELOPER` |
| `deadlineAt` | string | да | Крайний срок, **ISO 8601** |
| `clientId` | string | нет | Клиент организации (для ссылки на карточку) |
| `appointmentId` | string | нет | Запись **в этом филиале**; если не указан `clientId`, подставится клиент из записи |

**Пример тела:**

```json
{
  "title": "Инвентаризация расходников",
  "description": "До конца смены",
  "assigneeUserId": "usr_master01",
  "controllerUserIds": ["usr_mgr01", "usr_admin01"],
  "deadlineAt": "2026-04-22T18:00:00.000Z",
  "clientId": "cli_01",
  "appointmentId": "apt_99"
}
```

**Пример ответа `201`:** объект задачи (как в GET), статус **`OPEN`**, **`createdByUserId`** = автор запроса. Исполнителю может уйти уведомление в колокольчик.

---

## `PATCH /studios/:studioId/tasks/:taskId`

Обновление задачи.

**Тело (все поля опциональны):**

| Поле | Описание |
|------|----------|
| `title`, `description` | Строки |
| `assigneeUserId` | Новый исполнитель (тот же филиал) |
| `controllerUserIds` | **Полная замена** списка контролёров |
| `deadlineAt` | ISO 8601 (при смене сбрасывается напоминание о дедлайне на бэкенде) |
| `status` | `OPEN` \| `DONE` \| `CANCELLED` |
| `rejectionComment` | Текст отказа |
| `clientId` | string или **`null`** — сменить/снять привязку к клиенту |
| `appointmentId` | string или **`null`** — сменить/снять привязку к записи |

**Мастер (`MASTER`):** может менять только **`status`** и **`rejectionComment`**; допустимые статусы — `DONE`, `OPEN`, `CANCELLED`. При **`CANCELLED`** поле **`rejectionComment`** обязательно (непустая строка). Привязки клиента/записи мастер **не меняет**.

**Пример — мастер завершил задачу:**

```json
{ "status": "DONE" }
```

**Пример — мастер отказался:**

```json
{
  "status": "CANCELLED",
  "rejectionComment": "Нет доступа к складу в эту смену"
}
```

**Пример — менеджер переназначил и обновил срок:**

```json
{
  "assigneeUserId": "usr_master02",
  "deadlineAt": "2026-04-25T12:00:00.000Z",
  "controllerUserIds": ["usr_mgr01"]
}
```

**Ответ `200`:** полный объект задачи (как GET).

---

## `DELETE /studios/:studioId/tasks/:taskId`

Удаление. Роли: **`DEVELOPER`**, **`OWNER`**, **`DEPUTY_OWNER`**, **`SERVICE`**, **`MANAGER`**, **`ADMIN`** (не **`MASTER`**).

**Пример ответа `200`:**

```json
{ "success": true }
```

---

## Ошибки (кратко)

- **`403`** — нет доступа к филиалу или (для мастера) не своя задача.
- **`404`** — задача не найдена в организации филиала.
- **`400`** — невалидные даты, контролёры/исполнитель не из филиала, для мастера нарушены правила статуса/комментария.

---

## Связанное поведение

- При создании задачи создаётся уведомление исполнителю.
- При отказе мастером (`CANCELLED` + комментарий) постановщик может получить отдельное уведомление.
- Планировщик шлёт напоминание о приближающемся дедлайне (логика на бэкенде, поле `deadlineReminderSentAt`).
