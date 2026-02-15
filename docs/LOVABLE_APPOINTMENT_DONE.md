# Кнопка "Завершить" для записи

## Проблема

В модальном окне "Детали записи" есть кнопки "Отменить" и "Закрыть", но нет кнопки "Завершить" для изменения статуса записи на `DONE`.

## Решение

Добавлен новый endpoint для завершения записи.

---

## 🔌 API Endpoint

### Завершить запись

**Endpoint:** `POST /appointments/:id/done`

**Описание:** Изменяет статус записи на `DONE` (выполнено).

**Параметры:**
- `id` (path) - UUID записи

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
    "email": "staff@example.com",
    "phone": "+79991234568",
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
    "defaultPrice": 2000,
    "defaultDurationMin": 30
  }
}
```

**Ошибки:**
- `400` - Запись отменена или уже завершена
- `403` - Нет доступа к записи
- `404` - Запись не найдена

---

## 🎨 UI/UX Рекомендации

### Где показывать кнопку "Завершить"

Кнопку "Завершить" нужно показывать в модальном окне "Детали записи" когда:
- Статус записи = `ARRIVED` (клиент пришел)
- Статус записи = `BOOKED` (можно завершить без отметки "пришел")

**НЕ показывать кнопку когда:**
- Статус = `DONE` (уже завершена)
- Статус = `CANCELLED` (отменена)

### Расположение кнопки

```
┌─────────────────────────────────┐
│  Детали записи          [X]     │
├─────────────────────────────────┤
│  ... информация о записи ...    │
│                                 │
│  [Клиент пришел]                │
│                                 │
│  ... детали ...                 │
│                                 │
├─────────────────────────────────┤
│  [❌ Отменить]                  │
│  [✅ Завершить]  ← НОВАЯ КНОПКА │
│  [Закрыть]                      │
└─────────────────────────────────┘
```

### Визуальное оформление

- **Цвет:** Зеленый (как успешное действие)
- **Иконка:** ✅ (галочка в круге)
- **Текст:** "Завершить" или "Выполнено"
- **Размер:** Такой же, как кнопка "Отменить"

---

## 📝 Примеры кода

### Обработка клика на кнопку "Завершить"

```typescript
async function markAppointmentAsDone(appointmentId: string) {
  try {
    const response = await fetch(`/api/appointments/${appointmentId}/done`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to mark appointment as done');
    }

    const updatedAppointment = await response.json();
    
    // Обновить данные в UI
    updateAppointmentInList(updatedAppointment);
    
    // Закрыть модальное окно или обновить его содержимое
    refreshAppointmentDetails();
    
    // Показать уведомление об успехе
    showNotification('Запись успешно завершена', 'success');
    
  } catch (error) {
    console.error('Error marking appointment as done:', error);
    showNotification(error.message || 'Ошибка при завершении записи', 'error');
  }
}
```

### Компонент кнопки "Завершить"

```jsx
function AppointmentDetailsModal({ appointment, onClose, onUpdate }) {
  const [loading, setLoading] = useState(false);

  const canMarkAsDone = appointment.status === 'ARRIVED' || appointment.status === 'BOOKED';
  const isDone = appointment.status === 'DONE';

  async function handleMarkAsDone() {
    if (!canMarkAsDone || isDone) return;

    setLoading(true);
    try {
      await markAppointmentAsDone(appointment.id);
      onUpdate(); // Обновить данные
    } catch (error) {
      // Ошибка уже обработана в функции
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="appointment-details">
        {/* Заголовок */}
        <div className="modal-header">
          <h2>Детали записи</h2>
          {appointment.status === 'ARRIVED' && (
            <span className="status-badge arrived">Клиент пришел</span>
          )}
          {appointment.status === 'DONE' && (
            <span className="status-badge done">Выполнено</span>
          )}
        </div>

        {/* Информация о записи */}
        <div className="appointment-info">
          {/* ... существующая информация ... */}
        </div>

        {/* Кнопки действий */}
        <div className="appointment-actions">
          {appointment.status !== 'CANCELLED' && appointment.status !== 'DONE' && (
            <button 
              className="btn-cancel"
              onClick={() => handleCancel(appointment.id)}
            >
              ❌ Отменить
            </button>
          )}

          {/* НОВАЯ КНОПКА: Завершить */}
          {canMarkAsDone && !isDone && (
            <button 
              className="btn-done"
              onClick={handleMarkAsDone}
              disabled={loading}
            >
              {loading ? 'Загрузка...' : '✅ Завершить'}
            </button>
          )}

          <button className="btn-close" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </Modal>
  );
}
```

### Обновление статуса после завершения

```jsx
// После успешного завершения записи
function handleAppointmentDone(updatedAppointment) {
  // Обновить запись в списке
  setAppointments(prev => 
    prev.map(apt => 
      apt.id === updatedAppointment.id 
        ? { ...apt, status: 'DONE' }
        : apt
    )
  );

  // Обновить статистику дэшборда (если открыт)
  if (isDashboardOpen) {
    refreshDashboard();
  }

  // Обновить модальное окно
  setSelectedAppointment(updatedAppointment);
}
```

---

## 🔄 Логика работы

### Условия для завершения записи

1. **Запись должна существовать**
2. **Пользователь должен иметь доступ** (OWNER или MANAGER салона)
3. **Статус записи НЕ должен быть:**
   - `CANCELLED` (отменена)
   - `DONE` (уже завершена)

### Что происходит при завершении

1. Статус записи меняется на `DONE`
2. Запись возвращается с обновленными данными
3. В дэшборде автоматически обновляется процент "Выполнено"

### Визуальная обратная связь

После нажатия "Завершить":
- Показать индикатор загрузки
- После успеха: обновить статус в UI (показать "Выполнено")
- Показать уведомление об успехе
- Обновить статистику дэшборда (если открыт)

---

## ✅ Чеклист для реализации

- [ ] Добавить кнопку "Завершить" в модальное окно "Детали записи"
- [ ] Показывать кнопку только когда статус = `ARRIVED` или `BOOKED`
- [ ] Скрывать кнопку когда статус = `DONE` или `CANCELLED`
- [ ] Реализовать обработчик `handleMarkAsDone`
- [ ] Добавить индикатор загрузки при выполнении запроса
- [ ] Обновить UI после успешного завершения
- [ ] Показать уведомление об успехе/ошибке
- [ ] Обновить статистику дэшборда (если нужно)

---

## 🎯 Дополнительные возможности (опционально)

1. **Подтверждение:**
   - Показывать диалог подтверждения перед завершением
   - "Вы уверены, что хотите завершить эту запись?"

2. **Автоматическое закрытие:**
   - После завершения автоматически закрывать модальное окно
   - Или оставлять открытым с обновленным статусом

3. **История изменений:**
   - Сохранять время завершения (можно добавить поле `completedAt` в будущем)

---

**Готово!** Теперь у вас есть endpoint для завершения записи. Добавьте кнопку "Завершить" в модальное окно, и пользователи смогут отмечать записи как выполненные.

