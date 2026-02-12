# Правка: Исправление загрузки услуг при добавлении сотрудника

## Проблема
При открытии формы добавления сотрудника показывается "нет доступных услуг", хотя в базе данных есть услуги.

## Причина
Неправильная обработка ответа API или несовпадение `studioId`.

## Решение

### 1. Проверьте, что используете правильный `studioId`

```javascript
// ПРАВИЛЬНО: используйте studioId из текущего пользователя
const studioId = currentUser.studioId; // для MANAGER/MASTER
// или
const studioId = selectedStudioId; // для OWNER (если выбирает студию)

// НЕПРАВИЛЬНО: не используйте хардкод или неправильный ID
```

### 2. Исправьте функцию загрузки услуг

**Было (неправильно):**
```javascript
async function getServices(studioId, accessToken) {
  const response = await fetch(`.../studios/${studioId}/services`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    throw new Error('Не удалось загрузить список услуг');
  }
  return await response.json();
}
```

**Стало (правильно):**
```javascript
async function getServices(studioId, accessToken) {
  try {
    // ВАЖНО: Проверьте, что studioId существует
    if (!studioId) {
      console.error('StudioId не найден');
      return [];
    }

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
    
    // ВАЖНО: Пустой массив - это нормально, НЕ ошибка!
    return Array.isArray(services) ? services : [];
  } catch (error) {
    console.error('Error loading services:', error);
    throw error;
  }
}
```

### 3. Исправьте загрузку услуг в форме

**Было (неправильно):**
```javascript
useEffect(() => {
  async function loadServices() {
    try {
      const servicesList = await getServices(studioId, accessToken);
      setServices(servicesList);
    } catch (error) {
      console.error('Ошибка загрузки услуг:', error);
      // Проблема: не обрабатывается пустой массив
    }
  }
  if (isModalOpen) {
    loadServices();
  }
}, [isModalOpen]);
```

**Стало (правильно):**
```javascript
useEffect(() => {
  async function loadServices() {
    try {
      // ВАЖНО: Используйте studioId из текущего пользователя
      const studioId = currentUser.studioId; // или selectedStudioId для OWNER
      
      if (!studioId) {
        console.error('StudioId не найден');
        setServices([]);
        return;
      }
      
      console.log('Loading services for studioId:', studioId); // для отладки
      const servicesList = await getServices(studioId, accessToken);
      console.log('Services loaded:', servicesList); // для отладки
      
      // ВАЖНО: Пустой массив - это нормально, не ошибка!
      if (Array.isArray(servicesList)) {
        setServices(servicesList);
        if (servicesList.length === 0) {
          console.log('Нет доступных услуг в студии'); // информационное сообщение
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
}, [isModalOpen, currentUser.studioId]); // добавьте currentUser.studioId в зависимости
```

### 4. Исправьте отображение услуг в UI

**Было (неправильно):**
```javascript
<div>
  <label>Услуги</label>
  <select multiple>
    {services.map(service => ...)}
  </select>
  {services.length === 0 && <p>Нет доступных услуг</p>} {/* Показывается как ошибка */}
</div>
```

**Стало (правильно):**
```javascript
<div>
  <label>Услуги (можно выбрать несколько)</label>
  
  {services.length === 0 ? (
    // ВАЖНО: Информационное сообщение, НЕ ошибка
    <div style={{ padding: '10px', background: '#f5f5f5', borderRadius: '4px', color: '#666' }}>
      <p>В студии пока нет услуг.</p>
      <p style={{ fontSize: '12px', marginTop: '5px' }}>
        Сначала создайте услуги в разделе "Услуги", затем они появятся здесь.
      </p>
    </div>
  ) : (
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
  
  {formData.serviceIds && formData.serviceIds.length > 0 && (
    <small style={{ color: 'green' }}>
      Выбрано услуг: {formData.serviceIds.length}
    </small>
  )}
</div>
```

## Чек-лист исправления

- [ ] Используется правильный `studioId` из `currentUser.studioId`
- [ ] Функция `getServices` возвращает пустой массив `[]` при отсутствии услуг (не выбрасывает ошибку)
- [ ] В `useEffect` правильно обрабатывается пустой массив (не показывается как ошибка)
- [ ] В UI показывается информационное сообщение при отсутствии услуг (не ошибка)
- [ ] Добавлены console.log для отладки (можно убрать после проверки)

## Отладка

Если проблема осталась, проверьте в консоли браузера:

1. **Проверьте studioId:**
   ```javascript
   console.log('Current user:', currentUser);
   console.log('User studioId:', currentUser.studioId);
   ```

2. **Проверьте запрос в Network tab:**
   - Откройте DevTools → Network
   - Найдите запрос `GET /studios/.../services`
   - Проверьте:
     - **Status Code**: должен быть 200 (не 403, не 401)
     - **Response**: должен быть массив (даже если пустой `[]`)
     - **Request URL**: проверьте, что `studioId` правильный

3. **Проверьте данные в базе:**
   - Убедитесь, что `studioId` услуги совпадает с `studioId` пользователя
   - Услуга в базе: `studioId: "2a106555-bcc6-4cc7-b50a-43524d4e306a"`
   - Пользователь должен иметь такой же `studioId`

## Важные моменты

1. **Пустой массив `[]` - это НЕ ошибка!** Это означает, что в студии просто нет услуг.
2. **Используйте `currentUser.studioId`** для MANAGER/MASTER, не хардкодьте ID.
3. **Показывайте информационное сообщение**, а не ошибку, когда услуг нет.
4. **Добавьте логирование** для отладки, чтобы понять, что происходит.


