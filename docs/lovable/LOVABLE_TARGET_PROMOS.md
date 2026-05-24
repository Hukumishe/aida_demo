# Промокоды Target — API (CRM)

Организационный справочник промотекстов для Nextbot.

| Метод | Путь |
|-------|------|
| GET | `/target-promos?organizationId=` |
| POST | `/target-promos` |
| PATCH | `/target-promos/:id` |
| DELETE | `/target-promos/:id` |
| GET | `/target-promos/activations?targetPromoId=` |

Права: **OWNER**, **DEPUTY_OWNER**, **DEVELOPER**.

## Поля

| Поле | Описание |
|------|----------|
| `title` | Название в админке |
| `promoText` | Точная фраза из рекламы |
| `agentPrompt` | Инструкции для бота после срабатывания |
| `mechanicsType` | `INSTRUCTIONS_ONLY` \| `DISCOUNT_PERCENT` \| `BONUS_POINTS` |
| `discountPercent` | При `DISCOUNT_PERCENT` |
| `bonusPoints` | При `BONUS_POINTS` — начисляются клиенту при активации |
| `maxActivations` | Лимит срабатываний |
| `validFrom` / `validUntil` | Период действия |

## Nextbot

- `GET /nextbot/context` → `targetPromos: [{ id, promoText, title }]`
- `POST /nextbot/target-promo` → `{ matched, target_promo, ... }`

См. `docs/nextbot/NEXTBOT_TARGET_PROMO.md`.
