# Админ филиала (ADMIN): ограничения и завершение визита

> **Единый промпт для Lovable (копировать в чат):** [`LOVABLE_ADMIN_BRANCH_RESTRICTIONS_PROMPT.md`](./LOVABLE_ADMIN_BRANCH_RESTRICTIONS_PROMPT.md)

Краткая справка по API. Бэкенд уже реализован.

## 1. Завершение услуги (все роли с доступом к записи)

`POST /appointments/:id/done`

Тело (все поля опциональны, но в UI для админа лучше сделать обязательными):

```json
{
  "completedMoneyPaid": 8500,
  "bonusesUsed": 500,
  "paymentMethod": "CASH"
}
```

`paymentMethod`: `CASH` | `BANK_TRANSFER` | `KASPI_PAY` (наличные / перевод / Kaspi Pay).

- `completedMoneyPaid` — сумма оплаты **деньгами** за визит (₸), с учётом предоплаты. Если не передать — считается автоматически: стоимость услуг минус бонусы.
- `bonusesUsed` — списание кэшбека (бонусов).
- В ответе запись содержит `completedMoneyPaid`, `completedBonusesUsed`, `completedPaymentMethod`.

Модалка «Завершить визит»: поля сумма, бонусы, select типа оплаты → submit.

## 2. Админ не редактирует мастеров

Для роли `ADMIN` API вернёт **403** на:

- `PATCH /staff/:userId` (если цель — `MASTER`)
- `PATCH /staff/:userId/profile`
- `POST/DELETE /staff/:staffUserId/services...`
- override мастера, увольнение/восстановление мастера

Просмотр списка мастеров (`GET /studios/:studioId/staff`) — **разрешён**.

**UI:** скрыть кнопки «Редактировать», «Услуги мастера», «Сохранить» на карточке мастера для `ADMIN`; оставить только просмотр.

## 3. Нет общего списка клиентов

`GET /clients`, `GET /clients/segments`, `GET /clients/referred` для `ADMIN` → **403**.

`GET /clients/:id` — **работает** (карточка из записи).

**UI:** убрать пункт меню «Клиенты» / дашборд сегментов для `ADMIN`. Переход в карточку — только из записи (клик по клиенту в appointment).

## 4. Услуги при создании записи — только у выбранного мастера

`GET /services?studioId={studioId}&staffUserId={masterUserId}`

- Возвращает только услуги из `staff_services` для этого мастера в филиале и доступные в студии (`isOfferedInStudio`).
- После выбора мастера в форме записи **перезапросить** услуги с `staffUserId`; не показывать полный каталог.
- Для **всех ролей** (не только админ).

Альтернатива: `GET /staff/:staffUserId/services` (уже есть) — можно использовать вместо query на `/services`.

При создании записи бэкенд отклонит услугу, не привязанную к мастеру: `400 Услуга недоступна для выбранного мастера`.

## Чеклист Lovable

- [ ] Модалка done: сумма, бонусы, тип оплаты
- [ ] ADMIN: нет редактирования мастеров
- [ ] ADMIN: нет списка клиентов, карточка из записи
- [ ] Форма записи: услуги после выбора мастера (`staffUserId` + `studioId`)
