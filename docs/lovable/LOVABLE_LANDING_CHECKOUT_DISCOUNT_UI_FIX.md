# Промпт для Lovable: скидка на экране «Условия записи» (баг: 14 000 вместо 11 900)

Скопируйте блок ниже **целиком** в чат Lovable.

**Баг:** баннер акции есть («Акция: … · UBRWABAM»), но **Итого = полная цена** (14 000 ₸), без скидки.

**Причина:** экран берёт `defaultPrice` из каталога, **не** вызывает `quote` / не читает `checkout` из API.

---

## Промпт

### Обязательно на экране «Условия записи»

При открытии (и если есть `promoCode` / `resolvedPromo` / `promoEntry`):

**Вариант A — отдельный запрос:**

```
POST {API}/landing/promotions/quote
{
  "organizationId": "<VITE_ORGANIZATION_ID>",
  "studioId": "<studioId>",
  "code": "<promoCode>",
  "serviceIds": ["<выбранная услуга>"],
  "staffUserId": "<мастер из слота>"
}
```

**Вариант B — повторный resolve (если уже вызывали раньше без serviceIds):**

```
POST {API}/landing/promotions/resolve-code
{
  "code": "UBRWABAM",
  "organizationId": "...",
  "studioId": "...",
  "serviceIds": ["srv_..."],
  "staffUserId": "usr_..."
}
```

В ответе появится **`checkout`**:

```json
{
  "checkout": {
    "lines": [
      {
        "name": "Комплекс №1 1к",
        "originalPrice": 14000,
        "finalPrice": 11900,
        "promoApplied": true
      }
    ],
    "totalOriginal": 14000,
    "totalFinal": 11900,
    "partialApplication": false
  }
}
```

### Отображение (строго)

| Поле UI | Откуда брать |
|---------|----------------|
| Цена услуги в строке | `checkout.lines[i].finalPrice` (НЕ `defaultPrice`) |
| Зачёркнутая старая цена | `originalPrice`, если `promoApplied && originalPrice !== finalPrice` |
| **Итого** внизу | `checkout.totalFinal` (НЕ сумма из каталога) |
| Бейдж скидки | `−{discountPercent}%` из `resolvedPromo` |

Пример строки:

```
Комплекс №1 1к    14 000 → 11 900 ₸   [−15%]
Итого             11 900 ₸
```

### Запрещено

```ts
// ❌ НЕ ТАК
const price = service.defaultPrice;
const total = selectedServices.reduce((s, x) => s + x.defaultPrice, 0);
```

```ts
// ✅ ТАК
const { checkout } = await quoteOrResolve(...);
const line = checkout.lines[0];
const displayPrice = line.finalPrice;
const total = checkout.totalFinal;
```

### Если quote/checkout → 400

«К выбранной услуге нельзя применить эту акцию» — убрать баннер акции, не показывать полную цену с промо.

### Submit

`POST /landing/booking-request` с `promoCode` — бэкенд запишет цену со скидкой в CRM; **но клиент должен видеть скидку ДО submit** на этом экране.

### Acceptance

1. Акция 15%, услуга 14 000 ₸ → на «Условия записи» **11 900 ₸** в Итого.
2. В Network при открытии экрана — `quote` или `resolve-code` с `serviceIds` + `staffUserId`.
3. Баннер акции + зачёркнутая старая цена.

---

## Конец промпта
