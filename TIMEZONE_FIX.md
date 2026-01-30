# Исправление проблемы с часовыми поясами

## Проблема
При создании записи на 9:00 по Алмате, она появляется на 14:00 (или другое неправильное время).

## Причина
Frontend отправляет время в формате UTC (`2024-01-30T09:00:00Z`), но система работает по Алмате (UTC+6). 

**Разница:** 6 часов
- Если отправить `09:00Z` (9:00 UTC), это будет `15:00` по Алмате (9:00 + 6)
- Если отправить `03:00Z` (3:00 UTC), это будет `09:00` по Алмате (3:00 + 6)

## Решение

### Вариант 1: Отправлять время с timezone offset (Рекомендуется)

При создании записи отправлять время с указанием timezone Алматы:

```javascript
// Правильно: время 9:00 по Алмате
const startAt = '2024-01-30T09:00:00+06:00';

// Или использовать JavaScript Date с правильным timezone
const date = new Date('2024-01-30T09:00:00+06:00');
const startAt = date.toISOString(); // Это конвертирует в UTC автоматически
```

**Пример запроса:**
```javascript
const response = await fetch(
  `https://aidaproject-production.up.railway.app/studios/${studioId}/appointments`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      staffUserId: 'uuid',
      clientId: 'uuid',
      serviceId: 'uuid',
      startAt: '2024-01-30T09:00:00+06:00', // 9:00 по Алмате
      prepaymentAmount: 1000
    })
  }
);
```

### Вариант 2: Конвертировать локальное время в UTC перед отправкой

Если frontend работает в timezone Алматы, нужно вычесть 6 часов:

```javascript
// Время 9:00 по Алмате
const localTime = new Date('2024-01-30T09:00:00');
// Вычитаем 6 часов для конвертации в UTC
const utcTime = new Date(localTime.getTime() - 6 * 60 * 60 * 1000);
const startAt = utcTime.toISOString(); // 2024-01-30T03:00:00.000Z
```

### Вариант 3: Использовать библиотеку для работы с timezone

```javascript
// Используя date-fns-tz или moment-timezone
import { zonedTimeToUtc } from 'date-fns-tz';

const almatyTime = '2024-01-30T09:00:00';
const startAt = zonedTimeToUtc(almatyTime, 'Asia/Almaty').toISOString();
```

## Важно для Frontend

1. **Всегда отправляйте время с timezone offset** для Алматы: `+06:00`
2. **При отображении** - конвертируйте UTC время из ответа API в timezone Алматы
3. **При создании** - используйте формат: `YYYY-MM-DDTHH:MM:SS+06:00`

## Пример правильной функции создания записи

```javascript
function createAppointment(studioId, appointmentData) {
  // appointmentData.startAt - это время по Алмате (например, "09:00")
  // appointmentData.date - это дата (например, "2024-01-30")
  
  // Формируем ISO строку с timezone Алматы
  const startAt = `${appointmentData.date}T${appointmentData.startAt}:00+06:00`;
  
  return fetch(
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
        startAt: startAt, // Формат: 2024-01-30T09:00:00+06:00
        prepaymentAmount: appointmentData.prepaymentAmount
      })
    }
  );
}
```

## Пример правильной функции отображения времени

```javascript
function formatTimeForDisplay(utcTimeString) {
  // utcTimeString из API: "2024-01-30T03:00:00.000Z" (UTC)
  const date = new Date(utcTimeString);
  
  // Конвертируем в timezone Алматы
  const almatyTime = date.toLocaleString('ru-RU', {
    timeZone: 'Asia/Almaty',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return almatyTime; // "09:00"
}
```

