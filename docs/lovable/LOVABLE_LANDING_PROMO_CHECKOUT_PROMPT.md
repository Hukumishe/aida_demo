# Промпт для Lovable: checkout + валидация промокода по услугам

Скопируйте блок ниже **целиком** в чат Lovable.

---

## Промпт (скопировать отсюда)

### Контекст

Промокод акции лендинга (`DISCOUNT` / `ONE_PLUS_ONE` / `SERVICE_BUNDLE`).  
Бэкенд готов: `resolve-code`, `quote`, `booking-request` с `promoCode`.

### Правила акции DISCOUNT (важно)

1. **Одна услуга не из акции** → ошибка, промокод **не действует** на запись:
   - `POST /landing/promotions/quote` → **400** с текстом: `К выбранной услуге нельзя применить эту акцию`
   - Показать toast/alert с этим текстом
   - Сбросить промокод (`resolvedPromo = null`) или заблокировать переход к checkout
   - **Не отправлять** `promoCode` в `booking-request`

2. **Несколько услуг, часть под акцией** → скидка **только** на подходящие:
   - `quote` → 200, `partialApplication: true`
   - В `lines[]` у каждой услуги: `promoApplied: true | false`
   - Услуга со скидкой: зачёркнуть `originalPrice`, показать `finalPrice`, бейдж «−15%» / «По акции»
   - Услуга без скидки: полная цена, подпись «Акция не действует»

3. **Все услуги под акцией** → скидка на все, `partialApplication: false`

4. **ONE_PLUS_ONE / SERVICE_BUNDLE** — без изменений: нужен точный набор услуг, иначе 400.

---

### API quote (экран «Условия записи» и при смене услуг)

```
POST {API_URL}/landing/promotions/quote
{
  "organizationId": "<VITE_ORGANIZATION_ID>",
  "studioId": "<activeStudioId>",
  "code": "<resolvedPromo.code>",
  "serviceIds": ["..."],
  "staffUserId": "<optional>"
}
```

Ответ 200:

```ts
type QuoteLine = {
  serviceId: string;
  name: string;
  durationMin: number;
  originalPrice: number;
  finalPrice: number;
  promoApplied: boolean;
};

type QuoteResponse = {
  promotion: {
    code: string;
    title: string;
    type: 'DISCOUNT' | 'ONE_PLUS_ONE' | 'SERVICE_BUNDLE';
    discountPercent: number | null;
    appliedServiceIds: string[];
    partialApplication?: boolean;
    ineligibleServiceIds?: string[];
  };
  lines: QuoteLine[];
  partialApplication: boolean;
  ineligibleServiceIds?: string[];
  totalOriginal: number;
  totalFinal: number;
};
```

Ошибка 400 (услуга не подходит):

```json
{ "message": "К выбранной услуге нельзя применить эту акцию", "statusCode": 400 }
```

---

### Когда вызывать quote

| Событие | Действие |
|---------|----------|
| Открытие «Условия записи» | quote → показать цены из `lines` |
| Смена услуги при активном промокоде | quote снова |
| Добавление/удаление услуги в корзине | quote снова |
| quote → 400 | toast с `message`, сброс промокода, не пускать на checkout |
| quote → 200, `partialApplication` | инфо-баннер: «Скидка действует не на все услуги» |

---

### UI на экране «Условия записи»

Для каждой строки услуги:

```
Комплекс №1 1к          14 000 → 11 900 ₸   [По акции −15%]
Маникюр                  5 000 ₸              Акция не действует
─────────────────────────────────────────────
Итого                    16 900 ₸
```

- **Итого** = `totalFinal` из quote
- Без промокода — как сейчас (`bookable-services`)

---

### Submit

- `promoCode` в body **только** если последний quote был 200 (или resolve-code для bundle без смешанной корзины)
- После 201 на success показывать `landingPromotion` + при `partialApplication` текст «Скидка применена к части услуг»

---

### Acceptance

1. Промокод 15% на 3 услуги + выбрана подходящая → checkout с ценой со скидкой
2. Промокод + услуга **вне** акции → ошибка, промокод сброшен, submit без `promoCode`
3. 2 услуги: одна в акции, одна нет → одна со скидкой, одна полная, баннер partial
4. Смена услуги после промокода → пересчёт через quote

---

## Конец промпта
