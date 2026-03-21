# Как связать «филиал в диалоге» с `studioId` (WhatsApp + Nextbot)

В xmind нет отдельной функции «разрешить филиал» — после сужения `/nextbot` до функций промпта **`studioId` берётся только из ответа `get_company_context`** (`GET /nextbot/context`): у каждой студии в массиве есть **`id`**, **`name`**, **`address`**.

---

## 1. Промпт / сценарий

1. Вызови **`get_company_context`** и получи список студий.
2. Сопоставь слова клиента с **одной** записью (по `name` / `address`). При неоднозначности — уточнение или кнопки 1/2/3.
3. Сохрани **`selected_studio_id` = id`** из ответа API (не выдумывать).
4. Без **`selected_studio_id`** не вызывай **`check_availability`** и не создавай запись.
5. Адреса из статического текста промпта — для ответа человеку; **id** — только из API.

### Абзац для блока про запись / слоты

> **Сбор данных и поиск окон.** Выясни **филиал**, **услугу** и **дату**. После выбора филиала вызови **`get_company_context`**, сопоставь ответ клиента с одной студией из списка и сохрани её **`id`** как **`selected_studio_id`**. Пока **`selected_studio_id`** не зафиксирован, **`check_availability`** не вызывать. Когда есть филиал (с id), услуга и дата — вызови **`check_availability`** для этого **`selected_studio_id`**.

---

## 2. Nextbot (конструктор)

- Переменная **`studio_id`** из шага выбора филиала.
- URL: `.../nextbot/studios/{{studio_id}}/...`

---

## 3. Итог

| Задача | Решение |
|--------|---------|
| Несколько филиалов | **`get_company_context`** → выбор → **`selected_studio_id`** |

См. [`NEXTBOT_XMIND_API.md`](./NEXTBOT_XMIND_API.md), [`NEXTBOT_PARTIAL_AND_MISSING.md`](./NEXTBOT_PARTIAL_AND_MISSING.md).
