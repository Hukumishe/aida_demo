# Подробный гайд: Добавление нового филиала для Lovable

## Контекст
Нужно реализовать функционал добавления нового филиала (студии) в систему через форму на frontend.

**Важно:** Создавать филиалы могут **только пользователи с ролью OWNER**. MANAGER и MASTER не имеют доступа к этой функции.

---

## 📍 Куда обращаться (API Endpoint)

### Основной эндпоинт для создания филиала:

**POST** `https://aidaproject-production.up.railway.app/studios`

**Полный URL:**
```
POST https://aidaproject-production.up.railway.app/studios
```

**Важно:** 
- Не требуется указывать `studioId` в URL (в отличие от других эндпоинтов)
- Филиал создается независимо от текущего филиала пользователя

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

**Проверка роли пользователя:**
- Перед показом формы создания филиала проверьте, что `user.role === "OWNER"`
- Если роль не OWNER, скройте или отключите кнопку/форму создания филиала

---

## 📝 Какие поля нужно заполнять

### Обязательные поля (Required):

1. **name** (string)
   - Название филиала
   - Пример: `"Beauty Studio Almaty"` или `"Салон красоты на Абая"`
   - Валидация: не может быть пустым, должна быть строка

### Опциональные поля (Optional):

2. **address** (string, optional)
   - Адрес филиала
   - Пример: `"Almaty, Abay Ave 150"` или `"Алматы, пр. Абая 150"`
   - Можно оставить пустым

3. **timezone** (string, optional)
   - Часовой пояс филиала
   - Пример: `"Asia/Almaty"` или `"Europe/Moscow"`
   - По умолчанию: `"Asia/Almaty"` (если не указан)
   - Рекомендуется использовать выпадающий список с популярными часовыми поясами

---

## 📋 Полный пример запроса

### Пример 1: Минимальные обязательные поля

```json
{
  "name": "Beauty Studio Almaty"
}
```

### Пример 2: С адресом

```json
{
  "name": "Beauty Studio Almaty",
  "address": "Almaty, Abay Ave 150"
}
```

### Пример 3: Полный запрос со всеми полями

```json
{
  "name": "Beauty Studio Almaty",
  "address": "Almaty, Abay Ave 150",
  "timezone": "Asia/Almaty"
}
```

### Пример 4: Без timezone (будет использован по умолчанию)

```json
{
  "name": "Салон красоты на Абая",
  "address": "Алматы, пр. Абая 150"
}
```

---

## 💻 Пример кода для отправки запроса

### JavaScript/TypeScript:

```javascript
async function createStudio(studioData, accessToken) {
  try {
    const response = await fetch(
      'https://aidaproject-production.up.railway.app/studios',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: studioData.name,                    // обязательное
          address: studioData.address || undefined, // опционально
          timezone: studioData.timezone || undefined // опционально (по умолчанию "Asia/Almaty")
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Ошибка при создании филиала');
    }

    const newStudio = await response.json();
    return newStudio;
  } catch (error) {
    console.error('Error creating studio:', error);
    throw error;
  }
}
```

### React компонент с формой:

```jsx
import React, { useState } from 'react';

function AddStudioForm({ accessToken, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    timezone: 'Asia/Almaty'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        'https://aidaproject-production.up.railway.app/studios',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: formData.name,
            address: formData.address || undefined,
            timezone: formData.timezone || undefined
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при создании филиала');
      }

      const newStudio = await response.json();
      onSuccess(newStudio);
      
      // Очистка формы
      setFormData({
        name: '',
        address: '',
        timezone: 'Asia/Almaty'
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>
          Название филиала <span style={{color: 'red'}}>*</span>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            required
            placeholder="Beauty Studio Almaty"
          />
        </label>
      </div>

      <div>
        <label>
          Адрес
          <input
            type="text"
            value={formData.address}
            onChange={(e) => setFormData({...formData, address: e.target.value})}
            placeholder="Almaty, Abay Ave 150"
          />
        </label>
      </div>

      <div>
        <label>
          Часовой пояс
          <select
            value={formData.timezone}
            onChange={(e) => setFormData({...formData, timezone: e.target.value})}
          >
            <option value="Asia/Almaty">Алматы (UTC+6)</option>
            <option value="Asia/Aqtobe">Актобе (UTC+5)</option>
            <option value="Asia/Aqtau">Актау (UTC+5)</option>
            <option value="Asia/Oral">Уральск (UTC+5)</option>
            <option value="Europe/Moscow">Москва (UTC+3)</option>
            <option value="Asia/Tashkent">Ташкент (UTC+5)</option>
          </select>
        </label>
      </div>

      {error && (
        <div style={{color: 'red'}}>
          {error}
        </div>
      )}

      <div>
        <button type="submit" disabled={loading}>
          {loading ? 'Создание...' : 'Создать филиал'}
        </button>
        <button type="button" onClick={onCancel} disabled={loading}>
          Отмена
        </button>
      </div>
    </form>
  );
}

export default AddStudioForm;
```

---

## ✅ Успешный ответ (201 Created)

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Beauty Studio Almaty",
  "address": "Almaty, Abay Ave 150",
  "timezone": "Asia/Almaty",
  "createdAt": "2026-02-14T12:00:00.000Z",
  "updatedAt": "2026-02-14T12:00:00.000Z"
}
```

**Что делать после успешного создания:**
1. Показать сообщение об успехе: "Филиал успешно создан"
2. Обновить список филиалов (если он отображается на странице)
3. Опционально: перенаправить на страницу нового филиала или закрыть форму
4. Очистить форму

---

## ❌ Ошибки и их обработка

### 1. Ошибка 401 (Unauthorized) - Не авторизован

**Причина:** Токен отсутствует, истек или невалидный

**Решение:**
```javascript
if (response.status === 401) {
  // Обновить токен через refresh endpoint
  const newToken = await refreshToken();
  // Повторить запрос с новым токеном
  return createStudio(studioData, newToken);
}
```

### 2. Ошибка 403 (Forbidden) - Доступ запрещен

**Причина:** Пользователь не имеет роли OWNER

**Решение:**
```javascript
if (response.status === 403) {
  const error = await response.json();
  throw new Error('Только владелец может создавать филиалы');
}
```

**Проверка на frontend перед отправкой:**
```javascript
// Проверьте роль пользователя перед показом формы
if (user.role !== 'OWNER') {
  return <div>У вас нет прав для создания филиалов</div>;
}
```

### 3. Ошибка 400 (Bad Request) - Неверные данные

**Причина:** 
- Поле `name` отсутствует или пустое
- Неверный формат данных

**Пример ответа:**
```json
{
  "statusCode": 400,
  "message": ["name should not be empty", "name must be a string"],
  "error": "Bad Request"
}
```

**Решение:**
```javascript
if (response.status === 400) {
  const error = await response.json();
  const errorMessage = Array.isArray(error.message) 
    ? error.message.join(', ') 
    : error.message;
  throw new Error(`Ошибка валидации: ${errorMessage}`);
}
```

### 4. Ошибка 500 (Internal Server Error) - Ошибка сервера

**Причина:** Проблема на стороне сервера

**Решение:**
```javascript
if (response.status >= 500) {
  throw new Error('Ошибка сервера. Попробуйте позже');
}
```

### Полный пример обработки ошибок:

```javascript
async function createStudio(studioData, accessToken) {
  try {
    const response = await fetch(
      'https://aidaproject-production.up.railway.app/studios',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(studioData)
      }
    );

    if (!response.ok) {
      const error = await response.json();
      
      switch (response.status) {
        case 401:
          throw new Error('Сессия истекла. Пожалуйста, войдите снова');
        case 403:
          throw new Error('Только владелец может создавать филиалы');
        case 400:
          const errorMessage = Array.isArray(error.message) 
            ? error.message.join(', ') 
            : error.message;
          throw new Error(`Ошибка валидации: ${errorMessage}`);
        case 500:
          throw new Error('Ошибка сервера. Попробуйте позже');
        default:
          throw new Error(error.message || 'Ошибка при создании филиала');
      }
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating studio:', error);
    throw error;
  }
}
```

---

## 🔍 Валидация на frontend

Рекомендуется добавить валидацию на frontend перед отправкой запроса:

```javascript
function validateStudioData(studioData) {
  const errors = [];

  // Проверка обязательного поля name
  if (!studioData.name || studioData.name.trim() === '') {
    errors.push('Название филиала обязательно для заполнения');
  }

  // Проверка длины названия
  if (studioData.name && studioData.name.length > 255) {
    errors.push('Название филиала слишком длинное (максимум 255 символов)');
  }

  // Проверка формата timezone (опционально)
  if (studioData.timezone && !/^[A-Za-z_]+\/[A-Za-z_]+$/.test(studioData.timezone)) {
    errors.push('Неверный формат часового пояса');
  }

  return errors;
}

// Использование:
const errors = validateStudioData(formData);
if (errors.length > 0) {
  setValidationErrors(errors);
  return;
}
```

---

## 📋 Список популярных часовых поясов для Казахстана

Рекомендуется использовать выпадающий список с этими значениями:

```javascript
const timezones = [
  { value: 'Asia/Almaty', label: 'Алматы (UTC+6)' },
  { value: 'Asia/Aqtobe', label: 'Актобе (UTC+5)' },
  { value: 'Asia/Aqtau', label: 'Актау (UTC+5)' },
  { value: 'Asia/Oral', label: 'Уральск (UTC+5)' },
  { value: 'Asia/Qyzylorda', label: 'Кызылорда (UTC+5)' },
  { value: 'Asia/Atyrau', label: 'Атырау (UTC+5)' },
  { value: 'Asia/Oskemen', label: 'Усть-Каменогорск (UTC+6)' },
  { value: 'Asia/Pavlodar', label: 'Павлодар (UTC+6)' },
  { value: 'Asia/Qostanay', label: 'Костанай (UTC+6)' },
  { value: 'Asia/Shymkent', label: 'Шымкент (UTC+6)' },
  { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
  { value: 'Asia/Tashkent', label: 'Ташкент (UTC+5)' },
];
```

---

## 🔄 Обновление списка филиалов после создания

После успешного создания филиала рекомендуется обновить список филиалов:

```javascript
// Функция для получения списка филиалов
async function getStudios(accessToken) {
  try {
    const response = await fetch(
      'https://aidaproject-production.up.railway.app/studios',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Ошибка при загрузке списка филиалов');
    }

    return await response.json();
  } catch (error) {
    console.error('Error loading studios:', error);
    throw error;
  }
}

// Использование после создания:
const newStudio = await createStudio(studioData, accessToken);
const updatedStudios = await getStudios(accessToken);
setStudios(updatedStudios);
```

---

## 🎨 UI/UX Рекомендации

1. **Проверка роли перед показом формы:**
   - Если `user.role !== 'OWNER'`, не показывайте кнопку/форму создания филиала
   - Или покажите сообщение: "Только владелец может создавать филиалы"

2. **Валидация в реальном времени:**
   - Показывайте ошибки валидации сразу при вводе
   - Подсвечивайте обязательные поля красным, если они пустые

3. **Индикатор загрузки:**
   - Показывайте спиннер или "Создание..." во время запроса
   - Отключайте кнопку отправки во время загрузки

4. **Успешное сообщение:**
   - Показывайте зеленое уведомление: "Филиал успешно создан"
   - Автоматически скрывайте через 3-5 секунд

5. **Обработка ошибок:**
   - Показывайте ошибки красным цветом под формой
   - Для 403 ошибки: "Только владелец может создавать филиалы"
   - Для 400 ошибки: показывайте конкретные поля с ошибками

6. **Форма:**
   - Название: текстовое поле (обязательное, с красной звездочкой)
   - Адрес: текстовое поле (опциональное)
   - Часовой пояс: выпадающий список (по умолчанию "Asia/Almaty")

---

## 📝 Полный пример React компонента

```jsx
import React, { useState, useEffect } from 'react';

function AddStudioModal({ isOpen, onClose, accessToken, user, onStudioCreated }) {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    timezone: 'Asia/Almaty'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  // Проверка роли
  useEffect(() => {
    if (user?.role !== 'OWNER') {
      setError('Только владелец может создавать филиалы');
    }
  }, [user]);

  const timezones = [
    { value: 'Asia/Almaty', label: 'Алматы (UTC+6)' },
    { value: 'Asia/Aqtobe', label: 'Актобе (UTC+5)' },
    { value: 'Asia/Aqtau', label: 'Актау (UTC+5)' },
    { value: 'Asia/Oral', label: 'Уральск (UTC+5)' },
    { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
  ];

  const validate = () => {
    const errors = {};
    
    if (!formData.name || formData.name.trim() === '') {
      errors.name = 'Название филиала обязательно';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!validate()) {
      return;
    }

    if (user?.role !== 'OWNER') {
      setError('Только владелец может создавать филиалы');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        'https://aidaproject-production.up.railway.app/studios',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: formData.name.trim(),
            address: formData.address.trim() || undefined,
            timezone: formData.timezone || undefined
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        
        if (response.status === 403) {
          throw new Error('Только владелец может создавать филиалы');
        } else if (response.status === 400) {
          const errorMessage = Array.isArray(errorData.message)
            ? errorData.message.join(', ')
            : errorData.message;
          throw new Error(`Ошибка валидации: ${errorMessage}`);
        } else {
          throw new Error(errorData.message || 'Ошибка при создании филиала');
        }
      }

      const newStudio = await response.json();
      
      // Успех
      onStudioCreated(newStudio);
      onClose();
      
      // Очистка формы
      setFormData({
        name: '',
        address: '',
        timezone: 'Asia/Almaty'
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  if (user?.role !== 'OWNER') {
    return (
      <div className="modal">
        <div className="modal-content">
          <h2>Создание филиала</h2>
          <div style={{color: 'red'}}>
            Только владелец может создавать филиалы
          </div>
          <button onClick={onClose}>Закрыть</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal">
      <div className="modal-content">
        <h2>Создать новый филиал</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>
              Название филиала <span style={{color: 'red'}}>*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => {
                setFormData({...formData, name: e.target.value});
                if (validationErrors.name) {
                  setValidationErrors({...validationErrors, name: null});
                }
              }}
              placeholder="Beauty Studio Almaty"
              required
            />
            {validationErrors.name && (
              <span style={{color: 'red', fontSize: '12px'}}>
                {validationErrors.name}
              </span>
            )}
          </div>

          <div className="form-group">
            <label>Адрес</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              placeholder="Almaty, Abay Ave 150"
            />
          </div>

          <div className="form-group">
            <label>Часовой пояс</label>
            <select
              value={formData.timezone}
              onChange={(e) => setFormData({...formData, timezone: e.target.value})}
            >
              {timezones.map(tz => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div style={{color: 'red', marginBottom: '10px'}}>
              {error}
            </div>
          )}

          <div className="form-actions">
            <button type="submit" disabled={loading}>
              {loading ? 'Создание...' : 'Создать филиал'}
            </button>
            <button type="button" onClick={onClose} disabled={loading}>
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddStudioModal;
```

---

## 🔗 Связанные API endpoints

После создания филиала может понадобиться:

1. **Получить список всех филиалов:**
   ```
   GET /studios
   ```

2. **Получить информацию о филиале:**
   ```
   GET /studios/:studioId
   ```

3. **Создать сотрудника для нового филиала:**
   ```
   POST /studios/:studioId/staff
   ```

4. **Создать услугу для нового филиала:**
   ```
   POST /studios/:studioId/services
   ```

---

## ✅ Чеклист для реализации

- [ ] Проверка роли пользователя (только OWNER)
- [ ] Форма с полями: name (обязательное), address (опциональное), timezone (опциональное)
- [ ] Валидация на frontend перед отправкой
- [ ] Обработка всех типов ошибок (401, 403, 400, 500)
- [ ] Индикатор загрузки во время запроса
- [ ] Сообщение об успехе после создания
- [ ] Обновление списка филиалов после создания
- [ ] Очистка формы после успешного создания
- [ ] Выпадающий список с часовыми поясами
- [ ] UI/UX: подсветка обязательных полей, показ ошибок валидации

---

## 📚 Дополнительная информация

- **Базовая URL:** `https://aidaproject-production.up.railway.app`
- **Требуемая роль:** `OWNER`
- **Метод:** `POST`
- **Content-Type:** `application/json`
- **Авторизация:** JWT токен в заголовке `Authorization: Bearer <token>`

---

**Готово!** Теперь у вас есть вся информация для реализации функционала создания филиала на frontend.


