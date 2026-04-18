# Промпт для Lovable: Дополнительные продажи в карточке записи

## Задача

Добавить функционал дополнительных продаж (upsells) в карточку записи. Пользователь должен иметь возможность добавлять дополнительные услуги/товары, которые были проданы клиенту во время записи.

---

## API Endpoints (уже реализованы на backend)

### 1. Добавить дополнительную продажу
```
POST /appointments/:appointmentId/upsells
Body: {
  "serviceId": "service-uuid",
  "quantity": 1,
  "price": 5000,
  "comment": "Дополнительно продали крем" // опционально
}
```

### 2. Получить все дополнительные продажи
```
GET /appointments/:appointmentId/upsells
```

### 3. Обновить дополнительную продажу
```
PATCH /upsells/:upsellId
Body: {
  "quantity": 2,  // опционально
  "price": 4500,  // опционально
  "comment": "..." // опционально
}
```

### 4. Удалить дополнительную продажу
```
DELETE /upsells/:upsellId
```

**Важно:** Все endpoints требуют авторизации (Bearer token в заголовке Authorization).

---

## Что нужно реализовать на фронтенде

### 1. Секция "Дополнительные продажи" в модальном окне записи

В модальном окне "Детали записи" (Appointment Details Modal) добавить новую секцию после основной информации об услуге:

**Расположение:**
- После информации об услуге
- Перед кнопками действий (Завершить, Не пришёл)

**Содержимое секции:**
1. Заголовок: "📦 Дополнительные продажи"
2. Список существующих upsells (если есть)
3. Кнопка "+ Добавить продажу" (показывать для всех статусов кроме CANCELLED)

**Формат отображения каждого upsell:**
```
┌─────────────────────────────────────┐
│ Крем для лица                        │
│ 2 шт × 5,000 〒 = 10,000 〒        │
│ Комментарий: Дополнительно продали  │
│ [✏️ Редактировать] [🗑️ Удалить]    │
└─────────────────────────────────────┘
```

**Итоговая сумма:**
Внизу списка показывать:
```
Итого дополнительных продаж: 15,000 〒
```

### 2. Модальное окно добавления продажи

При нажатии на "+ Добавить продажу" открывать модальное окно:

**Поля формы:**
1. **Услуга/Товар** (обязательно) - выпадающий список
   - Загружать список услуг через `GET /studios/:studioId/services`
   - Показывать только активные услуги (`isActive: true`)
   - Формат: "Название услуги (цена по умолчанию)"

2. **Количество** (по умолчанию 1)
   - Числовое поле, минимум 1

3. **Цена за единицу (〒)** (обязательно)
   - Автозаполнение из `defaultPrice` выбранной услуги
   - Можно редактировать вручную

4. **Комментарий** (опционально)
   - Текстовое поле

5. **Итого** (автоматический расчет)
   - Показывать: `Количество × Цена = Итого`

**Кнопки:**
- "Отмена" - закрыть модальное окно
- "Добавить" - отправить запрос

### 3. Модальное окно редактирования продажи

При нажатии на "✏️ Редактировать" открывать модальное окно с теми же полями, но предзаполненными текущими значениями.

**Кнопки:**
- "Отмена"
- "Сохранить"

### 4. Удаление продажи

При нажатии на "🗑️ Удалить":
- Показывать подтверждение: "Удалить эту продажу?"
- При подтверждении отправлять DELETE запрос
- Обновлять список после успешного удаления

### 5. Отображение в списке записей (опционально)

В карточке записи в списке можно показывать бейдж с суммой дополнительных продаж, если они есть:

```
[Основная услуга: 10,000 〒]
[+5,000 〒 доп. продажи] ← бейдж
```

---

## Структура данных

### Ответ от GET /appointments/:id/upsells
```json
[
  {
    "id": "upsell-uuid",
    "appointmentId": "appointment-uuid",
    "serviceId": "service-uuid",
    "quantity": 2,
    "price": 5000,
    "totalAmount": 10000,
    "comment": "Крем для лица",
    "createdAt": "2024-02-17T10:00:00.000Z",
    "updatedAt": "2024-02-17T10:00:00.000Z",
    "service": {
      "id": "service-uuid",
      "name": "Крем для лица",
      "defaultPrice": 5000
    }
  }
]
```

### Записи теперь включают поле upsells
При получении записей (GET /studios/:studioId/appointments) каждая запись теперь содержит:
```json
{
  "id": "appointment-uuid",
  "status": "DONE",
  "upsells": [
    {
      "id": "upsell-uuid",
      "service": { "name": "Крем для лица" },
      "quantity": 1,
      "price": 5000,
      "totalAmount": 5000
    }
  ]
}
```

---

## Примеры кода

### Компонент секции дополнительных продаж

```jsx
function AppointmentUpsellsSection({ appointment, token, onRefresh }) {
  const [upsells, setUpsells] = useState(appointment.upsells || []);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const API_BASE = '/api'; // или ваш базовый URL

  async function loadUpsells() {
    try {
      const response = await fetch(`${API_BASE}/appointments/${appointment.id}/upsells`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUpsells(data);
      }
    } catch (error) {
      console.error('Failed to load upsells:', error);
    }
  }

  async function handleAdd(upsellData) {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/appointments/${appointment.id}/upsells`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(upsellData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add upsell');
      }

      const newUpsell = await response.json();
      setUpsells([...upsells, newUpsell]);
      setShowAddModal(false);
      onRefresh?.(); // Обновить родительский компонент
    } catch (error) {
      alert('Ошибка: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(upsellId) {
    if (!confirm('Удалить эту продажу?')) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/upsells/${upsellId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to delete');

      setUpsells(upsells.filter(u => u.id !== upsellId));
      onRefresh?.();
    } catch (error) {
      alert('Ошибка при удалении: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  const totalAmount = upsells.reduce((sum, u) => sum + u.totalAmount, 0);

  return (
    <div className="upsells-section" style={{ marginTop: '20px', padding: '16px', borderTop: '1px solid #eee' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0 }}>📦 Дополнительные продажи</h3>
        {appointment.status !== 'CANCELLED' && (
          <button 
            onClick={() => setShowAddModal(true)}
            disabled={loading}
            style={{ padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            + Добавить продажу
          </button>
        )}
      </div>

      {upsells.length === 0 ? (
        <p style={{ color: '#666', fontStyle: 'italic' }}>Нет дополнительных продаж</p>
      ) : (
        <>
          {upsells.map(upsell => (
            <div key={upsell.id} style={{ 
              padding: '12px', 
              marginBottom: '8px', 
              backgroundColor: '#f9f9f9', 
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                  {upsell.service.name}
                </div>
                <div style={{ color: '#666', fontSize: '14px' }}>
                  {upsell.quantity} шт × {formatCurrency(upsell.price)} = {formatCurrency(upsell.totalAmount)}
                </div>
                {upsell.comment && (
                  <div style={{ color: '#888', fontSize: '12px', marginTop: '4px' }}>
                    {upsell.comment}
                  </div>
                )}
              </div>
              <div>
                <button onClick={() => handleEdit(upsell)} style={{ marginRight: '8px' }}>✏️</button>
                <button onClick={() => handleDelete(upsell.id)}>🗑️</button>
              </div>
            </div>
          ))}
          
          {totalAmount > 0 && (
            <div style={{ 
              marginTop: '12px', 
              padding: '12px', 
              backgroundColor: '#e3f2fd', 
              borderRadius: '8px',
              fontWeight: 'bold'
            }}>
              Итого дополнительных продаж: {formatCurrency(totalAmount)}
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

function formatCurrency(amount) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'KZT',
    minimumFractionDigits: 0,
  }).format(amount);
}
```

### Модальное окно добавления

```jsx
function AddUpsellModal({ appointment, token, onAdd, onClose }) {
  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Загрузить список услуг
    fetch(`/api/studios/${appointment.studioId}/services`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => setServices(data.filter(s => s.isActive)))
      .catch(err => console.error('Failed to load services:', err));
  }, []);

  useEffect(() => {
    // Автозаполнение цены
    if (selectedServiceId) {
      const service = services.find(s => s.id === selectedServiceId);
      if (service?.defaultPrice) {
        setPrice(service.defaultPrice);
      }
    }
  }, [selectedServiceId, services]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedServiceId || price <= 0) {
      alert('Заполните все обязательные поля');
      return;
    }

    setLoading(true);
    try {
      await onAdd({
        serviceId: selectedServiceId,
        quantity,
        price,
        comment: comment || undefined,
      });
    } catch (error) {
      alert('Ошибка: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }} onClick={onClose}>
      <div style={{
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '8px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'auto'
      }} onClick={e => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>Добавить дополнительную продажу</h2>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Услуга/Товар *
            </label>
            <select
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              required
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            >
              <option value="">Выберите услугу</option>
              {services.map(service => (
                <option key={service.id} value={service.id}>
                  {service.name} {service.defaultPrice ? `(${formatCurrency(service.defaultPrice)})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Количество
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Цена за единицу (〒) *
            </label>
            <input
              type="number"
              min="0"
              value={price}
              onChange={(e) => setPrice(parseInt(e.target.value) || 0)}
              required
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Комментарий
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Опционально"
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', minHeight: '60px' }}
            />
          </div>

          <div style={{ 
            marginBottom: '16px', 
            padding: '12px', 
            backgroundColor: '#f0f0f0', 
            borderRadius: '4px',
            fontWeight: 'bold'
          }}>
            Итого: {formatCurrency(quantity * price)}
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button 
              type="button" 
              onClick={onClose}
              disabled={loading}
              style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
            >
              Отмена
            </button>
            <button 
              type="submit"
              disabled={loading || !selectedServiceId || price <= 0}
              style={{ 
                padding: '8px 16px', 
                backgroundColor: '#007bff', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: 'pointer' 
              }}
            >
              {loading ? 'Добавление...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

## Интеграция в существующий компонент

В вашем компоненте модального окна "Детали записи" добавьте секцию после информации об услуге:

```jsx
function AppointmentDetailsModal({ appointment, onClose, onUpdate }) {
  // ... существующий код ...

  return (
    <div className="modal">
      <div className="modal-header">
        <h2>Детали записи</h2>
        <button onClick={onClose}>×</button>
      </div>

      <div className="modal-body">
        {/* Существующая информация о клиенте */}
        {/* Существующая информация об услуге */}
        {/* Существующая информация о дате/времени */}
        {/* Существующая информация о мастере */}

        {/* НОВОЕ: Секция дополнительных продаж */}
        <AppointmentUpsellsSection 
          appointment={appointment}
          token={userToken} // ваш токен авторизации
          onRefresh={() => {
            // Обновить данные записи, если нужно
            onUpdate?.();
          }}
        />
      </div>

      <div className="modal-footer">
        {/* Существующие кнопки: Завершить, Не пришёл, Закрыть */}
      </div>
    </div>
  );
}
```

---

## Важные детали

1. **Авторизация:** Все запросы требуют Bearer token в заголовке `Authorization`

2. **Валидация:**
   - Услуга должна быть активной
   - Количество >= 1
   - Цена >= 0

3. **Обновление данных:**
   - После добавления/изменения/удаления обновлять список upsells
   - Можно обновить общую информацию о записи, если нужно

4. **Обработка ошибок:**
   - Показывать понятные сообщения об ошибках
   - Обрабатывать случаи, когда услуга не найдена или неактивна

5. **Форматирование валюты:**
   - Использовать формат: `X,XXX 〒` или `X XXX 〒`
   - Пример: `5,000 〒` или `5 000 〒`

---

## Чеклист реализации

- [ ] Добавить секцию "Дополнительные продажи" в модальное окно записи
- [ ] Реализовать загрузку списка upsells при открытии карточки
- [ ] Создать компонент отображения списка upsells
- [ ] Реализовать модальное окно добавления продажи
- [ ] Реализовать модальное окно редактирования продажи
- [ ] Добавить функцию удаления с подтверждением
- [ ] Добавить обработку ошибок
- [ ] Добавить индикаторы загрузки
- [ ] Протестировать все сценарии (добавление, редактирование, удаление)
- [ ] (Опционально) Показывать сумму upsells в карточке записи в списке

---

**Готово!** Используйте этот промпт в Lovable для реализации функционала дополнительных продаж.


