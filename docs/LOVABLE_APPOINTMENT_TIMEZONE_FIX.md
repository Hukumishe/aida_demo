# Исправление ошибки "Appointment is outside work hours"

## Проблема

При создании записи на 15:00 возникает ошибка: **"Appointment is outside work hours"**

**Причина:**
- Фронтенд отправляет `startAt: "2026-02-15T15:00:00"` **без указания таймзоны**
- Бэкенд интерпретирует это как **UTC** (15:00 UTC)
- В таймзоне студии (Asia/Almaty, UTC+6) это соответствует **21:00**
- Рабочие часы мастера: 09:00-18:00
- 21:00 выходит за пределы рабочих часов → ошибка

---

## ✅ Решение

**Нужно отправлять дату с указанием таймзоны студии И правильно обрабатывать ответ от бэкенда.**

### Правильный формат отправки

Для студий в таймзоне **Asia/Almaty (UTC+6)** нужно добавлять offset `+06:00`:

```javascript
// ❌ НЕПРАВИЛЬНО (без таймзоны)
startAt: "2026-02-15T15:00:00"

// ✅ ПРАВИЛЬНО (с таймзоной)
startAt: "2026-02-15T15:00:00+06:00"
```

### ⚠️ ВАЖНО: Обработка ответа от бэкенда

**Бэкенд сохраняет время в UTC и возвращает в UTC.**

Когда бэкенд возвращает запись, `startAt` будет в формате UTC:
```json
{
  "startAt": "2026-02-15T09:00:00.000Z"  // Это 09:00 UTC = 15:00 Almaty
}
```

**На фронтенде нужно конвертировать UTC время обратно в таймзону студии для отображения:**

```typescript
function formatAppointmentTime(utcDateString: string, timezone: string = 'Asia/Almaty'): string {
  const date = new Date(utcDateString);
  return date.toLocaleTimeString('ru-RU', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// Использование:
const appointment = await response.json();
const displayTime = formatAppointmentTime(appointment.startAt); // "15:00"
```

---

## 📝 Примеры кода

### 1. Функция для отправки даты на бэкенд (с таймзоной)

```typescript
/**
 * Форматирует дату и время для отправки на бэкенд
 * Добавляет таймзону студии (Asia/Almaty, UTC+6)
 */
function formatDateTimeForBackend(date: Date, time: string): string {
  // time в формате "HH:MM" (например, "15:00")
  const [hours, minutes] = time.split(':');
  
  // Создаем дату в локальном времени
  const localDate = new Date(date);
  localDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  
  // Конвертируем в формат ISO с таймзоной Almaty (UTC+6)
  // Используем toLocaleString для получения времени в нужной таймзоне
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  
  // Формируем строку с таймзоной +06:00
  return `${year}-${month}-${day}T${hours}:${minutes}:00+06:00`;
}

// Использование:
const appointmentDate = new Date('2026-02-15');
const appointmentTime = '15:00';
const startAt = formatDateTimeForBackend(appointmentDate, appointmentTime);
// Результат: "2026-02-15T15:00:00+06:00"
```

### Альтернативный способ (используя библиотеку date-fns-tz)

```typescript
import { formatInTimeZone } from 'date-fns-tz';

function formatDateTimeForBackend(date: Date, time: string): string {
  const [hours, minutes] = time.split(':');
  
  // Создаем дату с нужным временем
  const dateTime = new Date(date);
  dateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  
  // Форматируем в ISO с таймзоной Almaty
  return formatInTimeZone(dateTime, 'Asia/Almaty', "yyyy-MM-dd'T'HH:mm:ssXXX");
  // Результат: "2026-02-15T15:00:00+06:00"
}
```

### Простой способ (без библиотек)

```typescript
function formatDateTimeForBackend(date: Date, time: string): string {
  const [hours, minutes] = time.split(':');
  
  // Получаем компоненты даты
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  // Формируем ISO строку с таймзоной +06:00 (Almaty)
  return `${year}-${month}-${day}T${hours}:${minutes}:00+06:00`;
}

// Использование:
const date = new Date('2026-02-15');
const time = '15:00';
const startAt = formatDateTimeForBackend(date, time);
console.log(startAt); // "2026-02-15T15:00:00+06:00"
```

### 2. Функция для отображения времени из ответа бэкенда

**ВАЖНО:** Бэкенд возвращает время в UTC. Нужно конвертировать обратно в таймзону студии.

```typescript
/**
 * Конвертирует UTC время из ответа бэкенда в локальное время студии
 * @param utcDateString - ISO строка в UTC (например, "2026-02-15T09:00:00.000Z")
 * @param timezone - Таймзона студии (по умолчанию "Asia/Almaty")
 * @returns Время в формате "HH:MM" в таймзоне студии
 */
function formatAppointmentTime(utcDateString: string, timezone: string = 'Asia/Almaty'): string {
  const date = new Date(utcDateString);
  return date.toLocaleTimeString('ru-RU', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// Использование:
const appointment = await response.json();
// appointment.startAt = "2026-02-15T09:00:00.000Z" (09:00 UTC)
const displayTime = formatAppointmentTime(appointment.startAt); 
console.log(displayTime); // "15:00" (15:00 Almaty)

// Для отображения полной даты и времени:
function formatAppointmentDateTime(utcDateString: string, timezone: string = 'Asia/Almaty'): string {
  const date = new Date(utcDateString);
  return date.toLocaleString('ru-RU', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

const displayDateTime = formatAppointmentDateTime(appointment.startAt);
console.log(displayDateTime); // "15.02.2026, 15:00"
```

---

## 🔧 Исправление в коде создания записи

### До исправления (неправильно):

```typescript
async function createAppointment(appointmentData) {
  const response = await fetch('/api/studios/studio-id/appointments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      staffUserId: appointmentData.staffUserId,
      clientId: appointmentData.clientId,
      serviceId: appointmentData.serviceId,
      startAt: `${appointmentData.date}T${appointmentData.time}:00`, // ❌ Без таймзоны!
      prepaymentAmount: appointmentData.prepaymentAmount,
    }),
  });
}
```

### После исправления (правильно):

```typescript
async function createAppointment(appointmentData) {
  // Форматируем дату с таймзоной
  const startAt = formatDateTimeForBackend(
    new Date(appointmentData.date),
    appointmentData.time
  );
  
  const response = await fetch('/api/studios/studio-id/appointments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      staffUserId: appointmentData.staffUserId,
      clientId: appointmentData.clientId,
      serviceId: appointmentData.serviceId,
      startAt: startAt, // ✅ С таймзоной +06:00
      prepaymentAmount: appointmentData.prepaymentAmount,
    }),
  });
}
```

---

## 🎯 Где нужно исправить

1. **Создание новой записи** (`POST /studios/:studioId/appointments`)
2. **Обновление записи** (`PATCH /appointments/:id`) - если меняется `startAt`
3. **Создание занятого слота** (`POST /studios/:studioId/busy-slots`)

---

## 📋 Чеклист

- [ ] Создать функцию `formatDateTimeForBackend(date, time)`
- [ ] Использовать её при создании записи
- [ ] Использовать её при обновлении записи (если меняется время)
- [ ] Использовать её при создании занятого слота
- [ ] Протестировать создание записи на разное время (09:00, 15:00, 18:00)
- [ ] Убедиться, что ошибка "outside work hours" больше не возникает

---

## 🔍 Проверка

После исправления проверьте:

1. **Создайте запись на 15:00:**
   ```javascript
   startAt: "2026-02-15T15:00:00+06:00" // ✅ Правильно
   ```
   - Должно работать без ошибок
   - В ответе от бэкенда будет `startAt: "2026-02-15T09:00:00.000Z"` (09:00 UTC)
   - На фронтенде конвертируйте в Almaty: должно отображаться как **15:00**

2. **Создайте запись на 09:00:**
   ```javascript
   startAt: "2026-02-15T09:00:00+06:00" // ✅ Правильно
   ```
   - Должно работать без ошибок
   - В ответе будет `startAt: "2026-02-15T03:00:00.000Z"` (03:00 UTC)
   - На фронтенде должно отображаться как **09:00**

3. **Создайте запись на 18:00:**
   ```javascript
   startAt: "2026-02-15T18:00:00+06:00" // ✅ Правильно
   ```
   - Должно работать без ошибок (если услуга помещается в рабочие часы)
   - В ответе будет `startAt: "2026-02-15T12:00:00.000Z"` (12:00 UTC)
   - На фронтенде должно отображаться как **18:00**

### Проверка отображения времени

**Проблема:** Если запись создается на 15:00, но отображается как 09:00, значит фронтенд не конвертирует UTC время обратно в таймзону студии.

**Решение:** Используйте функцию `formatAppointmentTime` для отображения времени из ответа бэкенда.

---

## ⚠️ Важно

- **Все студии используют таймзону `Asia/Almaty (UTC+6)`**
- **Всегда добавляйте `+06:00` к дате при отправке на бэкенд**
- **Формат:** `YYYY-MM-DDTHH:mm:ss+06:00`

---

## 📚 Дополнительная информация

### Таймзона студии

В базе данных студии имеют поле `timezone` со значением `"Asia/Almaty"` (по умолчанию).

### API документация

В Swagger документации (`/docs`) указано:
```
ISO 8601 date-time string with timezone offset. 
For Almaty use +06:00 (e.g., 2024-01-15T09:00:00+06:00 for 9:00 AM Almaty time)
```

---

**Готово!** После применения этого исправления ошибка "Appointment is outside work hours" должна исчезнуть.

