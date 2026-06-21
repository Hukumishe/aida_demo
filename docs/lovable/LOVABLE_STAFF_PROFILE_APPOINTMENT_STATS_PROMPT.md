# Промпт для Lovable: итог записей мастера в профиле

Скопируйте блок **«Промпт»** ниже в чат Lovable.

Backend AIDA уже реализован: `GET /staff/:userId/profile` возвращает `appointmentStats` для мастеров.

Справка: `LOVABLE_STAFF_PROFILE.md`, `LOVABLE_EDIT_STAFF_PROFILE.md`, `LOVABLE_APPOINTMENT_LOG_VIEW_PROMPT.md` (экран «Мой профиль» для MASTER).

---

## Промпт

### Задача

В **профиле мастера** показать **итог количества записей за выбранный период**.

Видят блок:

| Кто | Условие |
|-----|---------|
| **MASTER** | только **свой** профиль |
| **ADMIN / MANAGER / OWNER / DEPUTY_OWNER** | если уже есть доступ к просмотру профиля этого мастера (как сейчас) |

Для ролей **не-MASTER** (админ, менеджер, владелец) — тот же блок на карточке мастера в разделе «Сотрудники».

---

### API

`GET /staff/:userId/profile`

Query (опционально):

| Параметр | Описание |
|----------|----------|
| `from` | Начало периода `YYYY-MM-DD` |
| `to` | Конец периода `YYYY-MM-DD` |
| `studioId` | Филиал для подсчёта. Без параметра — текущий филиал из JWT (если мастер там работает), иначе все филиалы мастера |

Примеры:

```
GET /staff/usr_master123/profile
GET /staff/usr_master123/profile?from=2026-06-01&to=2026-06-30
GET /staff/usr_master123/profile?from=2026-06-01&to=2026-06-30&studioId=stu_branch1
```

В ответе для **`role === MASTER`** добавлено поле **`appointmentStats`**:

```json
{
  "id": "usr_...",
  "role": "MASTER",
  "staffProfile": { "...": "..." },
  "services": [],
  "permissions": { "...": "..." },
  "appointmentStats": {
    "period": { "from": "2026-06-01", "to": "2026-06-30" },
    "studioId": "stu_...",
    "studioScope": "single",
    "total": 42,
    "excludingCancelled": 38,
    "byStatus": {
      "BOOKED": 5,
      "DONE": 30,
      "ARRIVED": 3,
      "CANCELLED": 4
    }
  }
}
```

| Поле | UI |
|------|-----|
| `excludingCancelled` | **Главная цифра** — «Записей за период» (без отменённых) |
| `total` | В tooltip: «Всего, включая отменённые» |
| `byStatus` | Опционально: мини-разбивка или скрыть |
| `period.from` / `period.to` | Подпись под цифрой |
| `studioScope` | `single` — один филиал; `all_work_studios` — сумма по всем филиалам мастера |

Если `role !== MASTER`, поля `appointmentStats` **нет** — блок не показывать.

**Период по умолчанию** (без `from`/`to`): текущий календарный месяц в таймзоне филиала.

---

### UI — MASTER «Мой профиль»

Экран read-only профиля (см. `LOVABLE_APPOINTMENT_LOG_VIEW_PROMPT.md`, п.3):

1. Блок **«Записи за период»** между «Мои услуги» и низом страницы.
2. **Селектор периода:**
   - Пресеты: «Этот месяц», «Прошлый месяц», «Свой диапазон» (date range picker).
   - При смене — повторный `GET .../profile?from=&to=` (и `studioId=` если выбран филиал).
3. Крупная цифра: **`appointmentStats.excludingCancelled`**.
4. Подпись: «с 01.06.2026 по 30.06.2026» из `period`.
5. Если `workStudios.length > 1` — select **«Филиал»** → `studioId` в query; опция «Все филиалы» — без `studioId`.
6. Loading skeleton при смене периода/филиала.

---

### UI — карточка мастера (ADMIN / MANAGER / OWNER)

На экране просмотра профиля другого мастера — **тот же блок** «Записи за период»:

- Селектор периода + цифра `excludingCancelled`.
- Филиал: по умолчанию текущий `studioId` из контекста CRM; при мульти-филиальном мастере — select как выше.
- Не показывать блок редактирования рядом — только просмотр статистики.

---

### TypeScript

```ts
export interface StaffAppointmentStats {
  period: { from: string; to: string };
  studioId: string | null;
  studioScope: 'single' | 'all_work_studios';
  total: number;
  excludingCancelled: number;
  byStatus: Record<string, number>;
}

export interface StaffProfileResponse {
  id: string;
  role: string;
  staffProfile?: { firstName?: string; lastName?: string | null; /* ... */ };
  workStudios?: { id: string; name: string }[];
  appointmentStats?: StaffAppointmentStats;
  permissions?: { canEditProfile: boolean; /* ... */ };
}
```

---

### Чеклист

- [ ] MASTER видит итог записей в «Мой профиль».
- [ ] ADMIN/MANAGER видят итог на карточке мастера.
- [ ] Смена периода перезагружает профиль с `from`/`to`.
- [ ] Главная цифра = `excludingCancelled`, не `total`.
- [ ] Мульти-филиальный мастер: select филиала работает.
- [ ] У менеджера/админа без доступа к профилю — 403 как раньше, блок не нужен.

### Не делать

- Не считать записи на фронте — только `appointmentStats` с API.
- Не показывать блок для ADMIN/MANAGER (не мастеров).
- Не менять бэкенд.

---

## Краткая справка

| Вопрос | Ответ |
|--------|--------|
| Что показывать крупно? | `appointmentStats.excludingCancelled` |
| Как задать месяц? | `?from=YYYY-MM-DD&to=YYYY-MM-DD` |
| Кто видит? | MASTER (свой) + роли с доступом к профилю мастера |
| Endpoint | `GET /staff/:userId/profile` |
