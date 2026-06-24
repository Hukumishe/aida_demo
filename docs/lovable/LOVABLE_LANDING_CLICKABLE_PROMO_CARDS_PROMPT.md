# Промпт для Lovable: кликабельные карточки акций → запись с промокодом

Скопируйте блок ниже **целиком** в чат Lovable.

---

## Промпт

### Цель

Секция **«Выгодные предложения»** на главной: при клике на карточку акции (или на бейдж «Промокод: …») открывается форма записи, где:

1. Клиент может выбрать **только услуги из этой акции**
2. На шаге с данными / подтверждением промокод **уже подставлен** и применён (скидка видна в итоге)

Бэкенд AIDA **готов** — нужна только связка UI.

---

### API

#### Список акций (карточки на главной)

```
GET {API}/landing/promotions?organizationId={VITE_ORGANIZATION_ID}
```

Без JWT — только **активные** акции и **активные** промокоды.

Пример элемента (DISCOUNT):

```json
{
  "id": "lpr_xxx",
  "type": "DISCOUNT",
  "title": "забота для будущих мам",
  "description": "-15% на шугаринг...",
  "discountPercent": 15,
  "isActive": true,
  "services": [
    { "serviceId": "srv_a", "service": { "id": "srv_a", "name": "Шугаринг", "defaultPrice": 8000 } }
  ],
  "codes": [{ "code": "UBRWABAM", "isActive": true }]
}
```

Для карточки: `title`, `description`, промокод = `codes[0].code`, услуги = `services.map(s => s.serviceId)`.

#### После выбора филиала — проверка промокода

```
POST {API}/landing/promotions/resolve-code
{
  "code": "UBRWABAM",
  "organizationId": "...",
  "studioId": "<выбранный филиал>"
}
```

Ответ DISCOUNT → `autoFill.serviceIds`, `autoFill.services[]` с `discountedPrice`.

#### Submit

```
POST {API}/landing/booking-request
{ ..., "promoCode": "UBRWABAM", "serviceId": "..." }
```

---

### State формы записи

Расширить контекст записи:

```ts
type PromoEntryContext = {
  promoCode: string;
  promotionId: string;
  promotionType: 'DISCOUNT' | 'ONE_PLUS_ONE' | 'SERVICE_BUNDLE';
  /** Услуги из акции — ограничить выбор на шаге «Услуги» */
  allowedServiceIds: string[];
  title: string;
  description?: string | null;
};

type BookingDraft = {
  studioId: string | null;
  selectedServiceIds: string[];
  selectedStaffUserId: string | null;
  // ...
  promoEntry: PromoEntryContext | null;
  resolvedPromo: ResolveCodeResponse | null;
};
```

---

### Клик по карточке акции

```ts
function openBookingFromPromotion(promotion: LandingPromotion) {
  const code = promotion.codes[0]?.code;
  if (!code) return;

  const allowedServiceIds =
    promotion.type === 'DISCOUNT' || promotion.type === 'SERVICE_BUNDLE'
      ? promotion.services.map((s) => s.serviceId)
      : [promotion.serviceIdA, promotion.serviceIdB].filter(Boolean);

  setBookingDraft({
    ...initialDraft,
    promoEntry: {
      promoCode: code,
      promotionId: promotion.id,
      promotionType: promotion.type,
      allowedServiceIds,
      title: promotion.title,
      description: promotion.description,
    },
    resolvedPromo: null,
  });
  openBookingModal();
}
```

Сделать кликабельными: **вся карточка** и/или бейдж «Промокод: …» (`cursor: pointer`, `onClick`).

---

### Шаг «Выбор услуг»

Если `promoEntry !== null`:

| `promotionType` | Поведение |
|-----------------|-----------|
| `DISCOUNT` | Показать **только** услуги из `allowedServiceIds` (пересечение с `bookable-services` после выбора филиала). Остальные скрыть. |
| `ONE_PLUS_ONE` | Автовыбрать **обе** услуги из акции (или обязать выбрать обе). |
| `SERVICE_BUNDLE` | Автовыбрать **все** услуги набора. |

Баннер под заголовком: «Акция: {promoEntry.title} · промокод {promoEntry.promoCode}».

---

### После выбора филиала

Автоматически (без кнопки «Применить»):

```
POST resolve-code { code: promoEntry.promoCode, organizationId, studioId }
```

- Успех → `resolvedPromo` в state, пересчитать цены (`quote` на checkout)
- Ошибка → toast, сбросить `promoEntry` или показать «акция недоступна в этом филиале»

Если услуги уже выбраны — добавить в body `"serviceIds": selectedServiceIds` (не заменять выбор).

---

### Шаг «Данные» / «Условия записи»

1. Поле **«Промокод»** — **предзаполнено** `promoEntry.promoCode`, readonly или disabled (кнопка «Убрать» опциональна).
2. Карточка акции: `title`, `description`, скидка %.
3. `POST /landing/promotions/quote` для итога со скидкой.
4. Submit с `promoCode: promoEntry.promoCode`.

Клиент **не вводит** промокод вручную — он пришёл с карточки.

---

### Сброс

| Событие | Действие |
|---------|----------|
| Закрыл модалку без submit | `promoEntry = null` |
| Сменил филиал | снова `resolve-code` с тем же кодом |
| «Убрать промокод» | очистить `promoEntry` и `resolvedPromo`, снять ограничение услуг |

---

### Открытие формы без акции

Обычный поток без `promoEntry` — все услуги филиала, промокод вводится вручную (как сейчас).

---

### Acceptance

1. Клик «Промокод: UBRWABAM» → модалка записи, баннер акции.
2. На шаге услуг — только шугаринг (или что в акции), не весь каталог.
3. На шаге данных промокод уже стоит, цена со скидкой.
4. Submit → в Network есть `promoCode` в body.
5. Клик с главной без акции — поведение как раньше.

---

## Конец промпта
