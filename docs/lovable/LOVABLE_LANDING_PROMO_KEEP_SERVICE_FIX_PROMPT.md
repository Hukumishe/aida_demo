# Промпт для Lovable: НЕ заменять услугу при применении промокода DISCOUNT

Скопируйте блок ниже **целиком** в чат Lovable.

**Баг:** клиент выбрал услугу → ввёл промокод → услуга **заменилась** первой из акции.  
**Нужно:** оставить выбранную услугу, только применить скидку (если услуга входит в акцию).

---

## Промпт

### Контекст

Форма записи: клиент **сначала** выбирает услугу(и), **потом** вводит промокод DISCOUNT.  
Акция может распространяться на **несколько** услуг — это не значит «подставить первую из списка».

### Правило (DISCOUNT)

1. **Никогда** не менять `selectedServiceIds` после успешного `resolve-code`, если услуги уже выбраны.
2. **Не использовать** `autoFill.defaultServiceId` для замены выбора — это поле только для пустой корзины (`suggestedServiceIdWhenEmpty`).
3. В `resolve-code` передавать текущий выбор:

```json
POST /landing/promotions/resolve-code
{
  "code": "PROMO15",
  "organizationId": "<VITE_ORGANIZATION_ID>",
  "studioId": "<studioId>",
  "serviceIds": ["<уже выбранная услуга>"]
}
```

4. Ответ при подходящей услуге:

```json
{
  "type": "DISCOUNT",
  "selection": {
    "requestedServiceIds": ["srv_user_pick"],
    "eligibleServiceIds": ["srv_user_pick"],
    "ineligibleServiceIds": [],
    "partialApplication": false
  },
  "autoFill": {
    "replaceUserSelection": false,
    "discountPercent": 15,
    "services": [ ... ]
  }
}
```

5. Действия UI:
   - **Оставить** `selectedServiceIds` как были
   - Показать карточку акции (title, скидка %)
   - Для выбранной услуги показать цену со скидкой (`discountedPrice` из `autoFill.services` или `POST .../promotions/quote`)
   - Вызвать `quote` с теми же `serviceIds`, не подменяя их

6. Если `resolve-code` → **400** «К выбранной услуге нельзя применить эту акцию»:
   - toast с текстом ошибки
   - **не** применять промокод, **не** менять услугу

7. Если услуга **ещё не выбрана** (`selectedServiceIds` пуст) — можно подсказать список `autoFill.services`, но **не** автовыбирать без действия пользователя (или только мягкая подсказка, без смены state submit).

### ONE_PLUS_ONE / SERVICE_BUNDLE

Здесь по-прежнему нужен **точный набор** услуг из акции — замена допустима только для этих типов.

### Удалить из кода

Любую логику вида:

```ts
// ❌ УДАЛИТЬ
if (resolvedPromo.type === 'DISCOUNT') {
  setSelectedServiceId(resolvedPromo.autoFill.defaultServiceId);
}
```

### Acceptance

1. Выбрал «Комплекс №1 2к» → промокод 15% → в форме остаётся «Комплекс №1 2к», цена со скидкой.
2. Выбрал услугу **вне** акции → промокод → ошибка, услуга не меняется.
3. Промокод без выбранной услуги → список услуг акции, без принудительной подстановки в submit.

---

## Конец промпта
