# Дополнительные продажи (Upsells) в карточке записи

## Обзор

Нужно добавить функционал дополнительных продаж в карточку записи. Пользователь должен иметь возможность добавлять дополнительные услуги/товары, которые были проданы клиенту во время записи.

---

## 🔌 API Endpoints

### 1. Добавить дополнительную продажу

**Endpoint:** `POST /appointments/:id/upsells`

**Описание:** Добавляет дополнительную услугу/товар к записи.

**Параметры:**
- `id` (path) - ID записи

**Тело запроса:**
```json
{
  "serviceId": "service-uuid",
  "quantity": 1,
  "price": 5000,
  "comment": "Дополнительно продали крем"
}
```

**Поля:**
- `serviceId` (обязательно) - ID услуги из списка услуг салона
- `quantity` (опционально, по умолчанию 1) - Количество
- `price` (обязательно) - Цена за единицу в тенге
- `comment` (опционально) - Комментарий

**Ответ:**
```json
{
  "id": "upsell-uuid",
  "appointmentId": "appointment-uuid",
  "serviceId": "service-uuid",
  "quantity": 1,
  "price": 5000,
  "totalAmount": 5000,
  "comment": "Дополнительно продали крем",
  "createdAt": "2024-02-17T10:00:00.000Z",
  "updatedAt": "2024-02-17T10:00:00.000Z",
  "service": {
    "id": "service-uuid",
    "name": "Крем для лица",
    "defaultPrice": 5000
  }
}
```

**Ошибки:**
- `400` - Услуга неактивна или не найдена
- `403` - Нет доступа к записи
- `404` - Запись или услуга не найдена

---

### 2. Получить все дополнительные продажи для записи

**Endpoint:** `GET /appointments/:id/upsells`

**Описание:** Возвращает список всех дополнительных продаж для записи.

**Параметры:**
- `id` (path) - ID записи

**Ответ:**
```json
[
  {
    "id": "upsell-uuid-1",
    "appointmentId": "appointment-uuid",
    "serviceId": "service-uuid-1",
    "quantity": 1,
    "price": 5000,
    "totalAmount": 5000,
    "comment": "Крем для лица",
    "createdAt": "2024-02-17T10:00:00.000Z",
    "updatedAt": "2024-02-17T10:00:00.000Z",
    "service": {
      "id": "service-uuid-1",
      "name": "Крем для лица",
      "defaultPrice": 5000
    }
  },
  {
    "id": "upsell-uuid-2",
    "appointmentId": "appointment-uuid",
    "serviceId": "service-uuid-2",
    "quantity": 2,
    "price": 3000,
    "totalAmount": 6000,
    "comment": "Маска для волос",
    "createdAt": "2024-02-17T10:05:00.000Z",
    "updatedAt": "2024-02-17T10:05:00.000Z",
    "service": {
      "id": "service-uuid-2",
      "name": "Маска для волос",
      "defaultPrice": 3000
    }
  }
]
```

---

### 3. Обновить дополнительную продажу

**Endpoint:** `PATCH /upsells/:id`

**Описание:** Обновляет количество, цену или комментарий дополнительной продажи.

**Параметры:**
- `id` (path) - ID дополнительной продажи

**Тело запроса:**
```json
{
  "quantity": 2,
  "price": 4500,
  "comment": "Обновленный комментарий"
}
```

**Все поля опциональны.** При изменении `quantity` или `price` автоматически пересчитывается `totalAmount`.

**Ответ:** Обновленный объект upsell (как в GET)

---

### 4. Удалить дополнительную продажу

**Endpoint:** `DELETE /upsells/:id`

**Описание:** Удаляет дополнительную продажу.

**Параметры:**
- `id` (path) - ID дополнительной продажи

**Ответ:**
```json
{
  "success": true,
  "message": "Upsell deleted"
}
```

---

## 📊 Обновление Dashboard API

Endpoint dashboard (`GET /studios/:studioId/dashboard`) теперь включает доход от дополнительных продаж:

```json
{
  "overview": {
    "totalAppointments": 150,
    "revenue": 350000,
    "noShowRevenue": 15000,
    "upsellRevenue": 50000,  // ← НОВОЕ: доход от дополнительных продаж
    "cancellationRate": 5.33,
    "completionRate": 85.5
  }
}
```

**Важно:** Доход от upsells учитывается только для завершенных записей (статус `DONE`).

---

## 🎨 UI/UX Рекомендации

### Где отображать дополнительные продажи

**В модальном окне "Детали записи" (Appointment Details Modal):**

1. **Секция "Дополнительные продажи":**
   - Показывать после основной информации об услуге
   - Список всех добавленных upsells
   - Кнопка "Добавить продажу" или "+"

2. **Расположение:**
   ```
   ┌─────────────────────────────────┐
   │  Детали записи          [X]     │
   ├─────────────────────────────────┤
   │  ... основная информация ...    │
   │                                  │
   │  📦 Дополнительные продажи       │
   │  ┌─────────────────────────────┐ │
   │  │ Крем для лица               │ │
   │  │ 1 шт × 5,000 〒 = 5,000 〒 │ │
   │  │ [✏️] [🗑️]                   │ │
   │  └─────────────────────────────┘ │
   │  ┌─────────────────────────────┐ │
   │  │ Маска для волос             │ │
   │  │ 2 шт × 3,000 〒 = 6,000 〒 │ │
   │  │ [✏️] [🗑️]                   │ │
   │  └─────────────────────────────┘ │
   │  [+ Добавить продажу]            │
   │                                  │
   │  [✅ Завершить] [🚫 Не пришёл]   │
   └─────────────────────────────────┘
   ```

3. **Модальное окно добавления продажи:**
   - Выбор услуги из списка (только активные услуги салона)
   - Поле количества (по умолчанию 1)
   - Поле цены (можно предзаполнить из defaultPrice услуги)
   - Поле комментария (опционально)
   - Кнопки "Добавить" и "Отмена"

### Когда показывать

- **Показывать секцию "Дополнительные продажи" всегда**, когда открыта карточка записи
- **Кнопку "Добавить продажу"** показывать для всех статусов, кроме `CANCELLED`
- **Кнопки редактирования/удаления** показывать для всех upsells

---

## 📝 Примеры кода

### Компонент списка дополнительных продаж

```jsx
function AppointmentUpsellsSection({ appointment, onUpdate }) {
  const [upsells, setUpsells] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadUpsells();
  }, [appointment.id]);

  async function loadUpsells() {
    try {
      const response = await fetch(`/api/appointments/${appointment.id}/upsells`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setUpsells(data);
    } catch (error) {
      console.error('Failed to load upsells:', error);
    }
  }

  async function handleAddUpsell(upsellData) {
    setLoading(true);
    try {
      const response = await fetch(`/api/appointments/${appointment.id}/upsells`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(upsellData),
      });

      if (!response.ok) {
        throw new Error('Failed to add upsell');
      }

      const newUpsell = await response.json();
      setUpsells([...upsells, newUpsell]);
      setShowAddModal(false);
      
      // Обновить запись (если нужно пересчитать общую сумму)
      onUpdate();
    } catch (error) {
      alert('Ошибка при добавлении продажи: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteUpsell(upsellId) {
    if (!confirm('Удалить эту продажу?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/upsells/${upsellId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete upsell');
      }

      setUpsells(upsells.filter(u => u.id !== upsellId));
      onUpdate();
    } catch (error) {
      alert('Ошибка при удалении: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  const totalUpsellAmount = upsells.reduce((sum, u) => sum + u.totalAmount, 0);

  return (
    <div className="upsells-section">
      <div className="section-header">
        <h3>📦 Дополнительные продажи</h3>
        {appointment.status !== 'CANCELLED' && (
          <button 
            className="btn-add"
            onClick={() => setShowAddModal(true)}
            disabled={loading}
          >
            + Добавить продажу
          </button>
        )}
      </div>

      {upsells.length === 0 ? (
        <div className="empty-state">
          <p>Нет дополнительных продаж</p>
        </div>
      ) : (
        <div className="upsells-list">
          {upsells.map(upsell => (
            <div key={upsell.id} className="upsell-item">
              <div className="upsell-info">
                <div className="upsell-service">{upsell.service.name}</div>
                <div className="upsell-details">
                  {upsell.quantity} шт × {formatCurrency(upsell.price)} = {formatCurrency(upsell.totalAmount)}
                </div>
                {upsell.comment && (
                  <div className="upsell-comment">{upsell.comment}</div>
                )}
              </div>
              <div className="upsell-actions">
                <button 
                  className="btn-edit"
                  onClick={() => handleEditUpsell(upsell)}
                  disabled={loading}
                >
                  ✏️
                </button>
                <button 
                  className="btn-delete"
                  onClick={() => handleDeleteUpsell(upsell.id)}
                  disabled={loading}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
          
          {totalUpsellAmount > 0 && (
            <div className="upsells-total">
              <strong>Итого дополнительных продаж: {formatCurrency(totalUpsellAmount)}</strong>
            </div>
          )}
        </div>
      )}

      {showAddModal && (
        <AddUpsellModal
          appointment={appointment}
          onAdd={handleAddUpsell}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
```

### Модальное окно добавления продажи

```jsx
function AddUpsellModal({ appointment, onAdd, onClose }) {
  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadServices();
  }, []);

  useEffect(() => {
    // Автозаполнение цены при выборе услуги
    if (selectedServiceId) {
      const service = services.find(s => s.id === selectedServiceId);
      if (service && service.defaultPrice) {
        setPrice(service.defaultPrice);
      }
    }
  }, [selectedServiceId, services]);

  async function loadServices() {
    try {
      // ВАЖНО: Допродажи - это услуги из списка услуг салона
      // Загружаем список услуг через endpoint GET /studios/:studioId/services
      const response = await fetch(`/api/studios/${appointment.studioId}/services`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to load services');
      }
      
      const data = await response.json();
      // Фильтруем только активные услуги (isActive: true)
      const activeServices = data.filter(s => s.isActive);
      setServices(activeServices);
    } catch (error) {
      console.error('Failed to load services:', error);
      alert('Не удалось загрузить список услуг. Допродажи должны быть услугами из списка услуг салона.');
    }
  }

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Добавить дополнительную продажу</h2>
          <button onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>Услуга/Товар *</label>
            <select
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              required
            >
              <option value="">Выберите услугу</option>
              {services.map(service => (
                <option key={service.id} value={service.id}>
                  {service.name} {service.defaultPrice ? `(${formatCurrency(service.defaultPrice)})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Количество</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            />
          </div>

          <div className="form-group">
            <label>Цена за единицу (〒) *</label>
            <input
              type="number"
              min="0"
              value={price}
              onChange={(e) => setPrice(parseInt(e.target.value) || 0)}
              required
            />
          </div>

          <div className="form-group">
            <label>Комментарий</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Опционально"
            />
          </div>

          <div className="form-total">
            <strong>Итого: {formatCurrency(quantity * price)}</strong>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} disabled={loading}>
              Отмена
            </button>
            <button type="submit" disabled={loading || !selectedServiceId || price <= 0}>
              {loading ? 'Добавление...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

### Обновление карточки записи

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
        {/* Существующая информация о записи */}
        {/* ... */}

        {/* НОВОЕ: Секция дополнительных продаж */}
        <AppointmentUpsellsSection 
          appointment={appointment}
          onUpdate={onUpdate}
        />
      </div>

      <div className="modal-footer">
        {/* Существующие кнопки */}
        {/* ... */}
      </div>
    </div>
  );
}
```

### Обновление списка записей

Записи теперь автоматически включают поле `upsells` в ответ API:

```json
{
  "id": "appointment-uuid",
  "status": "DONE",
  "upsells": [
    {
      "id": "upsell-uuid",
      "serviceId": "service-uuid",
      "quantity": 1,
      "price": 5000,
      "totalAmount": 5000,
      "service": {
        "name": "Крем для лица"
      }
    }
  ]
}
```

Можно отобразить общую сумму дополнительных продаж в карточке записи в списке:

```jsx
function AppointmentCard({ appointment }) {
  const totalUpsells = appointment.upsells?.reduce((sum, u) => sum + u.totalAmount, 0) || 0;

  return (
    <div className="appointment-card">
      {/* Основная информация */}
      <div>{appointment.service.name}</div>
      <div>{formatCurrency(appointment.prepaymentAmount || appointment.service.defaultPrice)}</div>
      
      {/* Показывать сумму дополнительных продаж, если есть */}
      {totalUpsells > 0 && (
        <div className="upsells-badge">
          +{formatCurrency(totalUpsells)} доп. продажи
        </div>
      )}
    </div>
  );
}
```

---

## 🔄 Логика работы

### Когда можно добавлять дополнительные продажи

- **Статус `BOOKED`** - можно добавлять
- **Статус `ARRIVED`** - можно добавлять
- **Статус `DONE`** - можно добавлять (для учета продаж после завершения)
- **Статус `CANCELLED`** - нельзя добавлять

### Учет в доходе

- Доход от дополнительных продаж учитывается **только для завершенных записей** (статус `DONE`)
- В dashboard отображается отдельная метрика `upsellRevenue`
- Доход включается в общую статистику по услугам и сотрудникам

### Валидация

- **Услуга должна быть из списка услуг салона** - допродажи это услуги, нельзя добавлять произвольные услуги
- Услуга должна существовать и быть активной (`isActive: true`)
- Услуга должна принадлежать тому же салону, что и запись (`studioId` должен совпадать)
- Количество должно быть >= 1
- Цена должна быть >= 0
- Список услуг загружается через `GET /studios/:studioId/services` (используя `appointment.studioId`)

---

## ✅ Чеклист для реализации

### Backend (уже реализовано)
- [x] Модель AppointmentUpsell в Prisma
- [x] API endpoints для CRUD операций
- [x] Интеграция с appointments (upsells включаются в ответ)
- [x] Учет в dashboard статистике

### Frontend (Lovable)
- [ ] Добавить секцию "Дополнительные продажи" в модальное окно записи
- [ ] Список существующих upsells с возможностью редактирования/удаления
- [ ] Кнопка "Добавить продажу"
- [ ] Модальное окно добавления продажи:
  - [ ] Выбор услуги из списка
  - [ ] Поле количества
  - [ ] Поле цены
  - [ ] Поле комментария
  - [ ] Автоматический расчет итоговой суммы
- [ ] Модальное окно редактирования продажи
- [ ] Отображение суммы дополнительных продаж в карточке записи (если есть)
- [ ] Обновление списка записей после добавления/изменения/удаления upsell
- [ ] Обработка ошибок (показ сообщений)

---

## 🎯 Дополнительные возможности (опционально)

1. **Быстрое добавление:**
   - Кнопки быстрого выбора популярных услуг
   - Шаблоны дополнительных продаж

2. **Статистика:**
   - Показывать топ продаваемых дополнительных услуг
   - Средний чек с учетом upsells

3. **Уведомления:**
   - Показывать уведомление после успешного добавления
   - Подтверждение перед удалением

---

**Готово!** Теперь у вас есть полное понимание, как реализовать функционал дополнительных продаж в карточке записи.

