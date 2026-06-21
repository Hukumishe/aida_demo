# Промпт для Lovable: полный доступ MARKETER ко всем пунктам «Настройки»

Скопируйте блок **«Промпт»** ниже в чат Lovable **целиком**.

Backend AIDA **обновлён**: роль `MARKETER` имеет доступ ко **всем** пунктам меню «Настройки» на скриншотах (Маркетинг, Автосообщения, Программа лояльности, Лендинг, FAQ) и ко **всем** подпунктам внутри «Маркетинг».

---

## Промпт

### Задача

Для роли **`MARKETER`** открыть **весь** экран «Настройки» и все подразделы без read-only блокировок там, где API уже разрешает запись. Не показывать журнал записей, клиентов, склад, payroll.

JWT: `role === 'MARKETER'`, `organizationId` — сеть, `studioId` обычно `null`. **Обязателен селектор филиала** (`GET /studios` → `activeStudioId`) для экранов с `studioId` в URL.

---

### Меню «Настройки» — все 5 пунктов

| Пункт UI | Что открыть | API |
|----------|-------------|-----|
| **Маркетинг** | Подменю из 6 экранов (ниже) | см. таблицу «Маркетинг» |
| **Автосообщения** | Шаблоны + журнал по филиалу | `GET/POST/PATCH/DELETE /studios/:studioId/nextbot-auto-messages/*`, logs, test-send, presets; birthday — `GET/PATCH .../nextbot-birthday-settings` |
| **Программа лояльности** | PRESET/CUSTOM, уровни, вехи | `GET/PUT /studios/:studioId/loyalty` → `permissions.canEdit`; лимит бонусов — `globalBonusPaymentLimitPercent` в settings; на услугах — PATCH `bonusAccrualEnabled` |
| **Лендинг** | Блоки, мастера, услуги, категории, WhatsApp | CRUD landing services/categories, masters org-wide, whatsapp-settings, `POST /upload/landing` |
| **FAQ** | Вопросы для публичного лендинга | `GET/POST/PATCH/DELETE /admin/faq`, reorder |

---

### Подменю «Маркетинг» — все 6 пунктов

| Пункт UI | API | PATCH settings (поля) |
|----------|-----|------------------------|
| **Акции** | `GET/POST/PATCH/DELETE /landing/promotions?organizationId=` | — |
| **Промокоды Target** | `GET/POST/PATCH/DELETE /target-promos`, `GET /target-promos/activations` | — |
| **Реферальные ссылки** | `GET/POST/PATCH /studios/:studioId/referral-links` | — |
| **Рабочие часы отдела маркетинга** | `GET/PATCH /studios/:studioId/settings` | `marketingHoursStartHour`, `marketingHoursEndHour`, `paymentKaspiPhone`, `paymentKaspiCardHolder`, `remotePaymentMethod`, `paymentIpRequisites` |
| **Тайминги оплаты** | тот же settings | `nightHoldMinutes`, `dayInvoiceTaskDeadlineHours`, `nightReceiptTaskDeadlineHours` |
| **Плотность записей** | тот же settings | `highPriorityGapMinutes`, `normalPriorityToleranceMinutes` |

Дополнительно в settings для маркетолога (блок «Приведи друга» / отзывы):

- `referFriendEnabled`, `referFriendInviteeRewardType`, `referFriendInviteeValue`, `referFriendReferrerRewardType`, `referFriendReferrerValue`
- `feedbackTwoGisUrl`, `feedbackLowRatingTaskTitle`
- `globalBonusPaymentLimitPercent`

**Read-only для MARKETER** (скрыть или disabled): `masterLateFineAmount`, `nextbotOutboundWebhookUrl`, `nextbotOutboundWebhookApiKey`.

`GET /studios/:studioId/settings` → `permissions.canEditMarketingSettings === true` для MARKETER — использовать для включения форм Kaspi, таймингов и плотности.

---

### Навигация MARKETER

Показать **только**:

1. **Настройки** → все 5 пунктов верхнего меню  
2. Внутри **Маркетинг** → все 6 подпунктов  
3. Селектор филиала в шапке (все студии из `GET /studios`)

Скрыть: Dashboard, журнал, клиенты, расписание, сотрудники (кроме галочек «на лендинге»), склад, зарплата, Nextbot webhook.

---

### Проверка на фронте

```typescript
const isMarketer = user.role === 'MARKETER';

const marketerSettingsSections = [
  'promotions',
  'target-promos',
  'referral-links',
  'marketing-hours',
  'payment-timings',
  'booking-density',
  'auto-messages',
  'loyalty',
  'landing',
  'faq',
] as const;
```

Не блокировать сохранение settings для полей из таблицы выше, если `permissions.canEditMarketingSettings` или `canEditLoyalty` true.

---

### Acceptance criteria

- [ ] MARKETER видит все 5 пунктов «Настройки» и все 6 подпунктов «Маркетинг»
- [ ] Target promos: список, создание, редактирование, удаление без 403
- [ ] Лендинг: CRUD карточек услуг/категорий по любому филиалу сети
- [ ] Settings: сохранение Kaspi, часов, таймингов, плотности, refer-friend, 2GIS
- [ ] Webhook Nextbot и штраф мастера — скрыты/disabled
