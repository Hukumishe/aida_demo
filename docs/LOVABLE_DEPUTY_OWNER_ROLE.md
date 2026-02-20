# Внедрение роли "Заместитель владельца" (DEPUTY_OWNER) на Frontend

## 📋 Обзор

Добавлена новая роль **DEPUTY_OWNER (Заместитель владельца)** в систему. Эта роль имеет практически те же права, что и OWNER, за исключением управления владельцами и другими заместителями.

## 🎯 Что нужно сделать на Frontend

### 1. Обновить типы и константы ролей

#### Обновить enum/константы ролей

```typescript
// types/user.ts или constants/roles.ts
export enum UserRole {
  OWNER = 'OWNER',
  DEPUTY_OWNER = 'DEPUTY_OWNER',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  MASTER = 'MASTER',
}

// Или если используете строковые константы:
export const USER_ROLES = {
  OWNER: 'OWNER',
  DEPUTY_OWNER: 'DEPUTY_OWNER',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  MASTER: 'MASTER',
} as const;
```

#### Добавить helper функции для проверки прав

```typescript
// utils/roleHelpers.ts

/**
 * Проверяет, является ли роль уровнем владельца (OWNER или DEPUTY_OWNER)
 */
export function isOwnerLevelRole(role: string | undefined): boolean {
  return role === UserRole.OWNER || role === UserRole.DEPUTY_OWNER;
}

/**
 * Проверяет, может ли роль управлять владельцами (создавать/удалять OWNER)
 * Только OWNER может управлять владельцами
 */
export function canManageOwners(role: string | undefined): boolean {
  return role === UserRole.OWNER;
}

/**
 * Проверяет, может ли роль управлять заместителями (создавать/удалять DEPUTY_OWNER)
 * Только OWNER может управлять заместителями
 */
export function canManageDeputies(role: string | undefined): boolean {
  return role === UserRole.OWNER;
}

/**
 * Проверяет, может ли роль видеть все студии
 */
export function canSeeAllStudios(role: string | undefined): boolean {
  return isOwnerLevelRole(role) || role === UserRole.MANAGER;
}

/**
 * Проверяет, может ли роль удалять сущности
 */
export function canDelete(role: string | undefined): boolean {
  return isOwnerLevelRole(role);
}
```

### 2. Обновить компоненты управления пользователями

#### Список пользователей

```typescript
// components/UsersList.tsx или аналогичный компонент

import { isOwnerLevelRole, canManageOwners, canManageDeputies } from '@/utils/roleHelpers';

function UsersList() {
  const userRole = useUserRole(); // Получить роль текущего пользователя
  
  // Показать кнопку создания пользователя только для OWNER и DEPUTY_OWNER
  const canCreateUsers = isOwnerLevelRole(userRole);
  
  // Показать опцию создания OWNER только для OWNER
  const canCreateOwner = canManageOwners(userRole);
  
  // Показать опцию создания DEPUTY_OWNER только для OWNER
  const canCreateDeputy = canManageDeputies(userRole);
  
  return (
    <div>
      {canCreateUsers && (
        <button onClick={handleCreateUser}>
          Создать пользователя
        </button>
      )}
      
      {/* В форме создания пользователя */}
      {canCreateUsers && (
        <select name="role">
          <option value="ADMIN">Админ</option>
          <option value="MANAGER">Менеджер</option>
          <option value="MASTER">Мастер</option>
          {canCreateDeputy && (
            <option value="DEPUTY_OWNER">Заместитель владельца</option>
          )}
          {canCreateOwner && (
            <option value="OWNER">Владелец</option>
          )}
        </select>
      )}
    </div>
  );
}
```

#### Карточка пользователя / Редактирование пользователя

```typescript
// components/UserCard.tsx или UserEditForm.tsx

import { isOwnerLevelRole, canManageOwners, canManageDeputies } from '@/utils/roleHelpers';

function UserCard({ user, currentUserRole }) {
  // Проверка, можно ли удалить этого пользователя
  const canDeleteUser = () => {
    if (!isOwnerLevelRole(currentUserRole)) {
      return false; // Только OWNER и DEPUTY_OWNER могут удалять
    }
    
    // OWNER не может быть удален
    if (user.role === UserRole.OWNER) {
      return canManageOwners(currentUserRole); // Только OWNER может удалить OWNER
    }
    
    // DEPUTY_OWNER не может быть удален DEPUTY_OWNER
    if (user.role === UserRole.DEPUTY_OWNER) {
      return canManageDeputies(currentUserRole); // Только OWNER может удалить DEPUTY_OWNER
    }
    
    return true; // Остальных можно удалить
  };
  
  // Проверка, можно ли изменить роль этого пользователя
  const canChangeRole = () => {
    if (!isOwnerLevelRole(currentUserRole)) {
      return false;
    }
    
    // Нельзя изменить роль OWNER (кроме самого OWNER)
    if (user.role === UserRole.OWNER) {
      return canManageOwners(currentUserRole);
    }
    
    // Нельзя изменить роль DEPUTY_OWNER на OWNER (кроме OWNER)
    if (user.role === UserRole.DEPUTY_OWNER) {
      return canManageDeputies(currentUserRole);
    }
    
    return true;
  };
  
  return (
    <div>
      <h3>{user.name}</h3>
      <p>Роль: {user.role}</p>
      
      {canChangeRole() && (
        <select 
          value={user.role}
          onChange={handleRoleChange}
          disabled={!canChangeRole()}
        >
          <option value="ADMIN">Админ</option>
          <option value="MANAGER">Менеджер</option>
          <option value="MASTER">Мастер</option>
          {canManageDeputies(currentUserRole) && (
            <option value="DEPUTY_OWNER">Заместитель владельца</option>
          )}
          {canManageOwners(currentUserRole) && (
            <option value="OWNER">Владелец</option>
          )}
        </select>
      )}
      
      {canDeleteUser() && (
        <button onClick={handleDeleteUser}>
          Удалить пользователя
        </button>
      )}
    </div>
  );
}
```

### 3. Обновить компоненты с проверками доступа

#### Селектор студий

```typescript
// components/StudioSelector.tsx

import { canSeeAllStudios } from '@/utils/roleHelpers';

function StudioSelector() {
  const userRole = useUserRole();
  
  // Показать селектор студий только для OWNER, DEPUTY_OWNER и MANAGER
  if (!canSeeAllStudios(userRole)) {
    return null; // ADMIN и MASTER видят только свою студию
  }
  
  return (
    <select onChange={handleStudioChange}>
      {studios.map(studio => (
        <option key={studio.id} value={studio.id}>
          {studio.name}
        </option>
      ))}
    </select>
  );
}
```

#### Кнопки удаления

```typescript
// components/AppointmentCard.tsx, ClientCard.tsx и т.д.

import { canDelete } from '@/utils/roleHelpers';

function AppointmentCard({ appointment }) {
  const userRole = useUserRole();
  
  return (
    <div>
      <h3>{appointment.title}</h3>
      
      {/* Кнопка удаления только для OWNER и DEPUTY_OWNER */}
      {canDelete(userRole) && (
        <button onClick={handleDelete}>
          Удалить
        </button>
      )}
    </div>
  );
}
```

### 4. Обновить навигацию и меню

```typescript
// components/Navigation.tsx или Sidebar.tsx

import { isOwnerLevelRole, canManageOwners } from '@/utils/roleHelpers';

function Navigation() {
  const userRole = useUserRole();
  
  return (
    <nav>
      <Link to="/dashboard">Дашборд</Link>
      <Link to="/appointments">Записи</Link>
      <Link to="/clients">Клиенты</Link>
      
      {/* Управление пользователями только для OWNER и DEPUTY_OWNER */}
      {isOwnerLevelRole(userRole) && (
        <Link to="/users">Пользователи</Link>
      )}
      
      {/* Создание студий только для OWNER и DEPUTY_OWNER */}
      {isOwnerLevelRole(userRole) && (
        <Link to="/studios">Студии</Link>
      )}
      
      {/* Специальные настройки только для OWNER */}
      {canManageOwners(userRole) && (
        <Link to="/settings/owners">Управление владельцами</Link>
      )}
    </nav>
  );
}
```

### 5. Обновить отображение ролей в UI

```typescript
// components/RoleBadge.tsx

function RoleBadge({ role }) {
  const roleLabels = {
    OWNER: { label: 'Владелец', color: 'gold' },
    DEPUTY_OWNER: { label: 'Заместитель владельца', color: 'silver' },
    ADMIN: { label: 'Админ', color: 'blue' },
    MANAGER: { label: 'Менеджер', color: 'green' },
    MASTER: { label: 'Мастер', color: 'purple' },
  };
  
  const roleInfo = roleLabels[role] || { label: role, color: 'gray' };
  
  return (
    <span className={`badge badge-${roleInfo.color}`}>
      {roleInfo.label}
    </span>
  );
}
```

### 6. Обновить формы создания/редактирования

#### Форма создания пользователя

```typescript
// components/CreateUserForm.tsx

import { canManageOwners, canManageDeputies } from '@/utils/roleHelpers';

function CreateUserForm() {
  const currentUserRole = useUserRole();
  
  const availableRoles = [
    { value: 'ADMIN', label: 'Админ' },
    { value: 'MANAGER', label: 'Менеджер' },
    { value: 'MASTER', label: 'Мастер' },
  ];
  
  // Добавить DEPUTY_OWNER только если текущий пользователь - OWNER
  if (canManageDeputies(currentUserRole)) {
    availableRoles.push({ value: 'DEPUTY_OWNER', label: 'Заместитель владельца' });
  }
  
  // Добавить OWNER только если текущий пользователь - OWNER
  if (canManageOwners(currentUserRole)) {
    availableRoles.push({ value: 'OWNER', label: 'Владелец' });
  }
  
  return (
    <form>
      <select name="role">
        {availableRoles.map(role => (
          <option key={role.value} value={role.value}>
            {role.label}
          </option>
        ))}
      </select>
    </form>
  );
}
```

### 7. Обновить проверки доступа в API вызовах

```typescript
// services/userService.ts или api/users.ts

export const userService = {
  async createUser(data: CreateUserDto) {
    // Backend сам проверит права, но можно добавить предупреждение на фронте
    if (data.role === 'OWNER' || data.role === 'DEPUTY_OWNER') {
      const currentRole = getCurrentUserRole();
      if (data.role === 'OWNER' && !canManageOwners(currentRole)) {
        throw new Error('Только владелец может создавать других владельцев');
      }
      if (data.role === 'DEPUTY_OWNER' && !canManageDeputies(currentRole)) {
        throw new Error('Только владелец может создавать заместителей');
      }
    }
    
    return api.post('/users', data);
  },
  
  async deleteUser(userId: string) {
    // Можно добавить предварительную проверку
    const user = await this.getUser(userId);
    const currentRole = getCurrentUserRole();
    
    if (user.role === 'OWNER' && !canManageOwners(currentRole)) {
      throw new Error('Только владелец может удалять других владельцев');
    }
    
    if (user.role === 'DEPUTY_OWNER' && !canManageDeputies(currentRole)) {
      throw new Error('Только владелец может удалять заместителей');
    }
    
    return api.delete(`/users/${userId}`);
  },
};
```

## 📊 Таблица прав доступа для Frontend

| Действие | OWNER | DEPUTY_OWNER | ADMIN | MANAGER | MASTER |
|----------|-------|--------------|-------|---------|--------|
| **UI Элементы** |
| Видеть все студии | ✅ | ✅ | ❌ | ✅ | ❌ |
| Селектор студий | ✅ | ✅ | ❌ | ✅ | ❌ |
| Кнопка удаления | ✅ | ✅ | ❌ | ❌ | ❌ |
| Управление пользователями | ✅ | ✅ | ❌ | ❌ | ❌ |
| Создание студий | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Управление пользователями** |
| Создание ADMIN/MANAGER/MASTER | ✅ | ✅ | ❌ | ❌ | ❌ |
| Создание DEPUTY_OWNER | ✅ | ❌ | ❌ | ❌ | ❌ |
| Создание OWNER | ✅ | ❌ | ❌ | ❌ | ❌ |
| Удаление ADMIN/MANAGER/MASTER | ✅ | ✅ | ❌ | ❌ | ❌ |
| Удаление DEPUTY_OWNER | ✅ | ❌ | ❌ | ❌ | ❌ |
| Удаление OWNER | ✅ | ❌ | ❌ | ❌ | ❌ |
| Изменение роли на OWNER | ✅ | ❌ | ❌ | ❌ | ❌ |
| Изменение роли на DEPUTY_OWNER | ✅ | ❌ | ❌ | ❌ | ❌ |

## ✅ Чеклист внедрения

- [ ] Обновить типы/константы ролей (добавить DEPUTY_OWNER)
- [ ] Создать helper функции (`isOwnerLevelRole`, `canManageOwners`, `canManageDeputies`)
- [ ] Обновить компонент списка пользователей
- [ ] Обновить форму создания пользователя (скрыть опции OWNER/DEPUTY_OWNER для DEPUTY_OWNER)
- [ ] Обновить форму редактирования пользователя (запретить изменение роли на OWNER/DEPUTY_OWNER для DEPUTY_OWNER)
- [ ] Обновить кнопки удаления пользователей (скрыть для DEPUTY_OWNER при попытке удалить OWNER/DEPUTY_OWNER)
- [ ] Обновить селектор студий (показать для DEPUTY_OWNER)
- [ ] Обновить кнопки удаления в других компонентах (показать для DEPUTY_OWNER)
- [ ] Обновить навигацию/меню (показать управление пользователями для DEPUTY_OWNER)
- [ ] Обновить отображение ролей (добавить label для DEPUTY_OWNER)
- [ ] Обновить проверки доступа в API вызовах
- [ ] Протестировать все сценарии с ролью DEPUTY_OWNER

## 🔍 Тестовые сценарии

### Сценарий 1: DEPUTY_OWNER создает пользователя
1. Войти как DEPUTY_OWNER
2. Перейти в раздел "Пользователи"
3. Нажать "Создать пользователя"
4. **Ожидаемый результат:** В списке ролей должны быть только ADMIN, MANAGER, MASTER (без OWNER и DEPUTY_OWNER)

### Сценарий 2: DEPUTY_OWNER пытается удалить OWNER
1. Войти как DEPUTY_OWNER
2. Найти пользователя с ролью OWNER
3. **Ожидаемый результат:** Кнопка удаления не должна отображаться или должна быть неактивна

### Сценарий 3: DEPUTY_OWNER пытается удалить другого DEPUTY_OWNER
1. Войти как DEPUTY_OWNER
2. Найти другого пользователя с ролью DEPUTY_OWNER
3. **Ожидаемый результат:** Кнопка удаления не должна отображаться или должна быть неактивна

### Сценарий 4: DEPUTY_OWNER удаляет ADMIN
1. Войти как DEPUTY_OWNER
2. Найти пользователя с ролью ADMIN
3. Нажать "Удалить"
4. **Ожидаемый результат:** Пользователь успешно удален

### Сценарий 5: DEPUTY_OWNER видит все студии
1. Войти как DEPUTY_OWNER
2. Перейти в раздел "Студии"
3. **Ожидаемый результат:** Должны отображаться все студии, селектор студий должен работать

### Сценарий 6: DEPUTY_OWNER создает студию
1. Войти как DEPUTY_OWNER
2. Перейти в раздел "Студии"
3. Нажать "Создать студию"
4. **Ожидаемый результат:** Студия успешно создана

## 🚨 Важные замечания

1. **Backend уже защищен:** Все проверки прав реализованы на backend, поэтому даже если на frontend что-то пропустить, backend вернет ошибку 403 Forbidden.

2. **UX важнее безопасности:** Хотя backend защищен, важно скрывать недоступные действия на UI для лучшего пользовательского опыта.

3. **Консистентность:** Используйте helper функции везде, где проверяете роли, чтобы избежать дублирования логики.

4. **Тестирование:** Обязательно протестируйте все сценарии с ролью DEPUTY_OWNER, особенно граничные случаи (попытка удалить OWNER, создать DEPUTY_OWNER и т.д.).

## 📝 Примеры использования helper функций

```typescript
// ✅ Правильно
if (isOwnerLevelRole(userRole)) {
  // Показать кнопку удаления
}

// ❌ Неправильно
if (userRole === 'OWNER' || userRole === 'DEPUTY_OWNER') {
  // Дублирование логики
}

// ✅ Правильно
if (canManageOwners(userRole)) {
  // Показать опцию создания OWNER
}

// ❌ Неправильно
if (userRole === 'OWNER') {
  // Не учитывает возможные изменения в будущем
}
```

## 🔗 Связанные документы

- [Система ролей и прав доступа](./LOVABLE_USER_ROLES.md) - полное описание всех ролей
- [Backend API документация](../README.md) - описание API endpoints

---

**Дата создания:** 18.02.2026  
**Версия:** 1.0

