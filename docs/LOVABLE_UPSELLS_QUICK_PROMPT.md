# Промпт для Lovable: Дополнительные продажи

## Задача

В карточке записи (Appointment Details Modal) нужно добавить секцию "Дополнительные продажи", где пользователь может добавлять дополнительные услуги/товары, проданные клиенту во время записи.

---

## API Endpoints

Backend уже реализован. Используйте эти endpoints:

1. **Добавить продажу:** `POST /appointments/:appointmentId/upsells`
   ```json
   {
     "serviceId": "service-uuid",
     "quantity": 1,
     "price": 5000,
     "comment": "Опционально"
   }
   ```

2. **Получить все продажи:** `GET /appointments/:appointmentId/upsells`

3. **Обновить продажу:** `PATCH /upsells/:upsellId`
   ```json
   {
     "quantity": 2,
     "price": 4500,
     "comment": "Опционально"
   }
   ```

4. **Удалить продажу:** `DELETE /upsells/:upsellId`

**Все запросы требуют:** `Authorization: Bearer {token}`

---

## Что нужно сделать

### 1. Добавить секцию в модальное окно записи

В модальном окне "Детали записи" после информации об услуге добавить:

**Секция "📦 Дополнительные продажи":**
- Список всех добавленных upsells
- Каждый upsell показывает: название услуги, количество × цена = итого, комментарий
- Кнопки редактирования (✏️) и удаления (🗑️) для каждого upsell
- Кнопка "+ Добавить продажу" (скрывать для статуса CANCELLED)
- Внизу показывать итоговую сумму всех upsells

**Формат отображения:**
```
📦 Дополнительные продажи          [+ Добавить продажу]

┌─────────────────────────────────────┐
│ Крем для лица                        │
│ 2 шт × 5,000 〒 = 10,000 〒        │
│ Комментарий: Дополнительно продали  │
│                    [✏️] [🗑️]        │
└─────────────────────────────────────┘

Итого дополнительных продаж: 10,000 〒
```

### 2. Модальное окно добавления продажи

При нажатии "+ Добавить продажу" открывать модальное окно с формой:

**Поля:**
- **Услуга** (выпадающий список) - **ОБЯЗАТЕЛЬНО** загрузить список услуг через `GET /studios/:studioId/services`
  - Использовать `appointment.studioId` для получения списка услуг
  - Показывать только активные услуги (`isActive: true`)
  - Формат отображения: "Название услуги (цена по умолчанию)" или просто "Название услуги"
  - **Важно:** Допродажи - это услуги из списка услуг салона, нельзя добавлять произвольные услуги
- **Количество** (число, по умолчанию 1)
- **Цена за единицу** (число) - автозаполнять из `defaultPrice` выбранной услуги, но можно редактировать
- **Комментарий** (текст, опционально)
- **Итого** (автоматически: количество × цена)

**Кнопки:** "Отмена" и "Добавить"

### 3. Модальное окно редактирования

При нажатии ✏️ открывать такое же модальное окно, но с предзаполненными значениями.

**Кнопки:** "Отмена" и "Сохранить"

### 4. Удаление

При нажатии 🗑️ показывать подтверждение "Удалить эту продажу?" и при подтверждении удалять.

---

## Структура данных

**Ответ от GET /appointments/:id/upsells:**
```json
[
  {
    "id": "upsell-uuid",
    "service": { "name": "Крем для лица" },
    "quantity": 2,
    "price": 5000,
    "totalAmount": 10000,
    "comment": "Дополнительно продали"
  }
]
```

**Записи теперь включают поле `upsells`:**
```json
{
  "id": "appointment-uuid",
  "upsells": [ /* массив upsells */ ]
}
```

---

## Пример кода компонента

```jsx
function AppointmentUpsellsSection({ appointment, token, onRefresh }) {
  const [upsells, setUpsells] = useState(appointment.upsells || []);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Загрузить upsells при открытии
  useEffect(() => {
    fetch(`/api/appointments/${appointment.id}/upsells`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(setUpsells)
      .catch(console.error);
  }, [appointment.id]);

  async function handleAdd(upsellData) {
    setLoading(true);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}/upsells`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(upsellData)
      });
      if (res.ok) {
        const newUpsell = await res.json();
        setUpsells([...upsells, newUpsell]);
        setShowAddModal(false);
        onRefresh?.();
      }
    } catch (error) {
      alert('Ошибка: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Удалить эту продажу?')) return;
    try {
      await fetch(`/api/upsells/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setUpsells(upsells.filter(u => u.id !== id));
      onRefresh?.();
    } catch (error) {
      alert('Ошибка при удалении');
    }
  }

  const total = upsells.reduce((sum, u) => sum + u.totalAmount, 0);

  return (
    <div style={{ marginTop: '20px', padding: '16px', borderTop: '1px solid #eee' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3>📦 Дополнительные продажи</h3>
        {appointment.status !== 'CANCELLED' && (
          <button onClick={() => setShowAddModal(true)}>+ Добавить продажу</button>
        )}
      </div>

      {upsells.length === 0 ? (
        <p>Нет дополнительных продаж</p>
      ) : (
        <>
          {upsells.map(upsell => (
            <div key={upsell.id} style={{ 
              padding: '12px', 
              marginBottom: '8px', 
              backgroundColor: '#f9f9f9', 
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>{upsell.service.name}</div>
                <div>{upsell.quantity} шт × {upsell.price.toLocaleString()} 〒 = {upsell.totalAmount.toLocaleString()} 〒</div>
                {upsell.comment && <div style={{ fontSize: '12px', color: '#666' }}>{upsell.comment}</div>}
              </div>
              <div>
                <button onClick={() => handleEdit(upsell)}>✏️</button>
                <button onClick={() => handleDelete(upsell.id)}>🗑️</button>
              </div>
            </div>
          ))}
          {total > 0 && (
            <div style={{ marginTop: '12px', fontWeight: 'bold' }}>
              Итого: {total.toLocaleString()} 〒
            </div>
          )}
        </>
      )}

      {showAddModal && (
        <AddUpsellModal
          appointment={appointment}
          token={token}
          onAdd={handleAdd}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
```

---

## Интеграция

Добавьте компонент `AppointmentUpsellsSection` в ваше модальное окно "Детали записи" после информации об услуге, но перед кнопками действий.

---

## Важно

- **Допродажи - это услуги из списка услуг салона** - нельзя добавлять произвольные услуги
- Загружать список услуг через `GET /studios/:studioId/services` (используя `appointment.studioId`)
- Показывать только активные услуги (`isActive: true`)
- Все запросы требуют авторизации (Bearer token)
- Показывать кнопку добавления только для статусов: BOOKED, ARRIVED, DONE
- Скрывать кнопку для статуса CANCELLED
- Форматировать валюту: `X,XXX 〒` или `X XXX 〒`
- Обрабатывать ошибки и показывать понятные сообщения
- При выборе услуги автозаполнять цену из `defaultPrice`, но разрешать редактирование

---

**Готово к использованию!** Скопируйте этот промпт в Lovable.

