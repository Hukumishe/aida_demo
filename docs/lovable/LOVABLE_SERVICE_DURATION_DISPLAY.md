# Отображение времени услуг: стандартное vs кастомное

## Важно: Два типа времени

В системе есть **два типа времени** для каждой услуги:

1. **Стандартное время** (`defaultDurationMin`) - устанавливается при создании услуги, **неизменяемое**
2. **Кастомное время** (`override.durationMin`) - индивидуальное время для каждого мастера, настраивается через StaffServiceOverride

---

## 📍 Где что показывать

### 1. В настройках услуг (список услуг студии)

**Endpoint:** `GET /studios/:studioId/services`

**Что показывать:**
- **Название услуги**
- **Стандартное время** (`service.defaultDurationMin`) - **неизменяемое**
- **Стандартная цена** (`service.defaultPrice`)
- **Статус** (`service.isActive`)

**Пример отображения:**
```
Haircut
50 мин · 2,000 〒
[Toggle] [Edit] [Delete]
```

**Важно:** 
- При редактировании услуги **НЕ показывайте** поле для изменения времени
- Можно редактировать только: название, цену, количество сотрудников, статус
- Стандартное время устанавливается только при создании услуги

---

### 2. В профиле сотрудника (услуги мастера)

**Endpoint:** `GET /staff/:userId/profile` или `GET /staff/:staffUserId/services`

**Что показывать:**
- **Название услуги**
- **Кастомное время** (если есть и активно) или **стандартное время** (если нет кастомного)
- **Кастомная цена** (если есть и активно) или **стандартная цена** (если нет кастомной)
- **Индикатор**, что есть кастомные настройки

**Логика определения времени:**

```javascript
function getServiceDuration(service, override) {
  // Если есть override и он активен, используем кастомное время
  if (override && override.isActive && override.durationMin) {
    return override.durationMin;
  }
  // Иначе используем стандартное время
  return service.defaultDurationMin;
}

function getServicePrice(service, override) {
  // Если есть override и он активен, используем кастомную цену
  if (override && override.isActive && override.price) {
    return override.price;
  }
  // Иначе используем стандартную цену
  return service.defaultPrice;
}
```

**Пример отображения:**

```jsx
function StaffServiceItem({ service, override }) {
  const duration = override?.isActive && override?.durationMin 
    ? override.durationMin 
    : service.defaultDurationMin;
  
  const price = override?.isActive && override?.price 
    ? override.price 
    : service.defaultPrice;
  
  const hasCustomSettings = override && override.isActive;

  return (
    <div style={{border: hasCustomSettings ? '2px solid blue' : '1px solid gray'}}>
      <h4>{service.name}</h4>
      <p>
        ⏱ {duration} мин
        {hasCustomSettings && override.durationMin && (
          <span style={{color: 'gray', fontSize: '0.9em'}}>
            {' '}(обычно {service.defaultDurationMin} мин)
          </span>
        )}
      </p>
      {price && (
        <p>
          💰 {price / 100}₸
          {hasCustomSettings && override.price && (
            <span style={{color: 'gray', fontSize: '0.9em'}}>
              {' '}(обычно {service.defaultPrice / 100}₸)
            </span>
          )}
        </p>
      )}
      {hasCustomSettings ? (
        <button onClick={() => editOverride(service.id, override)}>
          ⚙️ Изменить настройки
        </button>
      ) : (
        <button onClick={() => createOverride(service.id)}>
          ⚙️ Настроить индивидуально
        </button>
      )}
    </div>
  );
}
```

---

## 📋 Структура данных

### GET /studios/:studioId/services

```json
[
  {
    "id": "service-1",
    "name": "Haircut",
    "defaultDurationMin": 60,    // Стандартное время - НЕ МЕНЯЕТСЯ
    "defaultPrice": 2000,
    "requiredStaffCount": 1,
    "isActive": true
  }
]
```

**В форме редактирования услуги:**
- ✅ Можно изменить: `name`, `defaultPrice`, `requiredStaffCount`, `isActive`
- ❌ **НЕЛЬЗЯ** изменить: `defaultDurationMin` (поле не должно быть в форме)

---

### GET /staff/:userId/profile

```json
{
  "id": "user-1",
  "services": [
    {
      "id": "service-1",
      "name": "Haircut",
      "defaultDurationMin": 60,    // Стандартное время (для справки)
      "defaultPrice": 2000,         // Стандартная цена (для справки)
      "override": {
        "id": "override-1",
        "durationMin": 90,          // Кастомное время мастера
        "price": 5000,              // Кастомная цена мастера
        "isActive": true            // Использовать кастомные настройки?
      }
    }
  ]
}
```

**Логика отображения:**
```javascript
// Определяем время для отображения
const displayDuration = service.override?.isActive && service.override?.durationMin
  ? service.override.durationMin  // Кастомное время
  : service.defaultDurationMin;     // Стандартное время

// Определяем цену для отображения
const displayPrice = service.override?.isActive && service.override?.price
  ? service.override.price         // Кастомная цена
  : service.defaultPrice;           // Стандартная цена
```

---

## 🎨 UI/UX Рекомендации

### В настройках услуг:

1. **При создании услуги:**
   - Показывайте поле "Длительность (мин)" - обязательное
   - Это стандартное время, которое будет использоваться по умолчанию

2. **При редактировании услуги:**
   - **НЕ показывайте** поле "Длительность"
   - Показывайте только: название, цену, количество сотрудников, статус
   - Можно добавить подсказку: "Стандартное время устанавливается при создании. Для изменения времени конкретного мастера используйте настройки в профиле сотрудника."

3. **В списке услуг:**
   - Показывайте стандартное время: `{service.defaultDurationMin} мин`
   - Это время одинаково для всех мастеров (если у них нет кастомных настроек)

---

### В профиле сотрудника:

1. **Отображение времени:**
   - Если есть кастомное время и оно активно → показывайте кастомное время
   - Если нет кастомного времени или оно неактивно → показывайте стандартное время
   - Рядом с кастомным временем показывайте стандартное в скобках: `90 мин (обычно 60 мин)`

2. **Визуальное выделение:**
   - Услуги с кастомными настройками можно выделить цветом или иконкой
   - Например: синяя рамка или иконка ⚙️

3. **Кнопки действий:**
   - Если есть кастомные настройки: "⚙️ Изменить настройки", "❌ Удалить настройки"
   - Если нет кастомных настроек: "⚙️ Настроить индивидуально"

---

## ✅ Чеклист для реализации

### Настройки услуг:
- [ ] При создании: поле "Длительность" обязательное
- [ ] При редактировании: поле "Длительность" **НЕ показывать**
- [ ] В списке услуг: показывать `defaultDurationMin`
- [ ] Добавить подсказку о том, что время можно настроить индивидуально для мастера

### Профиль сотрудника:
- [ ] Определять время: кастомное (если есть и активно) или стандартное
- [ ] Показывать стандартное время в скобках, если используется кастомное
- [ ] Визуально выделять услуги с кастомными настройками
- [ ] Кнопки для создания/редактирования/удаления override

---

## 📝 Примеры кода

### Определение времени для отображения:

```javascript
function getDisplayDuration(service, override) {
  // Приоритет: кастомное время (если активно) > стандартное время
  if (override?.isActive && override?.durationMin) {
    return {
      value: override.durationMin,
      isCustom: true,
      default: service.defaultDurationMin
    };
  }
  return {
    value: service.defaultDurationMin,
    isCustom: false,
    default: service.defaultDurationMin
  };
}

// Использование:
const durationInfo = getDisplayDuration(service, override);
// durationInfo.value - время для отображения
// durationInfo.isCustom - есть ли кастомное время
// durationInfo.default - стандартное время (для справки)
```

### Компонент отображения услуги в профиле:

```jsx
function ServiceDisplay({ service, override }) {
  const durationInfo = getDisplayDuration(service, override);
  const priceInfo = getDisplayPrice(service, override);

  return (
    <div className={`service-item ${durationInfo.isCustom ? 'has-custom' : ''}`}>
      <h3>{service.name}</h3>
      
      <div className="duration">
        <span className="value">{durationInfo.value} мин</span>
        {durationInfo.isCustom && (
          <span className="default">(обычно {durationInfo.default} мин)</span>
        )}
      </div>

      {priceInfo.value && (
        <div className="price">
          <span className="value">{priceInfo.value / 100}₸</span>
          {priceInfo.isCustom && (
            <span className="default">(обычно {priceInfo.default / 100}₸)</span>
          )}
        </div>
      )}

      {durationInfo.isCustom ? (
        <div className="actions">
          <button onClick={() => editOverride(service.id)}>Изменить</button>
          <button onClick={() => deleteOverride(service.id)}>Удалить настройки</button>
        </div>
      ) : (
        <button onClick={() => createOverride(service.id)}>Настроить индивидуально</button>
      )}
    </div>
  );
}
```

---

## 🔄 Логика работы

1. **При создании услуги:**
   - Устанавливается `defaultDurationMin` (например, 60 мин)
   - Это время используется по умолчанию для всех мастеров

2. **В настройках услуг:**
   - Показывается `defaultDurationMin` (60 мин)
   - Это время **нельзя изменить** после создания

3. **В профиле мастера:**
   - Если мастер работает быстрее/медленнее, создаётся `StaffServiceOverride`
   - Устанавливается `override.durationMin` (например, 90 мин)
   - При отображении показывается 90 мин (кастомное), а в скобках 60 мин (стандартное)

4. **При создании записи:**
   - Система проверяет, есть ли override для мастера и услуги
   - Если есть и активен → используется кастомное время
   - Если нет → используется стандартное время

---

**Готово!** Теперь у вас есть полное понимание, как правильно отображать стандартное и кастомное время в разных местах приложения.










