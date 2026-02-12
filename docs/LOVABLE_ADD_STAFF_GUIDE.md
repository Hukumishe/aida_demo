# Подробный гайд: Добавление нового сотрудника для Lovable

## Контекст
Нужно реализовать функционал добавления нового сотрудника (мастера или менеджера) в систему через форму на frontend.

**Важно:** Вместо поля "Предоставляет услуги" (checkbox) нужно реализовать **выбор услуг из списка**. Пользователь может выбрать несколько услуг (например: стрижка, депиляция, маникюр), которые мастер предоставляет. Услуги добавляются **после** создания сотрудника через отдельные API запросы.

---

## 📍 Куда обращаться (API Endpoint)

### Основной эндпоинт для создания сотрудника:

**POST** `https://aidaproject-production.up.railway.app/studios/:studioId/staff`

**Полный URL пример:**
```
POST https://aidaproject-production.up.railway.app/studios/123e4567-e89b-12d3-a456-426614174000/staff
```

**Важно:** Замени `:studioId` на реальный ID студии.

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

## 📝 Какие поля нужно заполнять

### Обязательные поля (Required):

1. **firstName** (string)
   - Имя сотрудника
   - Пример: `"Иван"`
   - Валидация: не может быть пустым

2. **password** (string)
   - Пароль для входа
   - Пример: `"password123"`
   - Валидация: минимум 6 символов

3. **role** (enum)
   - Роль сотрудника
   - Возможные значения: `"MANAGER"` или `"MASTER"`
   - Пример: `"MASTER"`
   - **Важно:** Роль `"OWNER"` нельзя создать через этот эндпоинт

4. **email ИЛИ phone** (хотя бы одно обязательно)
   - Email: строка в формате email, пример: `"ivan@example.com"`
   - Phone: строка, пример: `"+79991234567"`
   - **Важно:** Должен быть указан хотя бы один (email или phone), но можно указать оба

### Опциональные поля (Optional):

5. **lastName** (string, optional)
   - Фамилия сотрудника
   - Пример: `"Иванов"`
   - Можно оставить пустым

6. **title** (string, optional)
   - Должность сотрудника
   - Пример: `"Старший мастер"`
   - Можно оставить пустым

7. **category** (string, optional)
   - Категория/специализация
   - Пример: `"Парикмахер"` или `"Визажист"`
   - Можно оставить пустым

8. **Услуги (services)** - опционально
   - **ВАЖНО:** Услуги НЕ отправляются в запрос создания сотрудника!
   - Это массив ID услуг, которые мастер предоставляет
   - После создания сотрудника нужно добавить каждую услугу отдельно через API
   - **Как получить список услуг:** `GET /studios/:studioId/services` (см. раздел ниже)

---

## 📋 Полный пример запроса

### Пример 1: Минимальные обязательные поля

```json
{
  "firstName": "Иван",
  "email": "ivan@example.com",
  "password": "password123",
  "role": "MASTER"
}
```

### Пример 2: Все поля заполнены (без услуг)

```json
{
  "firstName": "Иван",
  "lastName": "Иванов",
  "email": "ivan@example.com",
  "phone": "+79991234567",
  "password": "password123",
  "role": "MASTER",
  "title": "Старший мастер",
  "category": "Парикмахер"
}
```

**Важно:** Услуги добавляются отдельно после создания сотрудника (см. раздел "Добавление услуг сотруднику").

### Пример 3: Только телефон (без email)

```json
{
  "firstName": "Мария",
  "phone": "+79991234568",
  "password": "securepass123",
  "role": "MANAGER"
}
```

---

## 🛠️ Получение списка услуг для выбора

**Перед созданием сотрудника нужно загрузить список доступных услуг:**

**GET** `https://aidaproject-production.up.railway.app/studios/:studioId/services`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
[
  {
    "id": "service-uuid-1",
    "studioId": "studio-uuid",
    "name": "Стрижка",
    "defaultDurationMin": 60,
    "defaultPrice": 2000,
    "requiredStaffCount": 1,
    "isActive": true,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "service-uuid-2",
    "studioId": "studio-uuid",
    "name": "Окрашивание",
    "defaultDurationMin": 120,
    "defaultPrice": 5000,
    "requiredStaffCount": 1,
    "isActive": true,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "service-uuid-3",
    "name": "Маникюр",
    "defaultDurationMin": 90,
    "defaultPrice": 3000,
    ...
  }
]
```

**Пример кода для загрузки услуг:**
```javascript
async function getServices(studioId, accessToken) {
  try {
    const response = await fetch(
      `https://aidaproject-production.up.railway.app/studios/${studioId}/services`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Нет доступа к этой студии');
      }
      if (response.status === 401) {
        throw new Error('Требуется авторизация');
      }
      const error = await response.json();
      throw new Error(error.message || 'Не удалось загрузить список услуг');
    }
    
    const services = await response.json();
    
    // Проверка: если массив пустой, это нормально (просто нет услуг)
    // НЕ выбрасываем ошибку, просто возвращаем пустой массив
    return services || [];
  } catch (error) {
    console.error('Error loading services:', error);
    throw error;
  }
}
```

**Важно:** 
- Если запрос возвращает пустой массив `[]` - это **нормально**, просто нет услуг в студии
- НЕ показывайте ошибку "нет доступных услуг" если запрос успешен (200 OK)
- Показывайте сообщение "Нет доступных услуг" только если массив пустой, но не как ошибку

**Диагностика проблемы "нет доступных услуг":**

1. **Проверьте studioId:**
   - Убедитесь, что `studioId` в запросе совпадает с `studioId` пользователя
   - Для MANAGER/MASTER: используйте `user.studioId`
   - Для OWNER: убедитесь, что выбран правильный `studioId`

2. **Проверьте ответ API:**
   ```javascript
   const services = await getServices(studioId, accessToken);
   console.log('Services loaded:', services);
   console.log('Services count:', services.length);
   console.log('StudioId used:', studioId);
   ```

3. **Проверьте права доступа:**
   - Если получаете 403 - проверьте, что `user.studioId === studioId`
   - Если получаете 401 - обновите токен

4. **Проверьте данные в базе:**
   - Убедитесь, что услуга в базе имеет правильный `studioId`
   - Убедитесь, что услуга существует и `isActive` может быть `true` или `false` (оба должны возвращаться)

5. **Правильная обработка на frontend:**
   ```javascript
   const services = await getServices(studioId, accessToken);
   
   if (services.length === 0) {
     // Показываем информационное сообщение, НЕ ошибку
     setServicesMessage('В студии пока нет услуг. Сначала создайте услуги.');
     setServices([]);
   } else {
     setServices(services);
     setServicesMessage(null);
   }
   ```

6. **Отладка в консоли браузера:**
   ```javascript
   // Добавьте эти логи для отладки
   console.log('Current user:', currentUser);
   console.log('User studioId:', currentUser.studioId);
   console.log('Service studioId from DB:', 'проверьте в базе данных');
   console.log('Request URL:', `https://aidaproject-production.up.railway.app/studios/${studioId}/services`);
   console.log('Response status:', response.status);
   console.log('Response data:', services);
   ```

7. **Проверка в Network tab браузера:**
   - Откройте DevTools → Network
   - Найдите запрос `GET /studios/.../services`
   - Проверьте:
     - **Status Code**: должен быть 200 (не 403, не 401)
     - **Response**: должен быть массив (даже если пустой `[]`)
     - **Request Headers**: должен быть `Authorization: Bearer ...`
     - **Request URL**: проверьте, что `studioId` правильный

---

## 💻 Пример кода для отправки запроса

### JavaScript/TypeScript:

```javascript
async function createStaff(studioId, staffData, accessToken) {
  try {
    const response = await fetch(
      `https://aidaproject-production.up.railway.app/studios/${studioId}/staff`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          firstName: staffData.firstName,        // обязательное
          lastName: staffData.lastName,          // опционально
          email: staffData.email,                // опционально (но нужен email ИЛИ phone)
          phone: staffData.phone,                // опционально (но нужен email ИЛИ phone)
          password: staffData.password,          // обязательное, минимум 6 символов
          role: staffData.role,                  // обязательное: "MANAGER" или "MASTER"
          title: staffData.title,               // опционально
          category: staffData.category          // опционально
          // ВАЖНО: услуги (serviceIds) НЕ отправляются здесь!
          // Они добавляются отдельно после создания сотрудника
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Ошибка при создании сотрудника');
    }

    const newStaff = await response.json();
    return newStaff;
  } catch (error) {
    console.error('Error creating staff:', error);
    throw error;
  }
}
```

---

## ✅ Успешный ответ (201 Created)

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "ivan@example.com",
  "phone": "+79991234567",
  "role": "MASTER",
  "studioId": "studio-uuid-here",
  "isActive": true,
  "createdAt": "2026-02-01T12:00:00.000Z",
  "updatedAt": "2026-02-01T12:00:00.000Z",
  "staffProfile": {
    "userId": "123e4567-e89b-12d3-a456-426614174000",
    "firstName": "Иван",
    "lastName": "Иванов",
    "title": "Старший мастер",
    "category": "Парикмахер",
    "providesServices": true
  },
  "staffServices": []  // Пустой массив, услуги нужно добавить отдельно
}
```

**Что делать после успешного ответа:**
1. **Добавить услуги сотруднику** (если были выбраны):
   - Для каждой выбранной услуги вызвать `POST /staff/:staffUserId/services`
   - См. раздел "Добавление услуг сотруднику" ниже
2. Закрыть модальное окно/форму
3. Показать уведомление: "Сотрудник успешно добавлен"
4. Обновить список сотрудников на странице
5. Очистить форму

---

## ❌ Обработка ошибок

### 400 Bad Request - Ошибки валидации:

```json
{
  "statusCode": 400,
  "message": [
    "firstName should not be empty",
    "password must be longer than or equal to 6 characters",
    "email must be an email"
  ],
  "error": "Bad Request"
}
```

**Что делать:**
- Показать пользователю конкретные ошибки валидации
- Подсветить поля с ошибками в форме

### 400 Bad Request - Бизнес-логика:

```json
{
  "statusCode": 400,
  "message": "Email already exists",
  "error": "Bad Request"
}
```

или

```json
{
  "statusCode": 400,
  "message": "Phone already exists",
  "error": "Bad Request"
}
```

**Что делать:**
- Показать сообщение: "Email уже используется" или "Телефон уже используется"
- Предложить использовать другой email/phone

### 401 Unauthorized:

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Что делать:**
- Перенаправить на страницу входа
- Обновить токен через `/auth/refresh`

### 403 Forbidden:

```json
{
  "statusCode": 403,
  "message": "Access denied to this studio"
}
```

**Что делать:**
- Показать сообщение: "У вас нет доступа к этой студии"
- Проверить, что пользователь имеет права на создание сотрудников

### 404 Not Found:

```json
{
  "statusCode": 404,
  "message": "Studio with ID {id} not found"
}
```

**Что делать:**
- Проверить, что `studioId` правильный
- Показать сообщение: "Студия не найдена"

---

## 🔍 Как получить studioId

### Вариант 1: Из текущего пользователя (для MANAGER/MASTER)

```javascript
// После логина, пользователь имеет:
const currentUser = {
  id: "user-uuid",
  role: "MANAGER",  // или "MASTER"
  studioId: "studio-uuid-here"  // <- использовать этот ID
};

const studioId = currentUser.studioId;
```

### Вариант 2: Для OWNER (нужно выбрать студию)

Если пользователь OWNER, у него может быть доступ к нескольким студиям. Нужно:
1. Получить список студий через `GET /studios` (если такой эндпоинт есть)
2. Позволить пользователю выбрать студию
3. Использовать выбранный `studioId`

---

## 📱 Пример полной формы с валидацией

```javascript
const AddStaffForm = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    role: 'MASTER',
    title: '',
    category: '',
    serviceIds: []  // массив ID выбранных услуг
  });
  const [services, setServices] = useState([]);  // список доступных услуг
  
  // Загрузить услуги при открытии формы
  useEffect(() => {
    async function loadServices() {
      try {
        const studioId = currentUser.studioId; // или selectedStudioId для OWNER
        
        // ВАЖНО: Проверьте, что studioId существует
        if (!studioId) {
          console.error('StudioId не найден');
          setServices([]);
          return;
        }
        
        console.log('Loading services for studioId:', studioId);
        const servicesList = await getServices(studioId, accessToken);
        console.log('Services loaded:', servicesList);
        
        // Обработка пустого массива - это нормально, не ошибка
        if (Array.isArray(servicesList)) {
          setServices(servicesList);
          if (servicesList.length === 0) {
            console.log('Нет доступных услуг в студии');
            // Можно показать информационное сообщение, но не ошибку
          }
        } else {
          console.error('Services is not an array:', servicesList);
          setServices([]);
        }
      } catch (error) {
        console.error('Ошибка загрузки услуг:', error);
        setServices([]);
        // Показываем ошибку только если это реальная ошибка (не пустой массив)
        if (error.message && !error.message.includes('пустой')) {
          showNotification('Не удалось загрузить список услуг: ' + error.message, 'error');
        }
      }
    }
    if (isModalOpen) {
      loadServices();
    }
  }, [isModalOpen, currentUser.studioId]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const newErrors = {};

    // Обязательные поля
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'Имя обязательно';
    }

    if (!formData.email && !formData.phone) {
      newErrors.email = 'Укажите email или телефон';
      newErrors.phone = 'Укажите email или телефон';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Некорректный email';
    }

    if (!formData.password || formData.password.length < 6) {
      newErrors.password = 'Пароль должен быть минимум 6 символов';
    }

    if (!formData.role) {
      newErrors.role = 'Выберите роль';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Функция для добавления услуги сотруднику
  const addServiceToStaff = async (staffUserId, serviceId, accessToken) => {
    const response = await fetch(
      `https://aidaproject-production.up.railway.app/staff/${staffUserId}/services`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ serviceId })
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Ошибка при добавлении услуги');
    }
    
    return await response.json();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      const studioId = currentUser.studioId; // или selectedStudioId для OWNER
      
      // Создать сотрудника (без услуг)
      const newStaff = await createStaff(studioId, formData, accessToken);
      
      // Добавить услуги сотруднику (если были выбраны)
      if (formData.serviceIds && formData.serviceIds.length > 0) {
        let addedCount = 0;
        for (const serviceId of formData.serviceIds) {
          try {
            await addServiceToStaff(newStaff.id, serviceId, accessToken);
            addedCount++;
          } catch (error) {
            console.error(`Ошибка добавления услуги ${serviceId}:`, error);
            // Продолжаем добавлять остальные услуги даже если одна не добавилась
          }
        }
        
        if (addedCount > 0) {
          showNotification(`Сотрудник создан. Добавлено услуг: ${addedCount}`, 'success');
        } else {
          showNotification('Сотрудник создан, но не удалось добавить услуги', 'warning');
        }
      } else {
        showNotification('Сотрудник успешно добавлен', 'success');
      }
      
      onClose(); // Закрыть модальное окно
      onSuccess(newStaff); // Обновить список
      
      // Очистить форму
      setFormData({
        firstName: '', lastName: '', email: '', phone: '',
        password: '', role: 'MASTER', title: '', category: '',
        serviceIds: []
      });
    } catch (error) {
      showNotification(error.message || 'Ошибка при создании сотрудника', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Имя - обязательное */}
      <div>
        <label>Имя *</label>
        <input
          value={formData.firstName}
          onChange={(e) => setFormData({...formData, firstName: e.target.value})}
          required
        />
        {errors.firstName && <span className="error">{errors.firstName}</span>}
      </div>

      {/* Фамилия - опциональное */}
      <div>
        <label>Фамилия</label>
        <input
          value={formData.lastName}
          onChange={(e) => setFormData({...formData, lastName: e.target.value})}
        />
      </div>

      {/* Email - опциональное, но нужен email ИЛИ phone */}
      <div>
        <label>Email</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
        />
        {errors.email && <span className="error">{errors.email}</span>}
      </div>

      {/* Телефон - опциональное, но нужен email ИЛИ phone */}
      <div>
        <label>Телефон</label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({...formData, phone: e.target.value})}
        />
        {errors.phone && <span className="error">{errors.phone}</span>}
      </div>

      {/* Пароль - обязательное */}
      <div>
        <label>Пароль *</label>
        <input
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({...formData, password: e.target.value})}
          minLength={6}
          required
        />
        {errors.password && <span className="error">{errors.password}</span>}
      </div>

      {/* Роль - обязательное */}
      <div>
        <label>Роль *</label>
        <select
          value={formData.role}
          onChange={(e) => setFormData({...formData, role: e.target.value})}
          required
        >
          <option value="MASTER">Мастер</option>
          <option value="MANAGER">Менеджер</option>
        </select>
        {errors.role && <span className="error">{errors.role}</span>}
      </div>

      {/* Должность - опциональное */}
      <div>
        <label>Должность</label>
        <input
          value={formData.title}
          onChange={(e) => setFormData({...formData, title: e.target.value})}
        />
      </div>

      {/* Категория - опциональное */}
      <div>
        <label>Категория</label>
        <input
          value={formData.category}
          onChange={(e) => setFormData({...formData, category: e.target.value})}
          placeholder="Например: Парикмахер, Визажист"
        />
      </div>

      {/* Услуги - опциональное, можно использовать чекбоксы или мультиселект */}
      <div>
        <label>Услуги (можно выбрать несколько)</label>
        
        {services.length === 0 ? (
          <div style={{ padding: '10px', background: '#f5f5f5', borderRadius: '4px', color: '#666' }}>
            <p>В студии пока нет услуг.</p>
            <p style={{ fontSize: '12px', marginTop: '5px' }}>
              Сначала создайте услуги в разделе "Услуги", затем они появятся здесь.
            </p>
          </div>
        ) : (
          /* Вариант 1: Чекбоксы (рекомендуется - удобнее для пользователя) */
          <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ccc', padding: '10px' }}>
            {services.map(service => (
              <label key={service.id} style={{ display: 'block', marginBottom: '8px' }}>
                <input
                  type="checkbox"
                  checked={formData.serviceIds?.includes(service.id) || false}
                  onChange={(e) => {
                    const currentIds = formData.serviceIds || [];
                    if (e.target.checked) {
                      setFormData({...formData, serviceIds: [...currentIds, service.id]});
                    } else {
                      setFormData({...formData, serviceIds: currentIds.filter(id => id !== service.id)});
                    }
                  }}
                />
                {service.name} ({service.defaultDurationMin} мин, {service.defaultPrice}₸)
              </label>
            ))}
          </div>
        )}
        
        {/* Вариант 2: Мультиселект (альтернатива) */}
        {/* 
        <select
          multiple
          value={formData.serviceIds || []}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions, option => option.value);
            setFormData({...formData, serviceIds: selected});
          }}
          style={{ minHeight: '150px' }}
        >
          {services.map(service => (
            <option key={service.id} value={service.id}>
              {service.name} ({service.defaultDurationMin} мин, {service.defaultPrice}₸)
            </option>
          ))}
        </select>
        <small>Удерживайте Ctrl (или Cmd на Mac) для выбора нескольких услуг</small>
        */}
        
        {formData.serviceIds && formData.serviceIds.length > 0 && (
          <small style={{ color: 'green' }}>
            Выбрано услуг: {formData.serviceIds.length}
          </small>
        )}
      </div>

      <button type="submit" disabled={loading}>
        {loading ? 'Создание...' : 'Создать сотрудника'}
      </button>
      <button type="button" onClick={onClose}>Отмена</button>
    </form>
  );
};
```

---

## ✅ Чек-лист для успешного добавления сотрудника

- [ ] Получен `accessToken` (из localStorage или state после логина)
- [ ] Получен `studioId` (из текущего пользователя или выбран пользователем)
- [ ] Заполнено обязательное поле `firstName`
- [ ] Заполнено хотя бы одно: `email` ИЛИ `phone`
- [ ] Заполнено обязательное поле `password` (минимум 6 символов)
- [ ] Выбрана роль: `"MANAGER"` или `"MASTER"` (не `"OWNER"`)
- [ ] Email в правильном формате (если указан)
- [ ] Загружен список услуг через `GET /studios/:studioId/services` (для отображения в форме)
- [ ] Выбраны услуги для мастера (опционально, но рекомендуется для MASTER)
- [ ] Запрос отправлен с правильными заголовками:
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
- [ ] Обработаны возможные ошибки (400, 401, 403, 404)
- [ ] При успехе (201) создания сотрудника:
  - Добавлены выбранные услуги через `POST /staff/:staffUserId/services` для каждой услуги
  - Закрыто модальное окно
  - Показано уведомление
  - Обновлен список сотрудников

---

## ➕ Добавление услуг сотруднику после создания

**После успешного создания сотрудника нужно добавить выбранные услуги:**

**POST** `https://aidaproject-production.up.railway.app/staff/:staffUserId/services`

**Headers:**
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Body:**
```json
{
  "serviceId": "service-uuid-here"
}
```

**Пример кода:**
```javascript
async function addServiceToStaff(staffUserId, serviceId, accessToken) {
  try {
    const response = await fetch(
      `https://aidaproject-production.up.railway.app/staff/${staffUserId}/services`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          serviceId: serviceId
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Ошибка при добавлении услуги');
    }

    return await response.json();
  } catch (error) {
    console.error('Error adding service to staff:', error);
    throw error;
  }
}

// Добавить несколько услуг сотруднику
async function addServicesToStaff(staffUserId, serviceIds, accessToken) {
  const results = [];
  for (const serviceId of serviceIds) {
    try {
      const result = await addServiceToStaff(staffUserId, serviceId, accessToken);
      results.push({ serviceId, success: true, data: result });
    } catch (error) {
      results.push({ serviceId, success: false, error: error.message });
    }
  }
  return results;
}
```

**Использование в форме:**
```javascript
// После успешного создания сотрудника
const newStaff = await createStaff(studioId, staffData, accessToken);

// Добавить выбранные услуги
if (formData.serviceIds && formData.serviceIds.length > 0) {
  await addServicesToStaff(newStaff.id, formData.serviceIds, accessToken);
  showNotification(`Сотрудник создан. Добавлено услуг: ${formData.serviceIds.length}`, 'success');
} else {
  showNotification('Сотрудник успешно добавлен', 'success');
}
```

**Response (201):**
```json
{
  "id": "staff-service-uuid",
  "studioId": "studio-uuid",
  "staffUserId": "staff-uuid",
  "serviceId": "service-uuid",
  "createdAt": "2026-02-01T12:00:00.000Z",
  "updatedAt": "2026-02-01T12:00:00.000Z",
  "service": {
    "id": "service-uuid",
    "name": "Стрижка",
    "defaultDurationMin": 60,
    "defaultPrice": 2000,
    ...
  }
}
```

**Ошибки:**
- `400` - Услуга уже назначена этому сотруднику
- `403` - Нет доступа
- `404` - Сотрудник или услуга не найдены

---

## 🔄 Обновление списка сотрудников после создания

После успешного создания сотрудника, обнови список:

```javascript
// Вариант 1: Перезагрузить список через API
async function refreshStaffList(studioId, accessToken) {
  const response = await fetch(
    `https://aidaproject-production.up.railway.app/studios/${studioId}/staff`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );
  const staffList = await response.json();
  return staffList;
}

// Вариант 2: Добавить нового сотрудника в локальный state
// (используй данные из ответа создания)
```

---

## 📚 Дополнительная информация

### Роли сотрудников:

- **MASTER** - Мастер (предоставляет услуги клиентам)
- **MANAGER** - Менеджер (управляет записями, но может не предоставлять услуги)
- **OWNER** - Владелец (нельзя создать через этот эндпоинт)

### После создания сотрудника:

- Сотрудник сразу может войти в систему используя указанные `email`/`phone` и `password`
- Сотрудник автоматически привязан к студии (`studioId`)
- **Услуги нужно добавить отдельно** через `POST /staff/:staffUserId/services` для каждой выбранной услуги
- Если услуги не были выбраны при создании, их можно добавить позже

---

## 🎯 Итоговая схема работы

1. **Пользователь открывает форму** "Добавить сотрудника"
2. **Заполняет поля** (обязательные + опциональные)
3. **Валидация на frontend** (проверка обязательных полей)
4. **Отправка запроса** `POST /studios/:studioId/staff`
5. **Обработка ответа:**
   - ✅ **201** - Успех → закрыть форму, показать уведомление, обновить список
   - ❌ **400** - Ошибка валидации → показать ошибки
   - ❌ **401** - Не авторизован → перенаправить на вход
   - ❌ **403** - Нет доступа → показать сообщение
   - ❌ **404** - Студия не найдена → проверить studioId

---

## 💡 Полезные советы

1. **Показывай индикатор загрузки** во время отправки запроса
2. **Валидируй на frontend** перед отправкой (экономит время и запросы)
3. **Показывай конкретные ошибки** пользователю (не просто "Ошибка")
4. **Очищай форму** после успешного создания
5. **Обновляй список** автоматически после создания (не заставляй пользователя обновлять страницу)

