# Подробный гайд: Удаление сотрудника для Lovable

## Контекст
Нужно реализовать функционал удаления сотрудника (мастера или менеджера) из системы. При удалении сотрудника автоматически удаляются все связанные данные:
- Профиль сотрудника
- График работы
- Занятые слоты
- Записи (appointments)
- Связи с услугами

**Важно:** 
- Удалить OWNER нельзя
- Удалять может только OWNER или пользователь той же студии
- Удаление необратимо - все данные будут удалены навсегда

---

## 📍 API Endpoint

### Удаление сотрудника

**DELETE** `https://aidaproject-production.up.railway.app/staff/:userId`

**Полный URL пример:**
```
DELETE https://aidaproject-production.up.railway.app/staff/123e4567-e89b-12d3-a456-426614174000
```

**Важно:** Замени `:userId` на реальный ID сотрудника.

---

## 🔑 Обязательные заголовки (Headers)

Запрос должен содержать:

```
Authorization: Bearer <accessToken>
```

**Где взять accessToken:**
- После успешного логина через `/auth/login`
- Токен хранится в localStorage или state
- Токен действителен 15 минут, затем нужно обновить через `/auth/refresh`

---

## 📤 Удаление сотрудника (DELETE)

### Response 200:

```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "phone": "+79991234567",
  "role": "MASTER",
  "studioId": "studio-uuid",
  "isActive": true,
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:00.000Z"
}
```

### Возможные ошибки:

- **400 Bad Request** - нельзя удалить OWNER
  ```json
  {
    "statusCode": 400,
    "message": "Cannot delete OWNER role",
    "error": "Bad Request"
  }
  ```

- **403 Forbidden** - нет доступа к этому сотруднику
  ```json
  {
    "statusCode": 403,
    "message": "Access denied to this user",
    "error": "Forbidden"
  }
  ```

- **404 Not Found** - сотрудник не найден
  ```json
  {
    "statusCode": 404,
    "message": "User with ID {userId} not found",
    "error": "Not Found"
  }
  ```

---

## 🎨 UI Требования

### Кнопка удаления должна:

1. **Располагаться в профиле сотрудника или списке сотрудников**
   - Рекомендуется в меню действий (три точки) или отдельная кнопка "Удалить"

2. **Показывать подтверждение перед удалением**
   - Модальное окно с предупреждением
   - Текст: "Вы уверены, что хотите удалить этого сотрудника? Это действие необратимо."
   - Кнопки: "Отмена" и "Удалить"

3. **Показывать индикатор загрузки во время удаления**

4. **После успешного удаления:**
   - Закрыть модальное окно/профиль
   - Обновить список сотрудников
   - Показать уведомление об успешном удалении

5. **При ошибке:**
   - Показать сообщение об ошибке
   - Не закрывать модальное окно

---

## 💻 Примеры кода для Frontend

### TypeScript интерфейсы:

```typescript
interface DeleteStaffResponse {
  id: string;
  email?: string;
  phone?: string;
  role: 'MASTER' | 'MANAGER' | 'OWNER';
  studioId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### React компонент для удаления сотрудника:

```typescript
import { useState } from 'react';

interface DeleteStaffButtonProps {
  userId: string;
  staffName: string;
  onSuccess?: () => void;
}

function DeleteStaffButton({ userId, staffName, onSuccess }: DeleteStaffButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(
        `https://aidaproject-production.up.railway.app/staff/${userId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 400) {
          throw new Error(errorData.message || 'Нельзя удалить этого сотрудника');
        }
        if (response.status === 403) {
          throw new Error('Нет доступа к этому сотруднику');
        }
        if (response.status === 404) {
          throw new Error('Сотрудник не найден');
        }
        throw new Error('Ошибка при удалении сотрудника');
      }

      const deletedStaff = await response.json();
      setLoading(false);
      setShowConfirm(false);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="btn-danger"
        disabled={loading}
      >
        Удалить сотрудника
      </button>

      {showConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Подтверждение удаления</h2>
              <button
                onClick={() => {
                  setShowConfirm(false);
                  setError(null);
                }}
                className="close-button"
                disabled={loading}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              {error && (
                <div className="error-message" role="alert">
                  {error}
                </div>
              )}
              
              <p>
                Вы уверены, что хотите удалить сотрудника <strong>{staffName}</strong>?
              </p>
              <p className="warning-text">
                Это действие необратимо. Будут удалены:
              </p>
              <ul className="warning-list">
                <li>Профиль сотрудника</li>
                <li>График работы</li>
                <li>Занятые слоты</li>
                <li>Записи (appointments)</li>
                <li>Связи с услугами</li>
              </ul>
            </div>

            <div className="modal-footer">
              <button
                onClick={() => {
                  setShowConfirm(false);
                  setError(null);
                }}
                disabled={loading}
                className="btn-secondary"
              >
                Отмена
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="btn-danger"
              >
                {loading ? 'Удаление...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

### Пример использования в списке сотрудников:

```typescript
function StaffList() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  const handleDeleteSuccess = () => {
    // Обновить список сотрудников
    fetchStaffList();
    // Показать уведомление
    showNotification('Сотрудник успешно удален', 'success');
  };

  const fetchStaffList = async () => {
    // ... код загрузки списка
  };

  return (
    <div className="staff-list">
      {staff.map((member) => (
        <div key={member.id} className="staff-card">
          <div className="staff-info">
            <h3>{member.staffProfile.firstName} {member.staffProfile.lastName}</h3>
            <p>{member.role === 'MASTER' ? 'Мастер' : 'Менеджер'}</p>
          </div>
          <div className="staff-actions">
            <DeleteStaffButton
              userId={member.id}
              staffName={`${member.staffProfile.firstName} ${member.staffProfile.lastName}`}
              onSuccess={handleDeleteSuccess}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Пример использования в профиле сотрудника:

```typescript
function StaffProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { profile, loading } = useStaffProfile(userId || '');

  const handleDeleteSuccess = () => {
    // Перенаправить на список сотрудников
    navigate('/staff');
    // Показать уведомление
    showNotification('Сотрудник успешно удален', 'success');
  };

  if (loading) return <div>Загрузка...</div>;
  if (!profile) return <div>Профиль не найден</div>;

  return (
    <div className="staff-profile">
      {/* ... остальной контент профиля ... */}
      
      <div className="profile-actions">
        <button onClick={() => navigate(`/staff/${userId}/edit`)}>
          Редактировать
        </button>
        <DeleteStaffButton
          userId={userId || ''}
          staffName={`${profile.staffProfile.firstName} ${profile.staffProfile.lastName}`}
          onSuccess={handleDeleteSuccess}
        />
      </div>
    </div>
  );
}
```

---

## ✅ Валидация и проверки

### На Frontend нужно проверить:

1. **Роль сотрудника:**
   - Если роль OWNER, кнопка удаления не должна отображаться или должна быть неактивна
   - Можно проверить это на фронтенде, чтобы не показывать кнопку

2. **Права доступа:**
   - Кнопка удаления должна быть видна только OWNER или пользователю той же студии
   - Если нет прав, кнопка не должна отображаться

---

## 🐛 Обработка ошибок

### Типичные ошибки и их обработка:

1. **401 Unauthorized**
   - Токен истек или неверный
   - Решение: перенаправить на страницу входа

2. **403 Forbidden**
   - Нет доступа к этому сотруднику
   - Решение: показать сообщение "Нет доступа"

3. **404 Not Found**
   - Сотрудник не найден
   - Решение: показать сообщение "Сотрудник не найден"

4. **400 Bad Request**
   - Нельзя удалить OWNER
   - Решение: показать сообщение "Нельзя удалить владельца студии"

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
        setError(errorData.message || 'Нельзя удалить этого сотрудника');
        break;
      case 401:
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        break;
      case 403:
        setError('Нет доступа к этому сотруднику');
        break;
      case 404:
        setError('Сотрудник не найден');
        break;
      default:
        setError('Ошибка при удалении сотрудника');
    }
    return;
  }
  
  // Успешное удаление
  const deletedStaff = await response.json();
  // ...
} catch (err) {
  setError('Ошибка сети. Проверьте подключение к интернету');
}
```

---

## 📝 Примечания

1. **База URL:** Все запросы идут на `https://aidaproject-production.up.railway.app`

2. **Токен:** Токен должен быть актуальным. Если истек, нужно обновить через `/auth/refresh`

3. **Необратимость:** Удаление сотрудника необратимо. Все связанные данные будут удалены навсегда

4. **Каскадное удаление:** При удалении сотрудника автоматически удаляются:
   - Профиль сотрудника (StaffProfile)
   - График работы (WorkScheduleDay)
   - Занятые слоты (BusySlot)
   - Записи (Appointments)
   - Связи с услугами (StaffService)
   - Переопределения услуг (StaffServiceOverride)

5. **OWNER:** Удалить OWNER нельзя. Если попытаться удалить OWNER, будет возвращена ошибка 400

6. **Права доступа:** Удалять может только OWNER или пользователь той же студии

7. **UI/UX:** Рекомендуется показывать предупреждение перед удалением, так как действие необратимо

---

## 🔍 Диагностика проблем

### Если возникает ошибка при удалении:

1. **Проверь токен авторизации:**
   - Убедись, что токен актуален
   - Проверь, что токен отправляется в заголовке `Authorization: Bearer <token>`

2. **Проверь ID сотрудника:**
   - Убедись, что ID сотрудника корректен
   - Проверь, что сотрудник существует

3. **Проверь роль сотрудника:**
   - Если пытаешься удалить OWNER, будет ошибка 400
   - Проверь роль перед попыткой удаления

4. **Проверь права доступа:**
   - Убедись, что у текущего пользователя есть права на удаление
   - OWNER может удалять любого сотрудника
   - Пользователь может удалять только сотрудников своей студии

5. **Проверь консоль браузера:**
   - Открой DevTools (F12) → вкладка Network
   - Посмотри на запрос и ответ
   - Проверь статус код и тело ответа

### Пример правильного запроса:

```javascript
fetch('https://aidaproject-production.up.railway.app/staff/123e4567-e89b-12d3-a456-426614174000', {
  method: 'DELETE',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  }
})
```






