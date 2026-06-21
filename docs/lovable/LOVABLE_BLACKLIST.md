# Функциональность черного списка клиентов

## 📋 Обзор

Реализована система черного списка клиентов с механизмом запросов и утверждения. Менеджеры и администраторы могут запросить добавление клиента в черный список, а владельцы и заместители владельцев утверждают или отклоняют эти запросы.

Кнопка на запрос на добавление в чёрный список должна находится в профиле клиента.

## 🆕 Последние обновления

### 1. Исправлена ошибка 403 Forbidden
- **Проблема:** Эндпоинт `POST /clients/:clientId/blacklist/request` возвращал ошибку 403
- **Решение:** Исправлена логика контроля доступа - теперь проверка выполняется в сервисе
- **Статус:** ✅ Исправлено и работает корректно

### 2. Синхронизация черного списка между студиями
- **Новое поведение:** При одобрении запроса на добавление в ЧС, клиент автоматически добавляется в черный список **во всех студиях**, где он зарегистрирован (по телефону)
- **Удаление:** При удалении из ЧС одного салона, клиент автоматически удаляется из ЧС **всех салонов**
- **Как работает:** Система находит всех клиентов с таким же телефоном во всех студиях и обновляет их статус одновременно
- **Для фронтенда:** Никаких дополнительных действий не требуется - синхронизация происходит автоматически на бэкенде

## 🔐 Права доступа

### Создание запроса на добавление в ЧС
- ✅ **MANAGER** - может создавать запросы
- ✅ **ADMIN** - может создавать запросы
- ❌ **OWNER** - не может создавать запросы (может напрямую добавлять)
- ❌ **DEPUTY_OWNER** - не может создавать запросы (может напрямую добавлять)
- ❌ **MASTER** - не может создавать запросы

### Утверждение/отклонение запросов
- ✅ **OWNER** - может утверждать и отклонять запросы
- ✅ **DEPUTY_OWNER** - может утверждать и отклонять запросы
- ❌ Все остальные роли - не могут утверждать/отклонять

### Удаление из ЧС
- ✅ **OWNER** - может удалять клиентов из ЧС
- ✅ **DEPUTY_OWNER** - может удалять клиентов из ЧС
- ❌ Все остальные роли - не могут удалять из ЧС

## 🚫 Ограничения

**Важно:** Пользователи системы (OWNER, DEPUTY_OWNER, ADMIN, MANAGER, MASTER) **не могут** быть добавлены в черный список. Если клиент имеет тот же телефон, что и пользователь системы, запрос будет отклонен с ошибкой.

## 🔧 Исправления и обновления

### Исправлена ошибка 403 Forbidden

**Проблема была исправлена:** Эндпоинт `POST /clients/:clientId/blacklist/request` теперь работает корректно. Проблема была в том, что `StudioAccessGuard` блокировал запросы без `studioId` в URL. Теперь проверка доступа выполняется в сервисе, где мы получаем клиента и проверяем его `studioId`.

**Что изменилось:**
- Убран `StudioAccessGuard` для эндпоинтов без `studioId` в URL
- Проверка доступа к студии выполняется в `BlacklistService`, где мы получаем клиента и проверяем доступ

## 📡 API Endpoints

### 1. Создать запрос на добавление в ЧС

**Endpoint:** `POST /clients/:clientId/blacklist/request`

**Доступ:** MANAGER, ADMIN

**⚠️ Важно:** Этот эндпоинт теперь работает корректно. Если ранее была ошибка 403, она исправлена.

**Request Body:**
```json
{
  "reason": "Клиент не пришел на запись несколько раз" // ОБЯЗАТЕЛЬНОЕ поле
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "studioId": "uuid",
  "clientId": "uuid",
  "requestedByUserId": "uuid",
  "status": "PENDING",
  "reason": "Клиент не пришел на запись несколько раз",
  "createdAt": "2026-02-20T19:00:00.000Z",
  "updatedAt": "2026-02-20T19:00:00.000Z",
  "client": {
    "id": "uuid",
    "firstName": "Иван",
    "lastName": "Иванов",
    "phone": "+79991234567"
  },
  "requestedBy": {
    "id": "uuid",
    "email": "manager@example.com",
    "staffProfile": {
      "firstName": "Мария",
      "lastName": "Петрова"
    }
  }
}
```

**Ошибки:**
- `400` - Клиент уже в черном списке
- `400` - Уже есть активный запрос для этого клиента
- `400` - Пользователь системы не может быть добавлен в ЧС
- `403` - Недостаточно прав
- `404` - Клиент не найден

### 2. Получить все запросы на добавление в ЧС

**Endpoint:** `GET /studios/:studioId/blacklist/requests?status=PENDING`

**Доступ:** Все роли (с ограничениями по студии)

**Query Parameters:**
- `status` (опционально) - фильтр по статусу: `PENDING`, `APPROVED`, `REJECTED`

**Response (200):**
```json
[
  {
    "id": "uuid",
    "studioId": "uuid",
    "clientId": "uuid",
    "requestedByUserId": "uuid",
    "approvedByUserId": null,
    "status": "PENDING",
    "reason": "Клиент не пришел на запись несколько раз",
    "rejectedReason": null,
    "createdAt": "2026-02-20T19:00:00.000Z",
    "updatedAt": "2026-02-20T19:00:00.000Z",
    "approvedAt": null,
    "rejectedAt": null,
    "client": {
      "id": "uuid",
      "firstName": "Иван",
      "lastName": "Иванов",
      "phone": "+79991234567"
    },
    "requestedBy": {
      "id": "uuid",
      "email": "manager@example.com",
      "staffProfile": {
        "firstName": "Мария",
        "lastName": "Петрова"
      }
    },
    "approvedBy": null
  }
]
```

### 3. Утвердить запрос

**Endpoint:** `PATCH /blacklist/requests/:requestId/approve`

**Доступ:** OWNER, DEPUTY_OWNER

**Request Body:**
```json
{
  "comment": "Одобрено" // опционально
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "status": "APPROVED",
  "approvedByUserId": "uuid",
  "approvedAt": "2026-02-20T19:05:00.000Z"
}
```

**🆕 Важное поведение:**
- При одобрении запроса, клиент автоматически добавляется в черный список **во всех студиях**, где он зарегистрирован (по телефону)
- Это означает, что если клиент с таким же телефоном есть в нескольких студиях, все они будут добавлены в ЧС одновременно
- Причина (`blacklistReason`) сохраняется для всех клиентов с таким же телефоном

**Ошибки:**
- `400` - Запрос уже обработан
- `403` - Недостаточно прав
- `404` - Запрос не найден

### 4. Отклонить запрос

**Endpoint:** `PATCH /blacklist/requests/:requestId/reject`

**Доступ:** OWNER, DEPUTY_OWNER

**Request Body:**
```json
{
  "rejectedReason": "Недостаточно оснований" // опционально
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "status": "REJECTED",
  "rejectedReason": "Недостаточно оснований",
  "rejectedAt": "2026-02-20T19:05:00.000Z"
}
```

### 5. Получить список клиентов в ЧС

**Endpoint:** `GET /studios/:studioId/blacklist`

**Доступ:** Все роли (с ограничениями по студии)

**Response (200):**
```json
[
  {
    "id": "uuid",
    "studioId": "uuid",
    "firstName": "Иван",
    "lastName": "Иванов",
    "phone": "+79991234567",
    "isBlacklisted": true,
    "blacklistReason": "Клиент не пришел на запись несколько раз",
    "createdAt": "2026-02-20T18:00:00.000Z",
    "updatedAt": "2026-02-20T19:05:00.000Z"
  }
]
```

### 6. Удалить клиента из ЧС

**Endpoint:** `PATCH /clients/:clientId/blacklist/remove`

**Доступ:** OWNER, DEPUTY_OWNER

**Response (200):**
```json
{
  "count": 3 // Количество обновленных клиентов (все клиенты с таким же телефоном во всех студиях)
}
```

**🆕 Важное поведение:**
- При удалении клиента из ЧС, он автоматически удаляется из черного списка **во всех студиях**, где он зарегистрирован (по телефону)
- Это означает, что если клиент с таким же телефоном есть в нескольких студиях, все они будут удалены из ЧС одновременно
- Поле `blacklistReason` очищается для всех клиентов с таким же телефоном
- Response возвращает количество обновленных записей (может быть больше 1, если клиент есть в нескольких студиях)

## 🔔 Уведомления

При создании запроса на добавление в ЧС, всем владельцам и заместителям владельцев студии отправляется уведомление типа `BLACKLIST_REQUEST`.

**Попытка записи клиента из ЧС (лендинг / Nextbot):** всем **менеджерам** филиала (`role = MANAGER`) — тип `BLACKLIST_BOOKING_ATTEMPT`. Запись не создаётся; клиент видит отказ. CRM-попытка сотрудника уведомление **не** шлёт.

**Структура уведомления BLACKLIST_BOOKING_ATTEMPT:**
```json
{
  "type": "BLACKLIST_BOOKING_ATTEMPT",
  "title": "Попытка записи из ЧС",
  "message": "Клиент из чёрного списка пытался записаться через лендинг: Иван Петров (+7999...). Причина в ЧС: ...",
  "data": "{\"clientId\":\"cli_...\",\"clientName\":\"...\",\"phone\":\"+7...\",\"sourceLabel\":\"лендинг\",\"blacklistReason\":\"...\",\"studioId\":\"stu_...\"}"
}
```

Клик в UI → карточка клиента (`data.clientId`).

**Структура уведомления BLACKLIST_REQUEST:**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "studioId": "uuid",
  "type": "BLACKLIST_REQUEST",
  "title": "Запрос на добавление в черный список",
  "message": "Мария Петрова запросил(а) добавление клиента \"Иван Иванов\" в черный список. Причина: Клиент не пришел на запись несколько раз",
  "data": "{\"blacklistRequestId\":\"uuid\",\"clientName\":\"Иван Иванов\",\"requestedByName\":\"Мария Петрова\",\"reason\":\"Клиент не пришел на запись несколько раз\"}",
  "isRead": false,
  "createdAt": "2026-02-20T19:00:00.000Z"
}
```

## 🎯 Что нужно сделать на Frontend

### 1. Обновить типы данных

```typescript
// types/client.ts

export interface Client {
  id: string;
  studioId: string;
  firstName: string;
  lastName?: string;
  phone: string;
  notes?: string;
  bonuses: number;
  discount: number;
  balance: number;
  isBlacklisted: boolean;
  blacklistReason?: string; // Причина добавления в ЧС (видна только если isBlacklisted === true)
  createdAt: string;
  updatedAt: string;
}

// types/blacklist.ts

export interface BlacklistRequest {
  id: string;
  studioId: string;
  clientId: string;
  requestedByUserId: string;
  approvedByUserId?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason: string;
  rejectedReason?: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  client: Client;
  requestedBy: User;
  approvedBy?: User;
}

export interface CreateBlacklistRequestDto {
  reason: string; // ОБЯЗАТЕЛЬНОЕ поле
}

export interface ApproveBlacklistRequestDto {
  comment?: string;
}

export interface RejectBlacklistRequestDto {
  rejectedReason?: string;
}
```

### 2. Добавить кнопку "Черный список" в карточку клиента

**Где:** В компоненте карточки клиента (`ClientCard.tsx`, `ClientDetails.tsx`, или аналогичный)

**Условия отображения:**
- Показывать только для MANAGER и ADMIN
- Показывать только если клиент НЕ в черном списке (`!client.isBlacklisted`)
- Показывать только если нет активного запроса для этого клиента

```tsx
// components/ClientCard.tsx

import { useUserRole } from '@/hooks/useUserRole';
import { UserRole } from '@/types/user';

function ClientCard({ client }: { client: Client }) {
  const userRole = useUserRole();
  const [hasPendingRequest, setHasPendingRequest] = useState(false);

  // Проверяем, может ли пользователь создавать запросы
  const canCreateRequest = userRole === UserRole.MANAGER || userRole === UserRole.ADMIN;
  
  // Проверяем, можно ли показать кнопку
  const canShowBlacklistButton = 
    canCreateRequest && 
    !client.isBlacklisted && 
    !hasPendingRequest;

  const handleCreateBlacklistRequest = async () => {
    const reason = prompt('Укажите причину добавления в черный список:');
    if (!reason || !reason.trim()) {
      alert('Причина обязательна для указания');
      return;
    }

    try {
      await createBlacklistRequest(client.id, { reason: reason.trim() });
      setHasPendingRequest(true);
      alert('Запрос на добавление в черный список отправлен владельцу');
    } catch (error: any) {
      if (error.response?.status === 400) {
        alert(error.response.data.message || 'Ошибка при создании запроса');
      } else {
        alert('Произошла ошибка');
      }
    }
  };

  return (
    <div className="client-card">
      {/* ... остальная информация о клиенте ... */}
      
      {/* Показывать причину, если клиент в ЧС */}
      {client.isBlacklisted && client.blacklistReason && (
        <div className="blacklist-badge">
          <span className="badge-danger">В черном списке</span>
          <p className="blacklist-reason">Причина: {client.blacklistReason}</p>
        </div>
      )}

      {/* Кнопка для создания запроса */}
      {canShowBlacklistButton && (
        <button 
          onClick={handleCreateBlacklistRequest}
          className="btn btn-danger"
        >
          Добавить в черный список
        </button>
      )}

      {/* Показывать статус, если есть активный запрос */}
      {hasPendingRequest && (
        <div className="pending-request-badge">
          <span className="badge-warning">Ожидает утверждения</span>
        </div>
      )}
    </div>
  );
}
```

### 3. Создать страницу/раздел "Черный список" в настройках

**Где:** В настройках студии или в отдельном разделе

**Что показывать:**
- Список всех клиентов в черном списке
- Для каждого клиента: имя, телефон, причина добавления, дата добавления
- Кнопка "Удалить из ЧС" (только для OWNER и DEPUTY_OWNER)

```tsx
// pages/BlacklistPage.tsx или components/BlacklistSettings.tsx

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
    if (!confirm('Вы уверены, что хотите удалить этого клиента из черного списка?')) {
      return;
    }

    try {
      await fetch(`/api/clients/${clientId}/blacklist/remove`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
        },
      });
      
      // Обновить список
      await loadBlacklistedClients();
      alert('Клиент удален из черного списка');
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

### 4. Создать страницу управления запросами на добавление в ЧС

**Где:** В настройках или в разделе уведомлений (для OWNER и DEPUTY_OWNER)

**Что показывать:**
- Список всех запросов со статусом PENDING
- Для каждого запроса: имя клиента, кто создал запрос, причина, дата создания
- Кнопки "Утвердить" и "Отклонить"

```tsx
// pages/BlacklistRequestsPage.tsx

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { UserRole } from '@/types/user';
import { BlacklistRequest } from '@/types/blacklist';

function BlacklistRequestsPage() {
  const { studioId } = useParams();
  const userRole = useUserRole();
  const [requests, setRequests] = useState<BlacklistRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const canApproveReject = 
    userRole === UserRole.OWNER || userRole === UserRole.DEPUTY_OWNER;

  useEffect(() => {
    if (canApproveReject) {
      loadRequests();
    }
  }, [studioId, canApproveReject]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/studios/${studioId}/blacklist/requests?status=PENDING`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
        },
      });
      const data = await response.json();
      setRequests(data);
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      await fetch(`/api/blacklist/requests/${requestId}/approve`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      
      await loadRequests();
      alert('Запрос утвержден. Клиент добавлен в черный список.');
    } catch (error) {
      alert('Ошибка при утверждении запроса');
    }
  };

  const handleReject = async (requestId: string) => {
    const rejectedReason = prompt('Укажите причину отклонения (опционально):');
    
    try {
      await fetch(`/api/blacklist/requests/${requestId}/reject`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rejectedReason: rejectedReason || undefined,
        }),
      });
      
      await loadRequests();
      alert('Запрос отклонен');
    } catch (error) {
      alert('Ошибка при отклонении запроса');
    }
  };

  if (!canApproveReject) {
    return <div>У вас нет доступа к этой странице</div>;
  }

  if (loading) {
    return <div>Загрузка...</div>;
  }

  return (
    <div className="blacklist-requests-page">
      <h2>Запросы на добавление в черный список</h2>
      
      {requests.length === 0 ? (
        <p>Нет активных запросов</p>
      ) : (
        <div className="requests-list">
          {requests.map((request) => (
            <div key={request.id} className="request-card">
              <div className="request-header">
                <h3>
                  {request.client.firstName} {request.client.lastName}
                </h3>
                <span className="badge badge-warning">Ожидает утверждения</span>
              </div>
              
              <div className="request-info">
                <p>
                  <strong>Запросил:</strong>{' '}
                  {request.requestedBy.staffProfile 
                    ? `${request.requestedBy.staffProfile.firstName} ${request.requestedBy.staffProfile.lastName || ''}`
                    : request.requestedBy.email || request.requestedBy.phone}
                </p>
                <p>
                  <strong>Причина:</strong> {request.reason}
                </p>
                <p>
                  <strong>Дата запроса:</strong>{' '}
                  {new Date(request.createdAt).toLocaleString()}
                </p>
              </div>
              
              <div className="request-actions">
                <button
                  onClick={() => handleApprove(request.id)}
                  className="btn btn-success"
                >
                  Утвердить
                </button>
                <button
                  onClick={() => handleReject(request.id)}
                  className="btn btn-danger"
                >
                  Отклонить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 5. Обработка уведомлений о запросах

При получении уведомления типа `BLACKLIST_REQUEST`, нужно:

1. Показать уведомление в колокольчике
2. При клике на уведомление - перейти на страницу управления запросами
3. Можно добавить быстрые действия (утвердить/отклонить) прямо из уведомления

```tsx
// components/NotificationItem.tsx

import { Notification } from '@/types/notification';

function NotificationItem({ notification }: { notification: Notification }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (notification.type === 'BLACKLIST_REQUEST') {
      const data = JSON.parse(notification.data || '{}');
      // Перейти на страницу запросов или открыть модальное окно
      navigate(`/studios/${notification.studioId}/blacklist/requests`);
    }
  };

  if (notification.type === 'BLACKLIST_REQUEST') {
    const data = JSON.parse(notification.data || '{}');
    
    return (
      <div className="notification-item blacklist-request" onClick={handleClick}>
        <div className="notification-icon">🚫</div>
        <div className="notification-content">
          <div className="notification-title">{notification.title}</div>
          <div className="notification-message">{notification.message}</div>
          <div className="notification-actions">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleQuickApprove(data.blacklistRequestId);
              }}
              className="btn btn-sm btn-success"
            >
              Утвердить
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleQuickReject(data.blacklistRequestId);
              }}
              className="btn btn-sm btn-danger"
            >
              Отклонить
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ... обработка других типов уведомлений
}
```

### 6. Обновить отображение клиента в списке

В списке клиентов нужно визуально выделять клиентов в черном списке:

```tsx
// components/ClientList.tsx

function ClientListItem({ client }: { client: Client }) {
  return (
    <div className={`client-item ${client.isBlacklisted ? 'blacklisted' : ''}`}>
      <div className="client-info">
        <h3>
          {client.firstName} {client.lastName}
          {client.isBlacklisted && (
            <span className="badge badge-danger">В ЧС</span>
          )}
        </h3>
        <p>{client.phone}</p>
        {client.isBlacklisted && client.blacklistReason && (
          <p className="blacklist-reason">
            <small>Причина: {client.blacklistReason}</small>
          </p>
        )}
      </div>
    </div>
  );
}
```

## 🎨 UI/UX Рекомендации

1. **Визуальное выделение:**
   - Клиенты в ЧС должны быть визуально выделены (красная рамка, серый фон, иконка предупреждения)
   - Использовать badge "В ЧС" или "Blacklisted"

2. **Модальные окна:**
   - При создании запроса использовать модальное окно с текстовым полем для причины
   - При утверждении/отклонении можно использовать модальное окно с подтверждением

3. **Уведомления:**
   - Показывать toast-уведомления при успешных операциях
   - Показывать ошибки в понятном виде

4. **Фильтрация:**
   - В списке клиентов добавить фильтр "Показать только в ЧС"
   - В списке запросов фильтр по статусу уже есть в API

5. **Защита от случайных действий:**
   - При удалении из ЧС показывать подтверждение
   - При утверждении/отклонении можно добавить подтверждение

## ⚠️ Важные моменты

1. **Причина обязательна:** При создании запроса поле `reason` обязательно. Нельзя создать запрос без причины.

2. **Проверка на пользователей системы:** Если клиент имеет тот же телефон, что и пользователь системы, запрос будет отклонен. Показывайте понятное сообщение об ошибке.

3. **Статусы запросов:**
   - `PENDING` - ожидает утверждения
   - `APPROVED` - утвержден, клиент в ЧС
   - `REJECTED` - отклонен

4. **Причина в карточке клиента:** После одобрения запроса, причина сохраняется в поле `blacklistReason` клиента и всегда видна в его карточке.

5. **Удаление из ЧС:** При удалении клиента из ЧС, поле `blacklistReason` очищается, и клиент становится обычным.

6. **🆕 Синхронизация черного списка между студиями:**
   - **ВАЖНО:** При одобрении запроса на добавление в ЧС, клиент автоматически добавляется в черный список **во всех студиях**, где он зарегистрирован (по телефону)
   - При удалении клиента из ЧС одного салона, он автоматически удаляется из ЧС **всех салонов**
   - Это означает, что если клиент зарегистрирован в нескольких студиях с одним телефоном, при добавлении в ЧС он будет заблокирован везде одновременно
   - На фронтенде это должно работать автоматически - никаких дополнительных действий не требуется

## 📝 Примеры использования API

### Создание запроса

```typescript
async function createBlacklistRequest(clientId: string, reason: string) {
  const response = await fetch(`/api/clients/${clientId}/blacklist/request`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
}
```

### Утверждение запроса

```typescript
async function approveBlacklistRequest(requestId: string) {
  const response = await fetch(`/api/blacklist/requests/${requestId}/approve`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error('Failed to approve request');
  }

  return response.json();
}
```

### Удаление из ЧС

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

  return response.json();
}
```

## 🆕 Обновления функциональности

### Синхронизация черного списка между студиями

**Важное изменение:** Теперь черный список синхронизируется между всеми студиями по телефону клиента.

**Как это работает:**
1. Клиент может быть зарегистрирован в нескольких студиях с одним и тем же телефоном
2. При одобрении запроса на добавление в ЧС одного салона:
   - Система находит всех клиентов с таким же телефоном во всех студиях
   - Все они автоматически добавляются в черный список с той же причиной
3. При удалении из ЧС одного салона:
   - Система находит всех клиентов с таким же телефоном во всех студиях
   - Все они автоматически удаляются из черного списка

**Что это значит для фронтенда:**
- Никаких дополнительных действий не требуется - синхронизация происходит автоматически на бэкенде
- Если клиент зарегистрирован в нескольких студиях, при просмотре списка клиентов в ЧС вы увидите его во всех студиях
- При удалении из ЧС одного салона, клиент исчезнет из ЧС всех салонов

**Пример сценария:**
1. Клиент "Иван Иванов" с телефоном "+79991234567" зарегистрирован в Студии A и Студии B
2. Менеджер Студии A создает запрос на добавление в ЧС с причиной "Не пришел на запись"
3. Владелец Студии A одобряет запрос
4. Результат: Клиент "Иван Иванов" автоматически добавляется в ЧС и в Студии A, и в Студии B с причиной "Не пришел на запись"
5. При просмотре ЧС в Студии B, владелец увидит этого клиента в списке

## ✅ Чек-лист реализации

- [ ] Обновлены типы данных (Client, BlacklistRequest)
- [ ] Добавлена кнопка "Черный список" в карточку клиента (для MANAGER/ADMIN)
- [ ] Создана страница/раздел "Черный список" в настройках
- [ ] Создана страница управления запросами (для OWNER/DEPUTY_OWNER)
- [ ] Реализована обработка уведомлений о запросах
- [ ] Обновлено отображение клиентов в списке (визуальное выделение)
- [ ] Добавлена проверка прав доступа для всех действий
- [ ] Реализованы модальные окна для создания запросов
- [ ] Добавлены подтверждения для критических действий
- [ ] Протестированы все сценарии использования
- [ ] **🆕 Учтена синхронизация черного списка между студиями** - клиенты автоматически добавляются/удаляются во всех студиях

