# Фильтр "за период" для дэшборда

## 📋 Обзор

В дэшборд добавлен улучшенный фильтр по диапазону дат "от - до". Теперь пользователи могут выбирать произвольный период для просмотра статистики, указывая начальную и конечную даты.

## 🔄 Изменения в API

### Endpoint: `GET /studios/:studioId/dashboard`
### Endpoint: `GET /dashboard/all` (для OWNER/DEPUTY_OWNER)

**Параметры запроса остались прежними, но логика обработки улучшена:**

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `startDate` | string (YYYY-MM-DD) | Нет | Дата начала периода ("от") |
| `endDate` | string (YYYY-MM-DD) | Нет | Дата окончания периода ("до") |
| `period` | enum | Нет | Тип периода (day/week/month/year/all) |

**Логика работы:**

1. **Если указаны обе даты (`startDate` и `endDate`):**
   - Используются обе даты
   - Параметр `period` игнорируется
   - `startDate` должен быть <= `endDate`

2. **Если указана только `startDate`:**
   - `endDate` автоматически = сегодня
   - Период: от `startDate` до сегодня

3. **Если указана только `endDate`:**
   - `startDate` автоматически = 30 дней назад от `endDate`
   - Период: от 30 дней назад до `endDate`

4. **Если указан только `period` (и нет дат):**
   - Используется стандартная логика периода
   - `day` - сегодня
   - `week` - последние 7 дней
   - `month` - последний месяц
   - `year` - последний год
   - `all` - все время

5. **Если ничего не указано:**
   - По умолчанию: последние 30 дней

**Валидация:**
- Формат дат: `YYYY-MM-DD` (например, `2024-01-15`)
- `startDate` не может быть в будущем
- `endDate` не может быть в будущем
- `startDate` должен быть <= `endDate`

## 🎯 Что нужно сделать на Frontend

### 1. Обновить типы/интерфейсы (если нужно)

```typescript
// types/dashboard.ts или types/api.ts

export interface DashboardQueryParams {
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  period?: 'day' | 'week' | 'month' | 'year' | 'all';
}

export interface DashboardResponse {
  period: {
    start: string; // ISO date string
    end: string;   // ISO date string
  };
  overview: {
    totalAppointments: number;
    revenue: number;
    noShowRevenue: number;
    upsellRevenue: number;
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
```

### 2. Добавить компонент выбора диапазона дат

Создайте компонент для выбора диапазона "от - до":

```tsx
// components/DashboardDateRangeFilter.tsx

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface DashboardDateRangeFilterProps {
  startDate?: string;
  endDate?: string;
  onDateRangeChange: (startDate?: string, endDate?: string) => void;
  onPeriodChange?: (period: 'day' | 'week' | 'month' | 'year' | 'all') => void;
}

export function DashboardDateRangeFilter({
  startDate,
  endDate,
  onDateRangeChange,
  onPeriodChange,
}: DashboardDateRangeFilterProps) {
  const [localStartDate, setLocalStartDate] = useState(startDate || '');
  const [localEndDate, setLocalEndDate] = useState(endDate || '');

  const handleApply = () => {
    onDateRangeChange(
      localStartDate || undefined,
      localEndDate || undefined
    );
  };

  const handleReset = () => {
    setLocalStartDate('');
    setLocalEndDate('');
    onDateRangeChange(undefined, undefined);
  };

  const handleQuickPeriod = (period: 'day' | 'week' | 'month' | 'year' | 'all') => {
    setLocalStartDate('');
    setLocalEndDate('');
    onPeriodChange?.(period);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Label htmlFor="startDate">От</Label>
          <Input
            id="startDate"
            type="date"
            value={localStartDate}
            onChange={(e) => setLocalStartDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]} // Нельзя выбрать будущую дату
          />
        </div>
        <div className="flex-1">
          <Label htmlFor="endDate">До</Label>
          <Input
            id="endDate"
            type="date"
            value={localEndDate}
            onChange={(e) => setLocalEndDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]} // Нельзя выбрать будущую дату
            min={localStartDate || undefined} // Нельзя выбрать дату раньше startDate
          />
        </div>
        <div className="flex gap-2 pt-6">
          <Button onClick={handleApply} size="sm">
            Применить
          </Button>
          <Button onClick={handleReset} variant="outline" size="sm">
            Сбросить
          </Button>
        </div>
      </div>

      {/* Быстрые периоды (опционально) */}
      {onPeriodChange && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickPeriod('day')}
          >
            Сегодня
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickPeriod('week')}
          >
            Неделя
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickPeriod('month')}
          >
            Месяц
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickPeriod('year')}
          >
            Год
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickPeriod('all')}
          >
            Все время
          </Button>
        </div>
      )}
    </div>
  );
}
```

### 3. Интегрировать фильтр в компонент дэшборда

```tsx
// pages/DashboardPage.tsx или components/Dashboard.tsx

import { useState, useEffect } from 'react';
import { DashboardDateRangeFilter } from '@/components/DashboardDateRangeFilter';
import { DashboardResponse } from '@/types/dashboard';

export function DashboardPage({ studioId }: { studioId: string }) {
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year' | 'all' | undefined>();
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (period && !startDate && !endDate) params.append('period', period);

      const response = await fetch(
        `/api/studios/${studioId}/dashboard?${params.toString()}`
      );
      const data = await response.json();
      setDashboardData(data);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [studioId, startDate, endDate, period]);

  const handleDateRangeChange = (
    newStartDate?: string,
    newEndDate?: string
  ) => {
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    // Сбрасываем period при выборе дат
    if (newStartDate || newEndDate) {
      setPeriod(undefined);
    }
  };

  const handlePeriodChange = (
    newPeriod: 'day' | 'week' | 'month' | 'year' | 'all'
  ) => {
    setPeriod(newPeriod);
    // Сбрасываем даты при выборе периода
    setStartDate(undefined);
    setEndDate(undefined);
  };

  return (
    <div className="space-y-6">
      <h1>Дэшборд</h1>

      {/* Фильтр по датам */}
      <DashboardDateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onDateRangeChange={handleDateRangeChange}
        onPeriodChange={handlePeriodChange}
      />

      {/* Отображение выбранного периода */}
      {dashboardData?.period && (
        <div className="text-sm text-gray-500">
          Период: {new Date(dashboardData.period.start).toLocaleDateString('ru-RU')} - {new Date(dashboardData.period.end).toLocaleDateString('ru-RU')}
        </div>
      )}

      {/* Статистика */}
      {loading ? (
        <div>Загрузка...</div>
      ) : dashboardData ? (
        <div>
          {/* Отображение данных дэшборда */}
          <div>Всего записей: {dashboardData.overview.totalAppointments}</div>
          <div>Доход: {dashboardData.overview.revenue}</div>
          {/* ... остальные данные */}
        </div>
      ) : null}
    </div>
  );
}
```

### 4. Обновить API клиент (если используется)

```typescript
// api/dashboard.ts или services/dashboardService.ts

export async function getDashboard(
  studioId: string,
  params?: {
    startDate?: string;
    endDate?: string;
    period?: 'day' | 'week' | 'month' | 'year' | 'all';
  }
): Promise<DashboardResponse> {
  const queryParams = new URLSearchParams();
  
  if (params?.startDate) {
    queryParams.append('startDate', params.startDate);
  }
  if (params?.endDate) {
    queryParams.append('endDate', params.endDate);
  }
  if (params?.period && !params.startDate && !params.endDate) {
    queryParams.append('period', params.period);
  }

  const response = await fetch(
    `/api/studios/${studioId}/dashboard?${queryParams.toString()}`
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch dashboard');
  }
  
  return response.json();
}
```

## 📝 Примеры использования

### Пример 1: Диапазон дат "от - до"

```typescript
// Запрос статистики за период с 15 января по 31 января 2024
const data = await getDashboard(studioId, {
  startDate: '2024-01-15',
  endDate: '2024-01-31',
});
```

### Пример 2: Только "от" (до сегодня)

```typescript
// Запрос статистики с 1 января до сегодня
const data = await getDashboard(studioId, {
  startDate: '2024-01-01',
});
```

### Пример 3: Только "до" (30 дней назад от указанной даты)

```typescript
// Запрос статистики за 30 дней до 31 января
const data = await getDashboard(studioId, {
  endDate: '2024-01-31',
});
```

### Пример 4: Быстрый период

```typescript
// Запрос статистики за последний месяц
const data = await getDashboard(studioId, {
  period: 'month',
});
```

## ✅ Чеклист изменений

- [ ] Обновлены типы/интерфейсы для параметров запроса
- [ ] Создан компонент `DashboardDateRangeFilter` для выбора диапазона дат
- [ ] Добавлены поля ввода для `startDate` и `endDate` (type="date")
- [ ] Добавлена валидация: даты не могут быть в будущем
- [ ] Добавлена валидация: `endDate` не может быть раньше `startDate`
- [ ] Интегрирован фильтр в компонент дэшборда
- [ ] Обновлен API клиент для отправки параметров `startDate` и `endDate`
- [ ] Добавлено отображение выбранного периода в UI
- [ ] Протестирован фильтр с различными комбинациями дат
- [ ] Протестирована валидация (будущие даты, неправильный формат)

## 🔍 Где искать код для изменения

1. **Компонент дэшборда:**
   - `src/pages/DashboardPage.tsx`
   - `src/components/Dashboard.tsx`
   - `src/features/dashboard/DashboardPage.tsx`
   - Или поиск по `dashboard` в коде

2. **API клиент:**
   - `src/api/dashboard.ts`
   - `src/services/dashboardService.ts`
   - `src/lib/api.ts`

3. **Типы:**
   - `src/types/dashboard.ts`
   - `src/types/api.ts`

## ⚠️ Важные замечания

1. **Формат дат:** Всегда используйте формат `YYYY-MM-DD` (например, `2024-01-15`)
2. **Приоритет:** Если указаны и даты, и `period`, даты имеют приоритет
3. **Валидация на фронтенде:** Рекомендуется добавить валидацию перед отправкой запроса:
   - Проверка формата даты
   - Проверка, что `startDate <= endDate`
   - Проверка, что даты не в будущем
4. **Обработка ошибок:** Backend вернет ошибку 400, если:
   - Формат даты неправильный
   - `startDate > endDate`
   - Дата в будущем

## 🧪 Тестовые сценарии

1. **Успешный запрос с диапазоном дат:**
   - Указать `startDate: '2024-01-15'` и `endDate: '2024-01-31'`
   - Ожидаемый результат: статистика за указанный период

2. **Только startDate:**
   - Указать только `startDate: '2024-01-15'`
   - Ожидаемый результат: статистика от 15 января до сегодня

3. **Только endDate:**
   - Указать только `endDate: '2024-01-31'`
   - Ожидаемый результат: статистика за 30 дней до 31 января

4. **Ошибка: startDate > endDate:**
   - Указать `startDate: '2024-01-31'` и `endDate: '2024-01-15'`
   - Ожидаемый результат: ошибка 400 "startDate must be before or equal to endDate"

5. **Ошибка: дата в будущем:**
   - Указать `startDate: '2025-01-15'`
   - Ожидаемый результат: ошибка 400 "startDate cannot be in the future"

6. **Ошибка: неправильный формат:**
   - Указать `startDate: '15-01-2024'`
   - Ожидаемый результат: ошибка 400 валидации

## 📚 Дополнительная информация

- **API Endpoints:**
  - `GET /studios/:studioId/dashboard` - Статистика для одной студии
  - `GET /dashboard/all` - Агрегированная статистика для всех студий (только OWNER/DEPUTY_OWNER)
- **Требуемая авторизация:** Да (JWT токен)
- **Content-Type:** `application/json`
- **Коды ответов:**
  - `200` - Успешный запрос
  - `400` - Ошибка валидации (неправильный формат даты, startDate > endDate, дата в будущем)
  - `403` - Доступ запрещен
  - `401` - Не авторизован

## 🚀 Миграция базы данных

**НЕ ТРЕБУЕТСЯ!** 

Это изменение не затрагивает структуру базы данных. Изменения только в логике обработки запросов на бэкенде. Никаких миграций применять не нужно.


