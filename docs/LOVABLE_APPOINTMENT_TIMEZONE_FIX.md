# Время везде по Алмате (Asia/Almaty, UTC+6)

## ✅ ВАЖНО: Все даты автоматически возвращаются в таймзоне Алматы

**Бэкенд автоматически конвертирует все DateTime поля в таймзону Asia/Almaty (+06:00) во всех ответах API.**

Это означает:
- ✅ Все даты в ответах API имеют формат `YYYY-MM-DDTHH:mm:ss.sss+06:00`
- ✅ Не нужно конвертировать время на фронтенде
- ✅ Время отображается сразу в таймзоне Алматы

---

## Проблема (если всё ещё возникает)

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

### ✅ Обработка ответа от бэкенда

**Бэкенд автоматически возвращает все даты в таймзоне Asia/Almaty (+06:00).**

Когда бэкенд возвращает запись, `startAt` уже в формате Алматы:
```json
{
  "startAt": "2026-02-15T15:00:00.000+06:00"  // ✅ Уже в таймзоне Алматы!
}
```

**На фронтенде НЕ нужно конвертировать время - оно уже в правильной таймзоне!**

Просто используйте время напрямую:
```typescript
// Время уже в таймзоне Алматы, можно использовать напрямую
const appointment = await response.json();
const startAt = appointment.startAt; // "2026-02-15T15:00:00.000+06:00"

// Для отображения времени:
const time = startAt.split('T')[1].split('+')[0]; // "15:00:00.000"
const displayTime = time.substring(0, 5); // "15:00" ✅
```

Или используйте стандартный Date объект (он правильно распарсит строку с таймзоной):
```typescript
const appointment = await response.json();
const date = new Date(appointment.startAt); // Правильно распарсит +06:00
const displayTime = date.toLocaleTimeString('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
}); // "15:00" ✅
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

**ВАЖНО:** Бэкенд возвращает время уже в таймзоне Алматы (+06:00), конвертация не нужна!

```typescript
/**
 * Извлекает время из ISO строки с таймзоной Алматы
 * @param almatyDateString - ISO строка с таймзоной (например, "2026-02-15T15:00:00.000+06:00")
 * @returns Время в формате "HH:MM"
 */
function formatAppointmentTime(almatyDateString: string): string {
  // Время уже в таймзоне Алматы, просто извлекаем его
  const date = new Date(almatyDateString); // Правильно распарсит +06:00
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// Использование:
const appointment = await response.json();
// appointment.startAt = "2026-02-15T15:00:00.000+06:00" (уже в Алмате!)
const displayTime = formatAppointmentTime(appointment.startAt); 
console.log(displayTime); // "15:00" ✅

// Для отображения полной даты и времени:
function formatAppointmentDateTime(almatyDateString: string): string {
  const date = new Date(almatyDateString);
  return date.toLocaleString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

const displayDateTime = formatAppointmentDateTime(appointment.startAt);
console.log(displayDateTime); // "15.02.2026, 15:00" ✅
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
   - В ответе от бэкенда будет `startAt: "2026-02-15T15:00:00.000+06:00"` (уже в Алмате!)
   - На фронтенде должно отображаться как **15:00** ✅

2. **Создайте запись на 09:00:**
   ```javascript
   startAt: "2026-02-15T09:00:00+06:00" // ✅ Правильно
   ```
   - Должно работать без ошибок
   - В ответе будет `startAt: "2026-02-15T09:00:00.000+06:00"` (уже в Алмате!)
   - На фронтенде должно отображаться как **09:00** ✅

3. **Создайте запись на 18:00:**
   ```javascript
   startAt: "2026-02-15T18:00:00+06:00" // ✅ Правильно
   ```
   - Должно работать без ошибок (если услуга помещается в рабочие часы)
   - В ответе будет `startAt: "2026-02-15T18:00:00.000+06:00"` (уже в Алмате!)
   - На фронтенде должно отображаться как **18:00** ✅

### Проверка отображения времени

**ВАЖНО:** Бэкенд автоматически возвращает все даты в таймзоне Алматы (+06:00).

**Если запись создается на 15:00 и отображается как 15:00** - всё работает правильно! ✅

**Если запись создается на 15:00, но отображается как 09:00** - значит фронтенд неправильно обрабатывает строку с таймзоной. Используйте `new Date(appointment.startAt)` - он правильно распарсит `+06:00`.

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

