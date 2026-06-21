# Промпт для Lovable: MARKETER — полная настройка программы лояльности

Скопируйте блок **«Промпт»** ниже в чат Lovable **целиком**.

Backend уже разрешает **`MARKETER`** редактировать лояльность. Сейчас UI, скорее всего, **read-only** для всех, кроме OWNER — из‑за проверок `role === 'OWNER'` вместо `permissions.canEdit`.

---

## Промпт

### Задача (одна)

На странице **«Программа лояльности»** роль **`MARKETER`** должна иметь **те же права редактирования**, что и владелец: переключатель PRESET/CUSTOM, уровни, вехи, лимит оплаты бонусами, начисление бонусов по услугам.

**Не** блокировать toggle и формы для `role === 'MARKETER'`.

---

### API (готово)

#### Контекст филиала

Лояльность на уровне **организации**, но путь через филиал (см. `LOVABLE_MARKETER_STUDIO_SELECTOR_PROMPT.md`):

`activeStudioId` из `GET /studios` + localStorage.

#### Программа лояльности

| | |
|--|--|
| Чтение | `GET /studios/:activeStudioId/loyalty` |
| Сохранение | `PUT /studios/:activeStudioId/loyalty` |

**Ответ GET:**

```json
{
  "loyaltyMode": "PRESET",
  "tiers": [],
  "milestones": [],
  "presetLevels": [
    { "key": "BRONZE", "name": "Бронза", "cashbackPercent": 3, "minTotalPaid": 0, "manualOnly": false },
    { "key": "SILVER", "name": "Серебро", "cashbackPercent": 5, "minTotalPaid": 50000, "manualOnly": false },
    { "key": "GOLD", "name": "Золото", "cashbackPercent": 10, "minTotalPaid": 120000, "manualOnly": false },
    { "key": "DIAMOND", "name": "Бриллиант", "cashbackPercent": 30, "minTotalPaid": 0, "manualOnly": true }
  ],
  "permissions": {
    "canEdit": true
  }
}
```

**Включить «Свою программу»** → `loyaltyMode: "CUSTOM"` + `tiers` + `milestones` в PUT.

**Выключить** → `PUT` с `{ "loyaltyMode": "PRESET" }` (tiers/milestones не нужны).

Пример CUSTOM (классика):

```json
{
  "loyaltyMode": "CUSTOM",
  "tiers": [
    { "sortOrder": 0, "name": "Бронза", "cashbackPercent": 3 },
    { "sortOrder": 1, "name": "Серебро", "cashbackPercent": 5 },
    { "sortOrder": 2, "name": "Золото", "cashbackPercent": 10 },
    { "sortOrder": 3, "name": "Бриллиант", "cashbackPercent": 30, "manualOnly": true }
  ],
  "milestones": [
    { "minTotalPaid": 0, "targetSortOrder": 0 },
    { "minTotalPaid": 50000, "targetSortOrder": 1 },
    { "minTotalPaid": 120000, "targetSortOrder": 2 }
  ]
}
```

#### Лимит оплаты бонусами

`GET/PATCH /studios/:activeStudioId/settings`

- Поле: `globalBonusPaymentLimitPercent` (0–100)
- В GET: `permissions.canEditGlobalBonusLimit` — для MARKETER **`true`**
- PATCH только это поле (маркетолог не трогает Kaspi, штрафы и т.д.)

#### Начисление бонусов по услуге

`GET /services?studioId=:activeStudioId` → список с `bonusAccrualEnabled`

`PATCH /studios/:activeStudioId/services/:id` → `{ "bonusAccrualEnabled": true | false }`

Только это поле для MARKETER.

---

### UI — что исправить

#### 1. Не хардкодить OWNER

```typescript
// ❌ Плохо
const canEditLoyalty = user.role === 'OWNER' || user.role === 'DEPUTY_OWNER';

// ✅ Правильно
const canEditLoyalty = loyalty.permissions?.canEdit === true;
// или: ['OWNER','DEPUTY_OWNER','MARKETER','SERVICE','DEVELOPER'].includes(user.role)
```

#### 2. Toggle «Своя программа лояльности»

- **Enabled** если `permissions.canEdit === true`
- ON → режим CUSTOM, показать редактор уровней/вех
- OFF → `PUT { loyaltyMode: 'PRESET' }`, показать `presetLevels` (read-only справка)

#### 3. Режим CUSTOM

- Редактируемые таблицы `tiers` / `milestones`
- Кнопка «Сохранить» → `PUT /loyalty` с полным телом
- Уровень с `manualOnly: true` — «только вручную» (VIP)

#### 4. Блок «Лимит оплаты бонусами»

На той же странице или в подразделе — slider/input + PATCH settings.

#### 5. Блок «Начисление бонусов по услугам»

Список услуг + toggle `bonusAccrualEnabled` (опционально, если уже есть в макете).

---

### Чеклист

- [ ] MARKETER видит активный toggle «Своя программа», не disabled
- [ ] PUT loyalty с CUSTOM/PRESET работает без 403
- [ ] `permissions.canEdit` из GET используется на фронте
- [ ] Лимит бонусов сохраняется через PATCH settings
- [ ] Toggles bonusAccrualEnabled на услугах работают для MARKETER

### Не делать

- Не оставлять лояльность read-only только потому что `role !== 'OWNER'`
- Не слать `studioIds` при создании маркетолога (см. другой промпт)

---

## Конец промпта
