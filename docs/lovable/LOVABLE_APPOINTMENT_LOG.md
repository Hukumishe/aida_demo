# Настройка страницы "Журнал записей" для Lovable

## Контекст
Страница "Журнал записей" (Appointment Log) отображает расписание записей в виде сетки:
- Строки: временные слоты (09:00, 09:30, 10:00, и т.д.)
- Колонки: сотрудники (мастера) с их рабочими часами
- Ячейки: записи клиентов на определенное время

## Основные функции страницы

1. **Отображение записей** - сетка с временными слотами и сотрудниками
2. **Фильтрация по дате** - навигация по дням (стрелки влево/вправо, кнопка "Сегодня")
3. **Создание новой записи** - кнопка "Новая запись"
4. **Просмотр/редактирование записи** - клик по записи в сетке
5. **Отмена записи** - кнопка отмены
6. **Отметка "Клиент пришел"** - кнопка для отметки прибытия

---

## API Endpoints

### 1. Получить список записей

**GET** `https://aidaproject-production.up.railway.app/studios/:studioId/appointments?date=YYYY-MM-DD`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Query Parameters:**
- `date` (опционально): Фильтр по дате в формате `YYYY-MM-DD` (например: `2024-01-30`)

**Response (200):**
```json
[
  {
    "id": "uuid",
    "studioId": "uuid",
    "staffUserId": "uuid",
    "clientId": "uuid",
    "serviceId": "uuid",
    "startAt": "2024-01-30T10:00:00.000Z",
    "endAt": "2024-01-30T11:00:00.000Z",
    "status": "BOOKED",
    "prepaymentAmount": 1000,
    "comment": "Клиент просит мастера Майру",
    "arrivedAt": null,
    "arrivedByUserId": null,
    "createdAt": "2024-01-29T00:00:00.000Z",
    "updatedAt": "2024-01-29T00:00:00.000Z",
    "staff": {
      "id": "uuid",
      "email": "master@example.com",
      "phone": "+79991234569",
      "staffProfile": {
        "userId": "uuid",
        "firstName": "Аня",
        "lastName": "Иванова",
        "title": "Парикмахер",
        "category": "Парикмахер",
        "providesServices": true
      }
    },
    "client": {
      "id": "uuid",
      "firstName": "Иван",
      "lastName": "Петров",
      "phone": "+79991112233"
    },
    "service": {
      "id": "uuid",
      "name": "Стрижка",
      "defaultDurationMin": 60,
      "defaultPrice": 2000
    },
    "arrivedByUser": null
  }
]
```

**Важно:** Если записей нет, вернется пустой массив `[]` (не ошибка). Статус код `200 OK`.

**Статусы записей:**
- `BOOKED` - Забронировано (обычный статус)
- `CANCELLED` - Отменено (не отображать в сетке или показывать серым/перечеркнутым)
- `ARRIVED` - Клиент прибыл (можно выделить зеленым)
- `DONE` - Выполнено (можно выделить серым)

---

### 2. Получить список сотрудников (для отображения колонок)

**GET** `https://aidaproject-production.up.railway.app/studios/:studioId/staff`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
[
  {
    "id": "uuid",
    "email": "master1@example.com",
    "phone": "+79991234569",
    "role": "MASTER",
    "studioId": "uuid",
    "isActive": true,
    "staffProfile": {
      "userId": "uuid",
      "firstName": "Аня",
      "lastName": "Иванова",
      "title": "Парикмахер",
      "category": "Парикмахер",
      "providesServices": true
    }
  }
]
```

**Важно:** Фильтровать только сотрудников с `role: "MASTER"` и `isActive: true`, которые `providesServices: true`.

---

### 3. Получить расписание сотрудника (для отображения рабочих часов)

**GET** `https://aidaproject-production.up.railway.app/studios/:studioId/schedule?date=YYYY-MM-DD`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Query Parameters:**
- `date` (опционально): Дата в формате `YYYY-MM-DD`

**Response (200):**
```json
[
  {
    "id": "uuid",
    "studioId": "uuid",
    "staffUserId": "uuid",
    "date": "2024-01-30T00:00:00.000Z",
    "startTime": "09:00",
    "endTime": "20:00",
    "breakStart": "13:00",
    "breakEnd": "14:00",
    "isDayOff": false,
    "staff": {
      "id": "uuid",
      "staffProfile": {
        "firstName": "Аня",
        "lastName": "Иванова"
      }
    }
  }
]
```

**Важно:** 
- Если `isDayOff: true` - сотрудник не работает в этот день (не показывать колонку или показать "Выходной")
- `startTime` и `endTime` в формате `HH:MM` (например: "09:00", "20:00")
- Использовать эти значения для отображения рабочих часов под именем сотрудника (например: "09:00 - 20:00")

---

### 4. Создать новую запись

**POST** `https://aidaproject-production.up.railway.app/studios/:studioId/appointments`

**Headers:**
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Body:**
```json
{
  "staffUserId": "uuid",
  "clientId": "uuid",
  "serviceId": "uuid",
  "startAt": "2024-01-30T10:00:00+06:00",
  "prepaymentAmount": 1000,
  "comment": "Комментарий к записи (опционально)"
}
```

**КРИТИЧЕСКИ ВАЖНО - Формат времени:**
- Формат `startAt`: ISO 8601 с timezone offset для Алматы: `+06:00`
- **Пример:** `2024-01-30T09:00:00+06:00` означает 9:00 утра по Алмате
- **НЕ используйте `Z` (UTC)** - это приведет к неправильному времени
- Если отправить `09:00Z` (UTC), это будет `15:00` по Алмате (9:00 + 6 часов)
- Всегда указывайте `+06:00` для времени по Алмате

**Другие важные моменты:**
- `endAt` вычисляется автоматически на основе длительности услуги
- `prepaymentAmount` опционально (в тенге, целое число)
- `comment` опционально — комментарий к записи (текст, в карточке «Детали записи»)

**Response (201):**
```json
{
  "id": "uuid",
  "studioId": "uuid",
  "staffUserId": "uuid",
  "clientId": "uuid",
  "serviceId": "uuid",
  "startAt": "2024-01-30T10:00:00.000Z",
  "endAt": "2024-01-30T11:00:00.000Z",
  "status": "BOOKED",
  "prepaymentAmount": 1000,
  "arrivedAt": null,
  "arrivedByUserId": null
}
```

**Ошибки:**
- `409 Conflict` - Время занято или недоступно. Сообщение: `"Conflict: Time slot not available. Reason: <reason>"`

**Возможные причины конфликта:**
- `NO_WORK_SCHEDULE` - Нет рабочего расписания на эту дату
- `OUT_OF_WORK_HOURS` - Время вне рабочих часов
- `OVERLAP_BREAK` - Пересечение с перерывом
- `OVERLAP_BUSY_SLOT` - Пересечение с занятым слотом
- `OVERLAP_APPOINTMENT` - Пересечение с другой записью

---

### 5. Получить список клиентов (для формы создания записи)

**GET** `https://aidaproject-production.up.railway.app/studios/:studioId/clients?q=<search>`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Query Parameters:**
- `q` (опционально): Поиск по имени, фамилии или телефону

**Response (200):**
```json
[
  {
    "id": "uuid",
    "firstName": "Иван",
    "lastName": "Петров",
    "phone": "+79991112233",
    "notes": "VIP клиент"
  }
]
```

---

### 6. Получить список услуг (для формы создания записи)

**GET** `https://aidaproject-production.up.railway.app/studios/:studioId/services`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "Стрижка",
    "defaultDurationMin": 60,
    "defaultPrice": 2000,
    "isActive": true
  }
]
```

**Важно:** Показывать только услуги с `isActive: true`.

---

### 7. Обновить запись

**PATCH** `https://aidaproject-production.up.railway.app/appointments/:id`

**Headers:**
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Body:**
```json
{
  "startAt": "2024-01-30T11:00:00Z",
  "prepaymentAmount": 1500,
  "comment": "Обновлённый комментарий",
  "status": "BOOKED"
}
```

**Важно:** Все поля опциональны. Можно изменить только время, предоплату, комментарий или статус. Пустая строка `comment` очищает поле.

---

### 8. Отменить запись

**POST** `https://aidaproject-production.up.railway.app/appointments/:id/cancel`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "id": "uuid",
  "status": "CANCELLED",
  ...
}
```

---

### 9. Отметить "Клиент пришел"

**POST** `https://aidaproject-production.up.railway.app/appointments/:id/arrived`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "id": "uuid",
  "status": "ARRIVED",
  "arrivedAt": "2024-01-30T10:05:00.000Z",
  "arrivedByUserId": "uuid",
  ...
}
```

---

## Реализация страницы

### 1. Инициализация и загрузка данных

```javascript
// При загрузке страницы или смене даты
async function loadAppointmentLog(studioId, selectedDate) {
  // Формат даты: YYYY-MM-DD
  const dateStr = selectedDate.toISOString().split('T')[0];
  
  // Параллельно загружаем данные
  const [appointments, staff, schedules] = await Promise.all([
    fetch(`https://aidaproject-production.up.railway.app/studios/${studioId}/appointments?date=${dateStr}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }).then(r => r.json()),
    
    fetch(`https://aidaproject-production.up.railway.app/studios/${studioId}/staff`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }).then(r => r.json()),
    
    fetch(`https://aidaproject-production.up.railway.app/studios/${studioId}/schedule?date=${dateStr}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }).then(r => r.json())
  ]);
  
  // Фильтруем только мастеров
  const masters = staff.filter(s => 
    s.role === 'MASTER' && 
    s.isActive && 
    s.staffProfile?.providesServices
  );
  
  // Создаем мапу расписаний по staffUserId
  const scheduleMap = {};
  schedules.forEach(s => {
    if (!s.isDayOff) {
      scheduleMap[s.staffUserId] = {
        startTime: s.startTime,
        endTime: s.endTime,
        breakStart: s.breakStart,
        breakEnd: s.breakEnd
      };
    }
  });
  
  return { appointments, masters, scheduleMap };
}
```

### 2. Отображение сетки

**Структура сетки:**
- **Заголовок:** Имена сотрудников (мастеров) с рабочими часами
- **Строки:** Временные слоты (например, каждые 30 минут: 09:00, 09:30, 10:00, ...)
- **Ячейки:** Записи или пустые слоты

**Алгоритм отображения записей:**
```javascript
function renderAppointmentInGrid(appointment, timeSlots, masterColumn) {
  const startTime = new Date(appointment.startAt);
  const endTime = new Date(appointment.endAt);
  
  // Найти начальный и конечный слоты
  const startSlot = findTimeSlot(startTime, timeSlots);
  const endSlot = findTimeSlot(endTime, timeSlots);
  const durationSlots = endSlot - startSlot;
  
  // Отобразить блок записи, занимающий нужное количество слотов
  return {
    row: startSlot,
    span: durationSlots,
    appointment: appointment,
    masterColumn: masterColumn
  };
}
```

**Визуальное отображение:**
- Запись должна занимать несколько строк в зависимости от длительности
- Показывать: имя клиента, услугу, время, статус
- Цвета по статусу:
  - `BOOKED` - обычный цвет (например, розовый)
  - `ARRIVED` - зеленый
  - `CANCELLED` - серый/перечеркнутый (можно не показывать)
  - `DONE` - серый

### 3. Навигация по датам

```javascript
// Кнопка "Сегодня"
function goToToday() {
  setSelectedDate(new Date());
  loadAppointmentLog(studioId, new Date());
}

// Стрелки влево/вправо
function changeDate(days) {
  const newDate = new Date(selectedDate);
  newDate.setDate(newDate.getDate() + days);
  setSelectedDate(newDate);
  loadAppointmentLog(studioId, newDate);
}
```

### 4. Создание новой записи

**Модальное окно с формой:**

**Поля:**
- **Сотрудник** (staffUserId) - dropdown из списка мастеров
- **Клиент** (clientId) - поиск/выбор из списка клиентов (можно с поиском)
- **Услуга** (serviceId) - dropdown из списка активных услуг
- **Дата и время** (startAt) - date picker + time picker
- **Предоплата** (prepaymentAmount) - опционально, числовое поле
- **Комментарий** (comment) - опционально, textarea

**Валидация:**
- Все обязательные поля должны быть заполнены
- Дата и время должны быть в будущем (или сегодня, но не в прошлом)

**Отправка:**
```javascript
async function createAppointment(studioId, appointmentData) {
  const response = await fetch(
    `https://aidaproject-production.up.railway.app/studios/${studioId}/appointments`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        staffUserId: appointmentData.staffUserId,
        clientId: appointmentData.clientId,
        serviceId: appointmentData.serviceId,
        startAt: appointmentData.startAt, // Формат: 2024-01-30T10:00:00+06:00 (с timezone Алматы)
        prepaymentAmount: appointmentData.prepaymentAmount || undefined
      })
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    if (response.status === 409) {
      // Конфликт времени
      alert(`Время занято: ${error.message}`);
    } else {
      alert(`Ошибка: ${error.message}`);
    }
    throw new Error(error.message);
  }
  
  return await response.json();
}
```

**После успешного создания:**
- Закрыть модальное окно
- Обновить список записей
- Показать уведомление "Запись успешно создана"

### 5. Редактирование записи

**При клике на запись в сетке:**
- Открыть модальное окно с данными записи
- Поля те же, что при создании (можно изменить время, услугу, предоплату)
- Кнопки: "Сохранить", "Отменить запись", "Клиент пришел"

**Обновление:**
```javascript
async function updateAppointment(appointmentId, updateData) {
  const response = await fetch(
    `https://aidaproject-production.up.railway.app/appointments/${appointmentId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        startAt: updateData.startAt?.toISOString(),
        prepaymentAmount: updateData.prepaymentAmount,
        serviceId: updateData.serviceId
      })
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    if (response.status === 409) {
      alert(`Время занято: ${error.message}`);
    } else {
      alert(`Ошибка: ${error.message}`);
    }
    throw new Error(error.message);
  }
  
  return await response.json();
}
```

### 6. Отмена записи

```javascript
async function cancelAppointment(appointmentId) {
  const response = await fetch(
    `https://aidaproject-production.up.railway.app/appointments/${appointmentId}/cancel`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    alert(`Ошибка: ${error.message}`);
    throw new Error(error.message);
  }
  
  return await response.json();
}
```

### 7. Отметка "Клиент пришел"

```javascript
async function markAppointmentArrived(appointmentId) {
  const response = await fetch(
    `https://aidaproject-production.up.railway.app/appointments/${appointmentId}/arrived`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    alert(`Ошибка: ${error.message}`);
    throw new Error(error.message);
  }
  
  return await response.json();
}
```

---

## Важные замечания

1. **StudioId:** Брать из `currentUser.studioId` (для MANAGER/MASTER) или из выбранной студии (для OWNER)

2. **Формат дат:**
   - В запросах с параметром `date`: `YYYY-MM-DD` (например: `2024-01-30`)
   - В теле запросов `startAt`: ISO 8601 с timezone offset `+06:00` для Алматы (например: `2024-01-30T10:00:00+06:00`)
   - **НЕ используйте `Z` (UTC)** - всегда указывайте `+06:00` для времени по Алмате

3. **Временные слоты:**
   - Рекомендуется использовать слоты по 30 минут (09:00, 09:30, 10:00, ...)
   - Запись может занимать несколько слотов в зависимости от длительности услуги

4. **Фильтрация записей:**
   - Не показывать записи со статусом `CANCELLED` (или показывать серым/перечеркнутым)
   - MASTER видит только свои записи (бэкенд фильтрует автоматически)

5. **Рабочие часы:**
   - Отображать только сотрудников, у которых есть расписание на выбранную дату
   - Если `isDayOff: true` - не показывать колонку или показать "Выходной"

6. **Обработка ошибок:**
   - `409 Conflict` - показать понятное сообщение о конфликте времени
   - `403 Forbidden` - "Нет доступа к этой студии"
   - `401 Unauthorized` - перенаправить на страницу входа

7. **Обновление данных:**
   - После создания/обновления/отмены записи - обновить список записей
   - Можно использовать polling (обновление каждые N секунд) или обновлять только после действий пользователя

---

## Пример полной структуры компонента

```javascript
const AppointmentLogPage = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [masters, setMasters] = useState([]);
  const [scheduleMap, setScheduleMap] = useState({});
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  
  const studioId = currentUser.studioId || selectedStudioId;
  
  useEffect(() => {
    loadAppointmentLog(studioId, selectedDate);
  }, [studioId, selectedDate]);
  
  // ... остальная логика
  
  return (
    <div>
      {/* Заголовок с кнопками */}
      <div>
        <h1>Журнал записей</h1>
        <button onClick={() => setIsCreateModalOpen(true)}>
          + Новая запись
        </button>
      </div>
      
      {/* Навигация по датам */}
      <div>
        <button onClick={() => changeDate(-1)}>←</button>
        <span>{formatDate(selectedDate)}</span>
        <button onClick={() => changeDate(1)}>→</button>
        <button onClick={goToToday}>Сегодня</button>
      </div>
      
      {/* Сетка расписания */}
      <ScheduleGrid
        appointments={appointments}
        masters={masters}
        scheduleMap={scheduleMap}
        selectedDate={selectedDate}
        onAppointmentClick={setSelectedAppointment}
      />
      
      {/* Модальные окна */}
      {isCreateModalOpen && (
        <CreateAppointmentModal
          studioId={studioId}
          selectedDate={selectedDate}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            loadAppointmentLog(studioId, selectedDate);
          }}
        />
      )}
      
      {selectedAppointment && (
        <AppointmentDetailsModal
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onUpdate={() => loadAppointmentLog(studioId, selectedDate)}
          onCancel={async () => {
            await cancelAppointment(selectedAppointment.id);
            loadAppointmentLog(studioId, selectedDate);
            setSelectedAppointment(null);
          }}
          onArrived={async () => {
            await markAppointmentArrived(selectedAppointment.id);
            loadAppointmentLog(studioId, selectedDate);
            setSelectedAppointment(null);
          }}
        />
      )}
    </div>
  );
};
```

