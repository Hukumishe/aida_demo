# Подробный гайд: Настройка кастомного времени и цены услуги для сотрудника (Lovable)

## Контекст
Нужно реализовать функционал для настройки индивидуального времени оказания услуги и цены для каждого сотрудника. Например, если услуга "Стрижка" обычно занимает 60 минут, но конкретный мастер делает её за 90 минут, можно установить кастомное время для этого мастера.

**Важно:** 
- Кастомные настройки можно установить только для услуг, которые уже назначены сотруднику
- Если кастомное время не установлено, используется время по умолчанию из услуги (`service.defaultDurationMin`)
- Кастомная цена также опциональна
- Можно включить/выключить кастомные настройки через поле `isActive`

---

## 📍 API Endpoints

### 1. Получить кастомные настройки для конкретной услуги сотрудника

**GET** `https://aidaproject-production.up.railway.app/staff/:staffUserId/services/:serviceId/override`

**Пример:**
```
GET https://aidaproject-production.up.railway.app/staff/123e4567-e89b-12d3-a456-426614174000/services/456e7890-e89b-12d3-a456-426614174001/override
```

### 2. Получить все кастомные настройки сотрудника

**GET** `https://aidaproject-production.up.railway.app/staff/:staffUserId/overrides`

**Пример:**
```
GET https://aidaproject-production.up.railway.app/staff/123e4567-e89b-12d3-a456-426614174000/overrides
```

### 3. Создать кастомные настройки для услуги

**POST** `https://aidaproject-production.up.railway.app/staff/:staffUserId/services/:serviceId/override`

**Пример:**
```
POST https://aidaproject-production.up.railway.app/staff/123e4567-e89b-12d3-a456-426614174000/services/456e7890-e89b-12d3-a456-426614174001/override
```

### 4. Обновить кастомные настройки для услуги

**PATCH** `https://aidaproject-production.up.railway.app/staff/:staffUserId/services/:serviceId/override`

**Пример:**
```
PATCH https://aidaproject-production.up.railway.app/staff/123e4567-e89b-12d3-a456-426614174000/services/456e7890-e89b-12d3-a456-426614174001/override
```

### 5. Удалить кастомные настройки для услуги

**DELETE** `https://aidaproject-production.up.railway.app/staff/:staffUserId/services/:serviceId/override`

**Пример:**
```
DELETE https://aidaproject-production.up.railway.app/staff/123e4567-e89b-12d3-a456-426614174000/services/456e7890-e89b-12d3-a456-426614174001/override
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

## 📝 Какие поля нужно заполнять

### Для создания/обновления кастомных настроек:

1. **durationMin** (number, optional)
   - Кастомное время оказания услуги в минутах
   - Пример: `90` (для 90 минут)
   - Минимум: `1`
   - Если не указано, используется время по умолчанию из услуги

2. **price** (number, optional)
   - Кастомная цена услуги (в тиынах/копейках)
   - Пример: `5000` (для 5000 тиын = 50 тенге)
   - Минимум: `0`
   - Если не указано, используется цена по умолчанию из услуги

3. **isActive** (boolean, optional)
   - Включены ли кастомные настройки
   - По умолчанию: `true`
   - Если `false`, используются настройки по умолчанию из услуги

**Важно:** 
- Хотя бы одно поле (`durationMin` или `price`) должно быть указано при создании
- Можно указать только `durationMin`, только `price`, или оба
- При обновлении можно изменить любое поле независимо

---

## 📋 Примеры запросов

### Пример 1: Создать кастомное время (90 минут вместо 60)

```json
{
  "durationMin": 90,
  "isActive": true
}
```

### Пример 2: Создать кастомное время и цену

```json
{
  "durationMin": 90,
  "price": 5000,
  "isActive": true
}
```

### Пример 3: Создать только кастомную цену

```json
{
  "price": 6000,
  "isActive": true
}
```

### Пример 4: Обновить только время

```json
{
  "durationMin": 120
}
```

### Пример 5: Временно отключить кастомные настройки

```json
{
  "isActive": false
}
```

---

## 💻 Пример кода для работы с overrides

### JavaScript/TypeScript функции:

```javascript
// Получить кастомные настройки для конкретной услуги
async function getServiceOverride(staffUserId, serviceId, accessToken) {
  try {
    const response = await fetch(
      `https://aidaproject-production.up.railway.app/staff/${staffUserId}/services/${serviceId}/override`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.status === 404) {
      // Override не существует - это нормально
      return null;
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Ошибка при получении кастомных настроек');
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting service override:', error);
    throw error;
  }
}

// Получить все кастомные настройки сотрудника
async function getStaffServiceOverrides(staffUserId, accessToken) {
  try {
    const response = await fetch(
      `https://aidaproject-production.up.railway.app/staff/${staffUserId}/overrides`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Ошибка при получении кастомных настроек');
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting staff overrides:', error);
    throw error;
  }
}

// Создать кастомные настройки
async function createServiceOverride(staffUserId, serviceId, overrideData, accessToken) {
  try {
    const response = await fetch(
      `https://aidaproject-production.up.railway.app/staff/${staffUserId}/services/${serviceId}/override`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          durationMin: overrideData.durationMin,
          price: overrideData.price,
          isActive: overrideData.isActive ?? true
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Ошибка при создании кастомных настроек');
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating service override:', error);
    throw error;
  }
}

// Обновить кастомные настройки
async function updateServiceOverride(staffUserId, serviceId, overrideData, accessToken) {
  try {
    const response = await fetch(
      `https://aidaproject-production.up.railway.app/staff/${staffUserId}/services/${serviceId}/override`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          durationMin: overrideData.durationMin,
          price: overrideData.price,
          isActive: overrideData.isActive
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Ошибка при обновлении кастомных настроек');
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating service override:', error);
    throw error;
  }
}

// Удалить кастомные настройки
async function deleteServiceOverride(staffUserId, serviceId, accessToken) {
  try {
    const response = await fetch(
      `https://aidaproject-production.up.railway.app/staff/${staffUserId}/services/${serviceId}/override`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Ошибка при удалении кастомных настроек');
    }

    return await response.json();
  } catch (error) {
    console.error('Error deleting service override:', error);
    throw error;
  }
}
```

---

## ✅ Успешные ответы

### GET /staff/:staffUserId/services/:serviceId/override (200 OK)

```json
{
  "id": "789e0123-e89b-12d3-a456-426614174002",
  "studioId": "studio-uuid-here",
  "staffUserId": "123e4567-e89b-12d3-a456-426614174000",
  "serviceId": "456e7890-e89b-12d3-a456-426614174001",
  "durationMin": 90,
  "price": 5000,
  "isActive": true,
  "createdAt": "2026-02-14T12:00:00.000Z",
  "updatedAt": "2026-02-14T12:00:00.000Z",
  "service": {
    "id": "456e7890-e89b-12d3-a456-426614174001",
    "name": "Стрижка",
    "defaultDurationMin": 60,
    "defaultPrice": 3000
  },
  "staff": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "master@example.com",
    "phone": "+79991234567",
    "role": "MASTER"
  }
}
```

### GET /staff/:staffUserId/overrides (200 OK)

```json
[
  {
    "id": "789e0123-e89b-12d3-a456-426614174002",
    "studioId": "studio-uuid-here",
    "staffUserId": "123e4567-e89b-12d3-a456-426614174000",
    "serviceId": "456e7890-e89b-12d3-a456-426614174001",
    "durationMin": 90,
    "price": 5000,
    "isActive": true,
    "createdAt": "2026-02-14T12:00:00.000Z",
    "updatedAt": "2026-02-14T12:00:00.000Z",
    "service": {
      "id": "456e7890-e89b-12d3-a456-426614174001",
      "name": "Стрижка",
      "defaultDurationMin": 60,
      "defaultPrice": 3000
    },
    "staff": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "email": "master@example.com",
      "phone": "+79991234567",
      "role": "MASTER"
    }
  }
]
```

### POST /staff/:staffUserId/services/:serviceId/override (201 Created)

Возвращает тот же формат, что и GET запрос.

### PATCH /staff/:staffUserId/services/:serviceId/override (200 OK)

Возвращает тот же формат, что и GET запрос.

### DELETE /staff/:staffUserId/services/:serviceId/override (200 OK)

```json
{
  "id": "789e0123-e89b-12d3-a456-426614174002",
  "studioId": "studio-uuid-here",
  "staffUserId": "123e4567-e89b-12d3-a456-426614174000",
  "serviceId": "456e7890-e89b-12d3-a456-426614174001",
  "durationMin": 90,
  "price": 5000,
  "isActive": true,
  "createdAt": "2026-02-14T12:00:00.000Z",
  "updatedAt": "2026-02-14T12:00:00.000Z"
}
```

---

## ❌ Ошибки и их обработка

### 1. Ошибка 400 (Bad Request) - Услуга не назначена сотруднику

**Причина:** Попытка создать override для услуги, которая не назначена сотруднику

**Пример ответа:**
```json
{
  "statusCode": 400,
  "message": "Service is not assigned to this staff member. Please assign the service first.",
  "error": "Bad Request"
}
```

**Решение:**
```javascript
if (response.status === 400) {
  const error = await response.json();
  if (error.message?.includes('not assigned')) {
    // Сначала нужно назначить услугу сотруднику
    await addServiceToStaff(staffUserId, serviceId, accessToken);
    // Затем создать override
    return createServiceOverride(staffUserId, serviceId, overrideData, accessToken);
  }
  throw new Error(error.message);
}
```

### 2. Ошибка 400 (Bad Request) - Override уже существует

**Причина:** Попытка создать override, который уже существует

**Пример ответа:**
```json
{
  "statusCode": 400,
  "message": "Override already exists for this staff member and service. Use update instead.",
  "error": "Bad Request"
}
```

**Решение:**
```javascript
if (response.status === 400) {
  const error = await response.json();
  if (error.message?.includes('already exists')) {
    // Использовать PATCH вместо POST
    return updateServiceOverride(staffUserId, serviceId, overrideData, accessToken);
  }
  throw new Error(error.message);
}
```

### 3. Ошибка 404 (Not Found) - Override не найден

**Причина:** Попытка получить/обновить/удалить несуществующий override

**Решение:**
```javascript
if (response.status === 404) {
  // Override не существует - это нормально для GET запроса
  // Для PATCH/DELETE это ошибка
  return null; // для GET
  // throw new Error('Override not found'); // для PATCH/DELETE
}
```

### 4. Ошибка 403 (Forbidden) - Доступ запрещен

**Причина:** Пользователь не имеет доступа к этому сотруднику

**Решение:**
```javascript
if (response.status === 403) {
  throw new Error('У вас нет прав для изменения настроек этого сотрудника');
}
```

---

## 🎨 UI/UX Рекомендации

### 1. Отображение услуг с кастомными настройками

При отображении списка услуг сотрудника показывайте:
- Название услуги
- Время: кастомное (если есть и активно) или по умолчанию
- Цену: кастомную (если есть и активно) или по умолчанию
- Индикатор, что есть кастомные настройки

**Пример отображения:**

```
Стрижка
⏱ 90 мин (обычно 60 мин) | 💰 5000₸ (обычно 3000₸)
[⚙️ Настроить] [❌ Удалить настройки]
```

### 2. Форма создания/редактирования override

```jsx
function ServiceOverrideForm({ staffUserId, serviceId, existingOverride, onSave, onCancel }) {
  const [durationMin, setDurationMin] = useState(existingOverride?.durationMin || '');
  const [price, setPrice] = useState(existingOverride?.price ? existingOverride.price / 100 : '');
  const [isActive, setIsActive] = useState(existingOverride?.isActive ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const overrideData = {
        durationMin: durationMin ? parseInt(durationMin) : undefined,
        price: price ? Math.round(parseFloat(price) * 100) : undefined, // Конвертация в тиыны
        isActive
      };

      if (existingOverride) {
        await updateServiceOverride(staffUserId, serviceId, overrideData, accessToken);
      } else {
        await createServiceOverride(staffUserId, serviceId, overrideData, accessToken);
      }

      onSave();
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
          Время оказания (минуты)
          <input
            type="number"
            min="1"
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
            placeholder="Оставить по умолчанию"
          />
        </label>
        <small>Оставьте пустым, чтобы использовать время по умолчанию</small>
      </div>

      <div>
        <label>
          Цена (тенге)
          <input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Оставить по умолчанию"
          />
        </label>
        <small>Оставьте пустым, чтобы использовать цену по умолчанию</small>
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Использовать кастомные настройки
        </label>
        <small>Если выключено, будут использоваться настройки по умолчанию</small>
      </div>

      {error && <div style={{color: 'red'}}>{error}</div>}

      <button type="submit" disabled={loading}>
        {loading ? 'Сохранение...' : 'Сохранить'}
      </button>
      <button type="button" onClick={onCancel} disabled={loading}>
        Отмена
      </button>
    </form>
  );
}
```

### 3. Интеграция в профиль сотрудника

При просмотре услуг сотрудника (`GET /staff/:userId/profile` или `GET /staff/:staffUserId/services`), ответ уже включает поле `override` для каждой услуги:

```javascript
// Пример ответа из getStaffServices
[
  {
    "id": "staff-service-id",
    "serviceId": "service-id",
    "service": {
      "id": "service-id",
      "name": "Стрижка",
      "defaultDurationMin": 60,
      "defaultPrice": 3000
    },
    "override": {
      "id": "override-id",
      "durationMin": 90,
      "price": 5000,
      "isActive": true
    }
  }
]
```

**Отображение:**

```jsx
function StaffServicesList({ staffUserId, services }) {
  return (
    <div>
      <h3>Услуги сотрудника</h3>
      {services.map((item) => {
        const duration = item.override?.isActive && item.override.durationMin
          ? item.override.durationMin
          : item.service.defaultDurationMin;
        
        const price = item.override?.isActive && item.override.price
          ? item.override.price
          : item.service.defaultPrice;

        const hasOverride = item.override && item.override.isActive;

        return (
          <div key={item.id} style={{border: hasOverride ? '2px solid blue' : '1px solid gray'}}>
            <h4>{item.service.name}</h4>
            <p>
              ⏱ {duration} мин
              {hasOverride && item.override.durationMin && (
                <span style={{color: 'gray'}}>
                  {' '}(обычно {item.service.defaultDurationMin} мин)
                </span>
              )}
            </p>
            {price && (
              <p>
                💰 {price / 100}₸
                {hasOverride && item.override.price && (
                  <span style={{color: 'gray'}}>
                    {' '}(обычно {item.service.defaultPrice / 100}₸)
                  </span>
                )}
              </p>
            )}
            {hasOverride ? (
              <>
                <button onClick={() => openEditOverrideModal(staffUserId, item.serviceId, item.override)}>
                  ⚙️ Изменить настройки
                </button>
                <button onClick={() => deleteOverride(staffUserId, item.serviceId)}>
                  ❌ Удалить настройки
                </button>
              </>
            ) : (
              <button onClick={() => openCreateOverrideModal(staffUserId, item.serviceId)}>
                  ⚙️ Настроить индивидуально
                </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

---

## 📝 Полный пример React компонента

```jsx
import React, { useState, useEffect } from 'react';

function StaffServiceOverrides({ staffUserId, accessToken }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingOverride, setEditingOverride] = useState(null);

  useEffect(() => {
    loadServices();
  }, [staffUserId]);

  const loadServices = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://aidaproject-production.up.railway.app/staff/${staffUserId}/services`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Ошибка при загрузке услуг');
      }

      const data = await response.json();
      setServices(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOverride = async (serviceId, overrideData) => {
    try {
      await createServiceOverride(staffUserId, serviceId, overrideData, accessToken);
      await loadServices(); // Перезагрузить список
      setEditingOverride(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateOverride = async (serviceId, overrideData) => {
    try {
      await updateServiceOverride(staffUserId, serviceId, overrideData, accessToken);
      await loadServices(); // Перезагрузить список
      setEditingOverride(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteOverride = async (serviceId) => {
    if (!confirm('Удалить кастомные настройки для этой услуги?')) {
      return;
    }

    try {
      await deleteServiceOverride(staffUserId, serviceId, accessToken);
      await loadServices(); // Перезагрузить список
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div>Загрузка...</div>;
  if (error) return <div style={{color: 'red'}}>Ошибка: {error}</div>;

  return (
    <div>
      <h2>Индивидуальные настройки услуг</h2>
      {services.map((item) => {
        const override = item.override;
        const hasActiveOverride = override && override.isActive;

        return (
          <div key={item.id} style={{
            border: hasActiveOverride ? '2px solid #4CAF50' : '1px solid #ddd',
            padding: '15px',
            marginBottom: '10px',
            borderRadius: '5px'
          }}>
            <h3>{item.service.name}</h3>
            
            <div>
              <strong>Время:</strong>{' '}
              {hasActiveOverride && override.durationMin ? (
                <>
                  <span style={{color: '#4CAF50'}}>{override.durationMin} мин</span>
                  <span style={{color: '#999', fontSize: '0.9em'}}>
                    {' '}(обычно {item.service.defaultDurationMin} мин)
                  </span>
                </>
              ) : (
                <span>{item.service.defaultDurationMin} мин (по умолчанию)</span>
              )}
            </div>

            {item.service.defaultPrice && (
              <div>
                <strong>Цена:</strong>{' '}
                {hasActiveOverride && override.price ? (
                  <>
                    <span style={{color: '#4CAF50'}}>{override.price / 100}₸</span>
                    <span style={{color: '#999', fontSize: '0.9em'}}>
                      {' '}(обычно {item.service.defaultPrice / 100}₸)
                    </span>
                  </>
                ) : (
                  <span>{item.service.defaultPrice / 100}₸ (по умолчанию)</span>
                )}
              </div>
            )}

            <div style={{marginTop: '10px'}}>
              {hasActiveOverride ? (
                <>
                  <button onClick={() => setEditingOverride({ serviceId: item.serviceId, override })}>
                    ⚙️ Изменить
                  </button>
                  <button onClick={() => handleDeleteOverride(item.serviceId)}>
                    ❌ Удалить настройки
                  </button>
                </>
              ) : (
                <button onClick={() => setEditingOverride({ serviceId: item.serviceId, override: null })}>
                  ⚙️ Настроить индивидуально
                </button>
              )}
            </div>
          </div>
        );
      })}

      {editingOverride && (
        <ServiceOverrideModal
          staffUserId={staffUserId}
          serviceId={editingOverride.serviceId}
          existingOverride={editingOverride.override}
          onSave={(data) => {
            if (editingOverride.override) {
              handleUpdateOverride(editingOverride.serviceId, data);
            } else {
              handleCreateOverride(editingOverride.serviceId, data);
            }
          }}
          onCancel={() => setEditingOverride(null)}
        />
      )}
    </div>
  );
}

export default StaffServiceOverrides;
```

---

## 🔄 Логика работы с overrides

### При создании записи (appointment):

1. Проверяется, есть ли override для `staffUserId` + `serviceId`
2. Если есть и `isActive = true`:
   - Используется `override.durationMin` (если указано)
   - Используется `override.price` (если указано)
3. Если нет или `isActive = false`:
   - Используется `service.defaultDurationMin`
   - Используется `service.defaultPrice`

### При отображении услуг сотрудника:

- Показывайте кастомные настройки, если они есть и активны
- Показывайте настройки по умолчанию, если кастомных нет или они неактивны
- Визуально выделяйте услуги с кастомными настройками

---

## ✅ Чеклист для реализации

- [ ] Отображение услуг сотрудника с информацией об overrides
- [ ] Форма создания override (время, цена, активность)
- [ ] Форма редактирования override
- [ ] Кнопка удаления override
- [ ] Визуальное выделение услуг с кастомными настройками
- [ ] Обработка ошибок (400, 403, 404)
- [ ] Проверка, что услуга назначена сотруднику перед созданием override
- [ ] Автоматическое переключение между созданием и обновлением
- [ ] Отображение времени и цены по умолчанию рядом с кастомными
- [ ] Индикатор активности override (включен/выключен)

---

## 📚 Дополнительная информация

- **Базовая URL:** `https://aidaproject-production.up.railway.app`
- **Требуемая роль:** OWNER или MANAGER (для своего студии)
- **Методы:** GET, POST, PATCH, DELETE
- **Content-Type:** `application/json`
- **Авторизация:** JWT токен в заголовке `Authorization: Bearer <token>`

**Важно:**
- Override можно создать только для услуг, которые уже назначены сотруднику
- При удалении override, услуга остается назначенной, просто используются настройки по умолчанию
- При создании записи система автоматически использует override, если он активен

---

**Готово!** Теперь у вас есть вся информация для реализации функционала кастомных настроек времени и цены услуг для каждого сотрудника на frontend.






