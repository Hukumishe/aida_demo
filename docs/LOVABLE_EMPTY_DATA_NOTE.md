# Важное дополнение для Lovable о пустых данных

## Обработка пустых таблиц

Когда таблицы в базе данных пустые (нет данных), API возвращает **пустой массив `[]`**, а не ошибку. Это нормальное поведение REST API.

### Примеры:

- `GET /studios` → вернет `[]`, если студий нет
- `GET /studios/:studioId/clients` → вернет `[]`, если клиентов нет  
- `GET /studios/:studioId/appointments` → вернет `[]`, если записей нет
- `GET /studios/:studioId/services` → вернет `[]`, если услуг нет
- `GET /studios/:studioId/staff` → вернет `[]`, если персонала нет
- `GET /studios/:studioId/schedule` → вернет `[]`, если расписания нет
- `GET /studios/:studioId/busy-slots` → вернет `[]`, если занятых слотов нет

### Как обрабатывать на фронтенде:

```javascript
const response = await fetch('/studios/:studioId/clients', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const clients = await response.json();

// Проверка на пустой массив
if (clients.length === 0) {
  // Показать сообщение: "Клиентов пока нет" или "Список пуст"
  showEmptyState();
} else {
  // Отобразить список клиентов
  renderClients(clients);
}
```

### Важно:

- **Пустой массив `[]` - это НЕ ошибка**, это нормальный ответ API
- Статус код всегда `200 OK` для пустых списков
- Фронтенд должен проверять `array.length === 0` и показывать соответствующее UI состояние (empty state)
- Не нужно показывать ошибку, когда получаете `[]` - просто покажите сообщение типа "Данных пока нет" или "Список пуст"

### Текущее состояние базы данных:

- ✅ Таблицы созданы
- ✅ Пользователи есть (owner@example.com, manager@example.com, master@example.com)
- ⚠️ Другие таблицы (studios, clients, services, appointments) могут быть пустыми - это нормально
- API будет возвращать `[]` для пустых таблиц




