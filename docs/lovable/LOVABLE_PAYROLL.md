# Зарплата / комиссия мастеров (Lovable)

## Доступ

| Действие | OWNER | DEVELOPER | MASTER |
|----------|-------|-----------|--------|
| Просмотр настроек % | любой сотрудник | любой сотрудник / любая org | **только свои** |
| Сохранение настроек % | да | да | нет |
| Отчёт за период | вся организация | вся организация | **только свои** начисления |

Настройки на уровне **организации** (одна схема на мастера во всех филиалах сети).

DEVELOPER не ограничен `organizationId` из JWT — в URL указывается нужная организация.

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

Ответ: `totalCommission`, `viewScope` (`organization` | `self`), `staffUserId` (для мастера — его id), `staff[]` с `items[]`, плоский `items[]`.

**Мастер:** тот же endpoint; `staffUserId` в query игнорируется / должен совпадать с текущим пользователем. Удобно вызывать без `staffUserId` — вернутся только его строки.

Поля строки: `staffName`, `appointmentStartAt`, `studioName`, `clientName`, `serviceName`, `grossLineAmount`, `baseAmount`, `percent`, `commissionAmount`, `baseModeLabel`, `lineTypeLabel`.

## Когда начисляется

Автоматически при **завершении визита** (`POST /appointments/:id/done`). Повторно не начисляется. Если настроек нет — строк не создаётся.

## UI

1. **Карточка сотрудника** (OWNER / DEVELOPER) → вкладка «Зарплата»: режим %, переключатель базы, таблицы ставок, «Сохранить».
2. **Раздел «Зарплата»** (OWNER / DEVELOPER): период, фильтр сотрудник/филиал, таблица + итого.
3. **Кабинет мастера** → «Моя зарплата»: `GET payroll-report` без фильтра по staff; опционально `GET .../staff/{myUserId}/payroll-settings` (только просмотр своих %).

## Промпт

```
Страница «Зарплата» для OWNER и DEVELOPER: настройки (GET/PUT payroll-settings) и отчёт (GET payroll-report).
Для MASTER: экран «Моя зарплата» — только GET payroll-report (свои начисления) и GET payroll-settings для своего userId (read-only).
Режимы: единый %, по категориям, по услугам. Переключатель baseMode WITH_DISCOUNTS / WITHOUT_DISCOUNTS.
Отчёт: период, фильтры, таблица визитов с baseAmount, percent, commissionAmount, итого totalCommission.
```
