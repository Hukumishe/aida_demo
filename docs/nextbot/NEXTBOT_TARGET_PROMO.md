# target_promo — Nextbot

Организационная функция (как `get_active_promotions`): **без `studioId` в URL**.

## get_company_context

`GET /nextbot/context`

```json
{
  "organizationId": "org_...",
  "studios": [{ "id": "stu_...", "name": "...", "address": null, "timezone": "Asia/Almaty", "organizationId": "org_..." }],
  "targetPromos": [{
    "id": "tpr_...",
    "promoText": "ХОЧУ СКИДКУ",
    "title": "...",
    "mechanics": { "type": "BONUS_POINTS", "label": "Бонусы", "bonusPoints": 500, "note": null }
  }],
  "promo_text": ["ХОЧУ СКИДКУ"],
  "get_company_context": "..."
}
```

Сопоставляйте сообщение клиента **дословно** (после trim) с элементами `promo_text`.

## target_promo

`POST /nextbot/target-promo` или `GET /nextbot/target-promo?promoText=...&phone=...&dialogId=...`

```json
{
  "promoText": "ХОЧУ СКИДКУ 20",
  "phone": "+77001234567",
  "dialogId": 14325361
}
```

**Ответ:**

| Поле | Описание |
|------|----------|
| `activationStatus` | `MATCHED` \| `NOT_MATCHED` \| `EXHAUSTED` |
| `matched` | boolean |
| `promoId`, `promoText`, `title` | при успехе |
| `mechanics` | тип акции, скидка/бонусы |
| `clientFound`, `clientId`, `bonusGranted` | клиент и начисление |
| `target_promo` | **промпт для агента** (портал `prompts` или `agentPrompt` из CRM) |

Ключи промптов в панели:
- `target_promo_not_matched`
- `target_promo_exhausted`
- `target_promo` — общий fallback при MATCHED
- `target_promo_<promoId>` — для конкретной акции (приоритет над общим)

## Python (xmind)

Скрипт: `nextbot/xmind_python/target_promo.py` — по «Золотым правилам архитектуры Nextbot» (`docs/Золотые правила архитектуры Nextbot.docx`): `args.get`, `result = { ok, status, data }`, `try/except`, без `import`.

**Args:** `base_url`, `api_key`, `organization_id`, `promo_text` (или `promoText`), `promo_id`, `phone`, `dialog_id`.
