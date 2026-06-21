# Промпт для Lovable: фильтры «Мои записи» (ADMIN / MANAGER)

Скопируйте блок **«Промпт»** ниже в чат Lovable.

Backend AIDA уже реализован: query-параметры `staffUserId`, `createdByUserId`, `onlyMine` на `GET /studios/:studioId/appointments` и `GET /studios/:studioId/appointment-log`.

Справка: `LOVABLE_APPOINTMENT_AUTHOR.md`, `LOVABLE_APPOINTMENT_AUTHOR_PROMPT.md`.

---

## Промпт

### Задача

Доработать экран **«Мои записи»** (месячный список записей для **ADMIN** и **MANAGER**) — добавить фильтры по **мастеру** (исполнитель визита) и по **создателю** (админ/менеджер, который завёл запись в CRM).

**Не путать:**

| Понятие | Поле в API | Query |
|---------|------------|-------|
| **Мастер на приёме** | `staff`, `staffUserId` | `?staffUserId=<userId>` |
| **Кто создал запись** | `author`, `createdByUserId` | `?onlyMine=true` или `?createdByUserId=<userId>` |

«Мои записи» по умолчанию = записи, **которые я создал** (`onlyMine`). Фильтр «Мастер» сужает список до визитов **к конкретному мастеру**, независимо от автора.

---

### API

Base: `VITE_API_URL` (Railway). Заголовок: `Authorization: Bearer <accessToken>`.

**Список записей филиала:**

`GET /studios/:studioId/appointments`

Query (все опциональны, комбинируются через **AND**):

| Параметр | Значение | Смысл |
|----------|----------|-------|
| `onlyMine` | `true` / `1` | Только записи, созданные **текущим** пользователем |
| `createdByUserId` | `usr_...` | Явный фильтр по автору (игнорируется, если передан `onlyMine=true`) |
| `staffUserId` | `usr_...` | Только записи к указанному **мастеру** |
| `date` | `YYYY-MM-DD` | Один день (в «Мои записи за месяц» обычно **без** date — фильтр месяца на клиенте) |

Примеры:

```
GET .../appointments?onlyMine=true
GET .../appointments?onlyMine=true&staffUserId=usr_master123
GET .../appointments?createdByUserId=usr_admin456&staffUserId=usr_master123
GET .../appointments?staffUserId=usr_master123
```

**Журнал на день** (если на том же экране или в журнале нужны те же фильтры):

`GET /studios/:studioId/appointment-log?date=YYYY-MM-DD&staffUserId=...&onlyMine=true`

Ответ включает `appointments` и `personalTimeSlots`; при `staffUserId` личное время тоже фильтруется по этому мастеру.

**Справочник сотрудников:**

`GET /studios/:studioId/staff`

В ответе у каждого: `id`, `role`, `staffProfile: { firstName, lastName, title }`.

---

### Где в UI

Экран **«Мои записи»** / блок **«Мои записи за месяц»** на дэшборде менеджера или отдельная вкладка (только **ADMIN** и **MANAGER**; для **MASTER** этот блок не показывать — у мастера свой журнал приёмов).

Над таблицей — панель фильтров в одну строку (на мобиле — колонкой):

#### 1. Селектор месяца

Как уже реализовано: текущий календарный месяц в таймзоне студии. При смене месяца — перезагрузка данных с **теми же** query-фильтрами.

#### 2. Toggle «Только мои»

- **Включено (по умолчанию для «Мои записи»):** запрос с `onlyMine=true`.
- **Выключено:** запрос **без** `onlyMine` и **без** `createdByUserId` — все записи филиала за месяц (для сравнения с общим потоком).
- Подпись при включении: «Показаны записи, которые вы создали».

#### 3. Select «Мастер»

- Первая опция: **«Все мастера»** — не передавать `staffUserId`.
- Остальные: сотрудники из `GET .../staff` с `role === 'MASTER'`.
- Подпись опции: `firstName lastName` (+ `title` при наличии).
- При выборе: добавить `staffUserId=<id>` к запросу.

#### 4. Select «Создал»

Показывать **только когда toggle «Только мои» выключен** (иначе автор уже зафиксирован текущим пользователем).

- **«Все»** — без `createdByUserId`.
- **«Я»** — `createdByUserId=<currentUserId>` (не `onlyMine`, чтобы можно было комбинировать с другими фильтрами при необходимости).
- Список людей: `GET .../staff` с `role === 'ADMIN' || role === 'MANAGER'`.

Tooltip у «Создал»: «Кто завёл запись в CRM (не мастер на приёме)».

Tooltip у «Мастер»: «Мастер, который принимает клиента».

---

### Загрузка данных за месяц

Рекомендуемый паттерн (как в `LOVABLE_APPOINTMENT_AUTHOR_PROMPT.md`):

1. Один запрос: `GET /studios/:studioId/appointments?<filters>` **без** `date`.
2. На клиенте отфильтровать массив: `startAt` попадает в выбранный месяц `[monthStart, monthEnd)` в таймзоне студии — **той же логикой**, что и другие фильтры по датам в проекте.

Альтернатива (если уже есть цикл по дням): к каждому `?date=YYYY-MM-DD` добавлять те же `onlyMine`, `staffUserId`, `createdByUserId`.

При **любом** изменении фильтра — новый запрос и пересчёт **«Итого за месяц»**.

---

### Таблица

Колонки (как сейчас + без изменений логики денег):

| Колонка | Источник |
|---------|----------|
| Дата / время | `startAt` |
| Клиент | `client` |
| Мастер | `staff.staffProfile` |
| Услуга | `service` / `serviceItems` |
| Статус | `status` |
| **Автор** | `author` |
| Сумма | `completedMoneyPaid` если DONE, иначе `prepaymentAmount` или цена услуги — **та же формула**, что уже в приложении |

Над таблицей — **«Итого за месяц»**: сумма по отфильтрованным строкам.

Пустое состояние: «Нет записей за выбранный период с такими фильтрами».

---

### URL и сохранение состояния

Синхронизируй фильтры с URL query (рекомендуется):

```
/my-appointments?month=2026-06&onlyMine=1&staffUserId=usr_...&createdByUserId=usr_...
```

- `onlyMine=1` ↔ toggle включён
- пустой / отсутствующий `staffUserId` ↔ «Все мастера»
- при `onlyMine=1` параметр `createdByUserId` в URL не нужен

При первом открытии «Мои записи» — `onlyMine=1`, текущий месяц, остальные фильтры пустые.

---

### Роли

| Роль | «Мои записи» + фильтры |
|------|------------------------|
| **ADMIN** | да, полный набор фильтров |
| **MANAGER** | да, полный набор фильтров |
| **MASTER** | нет (свой журнал, только свои приёмы) |
| **OWNER / DEPUTY_OWNER** | опционально тот же UI или только журнал без `onlyMine` по умолчанию |

---

### TypeScript

```ts
export interface MyAppointmentsFilters {
  onlyMine: boolean;
  staffUserId: string | null;
  createdByUserId: string | null;
}

export function buildAppointmentsQuery(filters: MyAppointmentsFilters): string {
  const params = new URLSearchParams();
  if (filters.onlyMine) params.set('onlyMine', 'true');
  if (!filters.onlyMine && filters.createdByUserId) {
    params.set('createdByUserId', filters.createdByUserId);
  }
  if (filters.staffUserId) params.set('staffUserId', filters.staffUserId);
  return params.toString();
}
```

---

### UX

- Фильтры применяются сразу при изменении (без отдельной кнопки «Применить»).
- Loading skeleton на таблице при смене фильтра/месяца.
- Ошибки: 401 → логин; 403 → toast «Нет доступа»; 404 на staff → «Сотрудник не найден в филиале».
- Не вычислять `author` на фронте — показывать `appointment.author`.

---

### Чеклист приёмки

- [ ] ADMIN видит «Мои записи» с toggle «Только мои», select «Мастер», select «Создал» (когда toggle выкл.).
- [ ] `onlyMine=true` + выбор мастера → в таблице только **мои** созданные записи **к этому мастеру**.
- [ ] Toggle выкл. + мастер + создал «Иван (менеджер)» → записи этого автора к этому мастеру.
- [ ] «Итого за месяц» пересчитывается при смене любого фильтра.
- [ ] Состояние фильтров восстанавливается из URL после перезагрузки.
- [ ] Колонка «Автор» заполнена из `author`; мастер в колонке «Мастер» — из `staff`.
- [ ] MASTER не видит экран «Мои записи» с этими фильтрами.

### Не делать

- Не объединять «мастер» и «создал» в один dropdown.
- Не фильтровать месяц только на клиенте **без** передачи `staffUserId` / `createdByUserId` на API (иначе лишняя нагрузка и неверное «Итого»).
- Не путать `staff` с `author`.
- Не менять бэкенд — API уже готов.

Сверка: `LOVABLE_APPOINTMENT_AUTHOR.md`, `LOVABLE_APPOINTMENT_LOG.md`, `LOVABLE_DASHBOARD_ACCESS_RESTRICTION.md`.
