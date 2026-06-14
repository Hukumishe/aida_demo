# Промпт для Lovable: расчёт «Итого к оплате» без ручного ввода

Скопируйте в чат:

---

Исправь модалку **«Завершить запись»**: сумма к оплате **только автоматическая**, без ручного поля «Сумма оплаты».

### API расчёта

**`GET {API}/appointments/{appointmentId}/done-checkout?bonusesUsed={N}`**

Headers: `Authorization: Bearer <token>`

Ответ (пример):

```json
{
  "grossTotal": 10000,
  "masterLateFineAmount": 1000,
  "totalAfterDiscounts": 9000,
  "prepaymentAmount": 0,
  "bonusesUsed": 0,
  "maxBonusesAllowed": 2700,
  "clientBonusesAvailable": 1360,
  "totalMoneyPaid": 9000,
  "moneyPaidNow": 9000,
  "lines": [
    { "kind": "SERVICES", "label": "Сумма услуг", "amount": 10000 },
    { "kind": "MASTER_LATE_FINE", "label": "Скидка за опоздание мастера", "amount": -1000 }
  ]
}
```

- **`moneyPaidNow`** — показывать как **«Итого к оплате: … ₸»** (жирно, только чтение).
- При движении ползунка бонусов — **перезапрашивать** checkout с новым `bonusesUsed`.

### Что убрать

- Поле ввода **«Сумма оплаты (₸)»** — удалить полностью.
- Не отправлять `completedMoneyPaid` в `POST /appointments/:id/done`.

### Что оставить

- Ползунок **«Списать бонусы»** (единственный пользовательский параметр расчёта).
- Селектор **«Тип оплаты»** (`paymentMethod`: `CASH` | `BANK_TRANSFER` | `KASPI_PAY`).

### Блок итога

Строки из `lines` (amount < 0 — красным/минус), затем:

**Итого к оплате: {moneyPaidNow} ₸**

Если `prepaymentAmount > 0`, строка предоплаты уже в `lines`; итог = доплата на кассе.

### Завершение

**`POST {API}/appointments/{id}/done`**

```json
{ "bonusesUsed": 0, "paymentMethod": "CASH" }
```

Сумма на сервере пересчитывается заново — совпадёт с preview.

### Учитывается в расчёте

1. Услуги записи + допродажи (`grossTotal`)
2. Скидка «приведи друга» (первый визит, %)
3. Штраф мастера → скидка клиенту (`masterLateFineAmount` на записи)
4. Списание бонусов (ползунок, лимит % из settings)
5. Предоплата (`prepaymentAmount`)

---
