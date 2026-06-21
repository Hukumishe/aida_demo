# Промпт для Lovable: единые настройки мастеров лендинга (вся сеть)

Скопируйте блок **«Промпт»** ниже в чат Lovable.

Backend AIDA обновлён: настройки мастеров на лендинге **одни на всю организацию**, выбор сотрудников из **нескольких филиалов**.

Справка: `LOVABLE_LANDING_SETTINGS.md`.

---

## Промпт

### Задача

Переделать раздел **«Мастера»** в настройках лендинга:

- **Один экран на всю сеть**, не отдельный список на каждый филиал.
- Пользователь видит мастеров **из всех филиалов** и отмечает, кого показывать на лендинге, и в каком порядке.
- Сохранение **одним запросом** — не затирает настройки других филиалов (раньше PATCH из филиала A удалял мастеров филиала B).

---

### API (админка)

Base: `VITE_API_URL`. `Authorization: Bearer <accessToken>`.

**Загрузка (рекомендуется):**

`GET /organizations/:organizationId/landing/masters`

`:organizationId` — из JWT (`auth/me` → `organizationId`).

Ответ:

```json
{
  "organizationId": "org_...",
  "items": [
    {
      "staffUserId": "usr_...",
      "isVisible": true,
      "order": 0,
      "primaryStudioId": "stu_a",
      "primaryStudioName": "Филиал на Абая",
      "workStudios": [
        { "id": "stu_a", "name": "Филиал на Абая" },
        { "id": "stu_b", "name": "Филиал на Satpayeva" }
      ],
      "staff": {
        "id": "usr_...",
        "role": "MASTER",
        "staffProfile": {
          "firstName": "Айгуль",
          "lastName": "Смагулова",
          "avatar": "https://...",
          "title": "Стилист"
        }
      }
    }
  ]
}
```

**Сохранение:**

`PATCH /organizations/:organizationId/landing/masters`

```json
{
  "items": [
    { "staffUserId": "usr_1", "isVisible": true, "order": 0 },
    { "staffUserId": "usr_2", "isVisible": false, "order": 1 }
  ]
}
```

- В `items` передавай **всех** сотрудников из ответа GET (или только тех, у кого менялся чекбокс/порядок — но полный список надёжнее).
- Можно включать мастеров из **разных** `workStudios`.
- Ответ PATCH — тот же формат, что GET.

**Legacy (не использовать в новом UI):**

`GET/PATCH /studios/:studioId/landing/masters` — PATCH всё ещё работает, но GET для админки отдаёт только мастеров **одного** филиала (публичная витрина). Админка должна ходить на **organization** endpoint.

---

### API (публичный лендинг — без изменений логики отображения)

`GET /studios/:studioId/landing/masters` (публично)

- Мастера, **работающие в этом филиале**, с общими `isVisible` / `order` из сети.
- На витрине показывать только `isVisible === true`.

---

### UI — настройки лендинга → «Мастера»

1. **Убрать** привязку экрана к выбранному филиалу CRM (или показывать один раз на уровне организации).
2. Загрузка: `GET /organizations/{organizationId}/landing/masters`.
3. Список / карточки:
   - имя, аватар, должность — из `staff.staffProfile`;
   - **бейдж филиала(ов)**: `primaryStudioName` или список `workStudios` (если мульти-филиал);
   - чекбокс «Показывать на сайте» → `isVisible`;
   - drag-and-drop → `order` (0 = выше).
4. Группировка (опционально): по `primaryStudioName` или фильтр «Все филиалы / Филиал X» **только на клиенте** (данные уже все в одном ответе).
5. Кнопка «Сохранить» → `PATCH /organizations/{organizationId}/landing/masters` с массивом `items`.
6. Подсказка: «Настройки общие для всех лендингов сети. На странице филиала видны мастера, которые работают в этом филиале и отмечены галочкой».

---

### TypeScript

```ts
export interface LandingMasterWorkStudio {
  id: string;
  name: string;
}

export interface LandingMasterAdminItem {
  staffUserId: string;
  isVisible: boolean;
  order: number;
  primaryStudioId: string | null;
  primaryStudioName: string | null;
  workStudios: LandingMasterWorkStudio[];
  staff: {
    id: string;
    role: string;
    staffProfile?: {
      firstName: string;
      lastName?: string | null;
      avatar?: string | null;
      title?: string | null;
    } | null;
  };
}

export interface LandingMastersAdminResponse {
  organizationId: string;
  items: LandingMasterAdminItem[];
}
```

---

### Чеклист

- [ ] Админка грузит `GET /organizations/.../landing/masters`, не studio GET.
- [ ] В списке видны мастера из **нескольких** филиалов с подписью филиала.
- [ ] PATCH на organization; после сохранения настройки другого филиала не пропадают.
- [ ] Публичный лендинг по-прежнему использует `GET /studios/:id/landing/masters` + фильтр `isVisible`.
- [ ] Форма записи по-прежнему использует `bookable-masters`, не этот endpoint.

### Не делать

- Не делать отдельное сохранение на каждый филиал.
- Не использовать studio PATCH с неполным списком (сотрёт остальных).
- Не менять бэкенд.

---

## Краткая справка

| Контекст | Endpoint |
|----------|----------|
| Админка — загрузка/сохранение | `GET/PATCH /organizations/:organizationId/landing/masters` |
| Публичная витрина филиала | `GET /studios/:studioId/landing/masters` |
| Форма записи | `GET /landing/studios/:studioId/bookable-masters` |
