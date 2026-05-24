# Автосообщение «День рождения» — промпт для Lovable

Отдельный сценарий (не шаблон из списка триггеров). Настройки и журнал — отдельные API.

---

## API

| Метод | Путь |
|-------|------|
| GET | `/studios/:studioId/nextbot-birthday/settings` |
| PUT | `/studios/:studioId/nextbot-birthday/settings` |
| GET | `/studios/:studioId/nextbot-birthday/logs` |

Права на изменение: **OWNER**, **DEPUTY_OWNER**, **DEVELOPER**.

---

## Размещение в UI

Блок **не** на вкладке «Интеграции». Карточка **«День рождения»** на вкладке **«Шаблоны»** раздела Nextbot — см. `LOVABLE_NEXTBOT_TABS_RESTRUCTURE_PROMPT.md`.

## Форма настроек (маркетинг → Шаблоны → День рождения)

| № | Поле UI | API | Примечание |
|---|---------|-----|------------|
| 0 | Вкл/выкл | `isActive` | switch |
| 1 | Ранг лояльности от | `minClientLevel` | select: BRONZE, SILVER, GOLD, DIAMOND |
| 2 | За сколько дней до ДР | `daysBeforeBirthday` | number 0–60; **0 = в день рождения** |
| 3 | Тип бонуса | `bonusType` | `BONUS_POINTS` или `DISCOUNT_PERCENT` |
| 3a | Сумма бонуса / % скидки | `bonusValue` | баллы (≥1) или % (1–100) |
| 4 | Срок действия скидки (дней) | `discountValidDays` | **обязательно** если `DISCOUNT_PERCENT` |
| 5 | Поздравительный текст | `messageText` | textarea + переменные |

### Переменные в тексте

`{{name}}`, `{{patronymic}}`, `{{lastName}}`, `{{phone}}`, `{{studio}}`,  
`{{bonusDescription}}` — готовая фраза («500 бонусных баллов» / «скидку 10% на 7 дн.»),  
`{{bonusValue}}`, `{{discountValidDays}}`.

Пример:

```
{{name}}, с наступающим днём рождения! Дарим {{bonusDescription}}. Ждём вас в {{studio}}!
```

### Пример PUT

```json
{
  "isActive": true,
  "minClientLevel": "SILVER",
  "daysBeforeBirthday": 3,
  "bonusType": "BONUS_POINTS",
  "bonusValue": 500,
  "messageText": "{{name}}, с наступающим днём рождения! {{bonusDescription}}"
}
```

Скидка:

```json
{
  "isActive": true,
  "minClientLevel": "BRONZE",
  "daysBeforeBirthday": 1,
  "bonusType": "DISCOUNT_PERCENT",
  "bonusValue": 15,
  "discountValidDays": 7,
  "messageText": "{{name}}, поздравляем! Ваша скидка {{bonusValue}}% на {{discountValidDays}} дней."
}
```

---

## Логика (для подсказок)

- Триггер: **дата рождения** клиента (`birthDate` в карточке).
- Раз в сутки (09:00) система ищет, кому сегодня пора отправить (ДР минус N дней).
- Не более **одного поздравления на клиента в год** (в рамках организации).
- Нужны: `birthDate`, `nextbotDialogId`, не в ЧС, `loyaltyEnabled`, ранг ≥ выбранного.
- При отправке: начисляются **баллы** или выставляется **скидка** клиенту + срок `discountExpiresAt`.
- Сообщение уходит в Nextbot (тот же webhook, что у автосообщений).

---

## Журнал

`GET .../logs` — `status`, клиент, год, `renderedText`, `bonusApplied`, ошибки.

---

## Чеклист

- [ ] Блок «День рождения» в маркетинге.
- [ ] Все 6 полей + вкл/выкл.
- [ ] Валидация: скидка → обязательны % и срок.
- [ ] Журнал поздравлений.
- [ ] Подсказка: у клиента должен быть заполнен ДР и dialog Nextbot.
