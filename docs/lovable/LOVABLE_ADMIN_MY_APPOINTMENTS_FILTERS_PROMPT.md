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
| `date` | `YYYY-MM-DD` | Один день (журнал). **Не** использовать для «Мои записи за месяц». |
| `from`, `to` | `YYYY-MM-DD` | Период в TZ филиала. Ответ — **объект с summary** (см. ниже). |
| `limit`, `offset` | числа | Пагинация `items` (только с `from`+`to`). `summary.count` — по **всему** периоду. |

Пример для экрана «Мои записи за месяц»:

```
GET .../appointments?from=2026-06-01&to=2026-06-30&onlyMine=true&staffUserId=...
```

Ответ (не массив):

```json
{
  "period": { "from": "2026-06-01", "to": "2026-06-30" },
  "summary": {
    "count": 12,
    "revenue": 47400
  },
  "items": [ /* записи для таблицы */ ],
  "pagination": { "limit": 50, "offset": 0, "total": 12 }
}
```

- **`summary.count`** — количество записей по **всем** фильтрам (для строки «12 записей»).
- **`summary.revenue`** — сумма по той же выборке (как «Итого за месяц»); DONE → `completedMoneyPaid`, иначе предоплата/цена услуги.
- Без `from`/`to` API по-прежнему возвращает **массив** (обратная совместимость журнала).

Комбинируется с фильтром авора, например:

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

**Рекомендуемый паттерн:**

1. Вычислить границы месяца в TZ студии (`from` = 1-е число, `to` = последний день).
2. Запрос: `GET /studios/:studioId/appointments?from=...&to=...&<filters>`.
3. Таблица — `response.items`.
4. **«12 записей»** — `response.summary.count`.
5. **«Итого за месяц … ₸»** — `response.summary.revenue` (не считать на фронте).
6. При росте объёма — добавить `limit`/`offset`; `summary` остаётся по полному периоду, `pagination.total` = `summary.count`.

**Устаревший паттерн (не использовать):** загрузка без `from`/`to` и фильтр месяца на клиенте.

При **любом** изменении фильтра или месяца — новый запрос с обновлёнными `from`/`to` и query-фильтрами.

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

Над таблицей — **«Итого за месяц»** и **количество записей**:

- `summary.revenue` → «47 400 ₸»
- `summary.count` → «12 записей» (или «Записей: 12»)

Не пересчитывать count/revenue на фронте, если используете `from`/`to`.

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
- [ ] «Итого за месяц» и **число записей** из `summary.revenue` / `summary.count`.
- [ ] Запрос с `from`/`to` за выбранный месяц, не клиентский фильтр по `startAt`.
- [ ] Состояние фильтров восстанавливается из URL после перезагрузки.
- [ ] Колонка «Автор» заполнена из `author`; мастер в колонке «Мастер» — из `staff`.
- [ ] MASTER не видит экран «Мои записи» с этими фильтрами.

### Не делать

- Не объединять «мастер» и «создал» в один dropdown.
- Не фильтровать месяц только на клиенте без `from`/`to` (устарело).
- Не дублировать расчёт `summary.count` / `summary.revenue` на фронте, если API вернул summary.
- Не путать `staff` с `author`.
- Не менять бэкенд — используй `from`/`to` и `summary` как описано выше.

Сверка: `LOVABLE_APPOINTMENT_AUTHOR.md`, `LOVABLE_APPOINTMENT_LOG.md`, `LOVABLE_DASHBOARD_ACCESS_RESTRICTION.md`.
