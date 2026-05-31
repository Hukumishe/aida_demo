# Зарплата / комиссия (Lovable)

## Модель

- **Ставки % — одни на всю организацию** (не у каждого мастера свои).
- **Начисления** при `DONE` — по общим правилам; в отчёте — **по каждому мастеру** отдельно.
- **Карточка мастера** — зарплата этого мастера + те же глобальные ставки (просмотр).

## Доступ

| Действие | OWNER | DEVELOPER | MASTER |
|----------|-------|-----------|--------|
| Просмотр глобальных настроек | да | да | да (read-only) |
| Сохранение настроек | да | да | нет |
| Отчёт по всей сети | да | да | нет |
| Своя зарплата / карточка мастера | да | да | только себя |

## API

### Глобальные настройки (раздел настроек организации)

**GET** `/organizations/:organizationId/payroll-settings`  
**PUT** `/organizations/:organizationId/payroll-settings`

```json
{
  "rateMode": "UNIFIED",
  "baseMode": "WITHOUT_DISCOUNTS",
  "unifiedPercent": 40,
  "categoryRates": [{ "categoryId": "sca_xxx", "percent": 35 }],
  "serviceRates": [{ "serviceId": "srv_xxx", "percent": 50 }]
}
```

| rateMode | Смысл |
|----------|--------|
| `UNIFIED` | Один % на все услуги (`unifiedPercent`) |
| `BY_CATEGORY` | % по категориям каталога |
| `BY_SERVICE` | % по услугам каталога организации |

| baseMode | Смысл |
|----------|--------|
| `WITHOUT_DISCOUNTS` | % от прайса на записи |
| `WITH_DISCOUNTS` | % от суммы после скидок на чеке |

### Отчёт

**GET** `/organizations/:organizationId/payroll-report?from=&to=&staffUserId=&studioId=`

### Карточка мастера

**GET** `/organizations/:organizationId/staff/:staffUserId/payroll?from=&to=`

Ответ:

```json
{
  "staffUserId": "usr_xxx",
  "organizationPayroll": { "configured": true, "settings": { ... }, "categoryRates": [], "serviceRates": [] },
  "report": { "totalCommission": 12000, "items": [ ... ] }
}
```

MASTER: только `staffUserId ===` свой `userId`.

## Начисление

При `POST /appointments/:id/done` — автоматически, если есть `payroll-settings` у организации.

## Промпт

```
Настройки зарплаты — один экран в настройках организации: GET/PUT /organizations/{orgId}/payroll-settings.
В карточке мастера вкладка «Зарплата»: GET /organizations/{orgId}/staff/{staffUserId}/payroll?from=&to=.
Отчёт OWNER: GET /organizations/{orgId}/payroll-report.
```
