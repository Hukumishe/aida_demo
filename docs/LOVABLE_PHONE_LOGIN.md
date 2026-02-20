# Вход в систему только по номеру телефона

## 📋 Обзор

Backend изменил систему входа: теперь для аутентификации используется **только номер телефона**, email больше не используется для входа в систему.

## ⚠️ КРИТИЧЕСКИ ВАЖНО

**НЕ отправляйте поле `emailOrPhone` в запросе!** Backend с валидацией `forbidNonWhitelisted: true` отклонит запрос, если в нем есть поле `emailOrPhone`. 

**Отправляйте ТОЛЬКО:**
- `phone` (обязательно)
- `password` (обязательно)

**НЕ отправляйте:**
- ❌ `emailOrPhone` (это поле больше не существует)
- ❌ `email` (не используется для входа)

## 🐛 Текущая ошибка

Если вы видите ошибку:
```
HTTP 400: property phone should not exist, emailOrPhone should not be empty, emailOrPhone must be a string
```

Это означает, что фронтенд **все еще отправляет поле `emailOrPhone`** в запросе. Backend ожидает только `phone`, а `emailOrPhone` больше не существует в DTO, поэтому валидатор отклоняет запрос.

**Решение:** Найдите в коде, где формируется запрос на вход, и убедитесь, что отправляется только `phone`, а не `emailOrPhone`.

## 🔄 Изменения в API

### Endpoint: `POST /auth/login`

**Старый формат запроса:**
```json
{
  "emailOrPhone": "user@example.com" или "+79991234567",
  "password": "password123"
}
```

**Новый формат запроса:**
```json
{
  "phone": "+79991234567",
  "password": "password123"
}
```

**Ответ остается прежним:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "phone": "+79991234567",
    "role": "OWNER",
    "studioId": "uuid",
    "staffProfile": { ... }
  }
}
```

## 🎯 Что нужно сделать на Frontend

### 1. Обновить тип/интерфейс для LoginDto

```typescript
// types/auth.ts или types/login.ts

// ❌ УДАЛИТЬ старый интерфейс:
export interface LoginDto {
  emailOrPhone: string;
  password: string;
}

// ✅ ДОБАВИТЬ новый интерфейс:
export interface LoginDto {
  phone: string;
  password: string;
}
```

### 2. Обновить форму входа

**Найти компонент формы входа** (обычно `LoginForm.tsx`, `LoginPage.tsx`, или аналогичный) и внести следующие изменения:

#### 2.1. Обновить состояние формы

```typescript
// ❌ УДАЛИТЬ:
const [emailOrPhone, setEmailOrPhone] = useState('');

// ✅ ЗАМЕНИТЬ на:
const [phone, setPhone] = useState('');
```

#### 2.2. Обновить поле ввода

```tsx
// ❌ УДАЛИТЬ старый input:
<Input
  type="text"
  placeholder="Email или номер телефона"
  value={emailOrPhone}
  onChange={(e) => setEmailOrPhone(e.target.value)}
/>

// ✅ ЗАМЕНИТЬ на:
<Input
  type="tel"
  placeholder="Номер телефона"
  value={phone}
  onChange={(e) => setPhone(e.target.value)}
/>
```

#### 2.3. Обновить валидацию

```typescript
// ❌ УДАЛИТЬ старую валидацию:
if (!emailOrPhone) {
  setError('Введите email или номер телефона');
  return;
}

// ✅ ЗАМЕНИТЬ на:
if (!phone) {
  setError('Введите номер телефона');
  return;
}

// Опционально: добавить валидацию формата телефона
const phoneRegex = /^\+?[1-9]\d{1,14}$/;
if (!phoneRegex.test(phone)) {
  setError('Введите корректный номер телефона');
  return;
}
```

#### 2.4. Обновить запрос к API

```typescript
// ❌ УДАЛИТЬ старый запрос (НЕ отправляйте emailOrPhone!):
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    emailOrPhone,  // ❌ ЭТО ПОЛЕ БОЛЬШЕ НЕ СУЩЕСТВУЕТ!
    password,
  }),
});

// ✅ ЗАМЕНИТЬ на (отправляйте ТОЛЬКО phone и password):
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phone,      // ✅ Только это поле
    password,   // ✅ И это поле
    // ❌ НЕ добавляйте emailOrPhone или email!
  }),
});
```

**⚠️ ВАЖНО:** Убедитесь, что в объекте запроса НЕТ поля `emailOrPhone`. Если вы используете spread оператор или объект с несколькими полями, проверьте, что `emailOrPhone` не попадает в запрос.

### 3. Обновить текст и подсказки в UI

#### 3.1. Обновить заголовки и описания

```tsx
// ❌ УДАЛИТЬ:
<h1>Вход в систему</h1>
<p>Введите email или номер телефона и пароль</p>

// ✅ ЗАМЕНИТЬ на:
<h1>Вход в систему</h1>
<p>Введите номер телефона и пароль</p>
```

#### 3.2. Обновить placeholder и label

```tsx
// ❌ УДАЛИТЬ:
<Label>Email или номер телефона</Label>
<Input placeholder="user@example.com или +79991234567" />

// ✅ ЗАМЕНИТЬ на:
<Label>Номер телефона</Label>
<Input placeholder="+79991234567" type="tel" />
```

### 4. Обновить обработку ошибок (если нужно)

Обработка ошибок остается прежней, но можно обновить сообщения:

```typescript
// Если есть кастомные сообщения об ошибках:
if (error.message.includes('email') || error.message.includes('phone')) {
  // Обновить на:
  if (error.message.includes('phone')) {
    setError('Неверный номер телефона или пароль');
  }
}
```

## 📝 Пример полного компонента формы входа

```tsx
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export function LoginForm() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Валидация
    if (!phone) {
      setError('Введите номер телефона');
      return;
    }

    if (!password) {
      setError('Введите пароль');
      return;
    }

    // Опциональная валидация формата телефона
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phone)) {
      setError('Введите корректный номер телефона');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          password,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Ошибка входа');
      }

      const data = await response.json();
      
      // Сохранить токены
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      
      // Перенаправить на главную страницу
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="phone">Номер телефона</Label>
        <Input
          id="phone"
          type="tel"
          placeholder="+79991234567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
      </div>

      <div>
        <Label htmlFor="password">Пароль</Label>
        <Input
          id="password"
          type="password"
          placeholder="Введите пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error && (
        <div className="text-red-500 text-sm">{error}</div>
      )}

      <Button type="submit" disabled={loading}>
        {loading ? 'Вход...' : 'Войти'}
      </Button>
    </form>
  );
}
```

## ✅ Чеклист изменений

- [ ] Обновлен тип/интерфейс `LoginDto` (удалено `emailOrPhone`, добавлено `phone`)
- [ ] Обновлено состояние формы (заменено `emailOrPhone` на `phone`)
- [ ] Обновлено поле ввода (тип `tel`, placeholder "Номер телефона")
- [ ] Обновлена валидация (проверка только телефона)
- [ ] **КРИТИЧНО:** Обновлен запрос к API - отправляется ТОЛЬКО `phone` и `password`, поле `emailOrPhone` НЕ отправляется
- [ ] Проверено, что в запросе нет поля `emailOrPhone` (используйте DevTools Network tab)
- [ ] Обновлены тексты в UI (заголовки, подсказки, labels)
- [ ] Удалены все упоминания "email или телефон" из формы входа
- [ ] Протестирован вход с корректным номером телефона
- [ ] Протестирована обработка ошибок при неверном номере телефона
- [ ] **Проверка:** В Network tab браузера запрос должен содержать только `{"phone": "...", "password": "..."}`

## 🔍 Где искать код для изменения

1. **Компонент формы входа:**
   - `src/components/LoginForm.tsx`
   - `src/pages/LoginPage.tsx`
   - `src/features/auth/LoginForm.tsx`
   - Или поиск по `emailOrPhone` в коде

2. **Типы/интерфейсы:**
   - `src/types/auth.ts`
   - `src/types/login.ts`
   - `src/interfaces/auth.ts`

3. **API клиент (если используется):**
   - `src/api/auth.ts`
   - `src/services/authService.ts`
   - `src/lib/api.ts`

## ⚠️ Важные замечания

1. **Email все еще хранится в профиле пользователя**, но не используется для входа
2. **Номер телефона обязателен** для всех пользователей при создании
3. **Формат телефона:** рекомендуется использовать международный формат с `+` (например, `+79991234567`)
4. **Обратная совместимость:** старые пользователи должны использовать свой номер телефона для входа, а не email
5. **КРИТИЧНО:** Backend использует `forbidNonWhitelisted: true`, что означает, что любые поля, не указанные в DTO, будут отклонены. Поле `emailOrPhone` больше не существует в DTO, поэтому его отправка вызовет ошибку 400.

## 🔍 Как проверить, что все работает правильно

1. Откройте DevTools (F12) → вкладка Network
2. Попробуйте войти в систему
3. Найдите запрос `POST /auth/login`
4. Откройте вкладку Payload или Request
5. Убедитесь, что запрос содержит ТОЛЬКО:
   ```json
   {
     "phone": "+79991234567",
     "password": "password123"
   }
   ```
6. Если вы видите поле `emailOrPhone` в запросе - это ошибка, нужно исправить код фронтенда

## 🧪 Тестовые сценарии

1. **Успешный вход:**
   - Ввести корректный номер телефона: `+79991234567`
   - Ввести корректный пароль
   - Ожидаемый результат: успешный вход, получение токенов

2. **Ошибка: неверный номер телефона:**
   - Ввести несуществующий номер телефона
   - Ввести любой пароль
   - Ожидаемый результат: ошибка "Invalid credentials"

3. **Ошибка: неверный пароль:**
   - Ввести корректный номер телефона
   - Ввести неверный пароль
   - Ожидаемый результат: ошибка "Invalid credentials"

4. **Валидация: пустое поле:**
   - Оставить поле телефона пустым
   - Попытаться войти
   - Ожидаемый результат: ошибка валидации "Введите номер телефона"

## 📚 Дополнительная информация

- **API Endpoint:** `POST /auth/login`
- **Требуемая авторизация:** Нет (публичный endpoint)
- **Content-Type:** `application/json`
- **Коды ответов:**
  - `200` - Успешный вход
  - `401` - Неверные учетные данные
  - `400` - Ошибка валидации

