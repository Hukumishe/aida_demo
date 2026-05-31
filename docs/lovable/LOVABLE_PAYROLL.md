# Зарплата / комиссия мастеров (Lovable)

## Доступ

- **Настройки и отчёт** — только роль **OWNER** (JWT).
- Настройки на уровне **организации** (одна схема на мастера во всех филиалах сети).

## Настройки сотрудника

**GET** `/organizations/:organizationId/staff/:staffUserId/payroll-settings`

**PUT** `/organizations/:organizationId/staff/:staffUserId/payroll-settings`

```json
{
  "rateMode": "UNIFIED",
  "baseMode": "WITHOUT_DISCOUNTS",
  "unifiedPercent": 40,
  "categoryRates": [
    { "categoryId": "sca_xxx", "percent": 35 }
  ],
  "serviceRates": [
    { "serviceId": "srv_xxx", "percent": 50 }
  ]
}
```

### rateMode

| Значение | UI |
|----------|-----|
| `UNIFIED` | Единый % на все услуги (`unifiedPercent` обязателен) |
| `BY_CATEGORY` | Таблица: категория → % |
| `BY_SERVICE` | Таблица: услуга (только из `StaffService` мастера) → % |

### baseMode

| Значение | Смысл |
|----------|--------|
| `WITHOUT_DISCOUNTS` | % от прайса на записи (до скидок/акций на чеке) |
| `WITH_DISCOUNTS` | % от суммы после скидок (пропорционально по строкам) |

Переключатель в UI: **«Расчёт с учётом скидок/акций»** / **«Без учёта»**.

## Отчёт

**GET** `/organizations/:organizationId/payroll-report?from=2026-05-01&to=2026-05-31`

Query:

- `from`, `to` — ISO дата/время (обязательно)
- `staffUserId` — опционально
- `studioId` — опционально

Ответ: `totalCommission`, `staff[]` с `items[]` (строки начислений), плоский `items[]`.

Поля строки: `staffName`, `appointmentStartAt`, `studioName`, `clientName`, `serviceName`, `grossLineAmount`, `baseAmount`, `percent`, `commissionAmount`, `baseModeLabel`, `lineTypeLabel`.

## Когда начисляется

Автоматически при **завершении визита** (`POST /appointments/:id/done`). Повторно не начисляется. Если настроек нет — строк не создаётся.

## UI

1. **Карточка сотрудника** → вкладка «Зарплата»: режим %, переключатель базы, таблицы ставок, «Сохранить».
2. **Раздел «Зарплата»** (OWNER): период, фильтр сотрудник/филиал, таблица + итого.

## Промпт

```
Страница «Зарплата» для OWNER: настройки комиссии у сотрудника (GET/PUT payroll-settings) и отчёт (GET payroll-report).
Режимы: единый %, по категориям, по услугам. Переключатель baseMode WITH_DISCOUNTS / WITHOUT_DISCOUNTS.
Отчёт: период, фильтры, таблица визитов с baseAmount, percent, commissionAmount, итого totalCommission.
```
