# Добавление новых клиентов из журнала записей

## Обзор

В разделе "Журнал записей" (Appointments Journal) нужно добавить возможность создавать новых клиентов прямо при создании записи. Когда пользователь вводит имя, фамилию или номер телефона, система должна искать существующих клиентов. Если клиент не найден или найден не тот клиент, должна появиться кнопка для добавления нового клиента в базу данных.

---

## 🎯 Функционал

### Сценарий использования:

1. Пользователь открывает форму создания записи в журнале
2. Пользователь начинает вводить имя, фамилию или номер телефона в поле поиска клиента
3. Система автоматически ищет клиентов по введённым данным
4. Если клиент найден — показывается список найденных клиентов для выбора
5. Если клиент не найден или найден не тот клиент — показывается кнопка "Добавить нового клиента"
6. При нажатии на кнопку открывается форма создания нового клиента
7. После создания клиент автоматически выбирается для записи

---

## 🔌 API Endpoints

### 1. Поиск клиентов

**Endpoint:** `GET /studios/:studioId/clients?q=query`

**Описание:** Ищет клиентов по имени, фамилии или номеру телефона (case-insensitive, частичное совпадение).

**Параметры:**
- `studioId` (path) - UUID студии
- `q` (query) - поисковый запрос (имя, фамилия или телефон)

**Заголовки:**
```
Authorization: Bearer {token}
```

**Пример запроса:**
```javascript
// Поиск по имени
GET /studios/123e4567-e89b-12d3-a456-426614174000/clients?q=Иван

// Поиск по фамилии
GET /studios/123e4567-e89b-12d3-a456-426614174000/clients?q=Иванов

// Поиск по телефону
GET /studios/123e4567-e89b-12d3-a456-426614174000/clients?q=+77001234567
```

**Пример ответа (200 OK):**
```json
[
  {
    "id": "client-uuid-1",
    "studioId": "studio-uuid",
    "firstName": "Иван",
    "lastName": "Иванов",
    "phone": "+77001234567",
    "notes": "Постоянный клиент",
    "bonuses": 100,
    "discount": 10,
    "balance": 5000,
    "createdAt": "2024-01-15T10:00:00.000+06:00",
    "updatedAt": "2024-01-15T10:00:00.000+06:00"
  },
  {
    "id": "client-uuid-2",
    "studioId": "studio-uuid",
    "firstName": "Иван",
    "lastName": "Петров",
    "phone": "+77009876543",
    "notes": null,
    "bonuses": 0,
    "discount": 0,
    "balance": 0,
    "createdAt": "2024-02-10T14:30:00.000+06:00",
    "updatedAt": "2024-02-10T14:30:00.000+06:00"
  }
]
```

**Если клиенты не найдены:**
```json
[]
```

---

### 2. Создание нового клиента

**Endpoint:** `POST /studios/:studioId/clients`

**Описание:** Создаёт нового клиента в студии. Проверяет уникальность телефона в рамках студии.

**Параметры:**
- `studioId` (path) - UUID студии

**Тело запроса:**
```json
{
  "firstName": "Иван",
  "lastName": "Иванов",
  "phone": "+77001234567",
  "notes": "Новый клиент",
  "bonuses": 0,
  "discount": 0,
  "balance": 0
}
```

**Обязательные поля:**
- `firstName` (string) - имя клиента
- `lastName` (string) - фамилия клиента
- `phone` (string) - номер телефона (должен быть уникальным в рамках студии)

**Опциональные поля:**
- `notes` (string) - заметки о клиенте
- `bonuses` (number) - бонусные баллы (по умолчанию 0)
- `discount` (number) - скидка в процентах 0-100 (по умолчанию 0)
- `balance` (number) - баланс в тенге (по умолчанию 0)

**Заголовки:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Пример запроса:**
```javascript
POST /studios/123e4567-e89b-12d3-a456-426614174000/clients
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "firstName": "Иван",
  "lastName": "Иванов",
  "phone": "+77001234567",
  "notes": "Новый клиент из журнала записей"
}
```

**Пример ответа (201 Created):**
```json
{
  "id": "new-client-uuid",
  "studioId": "studio-uuid",
  "firstName": "Иван",
  "lastName": "Иванов",
  "phone": "+77001234567",
  "notes": "Новый клиент из журнала записей",
  "bonuses": 0,
  "discount": 0,
  "balance": 0,
  "createdAt": "2024-02-15T15:30:00.000+06:00",
  "updatedAt": "2024-02-15T15:30:00.000+06:00"
}
```

**Ошибки:**

**400 Bad Request** - Клиент с таким телефоном уже существует:
```json
{
  "statusCode": 400,
  "message": "Client with this phone already exists in this studio",
  "error": "Bad Request"
}
```

**403 Forbidden** - Нет доступа к студии:
```json
{
  "statusCode": 403,
  "message": "Access denied to this studio",
  "error": "Forbidden"
}
```

---

## 💻 Реализация на Frontend

### Шаг 1: Компонент поиска клиента

Создайте компонент поиска клиента с автодополнением:

```typescript
// ClientSearch.tsx
import { useState, useEffect } from 'react';
import { useDebounce } from '@/hooks/useDebounce';

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  notes?: string;
  bonuses: number;
  discount: number;
  balance: number;
}

interface ClientSearchProps {
  studioId: string;
  onClientSelect: (client: Client) => void;
  onNewClientClick: () => void;
}

export function ClientSearch({ studioId, onClientSelect, onNewClientClick }: ClientSearchProps) {
  const [query, setQuery] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery.trim().length >= 2) {
      searchClients(debouncedQuery);
    } else {
      setClients([]);
    }
  }, [debouncedQuery, studioId]);

  const searchClients = async (searchQuery: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/studios/${studioId}/clients?q=${encodeURIComponent(searchQuery)}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      }
    } catch (error) {
      console.error('Error searching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClientSelect = (client: Client) => {
    onClientSelect(client);
    setQuery(`${client.firstName} ${client.lastName} (${client.phone})`);
    setClients([]);
  };

  const showAddButton = debouncedQuery.trim().length >= 2 && clients.length === 0;

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Введите имя, фамилию или телефон..."
        className="w-full px-4 py-2 border rounded-lg"
      />
      
      {loading && (
        <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-1 p-2">
          Поиск...
        </div>
      )}

      {!loading && clients.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto z-10">
          {clients.map((client) => (
            <button
              key={client.id}
              onClick={() => handleClientSelect(client)}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 border-b last:border-b-0"
            >
              <div className="font-medium">
                {client.firstName} {client.lastName}
              </div>
              <div className="text-sm text-gray-500">{client.phone}</div>
            </button>
          ))}
        </div>
      )}

      {showAddButton && (
        <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-1 p-4 z-10">
          <p className="text-sm text-gray-600 mb-2">
            Клиент не найден. Хотите добавить нового клиента?
          </p>
          <button
            onClick={onNewClientClick}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            + Добавить нового клиента
          </button>
        </div>
      )}
    </div>
  );
}
```

### Шаг 2: Компонент формы создания клиента

```typescript
// CreateClientForm.tsx
import { useState } from 'react';

interface CreateClientFormProps {
  studioId: string;
  initialData?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
  onSuccess: (client: Client) => void;
  onCancel: () => void;
}

export function CreateClientForm({ 
  studioId, 
  initialData, 
  onSuccess, 
  onCancel 
}: CreateClientFormProps) {
  const [formData, setFormData] = useState({
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    phone: initialData?.phone || '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/studios/${studioId}/clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const newClient = await response.json();
        onSuccess(newClient);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Ошибка при создании клиента');
      }
    } catch (error) {
      setError('Произошла ошибка при создании клиента');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Имя *</label>
        <input
          type="text"
          value={formData.firstName}
          onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
          required
          className="w-full px-4 py-2 border rounded-lg"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Фамилия *</label>
        <input
          type="text"
          value={formData.lastName}
          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
          required
          className="w-full px-4 py-2 border rounded-lg"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Телефон *</label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          required
          className="w-full px-4 py-2 border rounded-lg"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Заметки</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full px-4 py-2 border rounded-lg"
          rows={3}
        />
      </div>

      {error && (
        <div className="text-red-500 text-sm">{error}</div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Создание...' : 'Создать клиента'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border rounded-lg hover:bg-gray-100"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
```

### Шаг 3: Интеграция в форму создания записи

```typescript
// CreateAppointmentForm.tsx
import { useState } from 'react';
import { ClientSearch } from './ClientSearch';
import { CreateClientForm } from './CreateClientForm';

export function CreateAppointmentForm({ studioId }: { studioId: string }) {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showCreateClientForm, setShowCreateClientForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    setShowCreateClientForm(false);
  };

  const handleNewClientClick = () => {
    setShowCreateClientForm(true);
  };

  const handleClientCreated = (newClient: Client) => {
    setSelectedClient(newClient);
    setShowCreateClientForm(false);
    // Можно автоматически заполнить форму записи
  };

  return (
    <div className="space-y-4">
      {!showCreateClientForm ? (
        <>
          <div>
            <label className="block text-sm font-medium mb-2">Клиент *</label>
            {selectedClient ? (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium">
                    {selectedClient.firstName} {selectedClient.lastName}
                  </div>
                  <div className="text-sm text-gray-500">{selectedClient.phone}</div>
                </div>
                <button
                  onClick={() => setSelectedClient(null)}
                  className="text-sm text-blue-500 hover:text-blue-700"
                >
                  Изменить
                </button>
              </div>
            ) : (
              <ClientSearch
                studioId={studioId}
                onClientSelect={handleClientSelect}
                onNewClientClick={handleNewClientClick}
              />
            )}
          </div>

          {/* Остальные поля формы записи */}
        </>
      ) : (
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-medium mb-4">Добавить нового клиента</h3>
          <CreateClientForm
            studioId={studioId}
            initialData={{
              // Можно извлечь данные из поискового запроса, если возможно
            }}
            onSuccess={handleClientCreated}
            onCancel={() => setShowCreateClientForm(false)}
          />
        </div>
      )}
    </div>
  );
}
```

---

## ✅ Важные замечания

1. **Debounce для поиска:** Используйте debounce (300-500ms) для поиска клиентов, чтобы не отправлять запросы при каждом нажатии клавиши.

2. **Минимальная длина запроса:** Начинайте поиск только после ввода минимум 2-3 символов.

3. **Обработка ошибок:** Обрабатывайте случай, когда клиент с таким телефоном уже существует (400 ошибка).

4. **Автоматическое заполнение:** При открытии формы создания клиента из поиска, можно предзаполнить поля данными из поискового запроса (если возможно извлечь имя, фамилию, телефон).

5. **Валидация телефона:** Убедитесь, что телефон в правильном формате (например, +77001234567).

6. **Автоматический выбор:** После создания клиента автоматически выбирайте его для записи.

7. **UX улучшения:**
   - Показывайте индикатор загрузки во время поиска
   - Показывайте сообщение "Клиент не найден" только если поиск завершён и результатов нет
   - Добавьте возможность отменить выбор клиента и вернуться к поиску

---

## 🎨 Пример UI/UX

```
┌─────────────────────────────────────────┐
│ Журнал записей - Создать запись        │
├─────────────────────────────────────────┤
│                                         │
│ Клиент *                                │
│ ┌─────────────────────────────────────┐ │
│ │ Иван Иванов                         │ │ ← Поле поиска
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Иван Иванов                         │ │ ← Результаты поиска
│ │ +77001234567                        │ │
│ ├─────────────────────────────────────┤ │
│ │ Иван Петров                         │ │
│ │ +77009876543                        │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ИЛИ (если не найдено):                  │
│ ┌─────────────────────────────────────┐ │
│ │ Клиент не найден. Хотите добавить   │ │
│ │ нового клиента?                     │ │
│ │ [ + Добавить нового клиента ]       │ │
│ └─────────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

---

## 📝 Чеклист реализации

- [ ] Создать компонент `ClientSearch` с автодополнением
- [ ] Добавить debounce для поиска (300ms)
- [ ] Реализовать отображение результатов поиска
- [ ] Добавить кнопку "Добавить нового клиента" когда клиент не найден
- [ ] Создать компонент `CreateClientForm`
- [ ] Интегрировать форму создания клиента в форму записи
- [ ] Обработать ошибки (400, 403)
- [ ] Автоматически выбирать созданного клиента
- [ ] Добавить возможность отменить выбор клиента
- [ ] Добавить индикаторы загрузки
- [ ] Протестировать с разными сценариями (клиент найден, не найден, ошибка создания)

---

## 🔗 Связанные документы

- [Карточка клиента](./LOVABLE_CLIENT_CARD.md) - для понимания структуры данных клиента
- [Создание записи](./LOVABLE_APPOINTMENT_TIMEZONE_FIX.md) - для интеграции с формой записи

