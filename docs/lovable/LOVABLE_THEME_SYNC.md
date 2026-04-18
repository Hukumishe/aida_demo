# Синхронизация темы между устройствами

## Обзор

Система поддерживает синхронизацию предпочтений темы (светлая/тёмная/системная) между всеми устройствами пользователя через backend.

---

## 🔌 API Endpoints

### 1. Получить предпочтение темы

**Endpoint:** `GET /auth/me`

**Описание:** Возвращает информацию о текущем пользователе, включая предпочтение темы.

**Заголовки:**
```
Authorization: Bearer {token}
```

**Пример ответа (200 OK):**
```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "phone": "+79991234567",
  "role": "OWNER",
  "studioId": "studio-uuid",
  "isActive": true,
  "themePreference": "dark",
  "createdAt": "2024-01-15T10:00:00.000+06:00",
  "updatedAt": "2024-01-15T10:00:00.000+06:00",
  "studio": {
    "id": "studio-uuid",
    "name": "Beauty Studio Almaty",
    "address": "Almaty, Abay Ave 150",
    "timezone": "Asia/Almaty"
  },
  "staffProfile": null
}
```

**Поле `themePreference`:**
- `"light"` - светлая тема
- `"dark"` - тёмная тема
- `"system"` - следовать системным настройкам
- `null` - предпочтение не установлено (по умолчанию)

---

### 2. Обновить предпочтение темы

**Endpoint:** `PATCH /auth/me/theme`

**Описание:** Обновляет предпочтение темы для текущего пользователя.

**Заголовки:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Тело запроса:**
```json
{
  "themePreference": "dark"
}
```

**Допустимые значения:**
- `"light"` - светлая тема
- `"dark"` - тёмная тема
- `"system"` - следовать системным настройкам

**Пример запроса:**
```javascript
PATCH /auth/me/theme
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "themePreference": "dark"
}
```

**Пример ответа (200 OK):**
```json
{
  "id": "user-uuid",
  "themePreference": "dark"
}
```

**Ошибки:**

**400 Bad Request** - Неверное значение:
```json
{
  "statusCode": 400,
  "message": ["themePreference must be one of the following values: light, dark, system"],
  "error": "Bad Request"
}
```

**401 Unauthorized** - Не авторизован:
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

---

## 💻 Реализация на Frontend

### Шаг 1: Получить предпочтение темы при загрузке

```typescript
// При загрузке приложения или после логина
async function loadUserTheme() {
  try {
    const response = await fetch('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });
    
    if (response.ok) {
      const user = await response.json();
      const theme = user.themePreference || 'system';
      applyTheme(theme);
    }
  } catch (error) {
    console.error('Error loading theme:', error);
    // Fallback to localStorage or system preference
    const localTheme = localStorage.getItem('theme') || 'system';
    applyTheme(localTheme);
  }
}
```

### Шаг 2: Применить тему

```typescript
function applyTheme(themePreference: 'light' | 'dark' | 'system') {
  let actualTheme: 'light' | 'dark';
  
  if (themePreference === 'system') {
    // Определить системную тему
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    actualTheme = prefersDark ? 'dark' : 'light';
  } else {
    actualTheme = themePreference;
  }
  
  // Применить тему
  document.documentElement.setAttribute('data-theme', actualTheme);
  // или
  document.documentElement.classList.toggle('dark', actualTheme === 'dark');
  
  // Сохранить в localStorage как fallback
  localStorage.setItem('theme', themePreference);
}
```

### Шаг 3: Обновить предпочтение темы

```typescript
async function updateThemePreference(themePreference: 'light' | 'dark' | 'system') {
  try {
    const response = await fetch('/api/auth/me/theme', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ themePreference }),
    });
    
    if (response.ok) {
      const result = await response.json();
      applyTheme(result.themePreference);
      console.log('Theme preference updated:', result.themePreference);
    } else {
      throw new Error('Failed to update theme preference');
    }
  } catch (error) {
    console.error('Error updating theme:', error);
    // Fallback: сохранить только в localStorage
    localStorage.setItem('theme', themePreference);
    applyTheme(themePreference);
  }
}
```

### Шаг 4: Компонент переключателя темы

```typescript
// ThemeToggle.tsx
import { useState, useEffect } from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Загрузить предпочтение при монтировании
    loadUserTheme().then((userTheme) => {
      setTheme(userTheme || 'system');
      setLoading(false);
    });
  }, []);

  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    await updateThemePreference(newTheme);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="theme-toggle">
      <button
        onClick={() => handleThemeChange('light')}
        className={theme === 'light' ? 'active' : ''}
      >
        ☀️ Light
      </button>
      <button
        onClick={() => handleThemeChange('dark')}
        className={theme === 'dark' ? 'active' : ''}
      >
        🌙 Dark
      </button>
      <button
        onClick={() => handleThemeChange('system')}
        className={theme === 'system' ? 'active' : ''}
      >
        💻 System
      </button>
    </div>
  );
}
```

### Шаг 5: Слушать изменения системной темы

```typescript
useEffect(() => {
  // Если выбрана системная тема, слушать изменения
  if (theme === 'system') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      applyTheme('system'); // Переприменить системную тему
    };
    
    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }
}, [theme]);
```

---

## 🎨 CSS для тем

### Вариант 1: CSS переменные

```css
:root {
  --bg-color: #ffffff;
  --text-color: #000000;
  --border-color: #e0e0e0;
}

[data-theme="dark"] {
  --bg-color: #1a1a1a;
  --text-color: #ffffff;
  --border-color: #333333;
}

body {
  background-color: var(--bg-color);
  color: var(--text-color);
  border-color: var(--border-color);
}
```

### Вариант 2: Tailwind CSS

```javascript
// tailwind.config.js
module.exports = {
  darkMode: 'class', // или 'media' для системной темы
  // ...
}
```

```tsx
// Применить класс dark
<div className="bg-white dark:bg-gray-900 text-black dark:text-white">
  Content
</div>
```

---

## ✅ Важные замечания

1. **Fallback на localStorage:** Если запрос к API не удался, используйте localStorage как резервный вариант.

2. **Системная тема:** При выборе `"system"` нужно определять предпочтение через `window.matchMedia('(prefers-color-scheme: dark)')`.

3. **Синхронизация:** Предпочтение темы автоматически синхронизируется между всеми устройствами пользователя через backend.

4. **Первая загрузка:** При первом входе пользователя `themePreference` будет `null`. В этом случае можно использовать системную тему или значение из localStorage.

5. **Оптимистичное обновление:** Можно применять тему сразу при клике, не дожидаясь ответа от сервера, для лучшего UX.

---

## 📝 Чеклист реализации

- [ ] Загружать `themePreference` из `GET /auth/me` при загрузке приложения
- [ ] Применять тему сразу после получения предпочтения
- [ ] Создать компонент переключателя темы
- [ ] Реализовать функцию `updateThemePreference` для отправки на сервер
- [ ] Добавить fallback на localStorage
- [ ] Обработать случай `null` (первый вход)
- [ ] Реализовать поддержку системной темы (`"system"`)
- [ ] Слушать изменения системной темы (если выбрана `"system"`)
- [ ] Добавить CSS переменные или классы для тёмной темы
- [ ] Протестировать синхронизацию между устройствами

---

## 🔗 Связанные документы

- [Аутентификация](./README.md#authentication) - для понимания работы с токенами
- [API Endpoints](./README.md#api-endpoints) - общий список endpoints








