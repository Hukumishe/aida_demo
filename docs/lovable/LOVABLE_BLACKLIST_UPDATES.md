# Обновления функциональности черного списка

## 🆕 Что изменилось

### 1. Исправлена ошибка 403 Forbidden при создании запроса

**Проблема:**
- Эндпоинт `POST /clients/:clientId/blacklist/request` возвращал ошибку 403 Forbidden
- Причина: `StudioAccessGuard` блокировал запросы без `studioId` в URL

**Решение:**
- Убран `StudioAccessGuard` для эндпоинтов без `studioId` в URL
- Проверка доступа к студии теперь выполняется в сервисе, где мы получаем клиента и проверяем его `studioId`

**Статус:** ✅ Исправлено и работает корректно

**Что нужно сделать на фронтенде:**
- Ничего! Эндпоинт теперь работает корректно
- Если ранее была ошибка 403, она больше не должна появляться

---

### 2. Синхронизация черного списка между студиями

**Новое поведение:**
При одобрении запроса на добавление в ЧС или удалении из ЧС, изменения автоматически применяются ко **всем студиям**, где клиент зарегистрирован (по телефону).

#### Как это работает:

1. **При одобрении запроса (`PATCH /blacklist/requests/:requestId/approve`):**
   - Система находит всех клиентов с таким же телефоном во всех студиях
   - Все они автоматически добавляются в черный список с той же причиной
   - Поле `blacklistReason` заполняется для всех клиентов

2. **При удалении из ЧС (`PATCH /clients/:clientId/blacklist/remove`):**
   - Система находит всех клиентов с таким же телефоном во всех студиях
   - Все они автоматически удаляются из черного списка
   - Поле `blacklistReason` очищается для всех клиентов

#### Пример сценария:

1. Клиент "Иван Иванов" с телефоном "+79991234567" зарегистрирован в:
   - Студии A (ID: `studio-a`)
   - Студии B (ID: `studio-b`)

2. Менеджер Студии A создает запрос на добавление в ЧС с причиной "Не пришел на запись"

3. Владелец Студии A одобряет запрос

4. **Результат:**
   - Клиент в Студии A: `isBlacklisted: true`, `blacklistReason: "Не пришел на запись"`
   - Клиент в Студии B: `isBlacklisted: true`, `blacklistReason: "Не пришел на запись"`
   - Оба клиента автоматически добавлены в ЧС

5. При просмотре ЧС в Студии B, владелец увидит этого клиента в списке

6. Если владелец Студии B удалит клиента из ЧС:
   - Клиент удаляется из ЧС и в Студии A, и в Студии B
   - Оба клиента: `isBlacklisted: false`, `blacklistReason: null`

---

## 📡 Изменения в API

### Endpoint: `PATCH /blacklist/requests/:requestId/approve`

**Изменения:**
- Теперь обновляет всех клиентов с таким же телефоном во всех студиях
- Response остается прежним, но действие применяется глобально

**Пример:**
```typescript
// Одобрение запроса для клиента в Студии A
await approveBlacklistRequest(requestId);

// Результат: клиент добавлен в ЧС во всех студиях, где он зарегистрирован
```

### Endpoint: `PATCH /clients/:clientId/blacklist/remove`

**Изменения:**
- Теперь обновляет всех клиентов с таким же телефоном во всех студиях
- Response изменен: возвращает количество обновленных записей

**Старый Response:**
```json
{
  "id": "uuid",
  "isBlacklisted": false,
  "blacklistReason": null
}
```

**Новый Response:**
```json
{
  "count": 3  // Количество обновленных клиентов (может быть больше 1)
}
```

**Обновленный пример использования:**
```typescript
async function removeFromBlacklist(clientId: string) {
  const response = await fetch(`/api/clients/${clientId}/blacklist/remove`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to remove from blacklist');
  }

  const result = await response.json();
  // result.count - количество обновленных клиентов (может быть > 1)
  console.log(`Removed ${result.count} client(s) from blacklist`);
  
  return result;
}
```

---

## 🎯 Что нужно сделать на Frontend

### 1. Обновить обработку ответа при удалении из ЧС

**Где:** В функции/компоненте, который вызывает `PATCH /clients/:clientId/blacklist/remove`

**Что изменить:**
- Response теперь возвращает `{ count: number }` вместо объекта клиента
- Обновить обработку ответа соответственно

**Пример:**
```tsx
// Было:
const handleRemoveFromBlacklist = async (clientId: string) => {
  const client = await removeFromBlacklist(clientId);
  // client.id, client.isBlacklisted, etc.
};

// Стало:
const handleRemoveFromBlacklist = async (clientId: string) => {
  const result = await removeFromBlacklist(clientId);
  // result.count - количество обновленных клиентов
  if (result.count > 1) {
    alert(`Клиент удален из черного списка во всех студиях (${result.count} записей)`);
  } else {
    alert('Клиент удален из черного списка');
  }
  // Обновить список клиентов
  await loadBlacklistedClients();
};
```

### 2. Обновить сообщения для пользователя

**Рекомендация:** Добавить информативные сообщения о синхронизации между студиями

**Пример:**
```tsx
// При одобрении запроса
const handleApprove = async (requestId: string) => {
  await approveBlacklistRequest(requestId);
  
  // Можно добавить информативное сообщение
  alert('Запрос утвержден. Клиент добавлен в черный список во всех студиях, где он зарегистрирован.');
  
  await loadRequests();
};

// При удалении из ЧС
const handleRemoveFromBlacklist = async (clientId: string) => {
  if (!confirm('Клиент будет удален из черного списка во всех студиях. Продолжить?')) {
    return;
  }

  const result = await removeFromBlacklist(clientId);
  
  if (result.count > 1) {
    alert(`Клиент удален из черного списка во всех студиях (обновлено ${result.count} записей)`);
  } else {
    alert('Клиент удален из черного списка');
  }
  
  await loadBlacklistedClients();
};
```

### 3. Обновить типы TypeScript (опционально)

**Если используете TypeScript:**
```typescript
// types/blacklist.ts

// Обновить тип ответа для removeFromBlacklist
export interface RemoveFromBlacklistResponse {
  count: number; // Количество обновленных клиентов
}

// Обновить функцию
async function removeFromBlacklist(clientId: string): Promise<RemoveFromBlacklistResponse> {
  // ... implementation
}
```

---

## ⚠️ Важные моменты

1. **Синхронизация происходит автоматически:**
   - Никаких дополнительных API вызовов не требуется
   - Все происходит на бэкенде при одобрении/удалении

2. **Идентификация по телефону:**
   - Клиенты считаются одинаковыми, если у них совпадает телефон
   - Телефон уникален в рамках одной студии, но может повторяться в разных студиях

3. **Поведение при просмотре ЧС:**
   - Если клиент зарегистрирован в нескольких студиях и добавлен в ЧС, он будет виден в списке ЧС всех этих студий
   - При удалении из ЧС одного салона, клиент исчезнет из ЧС всех салонов

4. **Обратная совместимость:**
   - Все существующие эндпоинты работают как раньше
   - Изменился только формат ответа для `removeFromBlacklist` (теперь `{ count: number }`)

---

## ✅ Чек-лист обновлений

- [ ] Обновлена обработка ответа `PATCH /clients/:clientId/blacklist/remove` (теперь возвращает `{ count: number }`)
- [ ] Добавлены информативные сообщения о синхронизации между студиями
- [ ] Обновлены типы TypeScript (если используются)
- [ ] Протестировано поведение с клиентами, зарегистрированными в нескольких студиях
- [ ] Проверено, что ошибка 403 больше не возникает при создании запроса

---

## 📝 Примеры кода

### Полный пример обновленного компонента удаления из ЧС

```tsx
// components/BlacklistPage.tsx

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { UserRole } from '@/types/user';
import { Client } from '@/types/client';

function BlacklistPage() {
  const { studioId } = useParams();
  const userRole = useUserRole();
  const [blacklistedClients, setBlacklistedClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const canRemoveFromBlacklist = 
    userRole === UserRole.OWNER || userRole === UserRole.DEPUTY_OWNER;

  useEffect(() => {
    loadBlacklistedClients();
  }, [studioId]);

  const loadBlacklistedClients = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/studios/${studioId}/blacklist`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
        },
      });
      const data = await response.json();
      setBlacklistedClients(data);
    } catch (error) {
      console.error('Error loading blacklisted clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFromBlacklist = async (clientId: string) => {
    // Обновленное подтверждение с информацией о синхронизации
    if (!confirm('Клиент будет удален из черного списка во всех студиях, где он зарегистрирован. Продолжить?')) {
      return;
    }

    try {
      const response = await fetch(`/api/clients/${clientId}/blacklist/remove`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to remove from blacklist');
      }

      const result = await response.json();
      
      // Обновленная обработка ответа
      if (result.count > 1) {
        alert(`Клиент удален из черного списка во всех студиях (обновлено ${result.count} записей)`);
      } else {
        alert('Клиент удален из черного списка');
      }
      
      // Обновить список
      await loadBlacklistedClients();
    } catch (error) {
      alert('Ошибка при удалении из черного списка');
    }
  };

  if (loading) {
    return <div>Загрузка...</div>;
  }

  return (
    <div className="blacklist-page">
      <h2>Черный список</h2>
      
      {/* Информационное сообщение о синхронизации */}
      <div className="info-banner">
        <p>
          <strong>ℹ️ Важно:</strong> При добавлении клиента в черный список, он автоматически 
          добавляется во все студии, где он зарегистрирован. При удалении - удаляется из всех студий.
        </p>
      </div>
      
      {blacklistedClients.length === 0 ? (
        <p>В черном списке нет клиентов</p>
      ) : (
        <table className="blacklist-table">
          <thead>
            <tr>
              <th>Имя</th>
              <th>Телефон</th>
              <th>Причина</th>
              <th>Дата добавления</th>
              {canRemoveFromBlacklist && <th>Действия</th>}
            </tr>
          </thead>
          <tbody>
            {blacklistedClients.map((client) => (
              <tr key={client.id}>
                <td>{client.firstName} {client.lastName}</td>
                <td>{client.phone}</td>
                <td>{client.blacklistReason || 'Причина не указана'}</td>
                <td>{new Date(client.updatedAt).toLocaleDateString()}</td>
                {canRemoveFromBlacklist && (
                  <td>
                    <button
                      onClick={() => handleRemoveFromBlacklist(client.id)}
                      className="btn btn-sm btn-primary"
                    >
                      Удалить из ЧС
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

---

## 🎉 Итого

Все изменения работают автоматически на бэкенде. На фронтенде нужно только:
1. Обновить обработку ответа при удалении из ЧС (теперь `{ count: number }`)
2. Добавить информативные сообщения для пользователя (опционально, но рекомендуется)

Никаких дополнительных API вызовов или сложной логики не требуется!

