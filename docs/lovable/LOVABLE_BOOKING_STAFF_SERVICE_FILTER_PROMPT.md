# Промпт для Lovable: взаимная фильтрация «мастер ↔ услуги» в форме записи

Скопируйте блок **«Задача для Lovable»** в чат. Бэкенд уже поддержает query-параметры на публичных эндпоинтах (после деплоя AIDA).

**Base URL API:** `VITE_API_URL` (например `https://aidaproject-production.up.railway.app`).

---

## Задача для Lovable

### 1. Проблема

В потоке **«Новая запись»** (экраны «Выбрать услуги» / «Выбрать специалиста»):

- После выбора **мастера** в «Выбор услуг» показываются **карточки лендинга** (`GET .../landing/services`) — это неверно.
- После выбора **услуг** в «Выбор специалиста» показываются **все** мастера филиала, а не те, кто оказывает выбранные услуги.

Нужна **взаимная фильтрация** по привязкам **staff_services** в CRM (как в админке у мастера «Услуги»).

### 2. Правильные API (публично, без Bearer)

| Экран | Запрос |
|--------|--------|
| Все услуги филиала | `GET /landing/studios/{studioId}/bookable-services` |
| Услуги **конкретного мастера** | `GET /landing/studios/{studioId}/bookable-services?staffUserId={staffUserId}` |
| Все мастера филиала (форма записи) | `GET /landing/studios/{studioId}/bookable-masters` — **все** активные MASTER/ADMIN в филиале, без галочек «на лендинге» |
| Мастера под **выбранные услуги** | `GET /landing/studios/{studioId}/bookable-masters?serviceId={id1}&serviceId={id2}` — для каждой выбранной услуги свой `serviceId` в query (AND: мастер должен оказывать **все** выбранные услуги) |

**Не использовать** в этих экранах:

- `GET /studios/{studioId}/landing/masters` + фильтр `isVisible` — это **витрина** главной, не форма записи.
- `GET /studios/{studioId}/landing/services` — только витрина главной страницы, не форма записи.
- `GET /studios` — CRM, JWT.

### 3. Состояние формы (общее)

Хранить в контексте записи (или Zustand / React state):

```ts
type BookingDraft = {
  studioId: string;
  selectedStaffUserId: string | null; // null = «Любой мастер»
  selectedServiceIds: string[];     // srv_… из bookable-services
};
```

Порядок шагов может быть любым — фильтры зависят от того, **что уже выбрано**.

### 4. Сценарий A: клиент сначала выбирает **специалиста**

1. Экран «Выбор специалиста» → `GET .../bookable-masters` (без `serviceId`, если услуги ещё не выбраны).
2. Если уже есть `selectedServiceIds.length > 0` → тот же запрос с `?serviceId=...` для каждого id.
3. Пользователь выбирает мастера (или «Любой мастер» → `selectedStaffUserId = null`).
4. Экран «Выбор услуг»:
   - Если выбран **конкретный мастер** →  
     `GET .../bookable-services?staffUserId={selectedStaffUserId}`  
     Показать **только** эти услуги (название, цена, длительность из ответа).
   - Если **«Любой мастер»** → `GET .../bookable-services` без `staffUserId` (все услуги филиала).
5. Мультивыбор услуг допустим, если так задуман UX; `serviceId` в API — id услуги CRM.

### 5. Сценарий B: клиент сначала выбирает **услуги**

1. Экран «Выбор услуг» → если мастер **ещё не** выбран: `GET .../bookable-services` (без `staffUserId`).
2. Если мастер **уже** выбран → `GET .../bookable-services?staffUserId=...`.
3. Пользователь выбирает одну или несколько услуг → `selectedServiceIds`.
4. Экран «Выбор специалиста»:
   - Построить URL:  
     `/landing/studios/${studioId}/bookable-masters` +  
     `selectedServiceIds.map(id => 'serviceId=' + encodeURIComponent(id)).join('&')`
   - Пример:  
     `.../bookable-masters?serviceId=srv_aaa&serviceId=srv_bbb`
   - В списке остаются только мастера, у которых в CRM привязаны **все** выбранные услуги в этом филиале.
   - Пункт **«Любой мастер»** оставить; при нём слоты потом без `staffUserId` в availability.
5. Если после фильтра **0 мастеров** — текст: «Нет специалиста, который выполняет все выбранные услуги. Измените состав услуг или выберите другого мастера».

### 6. Сброс при смене выбора

| Действие | Сброс |
|----------|--------|
| Сменили **филиал** | `selectedStaffUserId`, `selectedServiceIds`, дата, слот |
| Сменили **мастера** (на другого) | `selectedServiceIds`, если новый мастер не оказывает текущие услуги — очистить услуги или перезапросить список и снять невалидные |
| Убрали услугу из набора | Перезапросить `bookable-masters` с актуальным набором `serviceId` |
| Добавили услугу | Снова `bookable-masters?serviceId=...` для полного набора |

### 7. Карточки UI «Выбор услуг»

- Данные: поля из `bookable-services` — `serviceId`, `name`, `defaultPrice`, `defaultDurationMin`, `categoryName`.
- Картинки с витрины (`landing/services`) — **опционально**: после загрузки каталога можно подтянуть `imageUrl` по `serviceId` из карточек витрины, но **список id** только из `bookable-services` (+ фильтр `staffUserId`).
- Цена/длительность для записи — из CRM (`defaultPrice`, `defaultDurationMin`), не из текста карточки лендинга.

### 8. Карточки UI «Выбор специалиста»

- Данные из `bookable-masters`: `staffUserId`, `staff.staffProfile` (имя, avatar, title/специализация).
- Первый пункт: **«Любой мастер»** (`staffUserId = null`).
- Поиск — клиентский filter по имени поверх уже отфильтрованного API-списка.

### 9. Дальше по потоку (без изменений логики)

- Слоты: `GET /landing/studios/{studioId}/availability?date=&serviceId={первая или основная услуга}&staffUserId={если не «Любой»}`.
- Submit: `POST /landing/booking-request` с `serviceId` (при мультивыборе — согласовать с бэкендом: сейчас одна услуга в body; если UI мультивыбор — передавать основную или разбить на несколько записей по ТЗ продукта).
- Время слотов: форматировать `startAt` в `timezone` филиала (`Intl`), не regex по ISO (UTC).

### 10. React Query / hooks (рекомендация)

```ts
// Услуги
useQuery({
  queryKey: ['bookable-services', studioId, staffUserId ?? 'any'],
  queryFn: () => fetch(
    `${API}/landing/studios/${studioId}/bookable-services` +
    (staffUserId ? `?staffUserId=${staffUserId}` : '')
  ).then(r => r.json()),
  enabled: !!studioId,
});

// Мастера
const serviceQuery = selectedServiceIds
  .map(id => `serviceId=${encodeURIComponent(id)}`)
  .join('&');
useQuery({
  queryKey: ['bookable-masters', studioId, selectedServiceIds],
  queryFn: () => fetch(
    `${API}/landing/studios/${studioId}/bookable-masters` +
    (serviceQuery ? `?${serviceQuery}` : '')
  ).then(r => r.json()),
  enabled: !!studioId,
});
```

### 11. Не делать

- Не фильтровать услуги на клиенте по полному списку лендинга — только API с `staffUserId`.
- Не показывать всех мастеров после выбора услуги без `serviceId` в query.
- Не путать `card.id` (карточка витрины) с `serviceId` (услуга CRM).

### 12. Проверка

1. Выбрать **Мадину** (шугаринг) → в услугах **нет** «Лазерной эпиляции» (если у Камилы она, а у Мадины нет).
2. Выбрать услугу **только Камилы** → в специалистах только **Камила** (+ «Любой мастер»).
3. Две услуги у разных мастеров → пустой список мастеров + понятное сообщение.

---

## Связанные документы

- `docs/lovable/LOVABLE_LANDING_BOOKING_FORM_PROMPT.md` — филиал, слоты, submit, UTC.
