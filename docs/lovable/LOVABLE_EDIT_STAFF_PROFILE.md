# Подробный гайд: Редактирование профиля сотрудника для Lovable

## Контекст
Нужно реализовать функционал редактирования профиля сотрудника (мастера или менеджера). В профиле можно редактировать:
- Фото профиля (avatar)
- Имя и фамилия
- Поле "О сотруднике" (bio)
- Фото работ (portfolioPhotos - массив URL)
- Ранг/категория (1-я, 2-я, 3-я и т.д.)
- Должность (title)
- Специализация (category)

**Важно:** 
- Email, телефон, роль и услуги редактируются через другие эндпоинты (см. раздел "Дополнительные эндпоинты").
- **КРИТИЧЕСКИ ВАЖНО:** При нажатии кнопки "Удалить" на фото (avatar или portfolioPhotos) изменения должны **немедленно сохраняться на сервере** через PATCH запрос. Не нужно ждать нажатия кнопки "Сохранить" - удаление должно происходить сразу при клике на кнопку "Удалить".

---

## 📍 API Endpoints

### 1. Получить профиль сотрудника

**GET** `https://aidaproject-production.up.railway.app/staff/:userId/profile`

**Полный URL пример:**
```
GET https://aidaproject-production.up.railway.app/staff/123e4567-e89b-12d3-a456-426614174000/profile
```

**Важно:** Замени `:userId` на реальный ID сотрудника.

---

### 2. Обновить профиль сотрудника

**PATCH** `https://aidaproject-production.up.railway.app/staff/:userId/profile`

**Полный URL пример:**
```
PATCH https://aidaproject-production.up.railway.app/staff/123e4567-e89b-12d3-a456-426614174000/profile
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

## 📥 Получение профиля (GET)

### Response 200:

```json
{
  "id": "user-uuid",
  "email": "john@example.com",
  "phone": "+79991234567",
  "role": "MASTER",
  "isActive": true,
  "staffProfile": {
    "userId": "user-uuid",
    "firstName": "Иван",
    "lastName": "Иванов",
    "title": "Старший мастер",
    "category": "Парикмахер",
    "providesServices": true,
    "avatar": "https://example.com/avatar.jpg",
    "bio": "Опытный мастер с 10-летним стажем. Специализируюсь на стрижках и окрашивании.",
    "portfolioPhotos": [
      "https://example.com/work1.jpg",
      "https://example.com/work2.jpg",
      "https://example.com/work3.jpg"
    ],
    "rank": "1-я категория"
  },
  "services": [
    {
      "id": "service-uuid-1",
      "name": "Стрижка",
      "defaultDurationMin": 60,
      "defaultPrice": 2000
    },
    {
      "id": "service-uuid-2",
      "name": "Окрашивание",
      "defaultDurationMin": 120,
      "defaultPrice": 5000
    }
  ],
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:00.000Z"
}
```

### Возможные ошибки:

- **403 Forbidden** - нет доступа к этому сотруднику
- **404 Not Found** - сотрудник не найден

---

## 📤 Обновление профиля (PATCH)

### Request Body:

**Все поля опциональны** - можно обновлять только нужные поля.

```json
{
  "avatar": "https://example.com/new-avatar.jpg",
  "bio": "Обновленное описание о сотруднике",
  "portfolioPhotos": [
    "https://example.com/work1.jpg",
    "https://example.com/work2.jpg"
  ],
  "rank": "2-я категория",
  "firstName": "Иван",
  "lastName": "Петров",
  "title": "Ведущий мастер",
  "category": "Визажист"
}
```

---

## 📸 Загрузка файлов (Upload)

### Важно: Загрузка файлов через отдельные эндпоинты

Вместо ввода URL вручную, можно загружать файлы напрямую через API. Это более удобно для пользователей.

### 1. Загрузка фото профиля (Avatar)

**POST** `https://aidaproject-production.up.railway.app/upload/avatar`

**Headers:**
```
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data
```

**Request Body (FormData):**
```
file: <binary file>
```

**Response 200:**
```json
{
  "url": "https://aidaproject-production.up.railway.app/uploads/123e4567-e89b-12d3-a456-426614174000.jpg"
}
```

**Ограничения:**
- Максимальный размер файла: **5MB**
- Разрешенные форматы: **jpg, jpeg, png, gif, webp**

### 2. Загрузка фото работ (Portfolio)

**POST** `https://aidaproject-production.up.railway.app/upload/portfolio`

**Headers:**
```
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data
```

**Request Body (FormData):**
```
file: <binary file>
```

**Response 200:**
```json
{
  "url": "https://aidaproject-production.up.railway.app/uploads/123e4567-e89b-12d3-a456-426614174000.jpg"
}
```

**Ограничения:**
- Максимальный размер файла: **10MB**
- Разрешенные форматы: **jpg, jpeg, png, gif, webp**

### Возможные ошибки:

- **400 Bad Request** - неверный тип файла или превышен размер
- **401 Unauthorized** - не авторизован

### Минимальный пример (только одно поле):

```json
{
  "bio": "Новое описание"
}
```

### Пример очистки поля (удаление значения):

Чтобы удалить значение поля, отправь `null` или пустую строку `""`:

```json
{
  "avatar": null,
  "bio": "",
  "rank": null
}
```

**Важно:** Для `portfolioPhotos` отправь пустой массив `[]` чтобы очистить все фото.

### Response 200:

```json
{
  "userId": "user-uuid",
  "firstName": "Иван",
  "lastName": "Петров",
  "title": "Ведущий мастер",
  "category": "Визажист",
  "providesServices": true,
  "avatar": "https://example.com/new-avatar.jpg",
  "bio": "Обновленное описание о сотруднике",
  "portfolioPhotos": [
    "https://example.com/work1.jpg",
    "https://example.com/work2.jpg"
  ],
  "rank": "2-я категория",
  "user": {
    "id": "user-uuid",
    "email": "john@example.com",
    "phone": "+79991234567",
    "role": "MASTER",
    "isActive": true
  }
}
```

### Возможные ошибки:

- **400 Bad Request** - невалидные данные (например, неверный формат URL)
- **403 Forbidden** - нет доступа к этому сотруднику
- **404 Not Found** - сотрудник или профиль не найден

---

## 🎨 UI Требования

### Страница редактирования профиля должна содержать:

1. **Фото профиля (Avatar)**
   - Поле ввода URL фото
   - Превью текущего фото (если есть)
   - Кнопка "Удалить фото" (отправляет `null`)

2. **Имя и Фамилия**
   - Два текстовых поля
   - Имя обязательно, фамилия опциональна

3. **Должность (Title)**
   - Текстовое поле
   - Пример: "Старший мастер", "Ведущий мастер"

4. **Специализация (Category)**
   - Текстовое поле
   - Пример: "Парикмахер", "Визажист", "Мастер маникюра"

5. **Ранг/Категория (Rank)**
   - Текстовое поле или select
   - Пример: "1-я категория", "2-я категория", "3-я категория"
   - Можно сделать dropdown с предустановленными значениями

6. **О сотруднике (Bio)**
   - Многострочное текстовое поле (textarea)
   - Рекомендуется 5-10 строк

7. **Фото работ (Portfolio Photos)**
   - Поле для ввода URL (каждое фото с новой строки или отдельные поля)
   - Кнопка "Добавить еще фото"
   - Превью всех загруженных фото
   - Кнопка удаления для каждого фото

8. **Кнопки действий**
   - "Сохранить" - отправляет PATCH запрос
   - "Отмена" - возвращает к просмотру профиля
   - Показывать индикатор загрузки во время сохранения

### Дополнительная информация (только для чтения):

- Email (из `user.email`)
- Телефон (из `user.phone`)
- Роль (из `user.role`) - "Мастер" или "Менеджер"
- Услуги (из `services`) - список услуг, которые предоставляет сотрудник
- Статус (из `user.isActive`) - активен/неактивен

---

## 💻 Примеры кода для Frontend

### TypeScript интерфейсы:

```typescript
interface StaffProfile {
  userId: string;
  firstName: string;
  lastName?: string;
  title?: string;
  category?: string;
  providesServices: boolean;
  avatar?: string;
  bio?: string;
  portfolioPhotos: string[];
  rank?: string;
}

interface StaffProfileResponse {
  id: string;
  email?: string;
  phone?: string;
  role: 'MASTER' | 'MANAGER' | 'OWNER';
  isActive: boolean;
  staffProfile: StaffProfile;
  services: Array<{
    id: string;
    name: string;
    defaultDurationMin: number;
    defaultPrice?: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface UpdateStaffProfileDto {
  avatar?: string | null;
  bio?: string | null;
  portfolioPhotos?: string[];
  rank?: string | null;
  firstName?: string;
  lastName?: string | null;
  title?: string | null;
  category?: string | null;
}
```

### React компонент для загрузки профиля:

```typescript
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

function useStaffProfile(userId: string) {
  const [profile, setProfile] = useState<StaffProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    
    fetch(`https://aidaproject-production.up.railway.app/staff/${userId}/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('Профиль не найден');
          }
          if (res.status === 403) {
            throw new Error('Нет доступа к этому профилю');
          }
          throw new Error('Ошибка загрузки профиля');
        }
        return res.json();
      })
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [userId]);

  return { profile, loading, error };
}
```

### React компонент формы редактирования:

```typescript
import { useState, useEffect } from 'react';

interface EditStaffProfileFormProps {
  userId: string;
  initialData: StaffProfileResponse;
  onSuccess?: () => void;
  onCancel?: () => void;
}

function EditStaffProfileForm({ 
  userId, 
  initialData, 
  onSuccess, 
  onCancel 
}: EditStaffProfileFormProps) {
  const [formData, setFormData] = useState<UpdateStaffProfileDto>({
    avatar: initialData.staffProfile.avatar || '',
    bio: initialData.staffProfile.bio || '',
    portfolioPhotos: initialData.staffProfile.portfolioPhotos || [],
    rank: initialData.staffProfile.rank || '',
    firstName: initialData.staffProfile.firstName,
    lastName: initialData.staffProfile.lastName || '',
    title: initialData.staffProfile.title || '',
    category: initialData.staffProfile.category || '',
  });

  const [portfolioPhotoInput, setPortfolioPhotoInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('accessToken');
    
    // Подготовка данных для отправки
    const updateData: UpdateStaffProfileDto = {};
    
    // Добавляем только измененные поля
    if (formData.avatar !== (initialData.staffProfile.avatar || '')) {
      updateData.avatar = formData.avatar || null;
    }
    if (formData.bio !== (initialData.staffProfile.bio || '')) {
      updateData.bio = formData.bio || null;
    }
    if (formData.rank !== (initialData.staffProfile.rank || '')) {
      updateData.rank = formData.rank || null;
    }
    if (formData.firstName !== initialData.staffProfile.firstName) {
      updateData.firstName = formData.firstName;
    }
    if (formData.lastName !== (initialData.staffProfile.lastName || '')) {
      updateData.lastName = formData.lastName || null;
    }
    if (formData.title !== (initialData.staffProfile.title || '')) {
      updateData.title = formData.title || null;
    }
    if (formData.category !== (initialData.staffProfile.category || '')) {
      updateData.category = formData.category || null;
    }
    
    // Проверяем изменения в фото работ
    const initialPhotos = initialData.staffProfile.portfolioPhotos || [];
    const currentPhotos = formData.portfolioPhotos || [];
    if (JSON.stringify(initialPhotos) !== JSON.stringify(currentPhotos)) {
      updateData.portfolioPhotos = currentPhotos;
    }

    try {
      const response = await fetch(
        `https://aidaproject-production.up.railway.app/staff/${userId}/profile`,
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
        if (response.status === 400) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Неверные данные');
        }
        if (response.status === 403) {
          throw new Error('Нет доступа к этому профилю');
        }
        if (response.status === 404) {
          throw new Error('Профиль не найден');
        }
        throw new Error('Ошибка при обновлении профиля');
      }

      const updatedProfile = await response.json();
      setLoading(false);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const addPortfolioPhoto = () => {
    if (portfolioPhotoInput.trim()) {
      setFormData({
        ...formData,
        portfolioPhotos: [...(formData.portfolioPhotos || []), portfolioPhotoInput.trim()],
      });
      setPortfolioPhotoInput('');
    }
  };

  const removePortfolioPhoto = async (index: number) => {
    // Сохраняем текущее значение для возможного отката
    const currentPhotos = formData.portfolioPhotos || [];
    
    // Обновляем локальное состояние
    const updatedPhotos = currentPhotos.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      portfolioPhotos: updatedPhotos,
    });

    // Сразу сохраняем изменения на сервере
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
        // Если ошибка, возвращаем фото обратно
        setFormData({
          ...formData,
          portfolioPhotos: currentPhotos,
        });
        
        if (response.status === 400) {
          const errorData = await response.json();
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
    } catch (err: any) {
      // Если ошибка, возвращаем фото обратно
      setFormData({
        ...formData,
        portfolioPhotos: currentPhotos,
      });
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="edit-profile-form">
      {error && <div className="error-message">{error}</div>}

      {/* Фото профиля */}
      <div className="form-group">
        <label>Фото профиля:</label>
        <div className="avatar-upload">
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                // Проверка размера (5MB)
                if (file.size > 5 * 1024 * 1024) {
                  setError('Размер файла не должен превышать 5MB');
                  return;
                }

                setLoading(true);
                const formData = new FormData();
                formData.append('file', file);

                try {
                  const token = localStorage.getItem('accessToken');
                  const response = await fetch(
                    'https://aidaproject-production.up.railway.app/upload/avatar',
                    {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${token}`,
                      },
                      body: formData,
                    }
                  );

                  if (!response.ok) {
                    throw new Error('Ошибка загрузки файла');
                  }

                  const data = await response.json();
                  setFormData({ ...formData, avatar: data.url });
                  setLoading(false);
                } catch (err: any) {
                  setError(err.message || 'Ошибка загрузки файла');
                  setLoading(false);
                }
              }
            }}
            disabled={loading}
          />
          {formData.avatar && (
            <div className="avatar-preview">
              <img src={formData.avatar} alt="Avatar preview" />
              <button
                type="button"
                onClick={async () => {
                  // Сохраняем текущее значение для возможного отката
                  const currentAvatar = formData.avatar;
                  
                  // Обновляем локальное состояние
                  setFormData({ ...formData, avatar: null });
                  
                  // Сразу сохраняем изменения на сервере
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
                    });

                    if (!response.ok) {
                      // Если ошибка, возвращаем фото обратно
                      setFormData({ ...formData, avatar: currentAvatar || null });
                      
                      if (response.status === 400) {
                        const errorData = await response.json();
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
                  } catch (err: any) {
                    // Если ошибка, возвращаем фото обратно
                    setFormData({ ...formData, avatar: currentAvatar || null });
                    setError(err.message);
                    setLoading(false);
                  }
                }}
                disabled={loading}
              >
                {loading ? 'Удаление...' : 'Удалить фото'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Имя и Фамилия */}
      <div className="form-row">
        <div className="form-group">
          <label>Имя *</label>
          <input
            type="text"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            required
          />
        </div>
        <div className="form-group">
          <label>Фамилия</label>
          <input
            type="text"
            value={formData.lastName || ''}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
          />
        </div>
      </div>

      {/* Должность */}
      <div className="form-group">
        <label>Должность</label>
        <input
          type="text"
          value={formData.title || ''}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Старший мастер"
        />
      </div>

      {/* Специализация */}
      <div className="form-group">
        <label>Специализация</label>
        <input
          type="text"
          value={formData.category || ''}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          placeholder="Парикмахер"
        />
      </div>

      {/* Ранг */}
      <div className="form-group">
        <label>Ранг/Категория</label>
        <select
          value={formData.rank || ''}
          onChange={(e) => setFormData({ ...formData, rank: e.target.value || null })}
        >
          <option value="">Не указано</option>
          <option value="1-я категория">1-я категория</option>
          <option value="2-я категория">2-я категория</option>
          <option value="3-я категория">3-я категория</option>
          <option value="Высшая категория">Высшая категория</option>
        </select>
      </div>

      {/* О сотруднике */}
      <div className="form-group">
        <label>О сотруднике</label>
        <textarea
          value={formData.bio || ''}
          onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
          rows={5}
          placeholder="Опытный мастер с 10-летним стажем..."
        />
      </div>

      {/* Фото работ */}
      <div className="form-group">
        <label>Фото работ</label>
        <div className="portfolio-photos-upload">
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                // Проверка размера (10MB)
                if (file.size > 10 * 1024 * 1024) {
                  setError('Размер файла не должен превышать 10MB');
                  return;
                }

                setLoading(true);
                const uploadFormData = new FormData();
                uploadFormData.append('file', file);

                try {
                  const token = localStorage.getItem('accessToken');
                  const response = await fetch(
                    'https://aidaproject-production.up.railway.app/upload/portfolio',
                    {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${token}`,
                      },
                      body: uploadFormData,
                    }
                  );

                  if (!response.ok) {
                    throw new Error('Ошибка загрузки файла');
                  }

                  const data = await response.json();
                  setFormData({
                    ...formData,
                    portfolioPhotos: [...(formData.portfolioPhotos || []), data.url],
                  });
                  setLoading(false);
                } catch (err: any) {
                  setError(err.message || 'Ошибка загрузки файла');
                  setLoading(false);
                }
              }
            }}
            disabled={loading}
          />
          <p className="help-text">Или введите URL вручную:</p>
          <div className="portfolio-photos-input">
            <input
              type="url"
              value={portfolioPhotoInput}
              onChange={(e) => setPortfolioPhotoInput(e.target.value)}
              placeholder="https://example.com/work1.jpg"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addPortfolioPhoto();
                }
              }}
            />
            <button type="button" onClick={addPortfolioPhoto}>
              Добавить URL
            </button>
          </div>
        </div>
        
        {formData.portfolioPhotos && formData.portfolioPhotos.length > 0 && (
          <div className="portfolio-photos-list">
            {formData.portfolioPhotos.map((photo, index) => (
              <div key={index} className="portfolio-photo-item">
                <img src={photo} alt={`Работа ${index + 1}`} />
                <button
                  type="button"
                  onClick={() => removePortfolioPhoto(index)}
                  disabled={loading}
                >
                  {loading ? 'Удаление...' : 'Удалить'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Информация только для чтения */}
      <div className="read-only-info">
        <h3>Дополнительная информация</h3>
        <p><strong>Email:</strong> {initialData.email || 'Не указан'}</p>
        <p><strong>Телефон:</strong> {initialData.phone || 'Не указан'}</p>
        <p><strong>Роль:</strong> {initialData.role === 'MASTER' ? 'Мастер' : 'Менеджер'}</p>
        <p><strong>Услуги:</strong> {initialData.services.map(s => s.name).join(', ') || 'Нет услуг'}</p>
      </div>

      {/* Кнопки действий */}
      <div className="form-actions">
        <button type="submit" disabled={loading}>
          {loading ? 'Сохранение...' : 'Сохранить'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={loading}>
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
function StaffProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const [editMode, setEditMode] = useState(false);
  const { profile, loading, error } = useStaffProfile(userId || '');

  if (loading) return <div>Загрузка...</div>;
  if (error) return <div>Ошибка: {error}</div>;
  if (!profile) return <div>Профиль не найден</div>;

  if (editMode) {
    return (
      <EditStaffProfileForm
        userId={userId || ''}
        initialData={profile}
        onSuccess={() => {
          setEditMode(false);
          // Можно обновить данные профиля здесь
        }}
        onCancel={() => setEditMode(false)}
      />
    );
  }

  return (
    <div className="staff-profile-view">
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

1. **URL фото (avatar и portfolioPhotos)**
   - Должен быть валидным URL
   - Можно использовать регулярное выражение: `/^https?:\/\/.+/`

2. **Имя (firstName)**
   - Обязательное поле
   - Не может быть пустым

3. **Фото работ (portfolioPhotos)**
   - Каждый URL должен быть валидным
   - Можно ограничить количество (например, максимум 10 фото)

4. **О сотруднике (bio)**
   - Можно ограничить длину (например, максимум 1000 символов)

---

## 🔄 Дополнительные эндпоинты

Для редактирования других полей используй:

- **Email и телефон:** `PATCH /staff/:userId` (через `UpdateStaffDto`)
- **Роль:** `PATCH /staff/:userId` (через `UpdateStaffDto`)
- **Услуги:** 
  - Добавить: `POST /staff/:staffUserId/services`
  - Удалить: `DELETE /staff/:staffUserId/services/:serviceId`
  - Список: `GET /staff/:staffUserId/services`

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
   - Неверные данные (например, невалидный URL)
   - Решение: показать сообщение об ошибке валидации

5. **500 Internal Server Error**
   - Ошибка на сервере
   - Решение: показать сообщение "Ошибка сервера, попробуйте позже"

---

## 📝 Примечания

1. **База URL:** Все запросы идут на `https://aidaproject-production.up.railway.app`

2. **Токен:** Токен должен быть актуальным. Если истек, нужно обновить через `/auth/refresh`

3. **Опциональные поля:** Все поля профиля опциональны, кроме `firstName` (которое редактируется через этот эндпоинт)

4. **Очистка полей:** Чтобы удалить значение поля, отправь `null` или пустую строку `""`

5. **Фото работ:** Массив `portfolioPhotos` можно полностью заменить, отправив новый массив

6. **Успешное обновление:** После успешного обновления рекомендуется перезагрузить данные профиля, чтобы получить актуальную информацию

7. **Загрузка файлов:**
   - Файлы сохраняются на сервере в папке `uploads/`
   - После загрузки возвращается полный URL файла
   - URL можно использовать в поле `avatar` или `portfolioPhotos`
   - Рекомендуется использовать загрузку файлов вместо ввода URL вручную для лучшего UX

8. **Ограничения файлов:**
   - Фото профиля: максимум 5MB
   - Фото работ: максимум 10MB
   - Форматы: jpg, jpeg, png, gif, webp

9. **Удаление фото:**
   - **ВАЖНО:** При нажатии кнопки "Удалить" на фото (avatar или portfolioPhotos) изменения должны **немедленно сохраняться на сервере**
   - Не нужно ждать нажатия кнопки "Сохранить" - удаление должно происходить сразу
   - После удаления нужно отправить PATCH запрос с обновленным массивом `portfolioPhotos` или `avatar: null`
   - Если запрос не удался, нужно вернуть фото обратно в состояние формы

