# Завершение записи (Mark as Done)

## Обзор

После того как услуга была оказана клиенту, запись нужно отметить как завершенную (статус `DONE`). Это обновит статистику в дэшборде и покажет правильный процент "Выполнено".

---

## 🔌 API Endpoint

### Завершить запись

**Endpoint:** `POST /appointments/:id/done`

**Описание:** Отмечает запись как завершенную (статус `DONE`).

**Параметры:**
- `id` (path) - ID записи

**Тело запроса (JSON, опционально):**
```json
{
  "completedMoneyPaid": 8500,
  "bonusesUsed": 500,
  "paymentMethod": "CASH"
}
```
- `completedMoneyPaid` — сумма оплаты деньгами (₸), с учётом предоплаты. Если не передать — `стоимость визита − bonusesUsed`.
- `bonusesUsed` — списание кэшбека (бонусов). По умолчанию 0.
- `paymentMethod` — `CASH` | `BANK_TRANSFER` | `KASPI_PAY` (наличные / перевод / Kaspi Pay).

См. также `LOVABLE_ADMIN_BRANCH_RESTRICTIONS.md`.

**Ответ:**
```json
{
  "id": "appointment-uuid",
  "studioId": "studio-uuid",
  "staffUserId": "staff-uuid",
  "clientId": "client-uuid",
  "serviceId": "service-uuid",
  "startAt": "2024-02-15T11:00:00.000Z",
  "endAt": "2024-02-15T11:30:00.000Z",
  "status": "DONE",
  "prepaymentAmount": 2000,
  "arrivedAt": "2024-02-15T10:51:00.000Z",
  "arrivedByUserId": "user-uuid",
  "createdAt": "2024-02-15T10:00:00.000Z",
  "updatedAt": "2024-02-15T11:30:00.000Z",
  "staff": {
    "id": "staff-uuid",
    "staffProfile": {
      "firstName": "TEST",
      "lastName": "TEST"
    }
  },
  "client": {
    "id": "client-uuid",
    "firstName": "John",
    "lastName": "Doe"
  },
  "service": {
    "id": "service-uuid",
    "name": "Шугаринг",
    "defaultPrice": 2000
  }
}
```

**Ошибки:**
- `400` - Запись уже завершена или отменена
- `403` - Нет доступа к записи
- `404` - Запись не найдена

---

## 🎨 UI/UX Рекомендации

### Где показывать кнопку "Завершить"

Кнопку "Завершить" нужно показывать в модальном окне "Детали записи" когда:
- Статус записи: `ARRIVED` (клиент пришел)
- Статус записи: `BOOKED` (можно завершить даже если клиент не отмечен как пришедший)

**НЕ показывать кнопку когда:**
- Статус: `DONE` (уже завершено)
- Статус: `CANCELLED` (отменено)

### Расположение кнопки

В модальном окне "Детали записи" кнопка "Завершить" должна быть:
- Рядом с кнопкой "Отменить"
- Или вместо кнопки "Отменить", если запись уже началась
- Зеленого цвета (успешное действие)

**Пример расположения:**
```
┌─────────────────────────────────┐
│  Детали записи          [X]     │
├─────────────────────────────────┤
│  ... информация о записи ...    │
│                                  │
│  [✅ Завершить]  [❌ Отменить]   │
│  [Закрыть]                       │
└─────────────────────────────────┘
```

### Модальное окно «Завершить запись»

При нажатии на кнопку **«Завершить»** должно открываться модальное окно **«Завершить запись»**, а не сразу отправляться запрос на сервер.

**Содержимое модалки:**

1. **Заголовок:** «Завершить запись», кнопка закрытия (×).
2. **Услуга:** название и цена (например: «Шугаринг подмышки 1к — 1000 ₸»). Сумма визита = цена услуги + апселлы (если есть).
3. **Ползунок «Использовать бонусы»:**
   - Подпись: «Использовать бонусы» (или «Списано бонусов (₸)»).
   - Ползунок (slider) от 0 до максимума. Максимум = минимум из:
     - баланс бонусов клиента (`client.bonuses`);
     - лимит по студии: не более X% от суммы визита (настройка студии `globalBonusPaymentLimitPercent`, по умолчанию 30%). То есть макс. бонусов = `Math.floor(суммаВизита * globalBonusPaymentLimitPercent / 100)`.
   - При движении ползунка обновлять поле «Списано бонусов» и **итоговый чек**.
4. **Итоговый чек (обязательно показывать):**
   - Строка: **«Итого к оплате: X ₸»** — сумма, которую клиент платит деньгами после списания бонусов.  
     Формула: **Итого к оплате = сумма визита − списано бонусов** (не меньше 0).
   - Можно дополнительно показать: сумма визита, минус бонусы, равно итого к оплате.

**Кнопки в модалке:** «Отмена» (закрыть) и «Завершить» (отправить на сервер).

**При нажатии «Завершить»:** отправить `POST /appointments/:id/done` с телом `{ "bonusesUsed": <значение ползунка> }`. После успешного ответа закрыть модалку, обновить запись и при необходимости обновить данные клиента (GET /clients/:clientId), чтобы обновились бонусы и уровень лояльности.

**Данные для модалки:** сумма визита (из записи: услуга + апселлы), баланс бонусов клиента и лимит % — из GET /clients/:id и GET /studios/:id/settings (или из уже загруженных данных записи/клиента/студии).

---

## 📝 Примеры кода

### Обработка завершения записи

```typescript
async function markAppointmentAsDone(appointmentId: string, bonusesUsed: number = 0) {
  try {
    const response = await fetch(`/api/appointments/${appointmentId}/done`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bonusesUsed }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to mark appointment as done');
    }

    const updatedAppointment = await response.json();
    return updatedAppointment;
  } catch (error) {
    console.error('Error marking appointment as done:', error);
    throw error;
  }
}
```

### Компонент модального окна с кнопкой "Завершить"

```jsx
function AppointmentDetailsModal({ appointment, onClose, onUpdate }) {
  const [loading, setLoading] = useState(false);

  const canMarkAsDone = appointment.status === 'BOOKED' || appointment.status === 'ARRIVED';
  const isDone = appointment.status === 'DONE';
  const isCancelled = appointment.status === 'CANCELLED';

  async function handleMarkAsDone(bonusesUsed: number = 0) {
    setLoading(true);
    try {
      const updated = await markAppointmentAsDone(appointment.id, bonusesUsed);
      onUpdate(updated);
      // Можно показать уведомление об успехе
      alert('Запись завершена');
    } catch (error) {
      alert('Ошибка: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal">
      <div className="modal-header">
        <h2>Детали записи</h2>
        <button onClick={onClose}>×</button>
      </div>

      <div className="modal-body">
        {/* Информация о клиенте */}
        <div className="info-section">
          <Icon name="person" />
          <div>
            <div>{appointment.client.firstName} {appointment.client.lastName}</div>
            <div>📞 {appointment.client.phone}</div>
          </div>
        </div>

        {/* Информация об услуге */}
        <div className="info-section">
          <Icon name="service" />
          <div>
            <div>{appointment.service.name}</div>
            <div>{appointment.service.defaultDurationMin} мин · {formatCurrency(appointment.service.defaultPrice)}</div>
          </div>
        </div>

        {/* Дата и время */}
        <div className="info-section">
          <Icon name="clock" />
          <div>
            <div>{formatDate(appointment.startAt)}</div>
            <div>{formatTime(appointment.startAt)} - {formatTime(appointment.endAt)}</div>
          </div>
        </div>

        {/* Мастер */}
        <div className="info-section">
          <Icon name="person" />
          <div>
            <div>Мастер</div>
            <div>{appointment.staff.staffProfile.firstName} {appointment.staff.staffProfile.lastName}</div>
          </div>
        </div>

        {/* Время прибытия (если есть) */}
        {appointment.arrivedAt && (
          <div className="info-section">
            <Icon name="check" color="green" />
            <div>
              <div>Время прибытия</div>
              <div>{formatTime(appointment.arrivedAt)}</div>
            </div>
          </div>
        )}
      </div>

      <div className="modal-footer">
        {/* Кнопка "Завершить" - показываем только если можно */}
        {canMarkAsDone && (
          <button 
            className="btn-success"
            onClick={handleMarkAsDone}
            disabled={loading}
          >
            {loading ? 'Загрузка...' : '✅ Завершить'}
          </button>
        )}

        {/* Кнопка "Отменить" - показываем только если не завершено и не отменено */}
        {!isDone && !isCancelled && (
          <button 
            className="btn-danger"
            onClick={handleCancel}
            disabled={loading}
          >
            ❌ Отменить
          </button>
        )}

        <button className="btn-secondary" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
}
```

### Обновление списка записей после завершения

```jsx
function AppointmentList() {
  const [appointments, setAppointments] = useState([]);

  async function handleMarkAsDone(appointmentId) {
    try {
      const updated = await markAppointmentAsDone(appointmentId);
      
      // Обновляем запись в списке
      setAppointments(prev => 
        prev.map(apt => apt.id === appointmentId ? updated : apt)
      );

      // Обновляем статистику в дэшборде (если открыт)
      refreshDashboard();
    } catch (error) {
      console.error('Failed to mark as done:', error);
    }
  }

  return (
    <div>
      {appointments.map(appointment => (
        <AppointmentCard
          key={appointment.id}
          appointment={appointment}
          onMarkAsDone={handleMarkAsDone}
        />
      ))}
    </div>
  );
}
```

---

## 🔄 Логика работы

### Когда можно завершить запись

1. **Статус `BOOKED`** - можно завершить (даже если клиент не отмечен как пришедший)
2. **Статус `ARRIVED`** - можно завершить (клиент пришел, услуга оказана)

### Когда нельзя завершить

1. **Статус `DONE`** - уже завершено (показывать сообщение "Запись уже завершена")
2. **Статус `CANCELLED`** - отменено (нельзя завершить отмененную запись)

### Что происходит при завершении

1. Статус записи меняется на `DONE`
2. Запись больше не учитывается в предстоящих визитах
3. Статистика "Выполнено" в дэшборде обновляется
4. Запись остается в истории для отчетов

---

## ✅ Чеклист для реализации

- [ ] Добавить кнопку "Завершить" в модальное окно "Детали записи"
- [ ] Показывать кнопку только когда статус `BOOKED` или `ARRIVED`
- [ ] Скрывать кнопку когда статус `DONE` или `CANCELLED`
- [ ] Обработать успешное завершение (обновить UI)
- [ ] Обработать ошибки (показать сообщение)
- [ ] Обновить список записей после завершения
- [ ] Обновить статистику в дэшборде (если открыт)
- [ ] Добавить подтверждение перед завершением (опционально)

---

## 🎯 Дополнительные возможности (опционально)

1. **Автоматическое завершение:**
   - Автоматически завершать записи, которые закончились более N часов назад

2. **Уведомления:**
   - Показывать уведомление после успешного завершения
   - Отправлять уведомление клиенту (если есть интеграция)

3. **История:**
   - Показывать время завершения в деталях записи
   - Показывать, кто завершил запись (если нужно)

---

**Готово!** Теперь у вас есть endpoint для завершения записей и полное понимание, как его использовать на фронтенде.
