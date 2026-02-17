# Подробный гайд: Редактирование профиля клиента для Lovable

## Контекст
Нужно реализовать функционал редактирования профиля клиента. В профиле можно редактировать:
- Имя (firstName)
- Фамилия (lastName)
- Телефон (phone)
- Заметки (notes)

**Важно:** Телефон должен быть уникальным в рамках студии. При попытке изменить телефон на уже существующий, будет возвращена ошибка.

---

## 📍 API Endpoints

### 1. Получить профиль клиента

**GET** `https://aidaproject-production.up.railway.app/clients/:id`

**Полный URL пример:**
```
GET https://aidaproject-production.up.railway.app/clients/123e4567-e89b-12d3-a456-426614174000
```

**Важно:** Замени `:id` на реальный ID клиента.

---

### 2. Обновить профиль клиента

**PATCH** `https://aidaproject-production.up.railway.app/clients/:id`

**Полный URL пример:**
```
PATCH https://aidaproject-production.up.railway.app/clients/123e4567-e89b-12d3-a456-426614174000
```

---

## 🔑 Обязательные заголовки (Headers)

Каждый запрос должен содержать:

```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Где взять accessToken:**
- После успешного логина через `/auth/login`
- Токен хранится в localStorage или state
- Токен действителен 15 минут, затем нужно обновить через `/auth/refresh`

---

## 📥 Получение профиля клиента (GET)

### Response 200:

```json
{
  "id": "client-uuid",
  "studioId": "studio-uuid",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+79991234567",
  "notes": "Тестовый клиент",
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:00.000Z",
  "studio": {
    "id": "studio-uuid",
    "name": "Beauty Studio Moscow"
  }
}
```

### Возможные ошибки:

- **403 Forbidden** - нет доступа к этому клиенту
- **404 Not Found** - клиент не найден

---

## 📤 Обновление профиля клиента (PATCH)

### Request Body:

**Все поля опциональны** - можно обновлять только нужные поля.

```json
{
  "firstName": "Иван",
  "lastName": "Петров",
  "phone": "+79991234568",
  "notes": "Обновленные заметки о клиенте"
}
```

### Минимальный пример (только одно поле):

```json
{
  "notes": "Новые заметки"
}
```

### Пример очистки поля (удаление значения):

Чтобы удалить значение поля `notes`, отправь `null`:

```json
{
  "notes": null
}
```

**Важно:** Поля `firstName` и `phone` не могут быть пустыми (они обязательны при создании, но при обновлении можно не отправлять, если не меняются).

### Response 200:

```json
{
  "id": "client-uuid",
  "studioId": "studio-uuid",
  "firstName": "Иван",
  "lastName": "Петров",
  "phone": "+79991234568",
  "notes": "Обновленные заметки о клиенте",
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T11:00:00.000Z"
}
```

### Возможные ошибки:

- **400 Bad Request** - клиент с таким телефоном уже существует в этой студии
- **403 Forbidden** - нет доступа к этому клиенту
- **404 Not Found** - клиент не найден

**Пример ошибки 400:**
```json
{
  "statusCode": 400,
  "message": "Client with this phone already exists in this studio",
  "error": "Bad Request"
}
```

---

## 🎨 UI Требования

### Страница редактирования профиля клиента должна содержать:

1. **Имя (firstName)**
   - Текстовое поле
   - Обязательное поле (при создании)
   - При редактировании можно оставить без изменений

2. **Фамилия (lastName)**
   - Текстовое поле
   - Опциональное поле

3. **Телефон (phone)**
   - Текстовое поле
   - Обязательное поле (при создании)
   - При редактировании можно оставить без изменений
   - **Важно:** При изменении телефона проверяется уникальность в рамках студии

4. **Заметки (notes)**
   - Многострочное текстовое поле (textarea)
   - Опциональное поле
   - Можно очистить (отправить `null`)

5. **Кнопки действий**
   - "Сохранить" - отправляет PATCH запрос
   - "Отмена" - закрывает модальное окно без сохранения
   - Показывать индикатор загрузки во время сохранения

### Дополнительная информация (только для чтения):

- ID клиента
- Дата создания (createdAt)
- Дата последнего обновления (updatedAt)
- Студия (studio.name)

---

## 💻 Примеры кода для Frontend

### TypeScript интерфейсы:

```typescript
interface Client {
  id: string;
  studioId: string;
  firstName: string;
  lastName?: string;
  phone: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  studio?: {
    id: string;
    name: string;
  };
}

interface UpdateClientDto {
  firstName?: string;
  lastName?: string | null;
  phone?: string;
  notes?: string | null;
}
```

### React компонент для загрузки профиля клиента:

```typescript
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

function useClient(clientId: string) {
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    
    fetch(`https://aidaproject-production.up.railway.app/clients/${clientId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('Клиент не найден');
          }
          if (res.status === 403) {
            throw new Error('Нет доступа к этому клиенту');
          }
          throw new Error('Ошибка загрузки профиля клиента');
        }
        return res.json();
      })
      .then((data) => {
        setClient(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [clientId]);

  return { client, loading, error };
}
```

### React компонент формы редактирования:

```typescript
import { useState, useEffect } from 'react';

interface EditClientFormProps {
  clientId: string;
  initialData: Client;
  onSuccess?: () => void;
  onCancel?: () => void;
}

function EditClientForm({ 
  clientId, 
  initialData, 
  onSuccess, 
  onCancel 
}: EditClientFormProps) {
  const [formData, setFormData] = useState<UpdateClientDto>({
    firstName: initialData.firstName,
    lastName: initialData.lastName || '',
    phone: initialData.phone,
    notes: initialData.notes || '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('accessToken');
    
    // Подготовка данных для отправки
    const updateData: UpdateClientDto = {};
    
    // Добавляем только измененные поля
    if (formData.firstName !== initialData.firstName) {
      updateData.firstName = formData.firstName;
    }
    if (formData.lastName !== (initialData.lastName || '')) {
      updateData.lastName = formData.lastName || null;
    }
    if (formData.phone !== initialData.phone) {
      updateData.phone = formData.phone;
    }
    if (formData.notes !== (initialData.notes || '')) {
      updateData.notes = formData.notes || null;
    }

    // Если ничего не изменилось, не отправляем запрос
    if (Object.keys(updateData).length === 0) {
      setLoading(false);
      if (onCancel) {
        onCancel();
      }
      return;
    }

    try {
      const response = await fetch(
        `https://aidaproject-production.up.railway.app/clients/${clientId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(updateData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 400) {
          throw new Error(
            errorData.message || 'Клиент с таким телефоном уже существует'
          );
        }
        if (response.status === 403) {
          throw new Error('Нет доступа к этому клиенту');
        }
        if (response.status === 404) {
          throw new Error('Клиент не найден');
        }
        throw new Error('Ошибка при обновлении клиента');
      }

      const updatedClient = await response.json();
      setLoading(false);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="edit-client-form">
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      {/* Имя */}
      <div className="form-group">
        <label htmlFor="firstName">
          Имя <span className="required">*</span>
        </label>
        <input
          id="firstName"
          type="text"
          value={formData.firstName || ''}
          onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
          required
          disabled={loading}
        />
      </div>

      {/* Фамилия */}
      <div className="form-group">
        <label htmlFor="lastName">Фамилия</label>
        <input
          id="lastName"
          type="text"
          value={formData.lastName || ''}
          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
          disabled={loading}
        />
      </div>

      {/* Телефон */}
      <div className="form-group">
        <label htmlFor="phone">
          Телефон <span className="required">*</span>
        </label>
        <input
          id="phone"
          type="tel"
          value={formData.phone || ''}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          required
          disabled={loading}
          placeholder="+79991234567"
        />
        <small className="help-text">
          Телефон должен быть уникальным в рамках студии
        </small>
      </div>

      {/* Заметки */}
      <div className="form-group">
        <label htmlFor="notes">Заметки</label>
        <textarea
          id="notes"
          value={formData.notes || ''}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={5}
          disabled={loading}
          placeholder="Дополнительная информация о клиенте..."
        />
      </div>

      {/* Кнопки действий */}
      <div className="form-actions">
        <button 
          type="submit" 
          disabled={loading}
          className="btn-primary"
        >
          {loading ? 'Сохранение...' : 'Сохранить'}
        </button>
        {onCancel && (
          <button 
            type="button" 
            onClick={onCancel} 
            disabled={loading}
            className="btn-secondary"
          >
            Отмена
          </button>
        )}
      </div>
    </form>
  );
}
```

### Пример использования компонента:

```typescript
function ClientProfilePage() {
  const { clientId } = useParams<{ clientId: string }>();
  const [editMode, setEditMode] = useState(false);
  const { client, loading, error, refetch } = useClient(clientId || '');

  if (loading) return <div>Загрузка...</div>;
  if (error) return <div>Ошибка: {error}</div>;
  if (!client) return <div>Клиент не найден</div>;

  if (editMode) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <div className="modal-header">
            <h2>Редактировать клиента</h2>
            <button 
              onClick={() => setEditMode(false)}
              className="close-button"
            >
              ×
            </button>
          </div>
          <EditClientForm
            clientId={clientId || ''}
            initialData={client}
            onSuccess={() => {
              setEditMode(false);
              refetch(); // Обновить данные
            }}
            onCancel={() => setEditMode(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="client-profile-view">
      {/* Отображение профиля */}
      <button onClick={() => setEditMode(true)}>Редактировать</button>
      {/* ... остальной код отображения ... */}
    </div>
  );
}
```

---

## ✅ Валидация

### На Frontend нужно валидировать:

1. **Имя (firstName)**
   - Обязательное поле
   - Не может быть пустым

2. **Телефон (phone)**
   - Обязательное поле
   - Не может быть пустым
   - Рекомендуется проверять формат (например, начинается с +)

3. **Заметки (notes)**
   - Опциональное поле
   - Можно ограничить длину (например, максимум 1000 символов)

---

## 🐛 Обработка ошибок

### Типичные ошибки и их обработка:

1. **401 Unauthorized**
   - Токен истек или неверный
   - Решение: перенаправить на страницу входа

2. **403 Forbidden**
   - Нет доступа к этому клиенту
   - Решение: показать сообщение "Нет доступа"

3. **404 Not Found**
   - Клиент не найден
   - Решение: показать сообщение "Клиент не найден"

4. **400 Bad Request**
   - Клиент с таким телефоном уже существует
   - Решение: показать сообщение "Клиент с таким телефоном уже существует в этой студии"

5. **500 Internal Server Error**
   - Ошибка на сервере
   - Решение: показать сообщение "Ошибка сервера, попробуйте позже"

### Пример обработки ошибок:

```typescript
try {
  const response = await fetch(/* ... */);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    
    switch (response.status) {
      case 400:
        // Обработка ошибки валидации
        setError(errorData.message || 'Неверные данные');
        break;
      case 401:
        // Токен истек
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        break;
      case 403:
        setError('Нет доступа к этому клиенту');
        break;
      case 404:
        setError('Клиент не найден');
        break;
      default:
        setError('Ошибка при обновлении клиента');
    }
    return;
  }
  
  // Успешное обновление
  const updatedClient = await response.json();
  // ...
} catch (err) {
  setError('Ошибка сети. Проверьте подключение к интернету');
}
```

---

## 📝 Примечания

1. **База URL:** Все запросы идут на `https://aidaproject-production.up.railway.app`

2. **Токен:** Токен должен быть актуальным. Если истек, нужно обновить через `/auth/refresh`

3. **Опциональные поля:** Все поля при обновлении опциональны, но `firstName` и `phone` обязательны при создании

4. **Уникальность телефона:** Телефон должен быть уникальным в рамках студии. При попытке изменить телефон на уже существующий, будет возвращена ошибка 400

5. **Очистка полей:** Чтобы удалить значение поля `notes`, отправь `null`

6. **Успешное обновление:** После успешного обновления рекомендуется перезагрузить данные клиента, чтобы получить актуальную информацию

7. **Частичное обновление:** Можно обновлять только нужные поля. Не обязательно отправлять все поля

---

## 🔍 Диагностика проблем

### Если возникает ошибка "Не удалось обновить клиента":

1. **Проверь токен авторизации:**
   - Убедись, что токен актуален
   - Проверь, что токен отправляется в заголовке `Authorization: Bearer <token>`

2. **Проверь формат запроса:**
   - Убедись, что используется метод `PATCH` (не `PUT` или `POST`)
   - Проверь, что заголовок `Content-Type: application/json` установлен
   - Проверь, что тело запроса - валидный JSON

3. **Проверь ID клиента:**
   - Убедись, что ID клиента корректен
   - Проверь, что клиент существует и доступен текущему пользователю

4. **Проверь уникальность телефона:**
   - Если меняешь телефон, убедись, что такого телефона нет у другого клиента в этой студии

5. **Проверь консоль браузера:**
   - Открой DevTools (F12) → вкладка Network
   - Посмотри на запрос и ответ
   - Проверь статус код и тело ответа

6. **Проверь логи сервера:**
   - Если есть доступ к логам Railway, проверь их на наличие ошибок

### Пример правильного запроса:

```javascript
fetch('https://aidaproject-production.up.railway.app/clients/123e4567-e89b-12d3-a456-426614174000', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  },
  body: JSON.stringify({
    firstName: 'Иван',
    lastName: 'Петров',
    phone: '+79991234568',
    notes: 'Обновленные заметки'
  })
})
```






