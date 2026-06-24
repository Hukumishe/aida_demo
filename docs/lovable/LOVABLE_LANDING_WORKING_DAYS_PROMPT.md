# Промпт для Lovable: график мастера в форме записи

Скопируйте блок ниже **целиком** в чат Lovable.

---

## Промпт

### Проблема

На экранах «Выбор специалиста» и «Дата и время»:

- Показываются мастера **без рабочего графика** в CRM.
- В календаре — **все дни подряд**, хотя мастер работает только в отдельные дни → «На эту дату нет свободного времени».

### Бэкенд (после деплоя)

**1. Мастера** — только с графиком:

```
GET /landing/studios/{studioId}/bookable-masters?serviceId=...
```

В списке остаются только мастера с **хотя бы одним рабочим днём** (не выходной) начиная с сегодня.

**2. Рабочие дни для календаря:**

```
GET /landing/studios/{studioId}/working-days?staffUserId={id}&serviceId=...&from=YYYY-MM-DD&to=YYYY-MM-DD
```

Ответ:

```ts
{
  studioId: string;
  timezone: string;       // IANA, напр. Asia/Almaty
  staffUserId: string | null;
  from: string;
  to: string;
  dates: string[];        // ["2026-06-24", "2026-06-26", ...]
}
```

- `staffUserId` задан → только дни **этого** мастера.
- `staffUserId` нет («Любой мастер») → объединение дней всех bookable-masters (с учётом `serviceId`).
- `from` / `to` опциональны (по умолчанию сегодня … +60 дней).

**3. Слоты** — без изменений:

```
GET /landing/studios/{studioId}/availability?date=YYYY-MM-DD&serviceId=...&staffUserId=...
```

---

### Задача для UI

#### Экран «Выбор специалиста»

- Список из `bookable-masters` (уже без мастеров без графика).
- Если список пуст → «Нет доступных специалистов с графиком на ближайшие дни».

#### Экран «Дата и время»

1. При открытии (и при смене мастера/услуги) вызвать `working-days`:
   - конкретный мастер → `?staffUserId=...`
   - «Любой мастер» → без `staffUserId`, с `serviceId` если услуги выбраны
2. В горизонтальном календаре показывать **только** даты из `dates[]`.
3. **Не рисовать** остальные дни как кликабельные (или скрыть).
4. Первую доступную дату из `dates` выбрать по умолчанию.
5. Для выбранной даты — `availability` как сейчас.

#### Сброс

| Событие | Действие |
|---------|----------|
| Смена мастера | Перезапрос `working-days`, сброс даты/слота |
| Смена услуги | Перезапрос `working-days` и `bookable-masters` |
| Смена филиала | Полный сброс |

---

### React Query (пример)

```ts
useQuery({
  queryKey: ['working-days', studioId, staffUserId ?? 'any', serviceIds, from, to],
  queryFn: () => {
    const params = new URLSearchParams();
    if (staffUserId) params.set('staffUserId', staffUserId);
    serviceIds.forEach(id => params.append('serviceId', id));
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const q = params.toString();
    return fetch(`${API}/landing/studios/${studioId}/working-days${q ? `?${q}` : ''}`).then(r => r.json());
  },
  enabled: !!studioId && (step === 'datetime'),
});
```

---

### Acceptance

1. Мастер без графика в CRM **не** в списке специалистов.
2. У Ивана график только Ср/Пт → в календаре только эти дни, не вся неделя.
3. Клик по рабочему дню → слоты из `availability`.
4. «Любой мастер» → дни, когда работает хотя бы один доступный мастер.

---

## Конец промпта
