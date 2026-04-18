# Функции промпта (xmind) ↔ вызовы для Nextbot

Имена должны совпадать с **aida_xmind.pdf**. В `/nextbot` **нет** отдельных HTTP для `cancel_booking` / `reschedule_booking` — в xmind для этого указан **`modify_booking`**.

**Полная карта URL:** [`NEXTBOT_XMIND_API.md`](./NEXTBOT_XMIND_API.md).

---

## Таблица

| Имя в промпте | Когда | Nextbot (POST/GET) |
|---------------|--------|---------------------|
| **`modify_booking`** | Любое изменение записи: время, предоплата, **отмена** (`status: CANCELLED`) | **POST** `/nextbot/appointments/{appointmentId}/update` + JSON |
| **`reschedule_booking`** | Удобная аббревиатура в коде/Python; в HTTP это тот же **`modify_booking`** | **POST** `.../update` с телом `{"startAt":"..."}` |
| **`cancel_booking`** | В xmind как отдельное имя может не быть; смысл — через **`modify_booking`** | **POST** `.../update` с `{"status":"CANCELLED"}` |

**`appointment_id`:** из CRM после **`create_booking_request`** или из списка записей через основной API `GET /clients/:id/appointments` (в `/nextbot` этого маршрута нет — он не в xmind).

---

## Готовые абзацы для промпта

### Перенос

> Для **переноса** записи вызови **`modify_booking`**: **POST** с телом **`{"startAt": "<ISO с часовым поясом +06:00>"}`**. При необходимости сначала **`check_availability`**.

### Отмена

> Для **отмены** вызови **`modify_booking`**: **POST** с телом **`{"status": "CANCELLED"}`** после явного согласия клиента (и предупреждений по правилам студии, если они в промпте).

### Общий случай

> Любые допустимые поля CRM для записи — через **`modify_booking`** и **POST** `/update`: **`startAt`**, **`prepaymentAmount`**, **`status`**.

---

## Настройка Custom API в Nextbot

- **Изменение / отмена:** метод **POST**, URL  
  `https://<HOST>/nextbot/appointments/{{appointment_id}}/update`  
  + JSON.

Имя действия можно назвать **`modify_booking`** (как в xmind).
