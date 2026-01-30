# Настройка редактирования графика работы для Lovable

## Контекст
На странице "График работы" (Work Schedule) есть календарная сетка, где пользователь может кликать на ячейки (пересечение сотрудника и даты) для установки/изменения времени работы сотрудника на конкретный день.

## API Endpoints для работы с расписанием

### 1. Получить расписание

**GET** `https://aidaproject-production.up.railway.app/studios/:studioId/schedule?date=YYYY-MM-DD`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Query Parameters:**
- `date` (опционально): Фильтр по дате в формате `YYYY-MM-DD` (например: `2026-01-30`)

**Response (200):**
```json
[
  {
    "id": "uuid",
    "studioId": "uuid",
    "staffUserId": "uuid",
    "date": "2026-01-30T00:00:00.000Z",
    "startTime": "09:00",
    "endTime": "18:00",
    "breakStart": "13:00",
    "breakEnd": "14:00",
    "isDayOff": false,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z",
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

**Важно:** Если расписания нет, вернется пустой массив `[]` (не ошибка). Статус код `200 OK`.

---

### 2. Создать/Обновить расписание на день

**POST** `https://aidaproject-production.up.railway.app/studios/:studioId/schedule`

**Headers:**
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Body:**
```json
{
  "staffUserId": "uuid",
  "date": "2026-01-30",
  "startTime": "09:00",
  "endTime": "18:00",
  "breakStart": "13:00",
  "breakEnd": "14:00",
  "isDayOff": false
}
```

**Важно:** 
- Этот эндпоинт использует `upsert` - если расписание на этот день уже существует, оно обновится, если нет - создастся
- Формат даты: `YYYY-MM-DD` (например: `2026-01-30`)
- Формат времени: `HH:MM` (например: `09:00`, `18:00`)
- `breakStart` и `breakEnd` опциональны
- `isDayOff` опционально (по умолчанию `false`)

**Валидация на backend:**
- `endTime > startTime` (обязательно)
- Перерыв должен быть в пределах рабочих часов (если указан)
- `breakEnd > breakStart` (если указан перерыв)

**Response (201):**
```json
{
  "id": "uuid",
  "studioId": "uuid",
  "staffUserId": "uuid",
  "date": "2026-01-30T00:00:00.000Z",
  "startTime": "09:00",
  "endTime": "18:00",
  "breakStart": "13:00",
  "breakEnd": "14:00",
  "isDayOff": false,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

**Ошибки:**
- `400 Bad Request` - Ошибка валидации (например, `endTime <= startTime`)
- `403 Forbidden` - Нет доступа к студии
- `404 Not Found` - Сотрудник не найден или не принадлежит студии

---

### 3. Обновить существующее расписание

**PATCH** `https://aidaproject-production.up.railway.app/schedule/day/:id`

**Headers:**
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Body (все поля опциональны):**
```json
{
  "startTime": "10:00",
  "endTime": "19:00",
  "breakStart": "14:00",
  "breakEnd": "15:00",
  "isDayOff": false
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "studioId": "uuid",
  "staffUserId": "uuid",
  "date": "2026-01-30T00:00:00.000Z",
  "startTime": "10:00",
  "endTime": "19:00",
  "breakStart": "14:00",
  "breakEnd": "15:00",
  "isDayOff": false
}
```

**Ошибки:**
- `404 Not Found` - Расписание не найдено
- `403 Forbidden` - Нет доступа

---

## Реализация на странице "График работы"

### 1. Загрузка данных при инициализации

```javascript
// При загрузке страницы или смене месяца/недели
async function loadSchedule(studioId, dateRange) {
  // Загрузить расписание для всех дней в диапазоне
  // Можно загрузить все дни или по одному запросу на день
  const schedules = [];
  
  for (let date = dateRange.start; date <= dateRange.end; date.setDate(date.getDate() + 1)) {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const response = await fetch(
      `https://aidaproject-production.up.railway.app/studios/${studioId}/schedule?date=${dateStr}`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );
    const daySchedules = await response.json();
    schedules.push(...daySchedules);
  }
  
  // Создать мапу для быстрого доступа: scheduleMap[staffUserId][date] = schedule
  const scheduleMap = {};
  schedules.forEach(s => {
    const dateStr = s.date.split('T')[0];
    if (!scheduleMap[s.staffUserId]) {
      scheduleMap[s.staffUserId] = {};
    }
    scheduleMap[s.staffUserId][dateStr] = s;
  });
  
  return scheduleMap;
}
```

### 2. Отображение расписания в сетке

**Структура сетки:**
- Строки: Сотрудники (мастера)
- Колонки: Дни недели

**Визуальное отображение ячейки:**
- Если есть расписание (`scheduleMap[staffUserId][date]`):
  - Показать время работы: `09:00 - 18:00`
  - Если есть перерыв: `09:00 - 18:00 (13:00-14:00)`
  - Если `isDayOff: true` - показать "Выходной" или серым цветом
- Если расписания нет - показать "-" или пусто

**Пример отображения:**
```javascript
function renderScheduleCell(staffUserId, date, scheduleMap) {
  const dateStr = date.toISOString().split('T')[0];
  const schedule = scheduleMap[staffUserId]?.[dateStr];
  
  if (!schedule) {
    return '-'; // Нет расписания
  }
  
  if (schedule.isDayOff) {
    return 'Выходной'; // Выходной день
  }
  
  let display = `${schedule.startTime} - ${schedule.endTime}`;
  if (schedule.breakStart && schedule.breakEnd) {
    display += ` (${schedule.breakStart}-${schedule.breakEnd})`;
  }
  
  return display;
}
```

### 3. Обработка клика по ячейке

**При клике на ячейку календаря:**
1. Открыть модальное окно с формой редактирования
2. Если расписание уже есть - загрузить данные в форму
3. Если расписания нет - показать пустую форму

**Модальное окно должно содержать:**
- **Сотрудник** (readonly) - имя сотрудника
- **Дата** (readonly) - выбранная дата
- **Начало работы** (startTime) - time picker или input `HH:MM`
- **Конец работы** (endTime) - time picker или input `HH:MM`
- **Перерыв начало** (breakStart) - опционально, time picker `HH:MM`
- **Перерыв конец** (breakEnd) - опционально, time picker `HH:MM`
- **Выходной день** (isDayOff) - checkbox
- Кнопки: "Сохранить", "Отмена", "Удалить" (если расписание существует)

### 4. Валидация формы

**Перед отправкой проверить:**
- `startTime` и `endTime` обязательны (если не выходной)
- `endTime > startTime`
- Если указан перерыв:
  - `breakStart` и `breakEnd` оба должны быть указаны
  - `breakEnd > breakStart`
  - Перерыв должен быть в пределах `startTime - endTime`

**Пример валидации:**
```javascript
function validateScheduleForm(formData) {
  if (formData.isDayOff) {
    return true; // Выходной день - валидация не нужна
  }
  
  // Проверка времени работы
  const start = timeToMinutes(formData.startTime);
  const end = timeToMinutes(formData.endTime);
  if (end <= start) {
    return { error: 'Время окончания должно быть больше времени начала' };
  }
  
  // Проверка перерыва
  if (formData.breakStart || formData.breakEnd) {
    if (!formData.breakStart || !formData.breakEnd) {
      return { error: 'Укажите начало и конец перерыва' };
    }
    
    const breakStart = timeToMinutes(formData.breakStart);
    const breakEnd = timeToMinutes(formData.breakEnd);
    
    if (breakEnd <= breakStart) {
      return { error: 'Конец перерыва должен быть больше начала' };
    }
    
    if (breakStart < start || breakEnd > end) {
      return { error: 'Перерыв должен быть в пределах рабочих часов' };
    }
  }
  
  return { valid: true };
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}
```

### 5. Сохранение расписания

**Если расписание НЕ существует (новая ячейка):**
```javascript
async function createSchedule(studioId, scheduleData) {
  const response = await fetch(
    `https://aidaproject-production.up.railway.app/studios/${studioId}/schedule`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        staffUserId: scheduleData.staffUserId,
        date: scheduleData.date, // YYYY-MM-DD
        startTime: scheduleData.startTime, // HH:MM
        endTime: scheduleData.endTime, // HH:MM
        breakStart: scheduleData.breakStart || undefined,
        breakEnd: scheduleData.breakEnd || undefined,
        isDayOff: scheduleData.isDayOff || false
      })
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Ошибка при сохранении расписания');
  }
  
  return await response.json();
}
```

**Если расписание УЖЕ существует (редактирование):**
```javascript
async function updateSchedule(scheduleId, updateData) {
  const response = await fetch(
    `https://aidaproject-production.up.railway.app/schedule/day/${scheduleId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        startTime: updateData.startTime,
        endTime: updateData.endTime,
        breakStart: updateData.breakStart || undefined,
        breakEnd: updateData.breakEnd || undefined,
        isDayOff: updateData.isDayOff || false
      })
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Ошибка при обновлении расписания');
  }
  
  return await response.json();
}
```

**Универсальная функция (использует upsert через POST):**
```javascript
async function saveSchedule(studioId, scheduleData, existingScheduleId) {
  // Если есть ID - можно использовать PATCH, иначе POST (upsert)
  if (existingScheduleId) {
    return updateSchedule(existingScheduleId, scheduleData);
  } else {
    return createSchedule(studioId, scheduleData);
  }
}
```

### 6. Удаление расписания (установка выходного дня)

**Вариант 1: Установить `isDayOff: true`**
```javascript
async function setDayOff(studioId, staffUserId, date) {
  return createSchedule(studioId, {
    staffUserId,
    date,
    startTime: '09:00', // Значения по умолчанию (не используются при isDayOff)
    endTime: '18:00',
    isDayOff: true
  });
}
```

**Вариант 2: Удалить расписание (если нужно полностью удалить)**
- Backend не предоставляет DELETE эндпоинт для расписания
- Можно установить `isDayOff: true` или оставить пустым (не отображать)

### 7. Обработка успешного сохранения

**После успешного сохранения:**
1. Закрыть модальное окно
2. Обновить локальный `scheduleMap` с новыми данными
3. Перерисовать ячейку в сетке
4. Показать уведомление "Расписание сохранено"

```javascript
async function handleSaveSchedule(studioId, scheduleData, existingSchedule) {
  try {
    const validation = validateScheduleForm(scheduleData);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }
    
    const saved = await saveSchedule(
      studioId,
      scheduleData,
      existingSchedule?.id
    );
    
    // Обновить локальный state
    updateScheduleMap(saved);
    
    // Закрыть модальное окно
    setIsModalOpen(false);
    
    // Показать уведомление
    showNotification('Расписание сохранено');
    
    // Перерисовать ячейку
    refreshScheduleCell(saved.staffUserId, saved.date);
  } catch (error) {
    alert(`Ошибка: ${error.message}`);
  }
}
```

### 8. Получение списка сотрудников

**Для отображения строк в сетке:**
```
GET https://aidaproject-production.up.railway.app/studios/:studioId/staff
```

Фильтровать только сотрудников с `role: "MASTER"` и `isActive: true`, которые `providesServices: true`.

---

## Пример полной реализации компонента

```javascript
const ScheduleGrid = () => {
  const [scheduleMap, setScheduleMap] = useState({});
  const [selectedCell, setSelectedCell] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    startTime: '09:00',
    endTime: '18:00',
    breakStart: '',
    breakEnd: '',
    isDayOff: false
  });
  
  const studioId = currentUser.studioId || selectedStudioId;
  
  // Загрузка расписания
  useEffect(() => {
    loadSchedule(studioId, currentWeekRange);
  }, [studioId, currentWeekRange]);
  
  // Обработка клика по ячейке
  const handleCellClick = (staffUserId, date) => {
    const dateStr = date.toISOString().split('T')[0];
    const existing = scheduleMap[staffUserId]?.[dateStr];
    
    if (existing) {
      // Загрузить существующие данные
      setFormData({
        startTime: existing.startTime,
        endTime: existing.endTime,
        breakStart: existing.breakStart || '',
        breakEnd: existing.breakEnd || '',
        isDayOff: existing.isDayOff
      });
    } else {
      // Сбросить форму
      setFormData({
        startTime: '09:00',
        endTime: '18:00',
        breakStart: '',
        breakEnd: '',
        isDayOff: false
      });
    }
    
    setSelectedCell({ staffUserId, date, existing });
    setIsModalOpen(true);
  };
  
  // Сохранение
  const handleSave = async () => {
    const validation = validateScheduleForm(formData);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }
    
    try {
      const scheduleData = {
        staffUserId: selectedCell.staffUserId,
        date: selectedCell.date.toISOString().split('T')[0],
        ...formData
      };
      
      const saved = await createSchedule(studioId, scheduleData);
      
      // Обновить локальный state
      const newMap = { ...scheduleMap };
      if (!newMap[saved.staffUserId]) {
        newMap[saved.staffUserId] = {};
      }
      const dateStr = saved.date.split('T')[0];
      newMap[saved.staffUserId][dateStr] = saved;
      setScheduleMap(newMap);
      
      setIsModalOpen(false);
      showNotification('Расписание сохранено');
    } catch (error) {
      alert(`Ошибка: ${error.message}`);
    }
  };
  
  return (
    <div>
      {/* Сетка календаря */}
      <table>
        <thead>
          <tr>
            <th></th>
            {weekDays.map(day => (
              <th key={day.date}>{day.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {masters.map(master => (
            <tr key={master.id}>
              <td>{master.staffProfile.firstName}</td>
              {weekDays.map(day => {
                const dateStr = day.date.toISOString().split('T')[0];
                const schedule = scheduleMap[master.id]?.[dateStr];
                return (
                  <td
                    key={day.date}
                    onClick={() => handleCellClick(master.id, day.date)}
                    style={{ cursor: 'pointer' }}
                  >
                    {renderScheduleCell(master.id, day.date, scheduleMap)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* Модальное окно редактирования */}
      {isModalOpen && selectedCell && (
        <Modal onClose={() => setIsModalOpen(false)}>
          <h2>Редактирование расписания</h2>
          <form>
            <label>
              Начало работы:
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                disabled={formData.isDayOff}
              />
            </label>
            <label>
              Конец работы:
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                disabled={formData.isDayOff}
              />
            </label>
            <label>
              Перерыв начало:
              <input
                type="time"
                value={formData.breakStart}
                onChange={(e) => setFormData({...formData, breakStart: e.target.value})}
                disabled={formData.isDayOff}
              />
            </label>
            <label>
              Перерыв конец:
              <input
                type="time"
                value={formData.breakEnd}
                onChange={(e) => setFormData({...formData, breakEnd: e.target.value})}
                disabled={formData.isDayOff}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={formData.isDayOff}
                onChange={(e) => setFormData({...formData, isDayOff: e.target.checked})}
              />
              Выходной день
            </label>
            <button type="button" onClick={handleSave}>Сохранить</button>
            <button type="button" onClick={() => setIsModalOpen(false)}>Отмена</button>
          </form>
        </Modal>
      )}
    </div>
  );
};
```

---

## Важные замечания

1. **StudioId:** Брать из `currentUser.studioId` (для MANAGER/MASTER) или из выбранной студии (для OWNER)

2. **Формат дат:**
   - В запросах `?date=`: `YYYY-MM-DD` (например: `2026-01-30`)
   - В теле запросов `date`: `YYYY-MM-DD` (например: `2026-01-30`)

3. **Формат времени:**
   - Всегда `HH:MM` (например: `09:00`, `18:00`)
   - Использовать `type="time"` в HTML input для удобства

4. **Upsert поведение:**
   - `POST /studios/:studioId/schedule` автоматически создает или обновляет расписание
   - Не нужно проверять существование перед созданием

5. **Выходные дни:**
   - Установить `isDayOff: true` для выходного дня
   - При `isDayOff: true` время работы не используется, но все равно нужно указать `startTime` и `endTime` в запросе

6. **Обработка ошибок:**
   - `400 Bad Request` - показать ошибки валидации
   - `403 Forbidden` - "Нет доступа к этой студии"
   - `404 Not Found` - "Сотрудник не найден"
   - `401 Unauthorized` - перенаправить на страницу входа

7. **Обновление данных:**
   - После сохранения обновить локальный state
   - Можно использовать оптимистичное обновление UI
   - При ошибке - откатить изменения

---

## Визуальные подсказки

- **Пустая ячейка** (нет расписания): показать "-" или пусто, при наведении показать "Кликните для установки расписания"
- **Ячейка с расписанием**: показать время работы, при наведении показать "Кликните для редактирования"
- **Выходной день**: показать "Выходной" серым цветом или с иконкой
- **Сегодня**: выделить колонку светлым фоном (как на скриншоте - 30 ПТ выделен розовым)
- **Выходные дни** (сб, вс): показать дату и день красным цветом

