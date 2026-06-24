# Промпт для Lovable: ТОЛЬКО промокод в форме записи (не трогать филиалы)

Скопируйте блок ниже **целиком** в чат Lovable.  
**Не проси** менять загрузку филиалов, `GET /studios`, JWT — это уже сделано. Нужен **только промокод**.

---

## Промпт (скопировать отсюда)

### Контекст

Форма `BookingFormModal` / «Запись в удобное время» **уже работает**: филиалы, услуги, слоты, submit на `POST /landing/booking-request`.  
**Не меняй** логику филиалов, `bookable-services`, `availability`, timezone — это вне scope.

### Задача — только промокод акции лендинга

Добавь в существующую форму запись полный flow промокода. Бэкенд **уже готов** (деплой `ae87fc0`).

---

#### Шаг 1. Поле в UI

В модалке записи добавь:

- Input **«Промокод»**
- Кнопка **«Применить»** (или debounce после ввода)
- Блок успеха под полем (бейдж/карточка) с `title`, `description`, скидкой или ценой набора
- Кнопка **«Убрать промокод»**

Пока **не выбран филиал** (`studioId` в state) — кнопка «Применить» disabled.

---

#### Шаг 2. Проверка кода

При «Применить»:

```
POST {API_URL}/landing/promotions/resolve-code
Content-Type: application/json

{
  "code": "<введённый код, trim, uppercase>",
  "organizationId": "<VITE_ORGANIZATION_ID>",
  "studioId": "<activeStudioId из формы>"
}
```

**Без Bearer JWT.**

При **200** сохрани в state объект ответа (`resolvedPromo`) и:

| `type` | Действие в форме |
|--------|------------------|
| `DISCOUNT` | **Не менять** выбранные услуги. Передать `serviceIds` в resolve-code; при 400 — ошибка и сброс промокода. Скидка через `quote` |
| `ONE_PLUS_ONE` | Выбрать **обе** услуги из `autoFill.serviceIds`; показать `autoFill.finalPrice` ₸ |
| `SERVICE_BUNDLE` | Выбрать **все** услуги из `autoFill.serviceIds`; показать `autoFill.finalPrice` ₸ |

При смене услуги с активным промокодом DISCOUNT — снова `quote`. Смешанная корзина (часть услуг в акции): скидка только на `lines[].promoApplied === true`, баннер `partialApplication`.

При ошибке (404/400) — toast с текстом ответа, не закрывать модалку.

При смене филиала — **сбросить** `resolvedPromo` и поле промокода.

---

#### Шаг 3. Submit формы

В существующий `POST /landing/booking-request` добавь в body:

```json
{
  "promoCode": "ABC123",
  "serviceId": "srv_one",
  "serviceIds": ["srv_a", "srv_b"]
}
```

Правила:

- `promoCode` — только если resolve был успешным (`resolvedPromo.code`)
- одна услуга (DISCOUNT) → достаточно `serviceId`
- 1+1 / bundle → обязательно `serviceIds` (массив всех услуг акции)

**Не меняй** остальные поля submit (`studioId`, `phone`, `startAt`, `staffUserId`, …).

---

#### Шаг 4. Экран успеха

После 201 читай из ответа:

- `message` — показать как основной текст
- `landingPromotion` — отдельная карточка «Ваша акция»:

```ts
type LandingPromotion = {
  code: string;
  title: string;
  description: string | null;
  type: 'DISCOUNT' | 'ONE_PLUS_ONE' | 'SERVICE_BUNDLE';
  discountPercent: number | null;
  bundlePrice: number | null;
  appliedServiceIds: string[];
};
```

Если `landingPromotion` есть — **обязательно** показать `title`, `description`, скидку или `bundlePrice`, код.  
Сейчас пользователь **не видит содержимое акции** после регистрации — это баг, который нужно исправить.

Пример UI успеха:

```
✓ Запись создана
[карточка]
  Скидка 20% на стрижку
  Только в будни до конца месяца
  Скидка: 20%
  Промокод: ABC123
[/карточка]
```

---

#### Что НЕ делать

- ❌ Не трогать `GET /landing/organizations/.../studios` — уже ок
- ❌ Не трогать `GET /studios` (CRM)
- ❌ Не трогать Target promos / Nextbot
- ❌ Не рефакторить всю модалку — **только промокод + success UI**

---

#### Acceptance (проверь сам)

1. Ввёл валидный промокод → видна карточка акции в форме
2. Submit → в Network уходит `promoCode` в body
3. Success → на экране есть `landingPromotion.title` и описание
4. Невалидный код → toast, форма открыта

---

## Конец промпта
