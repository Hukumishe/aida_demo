# Подробный гайд: Удаление фотографий в профиле сотрудника для Lovable

## Контекст
Нужно реализовать функционал удаления фотографий в профиле сотрудника:
- Удаление фото профиля (avatar)
- Удаление фото работ из портфолио (portfolioPhotos)

**КРИТИЧЕСКИ ВАЖНО:** При нажатии кнопки "Удалить" на фото изменения должны **немедленно сохраняться на сервере** через PATCH запрос. Не нужно ждать нажатия кнопки "Сохранить" - удаление должно происходить сразу при клике на кнопку "Удалить".

---

## 📍 API Endpoint

### Обновление профиля сотрудника (для удаления фото)

**PATCH** `https://aidaproject-production.up.railway.app/staff/:userId/profile`

**Полный URL пример:**
```
PATCH https://aidaproject-production.up.railway.app/staff/123e4567-e89b-12d3-a456-426614174000/profile
```

**Важно:** Замени `:userId` на реальный ID сотрудника.

---

## 🔑 Обязательные заголовки (Headers)

Запрос должен содержать:

```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Где взять accessToken:**
- После успешного логина через `/auth/login`
- Токен хранится в localStorage или state
- Токен действителен 15 минут, затем нужно обновить через `/auth/refresh`

---

## 📤 Удаление фото профиля (avatar)

### Request Body:

Чтобы удалить фото профиля, отправь `avatar: null`:

```json
{
  "avatar": null
}
```

### Response 200:

```json
{
  "userId": "user-uuid",
  "firstName": "Иван",
  "lastName": "Иванов",
  "avatar": null,
  "bio": "...",
  "portfolioPhotos": [...],
  "rank": "...",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "phone": "+79991234567",
    "role": "MASTER",
    "isActive": true
  }
}
```

---

## 📤 Удаление фото из портфолио (portfolioPhotos)

### Request Body:

Чтобы удалить фото из портфолио, отправь обновленный массив без удаленного фото:

```json
{
  "portfolioPhotos": [
    "https://example.com/work1.jpg",
    "https://example.com/work3.jpg"
  ]
}
```

**Важно:** Отправляй весь массив, но без удаленного элемента.

### Response 200:

```json
{
  "userId": "user-uuid",
  "firstName": "Иван",
  "lastName": "Иванов",
  "avatar": "...",
  "bio": "...",
  "portfolioPhotos": [
    "https://example.com/work1.jpg",
    "https://example.com/work3.jpg"
  ],
  "rank": "...",
  "user": {...}
}
```

---

## 🎨 UI Требования

### Удаление фото профиля (avatar):

1. **Кнопка "Удалить фото"** должна быть рядом с превью фото
2. **При нажатии:**
   - Фото должно исчезнуть из UI сразу (оптимистичное обновление)
   - Отправляется PATCH запрос с `avatar: null`
   - Показывается индикатор загрузки
3. **При успехе:**
   - Индикатор загрузки скрывается
   - Фото остается удаленным
4. **При ошибке:**
   - Фото возвращается обратно
   - Показывается сообщение об ошибке

### Удаление фото из портфолио:

1. **Кнопка "Удалить"** должна быть на каждом фото в портфолио
2. **При нажатии:**
   - Фото должно исчезнуть из списка сразу (оптимистичное обновление)
   - Отправляется PATCH запрос с обновленным массивом `portfolioPhotos`
   - Показывается индикатор загрузки
3. **При успехе:**
   - Индикатор загрузки скрывается
   - Фото остается удаленным из списка
4. **При ошибке:**
   - Фото возвращается обратно в список
   - Показывается сообщение об ошибке

---

## 💻 Примеры кода для Frontend

### TypeScript интерфейсы:

```typescript
interface UpdateStaffProfileDto {
  avatar?: string | null;
  portfolioPhotos?: string[];
  // ... другие поля
}
```

### React компонент для удаления фото профиля:

```typescript
function AvatarDeleteButton({ 
  userId, 
  currentAvatar, 
  onSuccess 
}: { 
  userId: string; 
  currentAvatar: string | null; 
  onSuccess?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    // Сохраняем текущее значение для возможного отката
    const savedAvatar = currentAvatar;
    
    // Оптимистичное обновление - сразу скрываем фото
    // (это делается через callback в родительском компоненте)
    
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(
        `https://aidaproject-production.up.railway.app/staff/${userId}/profile`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            avatar: null,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 400) {
          throw new Error(errorData.message || 'Неверные данные');
        }
        if (response.status === 403) {
          throw new Error('Нет доступа к этому профилю');
        }
        if (response.status === 404) {
          throw new Error('Профиль не найден');
        }
        throw new Error('Ошибка при удалении фото');
      }

      setLoading(false);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      // Если ошибка, нужно вернуть фото обратно
      // (это делается через callback в родительском компоненте)
      setError(err.message);
      setLoading(false);
      
      // Вызываем callback для возврата фото
      if (onError) {
        onError(savedAvatar);
      }
    }
  };

  return (
    <div>
      <button
        onClick={handleDelete}
        disabled={loading}
        className="btn-danger"
      >
        {loading ? 'Удаление...' : 'Удалить фото'}
      </button>
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
```

### React компонент для удаления фото из портфолио:

```typescript
function PortfolioPhotoDeleteButton({ 
  userId, 
  photoUrl, 
  photoIndex,
  currentPhotos,
  onSuccess 
}: { 
  userId: string; 
  photoUrl: string;
  photoIndex: number;
  currentPhotos: string[];
  onSuccess?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    // Сохраняем текущее значение для возможного отката
    const savedPhotos = [...currentPhotos];
    
    // Создаем новый массив без удаляемого фото
    const updatedPhotos = currentPhotos.filter((_, i) => i !== photoIndex);
    
    // Оптимистичное обновление - сразу удаляем фото из UI
    // (это делается через callback в родительском компоненте)
    
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(
        `https://aidaproject-production.up.railway.app/staff/${userId}/profile`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            portfolioPhotos: updatedPhotos,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 400) {
          throw new Error(errorData.message || 'Неверные данные');
        }
        if (response.status === 403) {
          throw new Error('Нет доступа к этому профилю');
        }
        if (response.status === 404) {
          throw new Error('Профиль не найден');
        }
        throw new Error('Ошибка при удалении фото');
      }

      setLoading(false);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      // Если ошибка, нужно вернуть фото обратно
      // (это делается через callback в родительском компоненте)
      setError(err.message);
      setLoading(false);
      
      // Вызываем callback для возврата фото
      if (onError) {
        onError(savedPhotos);
      }
    }
  };

  return (
    <div>
      <button
        onClick={handleDelete}
        disabled={loading}
        className="btn-danger btn-small"
      >
        {loading ? '...' : '×'}
      </button>
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
```

### Полный пример использования в форме редактирования:

```typescript
function EditStaffProfileForm({ 
  userId, 
  initialData, 
  onSuccess, 
  onCancel 
}: EditStaffProfileFormProps) {
  const [formData, setFormData] = useState<UpdateStaffProfileDto>({
    avatar: initialData.staffProfile.avatar || null,
    portfolioPhotos: initialData.staffProfile.portfolioPhotos || [],
    // ... другие поля
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Удаление фото профиля
  const handleDeleteAvatar = async () => {
    const savedAvatar = formData.avatar;
    
    // Оптимистичное обновление
    setFormData({ ...formData, avatar: null });
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(
        `https://aidaproject-production.up.railway.app/staff/${userId}/profile`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ avatar: null }),
        }
      );

      if (!response.ok) {
        // Возвращаем фото обратно
        setFormData({ ...formData, avatar: savedAvatar });
        throw new Error('Ошибка при удалении фото');
      }

      setLoading(false);
    } catch (err: any) {
      setFormData({ ...formData, avatar: savedAvatar });
      setError(err.message);
      setLoading(false);
    }
  };

  // Удаление фото из портфолио
  const handleDeletePortfolioPhoto = async (index: number) => {
    const savedPhotos = [...(formData.portfolioPhotos || [])];
    const updatedPhotos = savedPhotos.filter((_, i) => i !== index);
    
    // Оптимистичное обновление
    setFormData({ ...formData, portfolioPhotos: updatedPhotos });
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(
        `https://aidaproject-production.up.railway.app/staff/${userId}/profile`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ portfolioPhotos: updatedPhotos }),
        }
      );

      if (!response.ok) {
        // Возвращаем фото обратно
        setFormData({ ...formData, portfolioPhotos: savedPhotos });
        throw new Error('Ошибка при удалении фото');
      }

      setLoading(false);
    } catch (err: any) {
      setFormData({ ...formData, portfolioPhotos: savedPhotos });
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <form className="edit-profile-form">
      {error && <div className="error-message">{error}</div>}

      {/* Фото профиля */}
      <div className="form-group">
        <label>Фото профиля:</label>
        {formData.avatar && (
          <div className="avatar-preview">
            <img src={formData.avatar} alt="Avatar" />
            <button
              type="button"
              onClick={handleDeleteAvatar}
              disabled={loading}
              className="btn-danger"
            >
              {loading ? 'Удаление...' : 'Удалить фото'}
            </button>
          </div>
        )}
      </div>

      {/* Фото работ */}
      <div className="form-group">
        <label>Фото работ:</label>
        {formData.portfolioPhotos && formData.portfolioPhotos.length > 0 && (
          <div className="portfolio-photos-list">
            {formData.portfolioPhotos.map((photo, index) => (
              <div key={index} className="portfolio-photo-item">
                <img src={photo} alt={`Работа ${index + 1}`} />
                <button
                  type="button"
                  onClick={() => handleDeletePortfolioPhoto(index)}
                  disabled={loading}
                  className="btn-danger btn-small"
                >
                  {loading ? '...' : '×'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </form>
  );
}
```

---

## ✅ Валидация

### На Frontend нужно проверить:

1. **Перед удалением:**
   - Убедись, что фото действительно существует
   - Проверь, что пользователь имеет права на редактирование профиля

2. **После удаления:**
   - Убедись, что фото удалено из UI
   - Проверь, что массив `portfolioPhotos` обновлен корректно

---

## 🐛 Обработка ошибок

### Типичные ошибки и их обработка:

1. **401 Unauthorized**
   - Токен истек или неверный
   - Решение: перенаправить на страницу входа

2. **403 Forbidden**
   - Нет доступа к этому профилю
   - Решение: показать сообщение "Нет доступа"

3. **404 Not Found**
   - Профиль не найден
   - Решение: показать сообщение "Профиль не найден"

4. **400 Bad Request**
   - Неверные данные
   - Решение: показать сообщение об ошибке валидации

5. **500 Internal Server Error**
   - Ошибка на сервере
   - Решение: показать сообщение "Ошибка сервера, попробуйте позже"

### Важно при обработке ошибок:

- **Всегда возвращай фото обратно** при ошибке (откат оптимистичного обновления)
- Показывай понятное сообщение об ошибке
- Не закрывай форму при ошибке

---

## 📝 Примечания

1. **База URL:** Все запросы идут на `https://aidaproject-production.up.railway.app`

2. **Токен:** Токен должен быть актуальным. Если истек, нужно обновить через `/auth/refresh`

3. **Немедленное сохранение:** При нажатии "Удалить" изменения должны сразу сохраняться на сервере. Не нужно ждать нажатия кнопки "Сохранить"

4. **Оптимистичное обновление:** Рекомендуется сразу обновлять UI (удалять фото из интерфейса), а затем отправлять запрос. Если запрос не удался, вернуть фото обратно

5. **Откат при ошибке:** При ошибке обязательно верни фото обратно в состояние формы

6. **Удаление avatar:** Отправляй `avatar: null` для удаления фото профиля

7. **Удаление portfolioPhotos:** Отправляй весь обновленный массив без удаленного элемента

---

## 🔍 Диагностика проблем

### Если фото не удаляется:

1. **Проверь токен авторизации:**
   - Убедись, что токен актуален
   - Проверь, что токен отправляется в заголовке `Authorization: Bearer <token>`

2. **Проверь формат запроса:**
   - Убедись, что используется метод `PATCH` (не `PUT` или `POST`)
   - Проверь, что заголовок `Content-Type: application/json` установлен
   - Проверь, что тело запроса - валидный JSON

3. **Проверь ID сотрудника:**
   - Убедись, что ID сотрудника корректен
   - Проверь, что профиль существует и доступен

4. **Проверь данные запроса:**
   - Для удаления avatar: `{ "avatar": null }`
   - Для удаления portfolioPhotos: отправь массив без удаленного элемента

5. **Проверь консоль браузера:**
   - Открой DevTools (F12) → вкладка Network
   - Посмотри на запрос и ответ
   - Проверь статус код и тело ответа

### Пример правильного запроса для удаления avatar:

```javascript
fetch('https://aidaproject-production.up.railway.app/staff/123e4567-e89b-12d3-a456-426614174000/profile', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  },
  body: JSON.stringify({
    avatar: null
  })
})
```

### Пример правильного запроса для удаления portfolioPhotos:

```javascript
// Исходный массив: ["photo1.jpg", "photo2.jpg", "photo3.jpg"]
// Удаляем photo2.jpg (индекс 1)
// Отправляем: ["photo1.jpg", "photo3.jpg"]

fetch('https://aidaproject-production.up.railway.app/staff/123e4567-e89b-12d3-a456-426614174000/profile', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  },
  body: JSON.stringify({
    portfolioPhotos: ["photo1.jpg", "photo3.jpg"]
  })
})
```






