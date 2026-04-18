# Функционал "Не пришёл" (No-Show) для записей

## Обзор

Нужно заменить функционал кнопки "Отменить" на кнопку "Не пришёл". При нажатии на эту кнопку:
- Если запись отменяется за **4 и более часов** до начала приёма → запись просто удаляется
- Если запись отменяется за **менее чем 4 часа** → предоплата добавляется в доход, а запись удаляется

Также нужно добавить отдельную графу в дэшборде для отображения дохода от неявок (no-show income).

---

## 🔌 API Endpoint

### Отметить запись как "Не пришёл"

**Endpoint:** `POST /appointments/:id/no-show`

**Описание:** Отмечает запись как неявку (no-show). Запись удаляется из системы. Если отмена произошла менее чем за 4 часа до начала и есть предоплата, она добавляется в доход.

**Параметры:**
- `id` (path) - ID записи

**Ответ:**
```json
{
  "success": true,
  "message": "Appointment marked as no-show and deleted"
}
```

**Ошибки:**
- `400` - Запись уже отменена или завершена
- `403` - Нет доступа к записи
- `404` - Запись не найдена

**Важно:** После успешного вызова этого endpoint запись **удаляется** из системы и больше не будет отображаться в списке записей.

---

## 📊 Обновление Dashboard API

### Доход от неявок в Dashboard

Endpoint dashboard остался прежним: `GET /studios/:studioId/dashboard`

Но теперь в ответе нужно учитывать доход от неявок. Структура ответа не изменилась, но доход (`revenue`) теперь включает:
1. Доход от завершенных записей (статус `DONE`)
2. Доход от сгоревших предоплат при поздней отмене (статус `CANCELLED` с `forfeitedPrepaymentAmount`)
3. **НОВОЕ:** Доход от неявок (no-show income) - когда запись была отменена менее чем за 4 часа и имела предоплату

**Важно:** Доход от неявок уже включен в общий `revenue` в ответе API. Но нужно добавить **отдельную графу/метрику** на фронтенде для отображения дохода от неявок отдельно.

---

## 🎨 UI/UX Изменения

### 1. Изменение кнопки "Отменить" на "Не пришёл"

**Где находится:**
- Модальное окно "Детали записи" (Appointment Details Modal)

**Что нужно изменить:**
1. Текст кнопки: `"Отменить"` → `"Не пришёл"`
2. Endpoint: `POST /appointments/:id/cancel` → `POST /appointments/:id/no-show`
3. Цвет кнопки: оставить красным (опасное действие)
4. Иконка: можно оставить ❌ или изменить на 🚫

**Когда показывать кнопку:**
- Статус записи: `BOOKED` (забронировано)
- Статус записи: `ARRIVED` (пришел) - можно отметить как неявку, если клиент не пришел на самом деле

**НЕ показывать кнопку когда:**
- Статус: `DONE` (уже завершено)
- Статус: `CANCELLED` (уже отменено)

### 2. Обновление после нажатия "Не пришёл"

После успешного вызова endpoint:
1. **Закрыть модальное окно** с деталями записи
2. **Удалить запись из списка** записей (она больше не существует)
3. **Обновить статистику** в дэшборде (если открыт)
4. Показать уведомление: "Запись отмечена как неявка"

---

## 📊 Добавление графы дохода от неявок в Dashboard

### Новая метрика в Dashboard

Нужно добавить **отдельную карточку/графу** для отображения дохода от неявок.

**Где отображать:**
- В разделе "Обзор" (Overview) дэшборда
- Рядом с общей метрикой "Доход" (Revenue)

**Что показывать:**
- Название: "Доход от неявок" или "No-Show Income"
- Сумма: общий доход от всех неявок за выбранный период
- Валюта: тенге (〒)
- Формат: `X,XXX 〒` или `X XXX 〒`

**Пример расположения:**

```
┌─────────────────────────────────────────┐
│  Обзор                                   │
├─────────────────────────────────────────┤
│  Всего записей: 150                     │
│  Доход: 300,000 〒                      │
│  Доход от неявок: 15,000 〒  ← НОВОЕ    │
│  Процент отмен: 5.33%                   │
│  Процент выполнения: 85.5%              │
└─────────────────────────────────────────┘
```

**Как получить данные:**

Доход от неявок уже включен в общий `revenue`, но для отдельной графы нужно:

1. **Вариант 1 (рекомендуемый):** Добавить новый endpoint или расширить существующий:
   - Запросить `GET /studios/:studioId/dashboard?includeNoShowBreakdown=true`
   - В ответе добавить поле `noShowRevenue` в объект `overview`

2. **Вариант 2:** Вычислить на фронтенде (не рекомендуется):
   - Вычесть из общего дохода доход от завершенных записей
   - Но это неточно, так как в доходе также есть сгоревшие предоплаты

**Рекомендация:** Попросить backend добавить отдельное поле `noShowRevenue` в ответ dashboard API.

---

## 📝 Примеры кода

### Обновление кнопки "Отменить" на "Не пришёл"

```jsx
function AppointmentDetailsModal({ appointment, onClose, onUpdate }) {
  const [loading, setLoading] = useState(false);

  const canMarkAsNoShow = appointment.status === 'BOOKED' || appointment.status === 'ARRIVED';
  const isDone = appointment.status === 'DONE';
  const isCancelled = appointment.status === 'CANCELLED';

  async function handleMarkAsNoShow() {
    if (!confirm('Отметить запись как "Не пришёл"? Запись будет удалена.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/appointments/${appointment.id}/no-show`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to mark appointment as no-show');
      }

      const result = await response.json();
      
      // Запись удалена, закрываем модальное окно и обновляем список
      onUpdate(null); // null означает, что запись удалена
      onClose();
      
      // Показываем уведомление
      alert('Запись отмечена как неявка');
      
      // Обновляем дэшборд, если открыт
      refreshDashboard();
    } catch (error) {
      console.error('Error marking appointment as no-show:', error);
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
        {/* ... информация о записи ... */}
      </div>

      <div className="modal-footer">
        {/* Кнопка "Завершить" */}
        {canMarkAsDone && (
          <button 
            className="btn-success"
            onClick={handleMarkAsDone}
            disabled={loading}
          >
            ✅ Завершить
          </button>
        )}

        {/* Кнопка "Не пришёл" - ИЗМЕНЕНО */}
        {canMarkAsNoShow && (
          <button 
            className="btn-danger"
            onClick={handleMarkAsNoShow}
            disabled={loading}
          >
            {loading ? 'Загрузка...' : '🚫 Не пришёл'}
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

### Обновление списка записей после no-show

```jsx
function AppointmentList() {
  const [appointments, setAppointments] = useState([]);

  async function handleMarkAsNoShow(appointmentId) {
    try {
      const response = await fetch(`/api/appointments/${appointmentId}/no-show`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to mark as no-show');
      }

      // Удаляем запись из списка (она больше не существует)
      setAppointments(prev => 
        prev.filter(apt => apt.id !== appointmentId)
      );

      // Обновляем статистику в дэшборде
      refreshDashboard();
    } catch (error) {
      console.error('Failed to mark as no-show:', error);
      alert('Ошибка при отметке как неявка');
    }
  }

  return (
    <div>
      {appointments.map(appointment => (
        <AppointmentCard
          key={appointment.id}
          appointment={appointment}
          onMarkAsNoShow={handleMarkAsNoShow}
        />
      ))}
    </div>
  );
}
```

### Добавление графы дохода от неявок в Dashboard

```jsx
function DashboardOverview({ dashboardData }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'KZT',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="dashboard-overview">
      <div className="overview-grid">
        {/* Всего записей */}
        <div className="metric-card">
          <div className="metric-label">Всего записей</div>
          <div className="metric-value">
            {dashboardData.overview.totalAppointments}
          </div>
        </div>

        {/* Общий доход */}
        <div className="metric-card">
          <div className="metric-label">Доход</div>
          <div className="metric-value revenue">
            {formatCurrency(dashboardData.overview.revenue)}
          </div>
        </div>

        {/* НОВОЕ: Доход от неявок */}
        {dashboardData.overview.noShowRevenue !== undefined && (
          <div className="metric-card no-show-revenue">
            <div className="metric-label">Доход от неявок</div>
            <div className="metric-value">
              {formatCurrency(dashboardData.overview.noShowRevenue)}
            </div>
            <div className="metric-description">
              Предоплаты от отмененных записей
            </div>
          </div>
        )}

        {/* Процент отмен */}
        <div className="metric-card">
          <div className="metric-label">Процент отмен</div>
          <div className="metric-value">
            {dashboardData.overview.cancellationRate.toFixed(2)}%
          </div>
        </div>

        {/* Процент выполнения */}
        <div className="metric-card">
          <div className="metric-label">Процент выполнения</div>
          <div className="metric-value">
            {dashboardData.overview.completionRate.toFixed(2)}%
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Стили для графы дохода от неявок:**

```css
.metric-card.no-show-revenue {
  border-left: 4px solid #ff9800; /* Оранжевый цвет для выделения */
  background-color: #fff3e0; /* Светло-оранжевый фон */
}

.metric-card.no-show-revenue .metric-label {
  color: #e65100;
  font-weight: 600;
}

.metric-card.no-show-revenue .metric-description {
  font-size: 0.75rem;
  color: #666;
  margin-top: 4px;
}
```

---

## 🔄 Логика работы

### Когда можно отметить как "Не пришёл"

1. **Статус `BOOKED`** - можно отметить как неявку
2. **Статус `ARRIVED`** - можно отметить как неявку (если клиент не пришел на самом деле)

### Когда нельзя отметить как "Не пришёл"

1. **Статус `DONE`** - уже завершено (нельзя отметить как неявку)
2. **Статус `CANCELLED`** - уже отменено (нельзя отметить повторно)

### Что происходит при отметке как "Не пришёл"

1. **Если отмена за 4+ часов до начала:**
   - Запись просто удаляется
   - Предоплата не добавляется в доход

2. **Если отмена менее чем за 4 часа до начала:**
   - Предоплата (если есть) добавляется в доход как "no-show income"
   - Запись удаляется

3. **После удаления:**
   - Запись больше не отображается в списке
   - Статистика в дэшборде обновляется
   - Доход от неявок учитывается в общей статистике

---

## ✅ Чеклист для реализации

### Изменение кнопки "Отменить"

- [ ] Изменить текст кнопки с "Отменить" на "Не пришёл"
- [ ] Изменить endpoint с `/appointments/:id/cancel` на `/appointments/:id/no-show`
- [ ] Обновить обработчик нажатия кнопки
- [ ] После успешного вызова удалять запись из списка (не обновлять статус)
- [ ] Закрывать модальное окно после успешной отметки
- [ ] Показывать уведомление об успехе
- [ ] Обработать ошибки (показать сообщение)

### Добавление графы дохода от неявок

- [ ] Попросить backend добавить поле `noShowRevenue` в ответ dashboard API
- [ ] Или вычислить доход от неявок на фронтенде (менее точно)
- [ ] Добавить новую карточку/графу в раздел "Обзор" дэшборда
- [ ] Отформатировать сумму в тенге (〒)
- [ ] Добавить описание/подсказку: "Предоплаты от отмененных записей"
- [ ] Стилизовать графу (можно оранжевым цветом для выделения)
- [ ] Обновлять графу при изменении периода в дэшборде

### Обновление после изменений

- [ ] Обновить список записей после отметки как неявка
- [ ] Обновить статистику в дэшборде (если открыт)
- [ ] Протестировать сценарий: отмена за 4+ часов
- [ ] Протестировать сценарий: отмена менее чем за 4 часа с предоплатой
- [ ] Протестировать сценарий: отмена менее чем за 4 часа без предоплаты

---

## 🎯 Дополнительные возможности (опционально)

1. **Подтверждение с предупреждением:**
   - Если отмена менее чем за 4 часа, показывать предупреждение: "Предоплата будет добавлена в доход"

2. **Детализация дохода от неявок:**
   - Показывать количество неявок за период
   - Показывать среднюю сумму предоплаты от неявок

3. **График дохода от неявок:**
   - Добавить отдельный график в раздел "Ежедневная статистика" для дохода от неявок

4. **Фильтры в дэшборде:**
   - Возможность фильтровать статистику с учетом/без учета дохода от неявок

---

## 📋 Запрос к Backend (если нужно)

Если нужно добавить отдельное поле `noShowRevenue` в ответ dashboard API, можно попросить backend разработчика:

```
Добавьте в ответ GET /studios/:studioId/dashboard в объект overview 
новое поле noShowRevenue, которое будет содержать сумму дохода 
от всех неявок (no-show income) за выбранный период.

Пример:
{
  "overview": {
    "totalAppointments": 150,
    "revenue": 300000,
    "noShowRevenue": 15000,  // ← новое поле
    "cancellationRate": 5.33,
    "completionRate": 85.5
  }
}
```

---

**Готово!** Теперь у вас есть полное понимание, как реализовать функционал "Не пришёл" и отобразить доход от неявок в дэшборде.


