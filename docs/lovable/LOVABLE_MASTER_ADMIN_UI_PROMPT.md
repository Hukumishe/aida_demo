# Промпт для Lovable: маска телефона, филиалы, настройки админа

Скопируйте блок ниже в Lovable.

---

## Промпт (copy-paste)

```
Реализуй три доработки CRM для ролей MASTER и ADMIN. Бэкенд обновлён — API не менять.

Base: VITE_API_URL. Authorization: Bearer <accessToken>.

---

### 1. Частичный номер телефона для мастера

Для роли **MASTER** у клиента в записях и карточке:

- **`phone`** — не приходит (undefined) — полный номер недоступен.
- **`phoneMasked`** — строка для UI, например `+7(***) *** 3494` (последние 4 цифры).

**Где показывать:** журнал записей (сетка/список), модалка записи, лист ожидания, карточка клиента из записи.

**UI:**
```ts
function displayClientPhone(client: { phone?: string; phoneMasked?: string | null }, role: string) {
  if (role === 'MASTER') {
    return client.phoneMasked ?? '—';
  }
  return client.phone ?? '—';
}
```

Не пытаться «размаскировать» номер. Не копировать в буфер полный телефон для MASTER.

Для MANAGER, ADMIN, OWNER — по-прежнему полный `phone`.

---

### 2. Переключение филиала (MASTER и ADMIN с несколькими филиалами)

**GET /auth/me** для MASTER и ADMIN возвращает:

- `workStudios`: `[{ id, name }, ...]` — все филиалы, где работает сотрудник (основной первым).
- `canSwitchStudio`: `true`, если филиалов больше одного.

**Селектор филиала** в шапке (или сайдбаре):

- Показывать только если `canSwitchStudio === true` (или `workStudios.length > 1`).
- Список опций — из `workStudios`, не хардкод.
- Выбранный `studioId` хранить в React state + **localStorage** (`activeStudioId`), подставлять во все запросы: `/studios/:studioId/...`.
- При смене филиала — перезагрузить журнал, staff, services, warehouse текущего экрана.

**Не путать с OWNER:** владелец/менеджер сети может брать филиалы из `GET /studios`; для MASTER/ADMIN достаточно `auth/me.workStudios`.

Если в JWT `user.studioId` один, а в `workStudios` несколько — активный филиал = выбор пользователя (localStorage), иначе `user.studioId`.

---

### 3. Убрать блок «Настройки» у админа филиала

Для **`role === 'ADMIN'`** скрыть в навигации:

- пункт меню «Настройки» и вложенные: маркетинг сети, лояльность организации, промпты, лендинг, FAQ, глобальные настройки студии (не путать с операционными экранами филиала).

**Оставить ADMIN:** журнал записей, создание/редактирование записей (в рамках прав), мастера (просмотр), склад филиала, завершение визита, задачи если есть доступ.

Сверка с LOVABLE_ADMIN_BRANCH_RESTRICTIONS.md — админ не редактирует мастеров, нет общего списка клиентов.

Проверка: `user.role === 'ADMIN'` → не рендерить Settings / Настройки.

---

### Чеклист

- [ ] MASTER: в UI телефон = `phoneMasked`, не `phone`
- [ ] Селектор филиала для MASTER/ADMIN при `canSwitchStudio`
- [ ] `activeStudioId` в localStorage и во всех API path
- [ ] ADMIN: нет пункта «Настройки» в меню
- [ ] После смены филиала данные экрана обновляются

### Не делать

- Не показывать MASTER полный `phone`, если он вдруг пришёл — только `phoneMasked`
- Не давать ADMIN заходить в настройки сети даже по прямому URL (редирект или 403 toast)

Сверка: LOVABLE_ADMIN_BRANCH_RESTRICTIONS.md, LOVABLE_APPOINTMENT_LOG.md.
```

---

## API (кратко)

| Поле / endpoint | Назначение |
|-----------------|------------|
| `client.phoneMasked` | Маска для MASTER |
| `GET /auth/me` → `workStudios`, `canSwitchStudio` | Переключатель филиала |
| Скрытие «Настройки» | Только фронт для ADMIN |
