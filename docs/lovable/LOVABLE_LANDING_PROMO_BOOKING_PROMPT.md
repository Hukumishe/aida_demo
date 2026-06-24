# Промпт для Lovable: промокод акции на форме записи лендинга

Скопируйте блок **«Промпт»** ниже в чат Lovable **целиком**.

Backend AIDA **обновлён** (коммит `ae87fc0`): промокод акции лендинга применяется при `POST /landing/booking-request` — скидка/цена набора, `usedCount`, объект `landingPromotion` в ответе.

**Не путать** с **Промокодами Target** (раздел маркетинга для Nextbot) — на лендинге работают только **акции** (`/landing/promotions`).

---

## Промпт

### Задача

Доработать модалку **«Запись в удобное время»** на публичном лендинге: поле **промокод**, проверка через API, автоподстановка услуг/цены, показ содержимого акции после успешной отправки.

Контекст формы — см. `LOVABLE_LANDING_BOOKING_FORM_PROMPT.md` (филиал, слоты, `POST /landing/booking-request`). Здесь — **только промокод**.

---

### API

#### 1. Проверка кода (при вводе / по кнопке «Применить»)

`POST /landing/promotions/resolve-code` — **публично**, без JWT.

```json
{
  "code": "ABC123",
  "organizationId": "org_xxx",
  "studioId": "stu_xxx"
}
```

`organizationId` — из `VITE_ORGANIZATION_ID`.  
`studioId` — **выбранный филиал** в форме (обязателен для фильтра услуг по филиалу).

**Ответ 200 (пример DISCOUNT):**

```json
{
  "code": "ABC123",
  "promotionId": "lpr_xxx",
  "type": "DISCOUNT",
  "title": "Скидка 20% на стрижку",
  "description": "Только в будни до конца месяца",
  "autoFill": {
    "mode": "DISCOUNT",
    "discountPercent": 20,
    "serviceIds": ["srv_a", "srv_b"],
    "defaultServiceId": "srv_a",
    "services": [
      {
        "id": "srv_a",
        "name": "Стрижка",
        "defaultPrice": 5000,
        "defaultDurationMin": 60,
        "discountedPrice": 4000
      }
    ]
  }
}
```

**Типы акций:**

| `type` | `autoFill.mode` | Что сделать в UI |
|--------|-----------------|------------------|
| `DISCOUNT` | `DISCOUNT` | Подставить `defaultServiceId` или первую из `services`; показать зачёркнутую цену и `discountedPrice` |
| `ONE_PLUS_ONE` | `ONE_PLUS_ONE` | Выбрать **обе** услуги из `serviceIds`; показать `finalPrice` (bundle) |
| `SERVICE_BUNDLE` | `SERVICE_BUNDLE` | Выбрать **все** услуги из `serviceIds`; показать `finalPrice` |

**Ошибки:** 404 «Promo code not found», 400 inactive / expired / limit — toast с текстом с бэка.

#### 2. Отправка формы

`POST /landing/booking-request` — добавить в body:

```json
{
  "promoCode": "ABC123",
  "serviceId": "srv_a",
  "serviceIds": ["srv_a", "srv_b"]
}
```

- Для **одной услуги** (DISCOUNT) — достаточно `serviceId`.
- Для **1+1 / bundle** — передавать **`serviceIds`** (массив всех услуг акции); `serviceId` можно не дублировать.

**Ответ 201** — всегда смотреть **`landingPromotion`** и **`message`**:

```json
{
  "outcome": "booked",
  "message": "Запись создана. Мы свяжемся с вами для подтверждения. Акция «Скидка 20%». Только в будни. скидка 20%.",
  "appointmentId": "apt_xxx",
  "clientId": "cli_xxx",
  "landingPromotion": {
    "code": "ABC123",
    "promotionId": "lpr_xxx",
    "type": "DISCOUNT",
    "title": "Скидка 20% на стрижку",
    "description": "Только в будни до конца месяца",
    "discountPercent": 20,
    "bundlePrice": null,
    "appliedServiceIds": ["srv_a"]
  }
}
```

То же поле `landingPromotion` приходит при `outcome: "waitlist"` и `outcome: "callback"`.

---

### UI — поле промокода

Разместить в форме записи (логично в блоке «Дополнительно» или отдельной строкой над комментарием):

1. **Input** «Промокод» + кнопка **«Применить»** (или debounce 500 ms после ввода).
2. Не вызывать `resolve-code`, пока не выбран **филиал** (`studioId`).
3. При успехе — зелёный бейдж / карточка под полем:

   - заголовок: `title`
   - подзаголовок: `description` (если есть)
   - для DISCOUNT: «Скидка {discountPercent}%»
   - для bundle: «Цена по акции: {finalPrice} ₸»

4. **Автоподстановка из `autoFill`:**
   - DISCOUNT → select «Услуга» = `defaultServiceId` или первая из списка
   - ONE_PLUS_ONE / SERVICE_BUNDLE → multi-select или две услуги в форме; сохранить массив `serviceIds` в state для submit

5. Кнопка **«Сбросить промокод»** — очистить input, бейдж, сбросить скидочные цены в UI.

6. При смене **филиала** — сбросить применённый промокод (перепроверить resolve с новым `studioId`).

7. В submit всегда передавать `promoCode` (нормализованный uppercase), если код был успешно применён.

---

### UI — экран успеха

После `POST /landing/booking-request`:

1. Показать `message` из ответа (уже содержит текст акции).
2. **Дополнительно** — блок «Ваша акция» из `landingPromotion`, если поле есть:

```tsx
{landingPromotion && (
  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
    <p className="font-medium">{landingPromotion.title}</p>
    {landingPromotion.description && (
      <p className="text-muted-foreground mt-1">{landingPromotion.description}</p>
    )}
    {landingPromotion.discountPercent != null && landingPromotion.discountPercent > 0 && (
      <p className="mt-1">Скидка {landingPromotion.discountPercent}%</p>
    )}
    {landingPromotion.bundlePrice != null && (
      <p className="mt-1">Цена по акции: {landingPromotion.bundlePrice} ₸</p>
    )}
    <p className="text-xs text-muted-foreground mt-2">Промокод: {landingPromotion.code}</p>
  </div>
)}
```

3. Не показывать сырой JSON; не дублировать блок, если `message` уже полный — достаточно одного из двух, но **лучше оба** (message + карточка).

---

### Ошибки при submit

Если бэкенд вернул 400 (услуга не в акции, код истёк и т.д.) — toast с `message` / текстом ошибки; не закрывать модалку.

Типичные тексты:
- `Услуга не участвует в акции «…»`
- `Для акции «…» нужно выбрать обе услуги: 1+1`
- `Promo code usage limit reached`

---

### Не делать

- **Не** использовать Target promos / `POST /nextbot/.../target_promo` на лендинге.
- **Не** считать скидку только на клиенте без `resolve-code` — цены в CRM пишет бэкенд при submit.
- **Не** отправлять промокод без предварительного успешного resolve (или обрабатывать 400 на submit).
- **Не** путать с реферальным `?ref=` (`referralLinkId`) — это отдельное поле.

---

### Acceptance criteria

- [ ] Ввод промокода → `resolve-code` → видны title, description, скидка/цена
- [ ] DISCOUNT: услуга подставляется, в UI видна цена со скидкой
- [ ] Submit с `promoCode` → success с `landingPromotion` в ответе
- [ ] На экране успеха клиент видит содержимое акции (не только «запись создана»)
- [ ] Неверный / просроченный код — понятная ошибка, форма не ломается
- [ ] Смена филиала сбрасывает промокод

---

### Связанные документы

- `LOVABLE_LANDING_BOOKING_FORM_PROMPT.md` — полная форма записи
- `docs/LANDING_PROMOTIONS.md` — API акций на бэкенде
