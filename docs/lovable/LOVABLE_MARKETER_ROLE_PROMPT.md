# Промпт для Lovable: роль MARKETER (маркетолог)

Скопируйте блок **«Промпт»** ниже в чат Lovable **целиком**.

Backend AIDA **обновлён**: роль `MARKETER` имеет доступ ко всем маркетинговым разделам своей организации (все филиалы сети).

---

## Промпт

### Задача

Настроить CRM для роли **`MARKETER`** (маркетолог): меню, маршруты и UI только для **привлечения и удержания клиентов**. Без журнала записей, клиентов, склада, payroll, удаления сущностей.

JWT: `role === 'MARKETER'`, `organizationId` — сеть салонов, `studioId` обычно `null`.

---

### Что маркетолог **может** (API готово)

| Раздел | Эндпоинты | Заметка |
|--------|-----------|---------|
| **Лендинг — акции** | `GET/POST/PATCH/DELETE /landing/promotions`, `POST /landing/promotions/resolve-code` | На уровне организации |
| **Лендинг — мастера витрины** | `GET/PATCH /organizations/:organizationId/landing/masters` | Единые настройки сети |
| **Лендинг — карточки услуг** | `GET .../landing/service-catalog`, CRUD `.../landing/services`, reorder | По `studioId` |
| **Лендинг — категории** | `GET .../landing/category-catalog`, CRUD `.../landing/categories`, reorder | По `studioId` |
| **Лендинг — WhatsApp** | `GET/PATCH /studios/:studioId/landing/whatsapp-settings` | Кнопка на сайте |
| **Загрузка картинок** | `POST /upload/landing` | → `imageUrl` в карточках |
| **FAQ** | `GET/POST/PATCH/DELETE /admin/faq`, reorder | Организация |
| **Автосообщения Nextbot** | `GET/POST/PATCH/DELETE /studios/:studioId/nextbot-auto-messages/*`, logs, test-send, presets | «Догоняющие» сценарии |
| **Реф. ссылки (?ref=)** | `GET/POST/PATCH /studios/:studioId/referral-links` | UTM-источники |
| **Настройки маркетинга** | `GET/PATCH /studios/:studioId/settings` | **Только** поля ниже |
| **Программа лояльности** | `GET/PUT /studios/:studioId/loyalty` | PRESET / CUSTOM: уровни, % кэшбэка, вехи |
| **Список филиалов** | `GET /studios` | Все студии своей организации |

**PATCH settings — разрешённые поля для MARKETER:**

- `referFriendEnabled`, `referFriendInviteeRewardType`, `referFriendInviteeValue`, `referFriendReferrerRewardType`, `referFriendReferrerValue` — «Приведи друга»
- `marketingHoursStartHour`, `marketingHoursEndHour` — рабочие часы отдела маркетинга (Nextbot)
- `feedbackTwoGisUrl`, `feedbackLowRatingTaskTitle` — автосообщения «запрос оценки»

Остальные поля settings (бонусы, Kaspi, штрафы, webhook Nextbot) — **read-only или скрыть** для маркетолога.

---

### Что маркетолог **не может**

- Журнал записей, клиенты, расписание, сотрудники (кроме галочек «на лендинге»)
- Создание/удаление филиалов, владельцев, payroll
- Чёрный список, задачи коллцентра
- `nextbotOutboundWebhookUrl` / `ApiKey` — только DEVELOPER
- Удаление записей и клиентов

---

### UI — навигация для MARKETER

Показать **только** (названия как в продукте):

1. **Лендинг** — подразделы: акции, услуги, категории, мастера, WhatsApp, FAQ  
2. **Автосообщения** — шаблоны + журнал отправок по выбранному филиалу  
3. **Реферальные ссылки** — список `?ref=` по сети  
4. **Программа лояльности** — режим PRESET/CUSTOM, уровни и вехи (`GET/PUT .../loyalty`)  
5. **Маркетинг** (или блок в настройках) — «Приведи друга», часы маркетинга, 2GIS для отзывов  

**Селектор филиала** в шапке: все студии из `GET /studios` (маркетолог видит всю сеть). Отдельный промпт: **`LOVABLE_MARKETER_STUDIO_SELECTOR_PROMPT.md`** (пустой экран «Автосообщения» без выбранного филиала).

Скрыть: Dashboard, журнал, клиенты, склад, зарплата, Nextbot webhook.

---

### Проверка роли на фронте

```typescript
const isMarketer = user.role === 'MARKETER';

function canAccessMarketingSection(section: string): boolean {
  if (!isMarketer) return true; // остальные роли — по вашей текущей матрице
  const allowed = ['landing', 'auto-messages', 'referral-links', 'loyalty', 'marketing-settings', 'faq'];
  return allowed.includes(section);
}
```

При `403` на API — toast «Недостаточно прав», не ломать layout.

---

### Создание пользователя MARKETER

Владелец создаёт через существующий CRUD сотрудников: роль **`MARKETER`**, `studioId = null` (уровень сети). См. `POST /studios/:studioId/staff` с `role: "MARKETER"`.

**Форма «Добавить сотрудника»:** для роли MARKETER (и MANAGER) **не отправлять** `studioIds` / блок «Филиалы» можно скрыть — бэкенд всё равно игнорирует филиалы, но лучше не показывать лишнее.

---

### Чеклист

- [ ] Меню маркетолога без CRM-разделов
- [ ] Все лендинг-редакторы доступны с JWT MARKETER
- [ ] Автосообщения: CRUD + logs + test-send
- [ ] Реф. ссылки: список и создание
- [ ] Программа лояльности: GET/PUT `/studios/:studioId/loyalty`
- [ ] Settings: форма только маркетинговых полей
- [ ] FAQ в админке
- [ ] Не показывать webhook Nextbot маркетологу

### Не делать

- Не давать маркетологу журнал записей «для просмотра»
- Не менять бэкенд — права уже на сервере

---

## Конец промпта
