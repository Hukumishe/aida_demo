# Руководство по профилю сотрудника

## Обзор

Добавлен функционал для заполнения и отображения профиля мастера. Профиль включает:
- Фото профиля (avatar)
- Имя и фамилия
- Поле "О сотруднике" (bio)
- Фото работ (portfolioPhotos - массив URL)
- Услуги сотрудника (services)
- Категория (мастер, менеджер) - из поля `role`
- Категория/ранг (1-я, 2-я, 3-я и т.д.) - поле `rank`
- Телефон (phone)
- Email (email)

## API Endpoints

### 1. Получить профиль сотрудника

**GET** `/staff/:userId/profile`

**Headers:**
```
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "id": "user-uuid",
  "email": "john@example.com",
  "phone": "+79991234567",
  "role": "MASTER",
  "isActive": true,
  "staffProfile": {
    "userId": "user-uuid",
    "firstName": "John",
    "lastName": "Doe",
    "title": "Senior Master",
    "category": "Hair Stylist",
    "providesServices": true,
    "avatar": "https://example.com/avatar.jpg",
    "bio": "Опытный мастер с 10-летним стажем",
    "portfolioPhotos": [
      "https://example.com/work1.jpg",
      "https://example.com/work2.jpg"
    ],
    "rank": "1-я категория"
  },
  "services": [
    {
      "id": "service-uuid",
      "name": "Haircut",
      "defaultDurationMin": 60,
      "defaultPrice": 2000
    }
  ],
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:00.000Z"
}
```

### 2. Обновить профиль сотрудника

**PATCH** `/staff/:userId/profile`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "avatar": "https://example.com/avatar.jpg",
  "bio": "Опытный мастер с 10-летним стажем",
  "portfolioPhotos": [
    "https://example.com/work1.jpg",
    "https://example.com/work2.jpg"
  ],
  "rank": "1-я категория",
  "firstName": "John",
  "lastName": "Doe",
  "title": "Senior Master",
  "category": "Hair Stylist"
}
```

**Все поля опциональны** - можно обновлять только нужные поля.

**Response 200:**
```json
{
  "userId": "user-uuid",
  "firstName": "John",
  "lastName": "Doe",
  "title": "Senior Master",
  "category": "Hair Stylist",
  "providesServices": true,
  "avatar": "https://example.com/avatar.jpg",
  "bio": "Опытный мастер с 10-летним стажем",
  "portfolioPhotos": [
    "https://example.com/work1.jpg",
    "https://example.com/work2.jpg"
  ],
  "rank": "1-я категория",
  "user": {
    "id": "user-uuid",
    "email": "john@example.com",
    "phone": "+79991234567",
    "role": "MASTER",
    "isActive": true
  }
}
```

### 3. Получить список всех сотрудников (обновлено)

**GET** `/studios/:studioId/staff`

Теперь возвращает полный профиль с новыми полями:
- `staffProfile.avatar`
- `staffProfile.bio`
- `staffProfile.portfolioPhotos`
- `staffProfile.rank`

## Frontend Implementation

### Пример компонента профиля сотрудника

```typescript
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

interface StaffProfile {
  id: string;
  email: string;
  phone: string;
  role: 'MASTER' | 'MANAGER';
  isActive: boolean;
  staffProfile: {
    firstName: string;
    lastName?: string;
    title?: string;
    category?: string;
    avatar?: string;
    bio?: string;
    portfolioPhotos: string[];
    rank?: string;
  };
  services: Array<{
    id: string;
    name: string;
    defaultDurationMin: number;
    defaultPrice?: number;
  }>;
}

function StaffProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/staff/${userId}/profile`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    })
      .then(res => res.json())
      .then(data => {
        setProfile(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading profile:', err);
        setLoading(false);
      });
  }, [userId]);

  if (loading) return <div>Загрузка...</div>;
  if (!profile) return <div>Профиль не найден</div>;

  return (
    <div className="staff-profile">
      {/* Фото профиля */}
      {profile.staffProfile.avatar && (
        <img 
          src={profile.staffProfile.avatar} 
          alt={`${profile.staffProfile.firstName} ${profile.staffProfile.lastName}`}
          className="avatar"
        />
      )}

      {/* Имя и фамилия */}
      <h1>
        {profile.staffProfile.firstName} {profile.staffProfile.lastName}
      </h1>

      {/* Категория (мастер/менеджер) */}
      <p className="role">{profile.role === 'MASTER' ? 'Мастер' : 'Менеджер'}</p>

      {/* Ранг */}
      {profile.staffProfile.rank && (
        <p className="rank">{profile.staffProfile.rank}</p>
      )}

      {/* О сотруднике */}
      {profile.staffProfile.bio && (
        <div className="bio">
          <h2>О сотруднике</h2>
          <p>{profile.staffProfile.bio}</p>
        </div>
      )}

      {/* Контакты */}
      <div className="contacts">
        {profile.phone && <p>Телефон: {profile.phone}</p>}
        {profile.email && <p>Email: {profile.email}</p>}
      </div>

      {/* Услуги */}
      <div className="services">
        <h2>Услуги</h2>
        <ul>
          {profile.services.map(service => (
            <li key={service.id}>{service.name}</li>
          ))}
        </ul>
      </div>

      {/* Фото работ */}
      {profile.staffProfile.portfolioPhotos.length > 0 && (
        <div className="portfolio">
          <h2>Фото работ</h2>
          <div className="portfolio-grid">
            {profile.staffProfile.portfolioPhotos.map((photo, index) => (
              <img key={index} src={photo} alt={`Работа ${index + 1}`} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Пример формы редактирования профиля

```typescript
function EditStaffProfileForm({ userId, initialData }: { userId: string; initialData: StaffProfile }) {
  const [formData, setFormData] = useState({
    avatar: initialData.staffProfile.avatar || '',
    bio: initialData.staffProfile.bio || '',
    portfolioPhotos: initialData.staffProfile.portfolioPhotos || [],
    rank: initialData.staffProfile.rank || '',
    firstName: initialData.staffProfile.firstName,
    lastName: initialData.staffProfile.lastName || '',
    title: initialData.staffProfile.title || '',
    category: initialData.staffProfile.category || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`/api/staff/${userId}/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        alert('Профиль обновлен');
        // Обновить данные на странице
      } else {
        alert('Ошибка при обновлении профиля');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Ошибка при обновлении профиля');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Фото профиля (URL):</label>
        <input
          type="url"
          value={formData.avatar}
          onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
        />
      </div>

      <div>
        <label>О сотруднике:</label>
        <textarea
          value={formData.bio}
          onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
          rows={5}
        />
      </div>

      <div>
        <label>Ранг/Категория:</label>
        <input
          type="text"
          value={formData.rank}
          onChange={(e) => setFormData({ ...formData, rank: e.target.value })}
          placeholder="1-я категория"
        />
      </div>

      <div>
        <label>Фото работ (URL, каждое с новой строки):</label>
        <textarea
          value={formData.portfolioPhotos.join('\n')}
          onChange={(e) => setFormData({
            ...formData,
            portfolioPhotos: e.target.value.split('\n').filter(url => url.trim())
          })}
          rows={5}
          placeholder="https://example.com/work1.jpg&#10;https://example.com/work2.jpg"
        />
      </div>

      <button type="submit">Сохранить</button>
    </form>
  );
}
```

## Примечания

1. **Загрузка файлов**: В текущей реализации используются URL для фото. Если нужно загружать файлы, нужно будет добавить отдельный эндпоинт для загрузки файлов (например, используя `multer` или `@nestjs/platform-express`).

2. **Валидация**: Все URL должны быть валидными. Frontend должен проверять формат URL перед отправкой.

3. **При создании сотрудника**: Новые поля профиля (`avatar`, `bio`, `portfolioPhotos`, `rank`) можно указать при создании сотрудника через `POST /studios/:studioId/staff`.

4. **Обновление через основной эндпоинт**: Поля профиля также можно обновлять через `PATCH /staff/:userId`, но рекомендуется использовать специализированный эндпоинт `PATCH /staff/:userId/profile`.

