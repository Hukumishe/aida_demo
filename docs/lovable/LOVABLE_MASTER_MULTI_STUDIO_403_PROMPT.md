# Короткий промпт для Lovable: мастер в двух филиалах (403)

Скопируйте в чат:

---

Мастер/админ может работать в **нескольких филиалах** (основной `studioId` + `user_studio_memberships`). Бэкенд уже разрешает доступ ко всем привязанным филиалам. Исправь фронт, чтобы не было **403 Access denied to this studio**.

### 1. Откуда брать список филиалов

После логина **`GET /auth/me`**:

```json
{
  "role": "MASTER",
  "studioId": "stu_aaa",
  "workStudios": [{ "id": "stu_aaa", "name": "..." }, { "id": "stu_bbb", "name": "..." }],
  "canSwitchStudio": true
}
```

Для **MASTER/ADMIN** — только **`workStudios`**, **не** `GET /studios` (это для OWNER/MANAGER, у мастера даст чужие id или 403).

### 2. Активный филиал в UI

- State + **localStorage** `activeStudioId`.
- При логине: если сохранённый id **есть в `workStudios`** — оставить; иначе **`workStudios[0].id`** или `user.studioId`.
- **Не** оставлять в localStorage `studioId` от прошлого входа **владельца** на том же браузере — при смене пользователя сбрасывать `activeStudioId` по `workStudios`.

### 3. Все запросы CRM

Подставлять **только** `activeStudioId` из `workStudios`:

```
GET /studios/{activeStudioId}/appointments?date=...
GET /studios/{activeStudioId}/schedule?date=...
GET /studios/{activeStudioId}/busy-slots?date=...
GET /studios/{activeStudioId}/waitlist-entries?date=...
GET /studios/{activeStudioId}/staff
```

### 4. Переключатель филиала

Если `canSwitchStudio === true` — select в шапке из **`workStudios`**. При смене — обновить `activeStudioId`, перезагрузить журнал.

### 5. Не делать

- Не фильтровать `workStudios` по `landing/masters` / `isVisible`.
- Не хардкодить один `studioId` из env для CRM мастера.

### Проверка

1. Мастер с двумя филиалами → переключить филиал → журнал открывается **без 403**.
2. Network: все запросы идут на id **из `workStudios`**, не на чужой филиал.

См. также `LOVABLE_MASTER_ADMIN_UI_PROMPT.md` (селектор + phoneMasked).

---
