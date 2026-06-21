# Промпт для Lovable: дневник мастера — личные и общие заметки

Скопируйте блок **«Промпт»** ниже в чат Lovable.

Backend AIDA обновлён: у заметок дневника тип **`visibility`**: `PRIVATE` | `SHARED`.

---

## Промпт

### Задача

В **дневнике мастера** о клиенте добавить **два типа заметок** при создании и отображении.

| Тип API | Подпись UI | Кто видит (факт) | Текст в UI при выборе |
|---------|------------|------------------|------------------------|
| `PRIVATE` | **Личная** | мастер-автор + owner/deputy/service | **«Видите только вы (мастер)»** |
| `SHARED` | **Общая** | все с доступом к клиенту (master, admin, manager, owner…) | «Видят все сотрудники с доступом к клиенту» |

В описании личного типа **намеренно не упоминать** owner/deputy — только «видите только вы».

---

### API

**Типы для селекта (подписи с бэкенда):**

`GET /staff-diary/visibility-options`

```json
[
  {
    "value": "PRIVATE",
    "label": "Личная",
    "description": "Видите только вы (мастер)"
  },
  {
    "value": "SHARED",
    "label": "Общая",
    "description": "Видят все сотрудники с доступом к клиенту"
  }
]
```

Используй **`description`** из ответа под селектом типа (не хардкодить на фронте).

**Создание заметки:**

`POST /appointments/:appointmentId/staff-diary`

```json
{
  "body": "Текст",
  "visibility": "PRIVATE"
}
```

`visibility` опционален, по умолчанию `PRIVATE`.

**Ответ / список — поле `visibility`:**

```json
{
  "items": [
    {
      "id": "csd_...",
      "visibility": "SHARED",
      "body": "...",
      "author": { "staffUserId": "usr_...", "name": "Иван Петров" }
    }
  ],
  "myNotesCount": 3
}
```

- `author` есть у **общих** заметок и у записей, когда owner смотрит все.
- У **своих личных** заметок мастера `author` может отсутствовать.

**Редактирование:**

`PATCH /staff-diary/:id` — `{ "body": "...", "visibility": "SHARED" }`

---

### Права просмотра

| Роль | Что видит в дневнике |
|------|----------------------|
| **MASTER** (своя запись) | свои **личные** + все **общие** по клиенту |
| **ADMIN / MANAGER** | только **общие** (в записи и в карточке клиента) |
| **OWNER / DEPUTY / SERVICE** | **все** заметки всех мастеров |
| **MASTER** (чужая запись) | нет доступа |

`GET /appointments/:id/staff-diary` — роли: MASTER, ADMIN, MANAGER, OWNER, DEPUTY, SERVICE, DEVELOPER.

`GET /clients/:clientId/staff-diary` — OWNER, DEPUTY, SERVICE, ADMIN, MANAGER, DEVELOPER (admin/manager — только SHARED).

---

### UI — мастер (модалка записи / bottom sheet)

1. Перед textarea — **сегмент или select типа**:
   - загрузить опции из `GET /staff-diary/visibility-options`;
   - по умолчанию **Личная** (`PRIVATE`);
   - под селектом — `description` выбранного типа (серый мелкий текст).
2. В списке заметок — **бейдж**: «Личная» / «Общая» (`visibility`).
3. У **общих** чужих заметок показывать **`author.name`**.
4. Редактирование своей заметки — можно сменить тип через PATCH.

---

### UI — ADMIN / MANAGER

- Блок дневника в **деталях записи** и вкладка в **карточке клиента** «Заметки мастеров»:
  - только **общие** заметки;
  - с именем автора;
  - **без** формы добавления (создаёт только MASTER).

---

### UI — Owner / Deputy

- Вкладка «Заметки мастеров» — все типы, бейдж «Личная»/«Общая», автор у всех.

---

### TypeScript

```ts
export type ClientStaffDiaryVisibility = 'PRIVATE' | 'SHARED';

export interface ClientStaffDiaryEntry {
  id: string;
  clientId: string;
  staffUserId: string;
  appointmentId: string | null;
  visibility: ClientStaffDiaryVisibility;
  body: string;
  createdAt: string;
  updatedAt: string;
  author?: { staffUserId: string; name: string };
}
```

---

### Чеклист

- [ ] При создании мастер выбирает тип; описание личного — «видите только вы (мастер)».
- [ ] Опции типов из `GET /staff-diary/visibility-options`.
- [ ] MASTER видит свои личные + все общие; ADMIN — только общие.
- [ ] Owner видит все с бейджами типа.
- [ ] Не путать с `client.notes` и `appointment.comment`.

### Не делать

- Не писать в UI, что личные видит owner (только в этом промпте для разработчика).
- Не давать ADMIN создавать заметки дневника.

---

## Деплoy

`npx prisma migrate deploy` (миграция `20260620180000_client_staff_diary_visibility`).
