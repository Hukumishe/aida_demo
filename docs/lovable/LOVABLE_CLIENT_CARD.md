# Карточка клиента - Полное руководство

## Обзор

Карточка клиента отображает всю информацию о клиенте, его статистику, записи и позволяет выполнять различные действия.

---

## 📋 Что отображается в карточке клиента

### 1. Кнопки действий
- **"Записать"** - создание новой записи для клиента
- **"Написать"** - открытие мессенджера (WhatsApp/Telegram) - не требует backend
- **"Позвонить"** - открытие телефонного звонка - не требует backend

### 2. Статистика
- **Посещаемость** - общее количество визитов
- **Средний чек** - средняя стоимость записи
- **Бонусы** - бонусные баллы клиента
- **Скидка** - процент скидки (0-100)
- **Баланс** - баланс клиента в тенге

### 3. Информация
- **День рождения** - дата рождения клиента (если указана)
- **Предстоящие визиты** - список будущих записей
- **Записи** - все записи клиента
- **Телефон** - номер телефона
- **Заметки** - заметки о клиенте

---

## 🔌 API Endpoints

### 1. Получить информацию о клиенте

**Endpoint:** `GET /clients/:id`

**Ответ:**
```json
{
  "id": "client-uuid",
  "studioId": "studio-uuid",
  "firstName": "Иван",
  "lastName": "Иванов",
  "phone": "+79991234567",
  "birthDate": "1990-05-15T00:00:00.000Z",
  "notes": "Постоянный клиент, предпочитает утренние записи",
  "bonuses": 100,
  "discount": 10,
  "balance": 5000,
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:00.000Z",
  "studio": {
    "id": "studio-uuid",
    "name": "Салон на Абая"
  }
}
```

Поле `birthDate` — опциональное; приходит в ISO (дата без времени) или `null`, если не задано.

---

### 2. Получить статистику клиента

**Endpoint:** `GET /clients/:id/statistics`

**Ответ:**
```json
{
  "totalVisits": 15,
  "averageCheck": 2500,
  "totalSpent": 37500
}
```

**Описание полей:**
- `totalVisits` - общее количество визитов (исключая отмененные записи)
- `averageCheck` - средний чек в тенге
- `totalSpent` - общая сумма потраченная клиентом в тенге

---

### 3. Получить записи клиента

**Endpoint:** `GET /clients/:id/appointments`

**Query параметры:**
- `upcoming` (опционально) - если `true`, возвращает только предстоящие записи

**Примеры:**
```javascript
// Все записи клиента (от новых к старым)
GET /clients/client-uuid/appointments

// Только предстоящие записи (BOOKED, ARRIVED, будущие даты)
GET /clients/client-uuid/appointments?upcoming=true
```

**Ответ:**
```json
[
  {
    "id": "appointment-uuid",
    "studioId": "studio-uuid",
    "staffUserId": "staff-uuid",
    "clientId": "client-uuid",
    "serviceId": "service-uuid",
    "startAt": "2024-02-20T10:00:00.000Z",
    "endAt": "2024-02-20T11:00:00.000Z",
    "status": "BOOKED",
    "prepaymentAmount": 2000,
    "arrivedAt": null,
    "arrivedByUserId": null,
    "createdAt": "2024-02-15T10:00:00.000Z",
    "updatedAt": "2024-02-15T10:00:00.000Z",
    "staff": {
      "id": "staff-uuid",
      "email": "staff@example.com",
      "phone": "+79991234568",
      "staffProfile": {
        "firstName": "Мария",
        "lastName": "Петрова",
        "title": "Мастер"
      }
    },
    "service": {
      "id": "service-uuid",
      "name": "Стрижка",
      "defaultPrice": 2000,
      "defaultDurationMin": 60
    },
    "client": {
      "id": "client-uuid",
      "firstName": "Иван",
      "lastName": "Иванов"
    }
  }
]
```

---

### 4. Создать запись для клиента

**Endpoint:** `POST /studios/:studioId/appointments`

**Тело запроса:**
```json
{
  "staffUserId": "staff-uuid",
  "clientId": "client-uuid",
  "serviceId": "service-uuid",
  "startAt": "2024-02-20T10:00:00+06:00",
  "prepaymentAmount": 2000
}
```

**Примечание:** Этот endpoint уже существует, просто используйте его с `clientId` из карточки клиента.

---

### 5. Обновить информацию о клиенте

**Endpoint:** `PATCH /clients/:id`

**Тело запроса:**
```json
{
  "firstName": "Иван",
  "lastName": "Иванов",
  "phone": "+79991234567",
  "notes": "Обновленные заметки",
  "bonuses": 150,
  "discount": 15,
  "balance": 7000
}
```

Все поля опциональны.

---

## 🎨 Рекомендации по UI/UX

### Структура карточки клиента

```
┌─────────────────────────────────────┐
│  [← Назад]  Иван Иванов             │
├─────────────────────────────────────┤
│  Кнопки действий:                   │
│  [📅 Записать] [💬 Написать] [📞 Позвонить] │
├─────────────────────────────────────┤
│  Статистика:                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐│
│  │ Посещений│ │ Ср. чек │ │ Бонусы  ││
│  │   15    │ │ 2,500₸  │ │   100   ││
│  └─────────┘ └─────────┘ └─────────┘│
│  ┌─────────┐ ┌─────────┐            │
│  │ Скидка  │ │ Баланс  │            │
│  │   10%   │ │ 5,000₸  │            │
│  └─────────┘ └─────────┘            │
├─────────────────────────────────────┤
│  Предстоящие визиты:                │
│  • 20 фев, 10:00 - Стрижка (Мария) │
│  • 25 фев, 14:00 - Окрашивание (Анна)│
├─────────────────────────────────────┤
│  Все записи:                         │
│  [Показать все записи →]            │
├─────────────────────────────────────┤
│  Контакты:                           │
│  📞 +79991234567                     │
│  📝 Заметки: Постоянный клиент...    │
└─────────────────────────────────────┘
```

---

## 📝 Примеры кода

### Получение данных для карточки клиента

```typescript
interface ClientCardData {
  client: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    notes: string;
    bonuses: number;
    discount: number;
    balance: number;
  };
  statistics: {
    totalVisits: number;
    averageCheck: number;
    totalSpent: number;
  };
  upcomingAppointments: Appointment[];
  allAppointments: Appointment[];
}

async function getClientCardData(clientId: string): Promise<ClientCardData> {
  const [client, statistics, upcomingAppointments, allAppointments] = await Promise.all([
    fetch(`/api/clients/${clientId}`).then(r => r.json()),
    fetch(`/api/clients/${clientId}/statistics`).then(r => r.json()),
    fetch(`/api/clients/${clientId}/appointments?upcoming=true`).then(r => r.json()),
    fetch(`/api/clients/${clientId}/appointments`).then(r => r.json()),
  ]);

  return {
    client,
    statistics,
    upcomingAppointments,
    allAppointments,
  };
}
```

### Компонент карточки клиента

```jsx
function ClientCard({ clientId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClientData();
  }, [clientId]);

  async function loadClientData() {
    setLoading(true);
    try {
      const cardData = await getClientCardData(clientId);
      setData(cardData);
    } catch (error) {
      console.error('Failed to load client data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (!data) return <ErrorMessage />;

  const { client, statistics, upcomingAppointments } = data;

  return (
    <div className="client-card">
      {/* Заголовок */}
      <div className="client-header">
        <h1>{client.firstName} {client.lastName}</h1>
      </div>

      {/* Кнопки действий */}
      <div className="client-actions">
        <button onClick={() => navigate(`/appointments/create?clientId=${clientId}`)}>
          📅 Записать
        </button>
        <a href={`https://wa.me/${client.phone.replace(/[^0-9]/g, '')}`} target="_blank">
          💬 Написать
        </a>
        <a href={`tel:${client.phone}`}>
          📞 Позвонить
        </a>
      </div>

      {/* Статистика */}
      <div className="client-statistics">
        <StatCard title="Посещений" value={statistics.totalVisits} />
        <StatCard title="Средний чек" value={`${formatCurrency(statistics.averageCheck)}`} />
        <StatCard title="Бонусы" value={client.bonuses} />
        <StatCard title="Скидка" value={`${client.discount}%`} />
        <StatCard title="Баланс" value={formatCurrency(client.balance)} />
      </div>

      {/* Предстоящие визиты */}
      <div className="upcoming-appointments">
        <h3>Предстоящие визиты</h3>
        {upcomingAppointments.length > 0 ? (
          <ul>
            {upcomingAppointments.map(apt => (
              <li key={apt.id}>
                {formatDate(apt.startAt)} - {apt.service.name} ({apt.staff.staffProfile.firstName})
              </li>
            ))}
          </ul>
        ) : (
          <p>Нет предстоящих визитов</p>
        )}
      </div>

      {/* Контакты и заметки */}
      <div className="client-info">
        <p>📞 {client.phone}</p>
        {client.notes && (
          <div>
            <h4>Заметки:</h4>
            <p>{client.notes}</p>
          </div>
        )}
      </div>

      {/* Кнопка для перехода на страницу со всеми записями */}
      <button onClick={() => navigate(`/clients/${clientId}/appointments`)}>
        Показать все записи →
      </button>
    </div>
  );
}
```

### Обработка кнопок действий

```jsx
// Кнопка "Записать"
function handleCreateAppointment(clientId: string) {
  // Переход на страницу создания записи с предзаполненным clientId
  navigate(`/appointments/create?clientId=${clientId}`);
}

// Кнопка "Написать" (WhatsApp)
function handleWriteMessage(phone: string) {
  // Убираем все символы кроме цифр
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  window.open(`https://wa.me/${cleanPhone}`, '_blank');
}

// Кнопка "Позвонить"
function handleCall(phone: string) {
  window.location.href = `tel:${phone}`;
}
```

---

## 🔄 Логика работы

### Расчет статистики

1. **Посещаемость (totalVisits):**
   - Считаются все записи клиента со статусом не CANCELLED
   - Включает: BOOKED, ARRIVED, DONE

2. **Средний чек (averageCheck):**
   - Сумма всех `prepaymentAmount` (или `service.defaultPrice` если prepaymentAmount нет)
   - Делится на количество визитов
   - Округляется до целого числа
   - В тенге

3. **Общая сумма (totalSpent):**
   - Сумма всех `prepaymentAmount` (или `service.defaultPrice`)
   - В тенге

### Предстоящие визиты

- Фильтруются записи со статусом `BOOKED` или `ARRIVED`
- Фильтруются записи с `startAt >= текущая дата/время`
- Сортируются по дате (от ближайших к дальним)

### Все записи

- Возвращаются все записи клиента (включая прошлые)
- Сортируются по дате (от новых к старым)

---

## ✅ Чеклист для реализации

### Backend (уже готово):
- [x] Добавлены поля `bonuses`, `discount`, `balance` в модель Client
- [x] Создан endpoint `GET /clients/:id/statistics`
- [x] Создан endpoint `GET /clients/:id/appointments`
- [x] Обновлены DTO для создания и обновления клиента

### Frontend:
- [ ] Создать компонент карточки клиента
- [ ] Отобразить кнопки действий (Записать, Написать, Позвонить)
- [ ] Отобразить статистику (посещаемость, средний чек, бонусы, скидка, баланс)
- [ ] Отобразить предстоящие визиты
- [ ] Добавить кнопку для перехода на страницу со всеми записями
- [ ] Отобразить телефон и заметки
- [ ] Реализовать обработку кнопок действий

---

## 📌 Важные замечания

1. **Единицы измерения:**
   - `bonuses` - целое число (баллы)
   - `discount` - целое число (проценты, 0-100)
   - `balance` - целое число (тенге)
   - `averageCheck`, `totalSpent` - целые числа (тенге)

2. **Форматирование валюты:**
   - Используйте функцию `formatCurrency` без деления на 100
   - Пример: `formatCurrency(5000)` → `"5,000 〒"`

3. **Кнопки действий:**
   - "Записать" - использует существующий endpoint создания записи
   - "Написать" - открывает WhatsApp (не требует backend)
   - "Позвонить" - открывает телефонный звонок (не требует backend)

4. **Обновление данных:**
   - После создания/обновления записи обновите статистику клиента
   - После обновления информации о клиенте обновите данные карточки

---

**Готово!** Теперь у вас есть полное понимание, как реализовать карточку клиента с использованием предоставленных API endpoints.









