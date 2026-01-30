# Настройка кнопки "Добавить сотрудника" для Lovable

## Контекст
На странице "График работы" (Work Schedule) есть кнопка "+ Добавить сотрудника". Нужно настроить её для создания нового сотрудника через API.

## API Endpoint для создания сотрудника

**POST** `https://aidaproject-production.up.railway.app/studios/:studioId/staff`

**Headers:**
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Body:**
```json
{
  "email": "newmaster@example.com",           // опционально (email или phone обязателен)
  "phone": "+79991234570",                    // опционально (email или phone обязателен)
  "password": "password123",                  // обязательное, минимум 6 символов
  "role": "MASTER",                           // обязательное: "OWNER" | "MANAGER" | "MASTER"
  "firstName": "Иван",                        // обязательное
  "lastName": "Иванов",                       // опционально
  "title": "Старший мастер",                  // опционально (должность)
  "category": "Парикмахер",                   // опционально (категория)
  "providesServices": true                    // опционально, по умолчанию true
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "email": "newmaster@example.com",
  "phone": "+79991234570",
  "role": "MASTER",
  "studioId": "uuid",
  "isActive": true,
  "createdAt": "2024-01-29T00:00:00.000Z",
  "updatedAt": "2024-01-29T00:00:00.000Z",
  "staffProfile": {
    "userId": "uuid",
    "firstName": "Иван",
    "lastName": "Иванов",
    "title": "Старший мастер",
    "category": "Парикмахер",
    "providesServices": true
  }
}
```

**Ошибки:**
- `400` - Validation error (неправильные данные)
- `401` - Unauthorized (нет токена или токен невалидный)
- `403` - Forbidden (нет доступа к студии)
- `404` - Studio not found

## Реализация кнопки

### 1. Модальное окно/форма

При клике на кнопку "+ Добавить сотрудника" открыть модальное окно с формой:

**Поля формы:**
- **Имя** (firstName) - обязательное, текстовое поле
- **Фамилия** (lastName) - опциональное, текстовое поле
- **Email** - опциональное, email поле (но должен быть email ИЛИ phone)
- **Телефон** - опциональное, текстовое поле (но должен быть email ИЛИ phone)
- **Пароль** - обязательное, поле с типом password, минимум 6 символов
- **Роль** - обязательное, dropdown/select:
  - "Менеджер" (MANAGER)
  - "Мастер" (MASTER)
  - "Владелец" (OWNER) - только если текущий пользователь OWNER
- **Должность** (title) - опциональное, текстовое поле
- **Категория** (category) - опциональное, текстовое поле (например: "Парикмахер", "Визажист")
- **Предоставляет услуги** (providesServices) - checkbox, по умолчанию true

### 2. Валидация формы

- Проверить, что заполнено хотя бы одно: email ИЛИ phone
- Проверить, что пароль минимум 6 символов
- Проверить, что имя заполнено
- Если email указан - проверить формат email

### 3. Отправка запроса

```javascript
async function createStaff(studioId, staffData) {
  const response = await fetch(
    `https://aidaproject-production.up.railway.app/studios/${studioId}/staff`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: staffData.email || undefined,
        phone: staffData.phone || undefined,
        password: staffData.password,
        role: staffData.role, // "MANAGER" или "MASTER"
        firstName: staffData.firstName,
        lastName: staffData.lastName || undefined,
        title: staffData.title || undefined,
        category: staffData.category || undefined,
        providesServices: staffData.providesServices !== false
      })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Ошибка при создании сотрудника');
  }

  return await response.json();
}
```

### 4. Обработка ответа

**Успех (201):**
- Закрыть модальное окно
- Показать уведомление "Сотрудник успешно добавлен"
- Обновить список сотрудников (если он отображается на странице)
- Очистить форму

**Ошибка:**
- Показать сообщение об ошибке пользователю
- Если `400` - показать конкретные ошибки валидации
- Если `403` - показать "Нет доступа к этой студии"
- Если `401` - перенаправить на страницу входа

### 5. Получение studioId

StudioId можно получить из:
- Текущего пользователя: `user.studioId` (если MANAGER или MASTER)
- Или из списка студий, если пользователь OWNER (нужно выбрать студию)

### 6. Обновление списка сотрудников

После успешного создания сотрудника:
- Если на странице есть список сотрудников - обновить его через:
  ```
  GET /studios/:studioId/staff
  ```
- Или добавить нового сотрудника в локальный state без дополнительного запроса

## Пример полной реализации

```javascript
// Компонент кнопки "Добавить сотрудника"
const AddStaffButton = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    role: 'MASTER',
    title: '',
    category: '',
    providesServices: true
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Валидация
    if (!formData.firstName) {
      alert('Имя обязательно');
      return;
    }
    if (!formData.email && !formData.phone) {
      alert('Укажите email или телефон');
      return;
    }
    if (!formData.password || formData.password.length < 6) {
      alert('Пароль должен быть минимум 6 символов');
      return;
    }

    try {
      const studioId = currentUser.studioId || selectedStudioId;
      const newStaff = await createStaff(studioId, formData);
      
      // Успех
      setIsModalOpen(false);
      showNotification('Сотрудник успешно добавлен');
      refreshStaffList(); // Обновить список
      
      // Очистить форму
      setFormData({
        firstName: '', lastName: '', email: '', phone: '',
        password: '', role: 'MASTER', title: '', category: '',
        providesServices: true
      });
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <>
      <button onClick={() => setIsModalOpen(true)}>
        + Добавить сотрудника
      </button>
      
      {isModalOpen && (
        <Modal onClose={() => setIsModalOpen(false)}>
          <form onSubmit={handleSubmit}>
            <input
              placeholder="Имя *"
              value={formData.firstName}
              onChange={(e) => setFormData({...formData, firstName: e.target.value})}
              required
            />
            <input
              placeholder="Фамилия"
              value={formData.lastName}
              onChange={(e) => setFormData({...formData, lastName: e.target.value})}
            />
            <input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
            <input
              placeholder="Телефон"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
            />
            <input
              type="password"
              placeholder="Пароль *"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              required
              minLength={6}
            />
            <select
              value={formData.role}
              onChange={(e) => setFormData({...formData, role: e.target.value})}
            >
              <option value="MASTER">Мастер</option>
              <option value="MANAGER">Менеджер</option>
            </select>
            <input
              placeholder="Должность"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
            />
            <input
              placeholder="Категория"
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
            />
            <label>
              <input
                type="checkbox"
                checked={formData.providesServices}
                onChange={(e) => setFormData({...formData, providesServices: e.target.checked})}
              />
              Предоставляет услуги
            </label>
            <button type="submit">Создать</button>
            <button type="button" onClick={() => setIsModalOpen(false)}>Отмена</button>
          </form>
        </Modal>
      )}
    </>
  );
};
```

## Важные замечания

1. **Роль OWNER** - обычно не создается через эту кнопку, только MANAGER и MASTER
2. **Email или Phone** - хотя бы одно должно быть заполнено
3. **Пароль** - минимум 6 символов, сохраняется в зашифрованном виде на бэкенде
4. **StudioId** - берется из текущего пользователя (для MANAGER/MASTER) или выбирается (для OWNER)
5. **После создания** - сотрудник сразу доступен в системе и может войти с указанными email/phone и паролем


