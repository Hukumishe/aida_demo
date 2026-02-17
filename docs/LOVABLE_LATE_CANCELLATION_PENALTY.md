# Поздняя отмена записи - сгорание предоплаты

## Обзор

При отмене записи менее чем за 4 часа до начала, предоплата клиента сгорает и добавляется в доход студии. Это штраф за позднюю отмену, который учитывается в дэшборде как доход.

---

## 🎯 Функционал

### Сценарий использования:

1. Клиент создаёт запись с предоплатой (например, 5000 тенге)
2. Запись отменяется менее чем за 4 часа до начала
3. Предоплата сгорает (сохраняется в `forfeitedPrepaymentAmount`)
4. В дэшборде эта сумма учитывается как доход от штрафа за отмену

### Правила:

- **Поздняя отмена:** менее чем за 4 часа до начала записи
- **Сгорание предоплаты:** если отмена поздняя И есть предоплата → предоплата сгорает
- **Ранняя отмена:** более чем за 4 часа → предоплата возвращается (не сгорает)
- **Без предоплаты:** если предоплаты не было → штраф не применяется

---

## 🔌 API Endpoints

### Отмена записи

**Endpoint:** `POST /appointments/:id/cancel`

**Описание:** Отменяет запись. Если отмена поздняя (менее 4 часов до начала) и есть предоплата, она сгорает.

**Заголовки:**
```
Authorization: Bearer {token}
```

**Параметры:**
- `id` (path) - UUID записи

**Пример запроса:**
```javascript
POST /appointments/123e4567-e89b-12d3-a456-426614174000/cancel
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Пример ответа (200 OK):**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "studioId": "studio-uuid",
  "staffUserId": "staff-uuid",
  "clientId": "client-uuid",
  "serviceId": "service-uuid",
  "startAt": "2026-02-16T15:00:00.000+06:00",
  "endAt": "2026-02-16T16:00:00.000+06:00",
  "status": "CANCELLED",
  "prepaymentAmount": 5000,
  "forfeitedPrepaymentAmount": 5000,
  "arrivedAt": null,
  "arrivedByUserId": null,
  "createdAt": "2026-02-15T10:00:00.000+06:00",
  "updatedAt": "2026-02-16T12:00:00.000+06:00"
}
```

**Важно:**
- Если отмена поздняя и есть предоплата → `forfeitedPrepaymentAmount` будет равен `prepaymentAmount`
- Если отмена ранняя или нет предоплаты → `forfeitedPrepaymentAmount` будет `null`

**Ошибки:**

**400 Bad Request** - Запись уже отменена:
```json
{
  "statusCode": 400,
  "message": "Appointment is already cancelled",
  "error": "Bad Request"
}
```

**403 Forbidden** - Нет доступа:
```json
{
  "statusCode": 403,
  "message": "Access denied to this appointment",
  "error": "Forbidden"
}
```

**404 Not Found** - Запись не найдена:
```json
{
  "statusCode": 404,
  "message": "Appointment with ID {id} not found",
  "error": "Not Found"
}
```

---

### Получение записи

**Endpoint:** `GET /appointments/:id` или `GET /studios/:studioId/appointments`

**Описание:** При получении записи поле `forfeitedPrepaymentAmount` показывает, сколько предоплаты сгорело при отмене.

**Пример ответа для отменённой записи:**
```json
{
  "id": "appointment-uuid",
  "status": "CANCELLED",
  "prepaymentAmount": 5000,
  "forfeitedPrepaymentAmount": 5000,
  "startAt": "2026-02-16T15:00:00.000+06:00",
  "client": {
    "id": "client-uuid",
    "firstName": "Иван",
    "lastName": "Иванов"
  },
  "service": {
    "id": "service-uuid",
    "name": "Стрижка"
  }
}
```

---

### Дэшборд (доход учитывает сгоревшие предоплаты)

**Endpoint:** `GET /studios/:studioId/dashboard`

**Описание:** Доход в дэшборде включает:
- Предоплату из завершённых записей (статус `DONE`)
- Сгоревшую предоплату из отменённых записей (статус `CANCELLED` с `forfeitedPrepaymentAmount`)

**Пример ответа:**
```json
{
  "overview": {
    "totalAppointments": 100,
    "revenue": 250000,
    "cancellationRate": 15.5,
    "completionRate": 80.0
  },
  "statusCounts": {
    "BOOKED": 10,
    "CANCELLED": 15,
    "ARRIVED": 5,
    "DONE": 70
  }
}
```

**Важно:** Поле `revenue` включает:
- Все предоплаты из записей со статусом `DONE`
- Все `forfeitedPrepaymentAmount` из записей со статусом `CANCELLED`

---

## 💻 Реализация на Frontend

### Шаг 1: Отмена записи с проверкой времени

```typescript
// CancelAppointment.tsx
import { useState } from 'react';

interface Appointment {
  id: string;
  startAt: string;
  prepaymentAmount?: number;
  status: string;
}

export function CancelAppointment({ appointment }: { appointment: Appointment }) {
  const [loading, setLoading] = useState(false);
  const [willForfeit, setWillForfeit] = useState(false);

  useEffect(() => {
    // Проверить, будет ли предоплата сгорать
    const startAt = new Date(appointment.startAt);
    const now = new Date();
    const hoursUntilStart = (startAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    const isLateCancellation = hoursUntilStart < 4 && hoursUntilStart > 0;
    
    setWillForfeit(isLateCancellation && appointment.prepaymentAmount > 0);
  }, [appointment]);

  const handleCancel = async () => {
    if (willForfeit) {
      const confirmed = window.confirm(
        `Внимание! Отмена менее чем за 4 часа до начала.\n` +
        `Предоплата ${appointment.prepaymentAmount} тенге будет удержана как штраф за позднюю отмену.\n\n` +
        `Продолжить?`
      );
      
      if (!confirmed) {
        return;
      }
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/appointments/${appointment.id}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const cancelledAppointment = await response.json();
        
        // Проверить, сгорела ли предоплата
        if (cancelledAppointment.forfeitedPrepaymentAmount) {
          alert(
            `Запись отменена.\n` +
            `Предоплата ${cancelledAppointment.forfeitedPrepaymentAmount} тенге удержана как штраф за позднюю отмену.`
          );
        } else {
          alert('Запись отменена. Предоплата будет возвращена.');
        }
        
        // Обновить список записей
        window.location.reload();
      } else {
        const error = await response.json();
        alert(`Ошибка: ${error.message}`);
      }
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      alert('Произошла ошибка при отмене записи');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {willForfeit && (
        <div className="warning-banner">
          ⚠️ Отмена менее чем за 4 часа до начала. Предоплата будет удержана.
        </div>
      )}
      
      <button
        onClick={handleCancel}
        disabled={loading}
        className={willForfeit ? 'warning-button' : ''}
      >
        {loading ? 'Отмена...' : 'Отменить запись'}
      </button>
    </div>
  );
}
```

### Шаг 2: Отображение информации о сгоревшей предоплате

```typescript
// AppointmentCard.tsx
interface Appointment {
  id: string;
  status: string;
  prepaymentAmount?: number;
  forfeitedPrepaymentAmount?: number;
  startAt: string;
  // ... другие поля
}

export function AppointmentCard({ appointment }: { appointment: Appointment }) {
  const isCancelled = appointment.status === 'CANCELLED';
  const hasForfeited = appointment.forfeitedPrepaymentAmount && appointment.forfeitedPrepaymentAmount > 0;

  return (
    <div className="appointment-card">
      {/* Основная информация */}
      <div className="appointment-info">
        <h3>Запись #{appointment.id.slice(0, 8)}</h3>
        <p>Время: {new Date(appointment.startAt).toLocaleString('ru-RU')}</p>
        <p>Статус: {getStatusLabel(appointment.status)}</p>
      </div>

      {/* Информация о предоплате */}
      {appointment.prepaymentAmount && (
        <div className="prepayment-info">
          <p>Предоплата: {appointment.prepaymentAmount} ₸</p>
          
          {isCancelled && hasForfeited && (
            <div className="forfeited-warning">
              ⚠️ Предоплата удержана как штраф за позднюю отмену
              <strong> {appointment.forfeitedPrepaymentAmount} ₸</strong>
            </div>
          )}
          
          {isCancelled && !hasForfeited && appointment.prepaymentAmount > 0 && (
            <div className="refund-info">
              ✓ Предоплата будет возвращена
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### Шаг 3: Отображение в дэшборде

```typescript
// Dashboard.tsx
interface DashboardData {
  overview: {
    totalAppointments: number;
    revenue: number;
    cancellationRate: number;
    completionRate: number;
  };
  // ... другие поля
}

export function Dashboard({ data }: { data: DashboardData }) {
  return (
    <div className="dashboard">
      <div className="revenue-card">
        <h2>Доход</h2>
        <p className="revenue-amount">{data.overview.revenue.toLocaleString()} ₸</p>
        <p className="revenue-note">
          Включает завершённые записи и штрафы за поздние отмены
        </p>
      </div>
      
      {/* Другие метрики */}
    </div>
  );
}
```

### Шаг 4: Расчёт времени до начала записи

```typescript
// utils/appointment.ts
export function getHoursUntilStart(startAt: string): number {
  const start = new Date(startAt);
  const now = new Date();
  const diffMs = start.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours;
}

export function isLateCancellation(startAt: string): boolean {
  const hoursUntilStart = getHoursUntilStart(startAt);
  return hoursUntilStart < 4 && hoursUntilStart > 0;
}

export function getCancellationMessage(
  startAt: string,
  prepaymentAmount?: number
): string | null {
  if (!isLateCancellation(startAt) || !prepaymentAmount) {
    return null;
  }
  
  return `Отмена менее чем за 4 часа до начала.\nПредоплата ${prepaymentAmount} ₸ будет удержана как штраф.`;
}
```

---

## 🎨 UI/UX Рекомендации

### 1. Предупреждение при поздней отмене

```tsx
{isLateCancellation(appointment.startAt) && appointment.prepaymentAmount && (
  <div className="alert alert-warning">
    <strong>⚠️ Поздняя отмена</strong>
    <p>
      До начала записи осталось менее 4 часов.
      Предоплата {appointment.prepaymentAmount} ₸ будет удержана как штраф.
    </p>
  </div>
)}
```

### 2. Визуальное выделение сгоревшей предоплаты

```css
.forfeited-warning {
  background-color: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
  padding: 8px;
  margin-top: 8px;
  color: #856404;
}

.forfeited-warning strong {
  color: #d9534f;
  font-size: 1.1em;
}
```

### 3. Информация в истории записей

```tsx
{appointment.status === 'CANCELLED' && appointment.forfeitedPrepaymentAmount && (
  <div className="cancellation-details">
    <span className="badge badge-warning">Поздняя отмена</span>
    <span className="forfeited-amount">
      Удержано: {appointment.forfeitedPrepaymentAmount} ₸
    </span>
  </div>
)}
```

---

## ✅ Важные замечания

1. **Проверка времени:** Поздняя отмена определяется как менее 4 часов до начала записи И запись ещё не началась (время до начала > 0).

2. **Сгорание предоплаты:** Предоплата сгорает только если:
   - Отмена поздняя (менее 4 часов)
   - И есть предоплата (`prepaymentAmount > 0`)

3. **Учёт в доходе:** Сгоревшие предоплаты автоматически учитываются в дэшборде в поле `revenue`.

4. **Визуальная обратная связь:** Важно показывать пользователю, что предоплата будет удержана ДО подтверждения отмены.

5. **Информативность:** После отмены показывать, была ли предоплата удержана или будет возвращена.

---

## 📊 Примеры сценариев

### Сценарий 1: Поздняя отмена с предоплатой

```
Запись: 16.02.2026 15:00
Предоплата: 5000 ₸
Текущее время: 16.02.2026 12:00 (за 3 часа до начала)

→ Отмена = поздняя
→ forfeitedPrepaymentAmount = 5000 ₸
→ В дэшборде доход +5000 ₸
```

### Сценарий 2: Ранняя отмена с предоплатой

```
Запись: 16.02.2026 15:00
Предоплата: 5000 ₸
Текущее время: 15.02.2026 10:00 (за 29 часов до начала)

→ Отмена = ранняя
→ forfeitedPrepaymentAmount = null
→ Предоплата возвращается
```

### Сценарий 3: Поздняя отмена без предоплаты

```
Запись: 16.02.2026 15:00
Предоплата: 0 (или null)
Текущее время: 16.02.2026 12:00 (за 3 часа до начала)

→ Отмена = поздняя
→ Но предоплаты нет
→ forfeitedPrepaymentAmount = null
→ Штраф не применяется
```

---

## 📝 Чеклист реализации

- [ ] Реализовать функцию проверки поздней отмены (`isLateCancellation`)
- [ ] Добавить предупреждение при попытке поздней отмены
- [ ] Показывать информацию о сгоревшей предоплате в карточке записи
- [ ] Обновить UI отмены записи с подтверждением
- [ ] Отображать `forfeitedPrepaymentAmount` в истории записей
- [ ] Добавить визуальное выделение для записей с удержанной предоплатой
- [ ] Убедиться, что доход в дэшборде корректно отображается (включая штрафы)
- [ ] Протестировать все сценарии (ранняя/поздняя отмена, с/без предоплаты)
- [ ] Добавить информативные сообщения для пользователя

---

## 🔗 Связанные документы

- [Дэшборд](./LOVABLE_DASHBOARD.md) - для понимания расчёта дохода
- [Записи](./LOVABLE_APPOINTMENT_TIMEZONE_FIX.md) - для работы с записями
- [Система ролей](./LOVABLE_USER_ROLES.md) - для понимания прав доступа



