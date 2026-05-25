# Промпт для Lovable: журнал — список, личное время, профиль мастера

Скопируйте блок ниже в Lovable.

---

## Промпт (copy-paste)

```
Реализуй три доработки CRM. Бэкенд готов — API менять не нужно.

Base: VITE_API_URL (Railway). Authorization: Bearer <accessToken>.

---

### 1. Кнопка «Список» в журнале записей

Страница «Журнал записей» сейчас — сетка (время × мастера). Добавь переключатель режимов:

- **Сетка** (как сейчас)
- **Список** — таблица/карточки на выбранный день

**Загрузка данных (рекомендуется один запрос):**

GET /studios/:studioId/appointment-log?date=YYYY-MM-DD

Ответ:
```json
{
  "date": "2026-05-24",
  "supportedViewModes": ["grid", "list"],
  "appointments": [ /* записи клиентов, с author если есть */ ],
  "personalTimeSlots": [ /* busy slots, см. п.2 */ ]
}
```

Альтернатива: два запроса `GET .../appointments?date=` и `GET .../busy-slots?date=`.

**Режим «Список»:** колонки — время, мастер, клиент, услуга, статус, автор (`author` если есть). Сортировка по `startAt`. Клик по строке → та же модалка записи, что в сетке.

Сохраняй выбранный режим в localStorage (`appointmentLogView=grid|list`).

---

### 2. Личное время — серый цвет в сетке

`personalTimeSlots` из appointment-log (или busy-slots) — это **личное время мастера**, не клиентская запись.

У каждого слота:
- `slotType`: `"PERSONAL_TIME"`
- `displayLabel`: причина или «Личное время»
- `uiColorHint`: `"gray"` — **фон ячейки серый**, текст `displayLabel` или `comment`
- `staffUserId`, `startAt`, `endAt`, `comment`

В **сетке** рисуй эти блоки в колонке мастера на пересечении времени, **не** как appointment (другой цвет статуса).

В **списке** — отдельные строки с бейджем «Личное время», серый фон строки.

Создание личного времени (MASTER): POST /studios/:studioId/busy-slots с обязательным `comment`. См. LOVABLE_MASTER_SCHEDULE_AND_PERSONAL_TIME.md.

---

### 3. Профиль мастера — только просмотр (услуги и тайминги)

Для роли **MASTER** — экран «Мой профиль» (меню или иконка):

**GET** `/staff/:userId/profile` где `userId` = текущий пользователь из JWT / auth/me.

В ответе:
- `staffProfile`, `services[]` — у каждой услуги **`durationMin`** и **`price`** (уже с учётом override мастера)
- **`permissions`**:
  - `canEditProfile: false`
  - `canEditServices: false`
  - `canEditServiceOverrides: false`
  - `canDismissStaff: false`

**UI:**
- Показать ФИО, должность, фото, био (read-only поля).
- Блок **«Мои услуги»**: таблица — название, **длительность (durationMin мин)**, цена (₸).
- **Не показывать** кнопки: Редактировать, Сохранить, Добавить услугу, Удалить, Override.
- При `permissions.canEditProfile === false` скрыть все PATCH/POST на профиль и услуги (403 с бэкенда при попытке).

Дополнительно: **GET** `/staff/:userId/services` — тот же список с `durationMin` / `price` на каждой строке.

MASTER не может открыть чужой профиль (`GET /staff/:otherId/profile` → 403).

Для **MANAGER/OWNER** на карточке другого мастера — `permissions` могут быть true; оставить редактирование как сейчас.

---

### Чеклист

- [ ] Переключатель Сетка / Список в журнале
- [ ] appointment-log (или appointments + busy-slots) на выбранную дату
- [ ] Личное время серое в сетке и в списке (`uiColorHint: gray`)
- [ ] MASTER: экран профиля read-only, таблица услуг с durationMin
- [ ] Скрыты кнопки редактирования при permissions.canEditProfile === false

### Не делать

- Не красить busy slot как обычную запись клиента
- Не давать MASTER редактировать услуги/профиль в UI
- Не менять бэкенд

Сверка: LOVABLE_APPOINTMENT_LOG.md, LOVABLE_MASTER_SCHEDULE_AND_PERSONAL_TIME.md, LOVABLE_EDIT_STAFF_PROFILE.md.
```

---

## API (кратко)

| Endpoint | Назначение |
|----------|------------|
| `GET /studios/:studioId/appointment-log?date=` | Журнал: appointments + personalTimeSlots |
| `GET /studios/:studioId/busy-slots?date=` | Только личное время |
| `GET /staff/:id/profile` | Профиль + `permissions` + `services[].durationMin` |
| `GET /staff/:id/services` | Услуги с таймингами |
