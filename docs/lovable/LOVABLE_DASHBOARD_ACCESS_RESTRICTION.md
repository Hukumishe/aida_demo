# Ограничение доступа к дэшбордам (только OWNER и DEPUTY_OWNER)

## 📋 Обзор

Backend изменил доступ к дэшбордам: теперь **только OWNER и DEPUTY_OWNER** могут просматривать дэшборды. Все остальные роли (ADMIN, MANAGER, MASTER) получат ошибку 403 Forbidden при попытке доступа.

## 🔄 Изменения в API

### Endpoint: `GET /studios/:studioId/dashboard`
### Endpoint: `GET /dashboard/all`

**Доступ:**
- ✅ **OWNER** - полный доступ ко всем дэшбордам
- ✅ **DEPUTY_OWNER** - полный доступ ко всем дэшбордам
- ❌ **ADMIN** - доступ запрещен (403 Forbidden)
- ❌ **MANAGER** - доступ запрещен (403 Forbidden)
- ❌ **MASTER** - доступ запрещен (403 Forbidden)

**Ответ при отсутствии доступа:**
```json
{
  "statusCode": 403,
  "message": "Only owners and deputy owners can access dashboard",
  "error": "Forbidden"
}
```

## 🎯 Что нужно сделать на Frontend

### 1. Создать helper функцию для проверки доступа к дэшборду

```typescript
// utils/roles.ts или utils/permissions.ts

export enum UserRole {
  OWNER = 'OWNER',
  DEPUTY_OWNER = 'DEPUTY_OWNER',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  MASTER = 'MASTER',
}

/**
 * Проверяет, может ли пользователь просматривать дэшборды
 * Только OWNER и DEPUTY_OWNER имеют доступ
 */
export function canAccessDashboard(role: string | undefined): boolean {
  if (!role) return false;
  return role === UserRole.OWNER || role === UserRole.DEPUTY_OWNER;
}
```

### 2. Скрыть дэшборд из навигации/меню для пользователей без доступа

**Найти компонент навигации/меню** (обычно `Navigation.tsx`, `Sidebar.tsx`, `Menu.tsx`, или аналогичный):

```tsx
// components/Navigation.tsx или components/Sidebar.tsx

import { canAccessDashboard } from '@/utils/roles';
import { useAuth } from '@/hooks/useAuth'; // или откуда вы получаете данные пользователя

export function Navigation() {
  const { user } = useAuth(); // Получаем текущего пользователя

  return (
    <nav>
      {/* ... другие пункты меню ... */}
      
      {/* Показывать дэшборд только для OWNER и DEPUTY_OWNER */}
      {canAccessDashboard(user?.role) && (
        <NavLink to="/dashboard">
          Дэшборд
        </NavLink>
      )}
      
      {/* ... остальные пункты меню ... */}
    </nav>
  );
}
```

### 3. Защитить роут дэшборда

**Если используется React Router или аналогичный:**

```tsx
// App.tsx или routes.tsx

import { Route, Navigate } from 'react-router-dom';
import { canAccessDashboard } from '@/utils/roles';
import { useAuth } from '@/hooks/useAuth';
import { DashboardPage } from '@/pages/DashboardPage';

// Компонент-защита роута
function ProtectedDashboardRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  if (!canAccessDashboard(user?.role)) {
    // Перенаправить на главную или показать сообщение об ошибке
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

// В роутах
<Route
  path="/dashboard"
  element={
    <ProtectedDashboardRoute>
      <DashboardPage />
    </ProtectedDashboardRoute>
  }
/>
```

### 4. Обработать ошибку 403 в компоненте дэшборда

**Обновить компонент дэшборда для обработки ошибки доступа:**

```tsx
// pages/DashboardPage.tsx или components/Dashboard.tsx

import { useState, useEffect } from 'react';
import { canAccessDashboard } from '@/utils/roles';
import { useAuth } from '@/hooks/useAuth';

export function DashboardPage({ studioId }: { studioId?: string }) {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Проверка доступа на фронтенде
  if (!canAccessDashboard(user?.role)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Доступ запрещен</h2>
          <p className="text-gray-600">
            Просмотр дэшборда доступен только для владельцев и заместителей владельца.
          </p>
        </div>
      </div>
    );
  }

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const endpoint = studioId 
        ? `/api/studios/${studioId}/dashboard`
        : '/api/dashboard/all';
      
      const response = await fetch(endpoint);
      
      if (response.status === 403) {
        setError('У вас нет доступа к дэшборду. Доступ разрешен только для владельцев и заместителей владельца.');
        return;
      }
      
      if (!response.ok) {
        throw new Error('Ошибка загрузки дэшборда');
      }
      
      const data = await response.json();
      setDashboardData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки дэшборда');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [studioId]);

  if (loading) {
    return <div>Загрузка...</div>;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  // Отображение дэшборда
  return (
    <div>
      {/* ... содержимое дэшборда ... */}
    </div>
  );
}
```

### 5. Обновить API клиент (если используется)

```typescript
// api/dashboard.ts или services/dashboardService.ts

import { canAccessDashboard } from '@/utils/roles';
import { getCurrentUser } from '@/utils/auth'; // или откуда вы получаете пользователя

export async function getDashboard(
  studioId?: string,
  params?: { startDate?: string; endDate?: string; period?: string }
): Promise<DashboardResponse> {
  // Проверка доступа перед запросом
  const user = getCurrentUser();
  if (!canAccessDashboard(user?.role)) {
    throw new Error('Access denied: Only owners and deputy owners can access dashboard');
  }

  const endpoint = studioId 
    ? `/api/studios/${studioId}/dashboard`
    : '/api/dashboard/all';
  
  // ... остальной код запроса ...
}
```

### 6. Обновить типы пользователя (если нужно)

```typescript
// types/user.ts

export enum UserRole {
  OWNER = 'OWNER',
  DEPUTY_OWNER = 'DEPUTY_OWNER',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  MASTER = 'MASTER',
}

export interface User {
  id: string;
  role: UserRole;
  // ... другие поля ...
}
```

## 📝 Пример полного компонента с защитой

```tsx
// pages/DashboardPage.tsx

import { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { canAccessDashboard } from '@/utils/roles';
import { useAuth } from '@/hooks/useAuth';
import { DashboardDateRangeFilter } from '@/components/DashboardDateRangeFilter';

export function DashboardPage() {
  const { studioId } = useParams<{ studioId?: string }>();
  const { user } = useAuth();
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Проверка доступа - перенаправление, если нет доступа
  if (!canAccessDashboard(user?.role)) {
    return (
      <Navigate 
        to="/" 
        replace 
        state={{ message: 'Доступ к дэшборду ограничен' }} 
      />
    );
  }

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const endpoint = studioId 
        ? `/api/studios/${studioId}/dashboard?${params.toString()}`
        : `/api/dashboard/all?${params.toString()}`;

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (response.status === 403) {
        setError('У вас нет доступа к дэшборду. Доступ разрешен только для владельцев и заместителей владельца.');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка загрузки дэшборда');
      }

      const data = await response.json();
      setDashboardData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки дэшборда');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [studioId, startDate, endDate]);

  const handleDateRangeChange = (newStartDate?: string, newEndDate?: string) => {
    setStartDate(newStartDate);
    setEndDate(newEndDate);
  };

  if (loading) {
    return <div>Загрузка дэшборда...</div>;
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-lg font-semibold text-red-800 mb-2">Ошибка</h3>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Дэшборд</h1>

      <DashboardDateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onDateRangeChange={handleDateRangeChange}
      />

      {dashboardData && (
        <div>
          {/* Отображение данных дэшборда */}
          <div>Всего записей: {dashboardData.overview.totalAppointments}</div>
          <div>Доход: {dashboardData.overview.revenue}</div>
          {/* ... остальные данные ... */}
        </div>
      )}
    </div>
  );
}
```

## ✅ Чеклист изменений

- [ ] Создана helper функция `canAccessDashboard(role)`
- [ ] Дэшборд скрыт из навигации/меню для пользователей без доступа
- [ ] Роут дэшборда защищен проверкой доступа
- [ ] Компонент дэшборда проверяет доступ перед загрузкой данных
- [ ] Обработана ошибка 403 в компоненте дэшборда
- [ ] Показано сообщение об ошибке доступа пользователям без прав
- [ ] Обновлен API клиент для проверки доступа (если используется)
- [ ] Протестирован доступ для OWNER (должен работать)
- [ ] Протестирован доступ для DEPUTY_OWNER (должен работать)
- [ ] Протестирован доступ для ADMIN (должен быть запрещен)
- [ ] Протестирован доступ для MANAGER (должен быть запрещен)
- [ ] Протестирован доступ для MASTER (должен быть запрещен)

## 🔍 Где искать код для изменения

1. **Компонент навигации/меню:**
   - `src/components/Navigation.tsx`
   - `src/components/Sidebar.tsx`
   - `src/components/Menu.tsx`
   - `src/layouts/MainLayout.tsx`
   - Или поиск по `dashboard` в навигации

2. **Компонент дэшборда:**
   - `src/pages/DashboardPage.tsx`
   - `src/components/Dashboard.tsx`
   - `src/features/dashboard/DashboardPage.tsx`

3. **Роуты:**
   - `src/App.tsx`
   - `src/routes.tsx`
   - `src/router.tsx`

4. **Утилиты для ролей:**
   - `src/utils/roles.ts`
   - `src/utils/permissions.ts`
   - `src/lib/auth.ts`

## ⚠️ Важные замечания

1. **Двойная защита:** Рекомендуется проверять доступ и на фронтенде (для UX), и на бэкенде (для безопасности). Backend всегда будет возвращать 403 для неавторизованных ролей.

2. **Обработка ошибок:** Всегда обрабатывайте ошибку 403 при запросах к API дэшборда, даже если вы проверяете доступ на фронтенде.

3. **UX:** Показывайте понятное сообщение пользователям без доступа, объясняя, почему они не могут просматривать дэшборд.

4. **Кэширование:** Если вы кэшируете данные пользователя, убедитесь, что при изменении роли кэш обновляется.

## 🧪 Тестовые сценарии

1. **OWNER пытается открыть дэшборд:**
   - Ожидаемый результат: дэшборд отображается, данные загружаются

2. **DEPUTY_OWNER пытается открыть дэшборд:**
   - Ожидаемый результат: дэшборд отображается, данные загружаются

3. **ADMIN пытается открыть дэшборд:**
   - Ожидаемый результат: дэшборд скрыт из меню, при прямом доступе - ошибка 403 или перенаправление

4. **MANAGER пытается открыть дэшборд:**
   - Ожидаемый результат: дэшборд скрыт из меню, при прямом доступе - ошибка 403 или перенаправление

5. **MASTER пытается открыть дэшборд:**
   - Ожидаемый результат: дэшборд скрыт из меню, при прямом доступе - ошибка 403 или перенаправление

## 📚 Дополнительная информация

- **API Endpoints:**
  - `GET /studios/:studioId/dashboard` - Статистика для одной студии (только OWNER/DEPUTY_OWNER)
  - `GET /dashboard/all` - Агрегированная статистика (только OWNER/DEPUTY_OWNER)
- **Требуемая авторизация:** Да (JWT токен)
- **Коды ответов:**
  - `200` - Успешный запрос (только для OWNER/DEPUTY_OWNER)
  - `403` - Доступ запрещен (для всех остальных ролей)
  - `401` - Не авторизован

## 🚀 Миграция базы данных

**НЕ ТРЕБУЕТСЯ!** 

Это изменение не затрагивает структуру базы данных. Изменения только в логике доступа на бэкенде и UI на фронтенде.


