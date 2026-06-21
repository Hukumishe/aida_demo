# Промпт для Lovable: MARKETER — выбор филиала (автосообщения и др.)

Скопируйте блок **«Промпт»** ниже в чат Lovable **целиком**.

**Задача одна:** у роли **`MARKETER`** в шапке CRM должен работать **селектор «Студия / Филиал»**, иначе экраны «Автосообщения», «Поздравления», лояльность по филиалу и т.д. показывают пустую заглушку «Выберите филиал…».

Backend готов: `GET /studios` для MARKETER возвращает **все филиалы организации**. Менять API не нужно.

---

## Промпт

### Проблема

Пользователь с `role: "MARKETER"` в JWT имеет **`studioId: null`** (роль сети). Сейчас UI:

- не подгружает список филиалов **или**
- ждёт `user.studioId` из токена и остаётся без выбранного `studioId`

На странице **«Автосообщения»** видны только заглушки:

- «Выберите филиал, чтобы настроить автосообщения»
- «Выберите филиал, чтобы настроить поздравления»

### Что сделать

#### 1. Общий контекст «текущий филиал» для MARKETER (и MANAGER)

При логине / загрузке приложения, если роль **`MARKETER`** или **`MANAGER`** (или `user.studioId == null`):

```typescript
// Псевдокод — встроить в ваш auth/layout store
async function ensureActiveStudioId(user: AuthUser): Promise<string | null> {
  if (user.studioId) return user.studioId;

  const res = await fetch(`${API}/studios`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const studios: { id: string; name: string }[] = await res.json();

  if (studios.length === 0) return null;

  const saved = localStorage.getItem('activeStudioId');
  if (saved && studios.some((s) => s.id === saved)) return saved;

  const first = studios[0].id;
  localStorage.setItem('activeStudioId', first);
  return first;
}
```

- **`activeStudioId`** — единый state (Context / Zustand / Redux), **не** поле из JWT.
- При смене филиала в шапке — обновлять `activeStudioId` + `localStorage`.

#### 2. Селектор «Студия» в шапке

- Показывать для **MARKETER** (и MANAGER), не только для ADMIN.
- Options: **`GET /studios`** → `{ id, name, address? }[]`.
- Label: имя филиала; value: `id`.
- Если один филиал — можно показать read-only «Филиал: …», но **`activeStudioId` всё равно задать**.

#### 3. Страница «Автосообщения»

Не рендерить заглушку, если **`activeStudioId`** уже есть.

| Блок | Запросы после выбора `activeStudioId` |
|------|----------------------------------------|
| Шаблоны | `GET /studios/:studioId/nextbot-auto-messages` |
| Пресеты / переменные | `GET .../presets`, `GET .../variables` |
| Журнал | `GET .../logs` |
| CRUD | `POST/PATCH/DELETE .../:templateId` |
| Тест | `POST .../test-send` |

**Поздравления (ДР):**

| | |
|--|--|
| Настройки | `GET/PUT /studios/:studioId/nextbot-birthday/settings` |
| Журнал | `GET /studios/:studioId/nextbot-birthday/logs` |

При **`activeStudioId === null`** (нет филиалов в сети) — одна заглушка: «Нет доступных филиалов».

#### 4. Другие экраны MARKETER — тот же `activeStudioId`

Не дублировать логику — **один** контекст филиала для:

- автосообщения / поздравления  
- `GET/PUT .../loyalty`  
- `GET/PATCH .../settings` (маркетинговые поля)  
- `GET/POST/PATCH .../referral-links`  
- CRUD лендинга по `studios/:studioId/landing/...`  

Организационные экраны **без** `studioId` в пути (акции, FAQ, мастера сети) — **`organizationId` из JWT**, филиал не нужен.

#### 5. Не ломать остальные роли

- **ADMIN / MASTER:** по-прежнему `user.studioId` (+ memberships), как сейчас.
- **OWNER / DEPUTY:** можно оставить текущую логику или тоже `GET /studios` + `activeStudioId`.

---

### Чеклист

- [ ] MARKETER видит dropdown «Студия» с филиалами из `GET /studios`
- [ ] При первом входе автовыбор первого филиала + сохранение в localStorage
- [ ] «Автосообщения» и «Поздравления» грузят данные по `activeStudioId`, без вечной заглушки
- [ ] Смена филиала перезагружает шаблоны и настройки ДР
- [ ] Не использовать `user.studioId` для MARKETER как единственный источник

### Не делать

- Не просить бэкенд «проставить studioId маркетологу в JWT»
- Не копировать весь `LOVABLE_MARKETER_ROLE_PROMPT.md` — только эту задачу

---

## Конец промпта
