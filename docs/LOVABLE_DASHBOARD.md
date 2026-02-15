# Дэшборды для отображения статистики бизнеса

## Обзор

Дэшборды отображают ключевую информацию о работе салона/салонов. Система поддерживает два типа дэшбордов:

1. **Дэшборд одного салона** - для менеджеров и владельцев (показывает статистику конкретного салона)
2. **Общий дэшборд всех салонов** - только для владельцев (агрегированная статистика по всем салонам)

---

## 🔐 Доступ

### Менеджер (MANAGER)
- ✅ Доступен дэшборд только своего салона
- ❌ Нет доступа к общему дэшборду всех салонов

### Владелец (OWNER)
- ✅ Доступен дэшборд каждого салона отдельно
- ✅ Доступен общий дэшборд всех салонов

---

## 📊 API Endpoints

### 1. Дэшборд одного салона

**Endpoint:** `GET /studios/:studioId/dashboard`

**Query параметры:**
- `startDate` (опционально) - начальная дата в формате `YYYY-MM-DD`
- `endDate` (опционально) - конечная дата в формате `YYYY-MM-DD`
- `period` (опционально) - период: `day`, `week`, `month`, `year`, `all`

**Примеры запросов:**

```javascript
// Статистика за последний месяц (по умолчанию)
GET /studios/123/dashboard

// Статистика за конкретный период
GET /studios/123/dashboard?startDate=2024-01-01&endDate=2024-01-31

// Статистика за последнюю неделю
GET /studios/123/dashboard?period=week

// Статистика за последний год
GET /studios/123/dashboard?period=year

// Вся статистика
GET /studios/123/dashboard?period=all
```

**Ответ:**

```json
{
  "period": {
    "start": "2024-01-01T00:00:00.000Z",
    "end": "2024-01-31T23:59:59.999Z"
  },
  "overview": {
    "totalAppointments": 150,
    "revenue": 300000,  // в тенге (300,000 〒)
    "cancellationRate": 5.33,
    "completionRate": 85.5
  },
  "statusCounts": {
    "BOOKED": 20,
    "CANCELLED": 8,
    "ARRIVED": 5,
    "DONE": 117
  },
  "popularServices": [
    {
      "name": "Haircut",
      "count": 45,
      "revenue": 90000  // в тенге (90,000 〒)
    },
    {
      "name": "Coloring",
      "count": 30,
      "revenue": 120000
    }
  ],
  "topStaff": [
    {
      "id": "staff-1",
      "name": "Иван Иванов",
      "count": 50,
      "revenue": 100000  // в тенге (100,000 〒)
    },
    {
      "id": "staff-2",
      "name": "Мария Петрова",
      "count": 40,
      "revenue": 80000
    }
  ],
  "dailyChart": [
    {
      "date": "2024-01-01",
      "count": 5,
      "revenue": 10000  // в тенге (10,000 〒)
    },
    {
      "date": "2024-01-02",
      "count": 8,
      "revenue": 16000
    }
  ]
}
```

---

### 2. Общий дэшборд всех салонов (OWNER only)

**Endpoint:** `GET /dashboard/all`

**Query параметры:** (те же, что и для одного салона)
- `startDate` (опционально)
- `endDate` (опционально)
- `period` (опционально)

**Примеры запросов:**

```javascript
// Статистика за последний месяц по всем салонам
GET /dashboard/all?period=month

// Статистика за конкретный период
GET /dashboard/all?startDate=2024-01-01&endDate=2024-01-31
```

**Ответ:**

```json
{
  "period": {
    "start": "2024-01-01T00:00:00.000Z",
    "end": "2024-01-31T23:59:59.999Z"
  },
  "overview": {
    "totalStudios": 3,
    "totalAppointments": 450,
    "totalRevenue": 900000,
    "cancellationRate": 6.22,
    "completionRate": 87.3
  },
  "aggregatedStatusCounts": {
    "BOOKED": 60,
    "CANCELLED": 28,
    "ARRIVED": 15,
    "DONE": 347
  },
  "studios": [
    {
      "studioId": "studio-1",
      "studioName": "Салон на Абая",
      "totalAppointments": 150,
      "revenue": 300000,
      "statusCounts": {
        "BOOKED": 20,
        "CANCELLED": 8,
        "ARRIVED": 5,
        "DONE": 117
      }
    },
    {
      "studioId": "studio-2",
      "studioName": "Салон на Сатпаева",
      "totalAppointments": 200,
      "revenue": 400000,
      "statusCounts": {
        "BOOKED": 30,
        "CANCELLED": 10,
        "ARRIVED": 7,
        "DONE": 153
      }
    }
  ]
}
```

---

## 🎨 Рекомендации по UI/UX

### Структура дэшборда одного салона

1. **Верхняя панель с фильтрами:**
   - Выбор периода: день / неделя / месяц / год / все
   - Или выбор конкретных дат (календарь)
   - Кнопка "Обновить"

2. **Карточки с ключевыми метриками:**
   ```
   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
   │ Всего записей│  │   Доход     │  │ Отмена (%)  │  │ Выполнено(%)│
   │     150     │  │  300,000₸   │  │    5.33%    │  │   85.5%     │
   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
   ```

3. **Статистика по статусам:**
   - Круговая диаграмма или столбчатая диаграмма
   - Показывает: BOOKED, CANCELLED, ARRIVED, DONE

4. **Популярные услуги:**
   - Таблица или список топ-10 услуг
   - Колонки: Название, Количество записей, Доход

5. **Топ мастеров:**
   - Таблица или список топ-10 мастеров
   - Колонки: Имя, Количество записей, Доход

6. **График по дням:**
   - Линейный график или столбчатая диаграмма
   - Ось X: даты
   - Ось Y: количество записей и/или доход
   - Можно сделать два графика или один с двумя осями Y

---

### Структура общего дэшборда (OWNER)

1. **Верхняя панель с фильтрами:** (та же, что и для одного салона)

2. **Карточки с общей статистикой:**
   ```
   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
   │   Салонов   │  │ Всего записей│  │ Общий доход │  │ Отмена (%)  │
   │      3      │  │     450      │  │  900,000₸   │  │    6.22%    │
   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
   ```

3. **Статистика по статусам:** (агрегированная по всем салонам)

4. **Список салонов:**
   - Карточки или таблица с информацией по каждому салону
   - Показывает: название, количество записей, доход, статусы
   - Клик на салон → переход к дэшборду этого салона

5. **Сравнительные графики:**
   - График доходов по салонам
   - График количества записей по салонам

---

## 📋 Примеры кода для фронтенда

### Форматирование валюты

**ВАЖНО:** Цены в API уже в тенге, НЕ нужно делить на 100!

```typescript
// ПРАВИЛЬНО: просто форматируем число
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'KZT',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
  // Или проще:
  // return `${value.toLocaleString('ru-RU')} 〒`;
}

// НЕПРАВИЛЬНО: не делите на 100!
function formatCurrencyWrong(value: number): string {
  return `${(value / 100).toLocaleString('ru-RU')} 〒`; // ❌ НЕ ДЕЛАЙТЕ ТАК!
}
```

**Примеры:**
- `formatCurrency(300000)` → `"300 000 〒"` или `"300,000 〒"`
- `formatCurrency(2000)` → `"2 000 〒"` или `"2,000 〒"`
- `formatCurrency(1000)` → `"1 000 〒"` или `"1,000 〒"`

---

### Получение данных дэшборда

```typescript
// Типы данных
interface DashboardData {
  period: {
    start: string;
    end: string;
  };
  overview: {
    totalAppointments: number;
    revenue: number;
    cancellationRate: number;
    completionRate: number;
  };
  statusCounts: {
    BOOKED: number;
    CANCELLED: number;
    ARRIVED: number;
    DONE: number;
  };
  popularServices: Array<{
    name: string;
    count: number;
    revenue: number;
  }>;
  topStaff: Array<{
    id: string;
    name: string;
    count: number;
    revenue: number;
  }>;
  dailyChart: Array<{
    date: string;
    count: number;
    revenue: number;
  }>;
}

// Функция для получения дэшборда
async function getStudioDashboard(
  studioId: string,
  period?: 'day' | 'week' | 'month' | 'year' | 'all',
  startDate?: string,
  endDate?: string
): Promise<DashboardData> {
  const params = new URLSearchParams();
  if (period) params.append('period', period);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const response = await fetch(
    `/api/studios/${studioId}/dashboard?${params.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );
  return response.json();
}

// Функция для получения общего дэшборда (OWNER only)
async function getAllStudiosDashboard(
  period?: 'day' | 'week' | 'month' | 'year' | 'all',
  startDate?: string,
  endDate?: string
): Promise<AllStudiosDashboardData> {
  const params = new URLSearchParams();
  if (period) params.append('period', period);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const response = await fetch(
    `/api/dashboard/all?${params.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );
  return response.json();
}
```

### Компонент дэшборда

```jsx
function Dashboard({ studioId, userRole }) {
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, [studioId, period]);

  async function loadDashboard() {
    setLoading(true);
    try {
      const dashboardData = await getStudioDashboard(studioId, period);
      setData(dashboardData);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (!data) return <ErrorMessage />;

  return (
    <div className="dashboard">
      {/* Фильтры */}
      <div className="dashboard-filters">
        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="day">День</option>
          <option value="week">Неделя</option>
          <option value="month">Месяц</option>
          <option value="year">Год</option>
          <option value="all">Все</option>
        </select>
      </div>

      {/* Карточки с метриками */}
      <div className="metrics-cards">
        <MetricCard
          title="Всего записей"
          value={data.overview.totalAppointments}
          icon="📅"
        />
        <MetricCard
          title="Доход"
          value={`${formatCurrency(data.overview.revenue)}`}
          icon="💰"
        />
        {/* 
          ВАЖНО: formatCurrency НЕ должна делить на 100!
          revenue уже в тенге, просто форматируйте число с символом 〒
          Пример: formatCurrency(300000) => "300,000 〒"
        */}
        <MetricCard
          title="Отмена"
          value={`${data.overview.cancellationRate}%`}
          icon="❌"
          trend={data.overview.cancellationRate > 10 ? 'bad' : 'good'}
        />
        <MetricCard
          title="Выполнено"
          value={`${data.overview.completionRate}%`}
          icon="✅"
          trend={data.overview.completionRate > 80 ? 'good' : 'bad'}
        />
      </div>

      {/* График по дням */}
      <Chart
        data={data.dailyChart}
        xKey="date"
        yKeys={['count', 'revenue']}
        title="Статистика по дням"
      />

      {/* Популярные услуги */}
      <Table
        title="Популярные услуги"
        data={data.popularServices}
        columns={[
          { key: 'name', label: 'Услуга' },
          { key: 'count', label: 'Записей' },
          { key: 'revenue', label: 'Доход', format: formatCurrency },
        ]}
      />

      {/* Топ мастеров */}
      <Table
        title="Топ мастеров"
        data={data.topStaff}
        columns={[
          { key: 'name', label: 'Мастер' },
          { key: 'count', label: 'Записей' },
          { key: 'revenue', label: 'Доход', format: formatCurrency },
        ]}
      />
    </div>
  );
}
```

---

## 🔄 Логика работы

### ⚠️ ВАЖНО: Единицы измерения цен

**Цены в API хранятся и возвращаются в ТЕНГЕ (не в тиынах).**

- `defaultPrice: 2000` = 2000 тенге
- `prepaymentAmount: 1000` = 1000 тенге
- `revenue: 300000` = 300,000 тенге

**На фронтенде НЕ нужно делить на 100!** Цены уже в тенге.

Если вы видите функцию `formatCurrency`, которая делит на 100, её нужно убрать или изменить, чтобы она просто форматировала число с символом валюты.

### Расчет дохода

**ВАЖНО:** Доход рассчитывается **только для завершенных записей** (статус `DONE`).

Доход рассчитывается как сумма:
- `prepaymentAmount` для всех записей со статусом `DONE` (выполнено)
- Если `prepaymentAmount` не указан, используется `service.defaultPrice`
- Если и `prepaymentAmount`, и `defaultPrice` отсутствуют, запись не учитывается в доходе

**Записи со статусом `BOOKED`, `ARRIVED` или `CANCELLED` НЕ учитываются в доходе.**

**Все значения возвращаются в тенге.**

### Расчет процентов

- **Cancellation Rate** = (CANCELLED / Всего записей) × 100
- **Completion Rate** = (DONE / (Всего - CANCELLED)) × 100

### Периоды

- **day** - с начала сегодняшнего дня до текущего момента
- **week** - последние 7 дней
- **month** - последние 30 дней
- **year** - последние 365 дней
- **all** - все записи с начала времен

Если указаны `startDate` и `endDate`, они имеют приоритет над `period`.

---

## ✅ Чеклист для реализации

### Дэшборд одного салона:
- [ ] Создать страницу/компонент дэшборда
- [ ] Добавить фильтры по периоду
- [ ] Отобразить карточки с ключевыми метриками
- [ ] Добавить график/диаграмму по статусам
- [ ] Отобразить таблицу популярных услуг
- [ ] Отобразить таблицу топ мастеров
- [ ] Добавить график по дням (количество записей и доход)
- [ ] Обработать ошибки и состояния загрузки

### Общий дэшборд (OWNER):
- [ ] Создать страницу общего дэшборда
- [ ] Проверить роль пользователя (только OWNER)
- [ ] Отобразить общую статистику
- [ ] Отобразить список салонов с их статистикой
- [ ] Добавить возможность перехода к дэшборду конкретного салона
- [ ] Добавить сравнительные графики по салонам

---

## 🎯 Дополнительные возможности (опционально)

1. **Экспорт данных:**
   - Кнопка "Экспорт в Excel/CSV"
   - Экспорт статистики за выбранный период

2. **Сравнение периодов:**
   - Выбор двух периодов для сравнения
   - Показ изменений в процентах

3. **Уведомления:**
   - Предупреждения при высоком проценте отмен
   - Уведомления о достижении целей по доходу

4. **Кастомизация:**
   - Возможность выбрать, какие виджеты показывать
   - Сохранение настроек дэшборда

---

**Готово!** Теперь у вас есть полное понимание, как реализовать дэшборды на фронтенде, используя предоставленные API endpoints.

