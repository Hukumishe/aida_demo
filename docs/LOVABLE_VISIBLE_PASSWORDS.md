# Видимые пароли для OWNER и DEPUTY_OWNER

## 📋 Обзор

Добавлена функциональность отображения паролей пользователей для ролей **OWNER** и **DEPUTY_OWNER**. Теперь владелец и заместитель владельца могут видеть пароли сотрудников при создании и редактировании.

## 🎯 Что нужно сделать на Frontend

### 1. Обновить типы пользователя

Добавьте поле `password` в интерфейс/тип пользователя:

```typescript
// types/user.ts или types/staff.ts

export interface User {
  id: string;
  email?: string;
  phone?: string;
  password?: string; // Добавить это поле - видимо только для OWNER/DEPUTY_OWNER
  role: UserRole;
  studioId?: string;
  isActive: boolean;
  staffProfile?: StaffProfile;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStaffDto {
  email?: string;
  phone?: string;
  password: string; // Обязательное поле при создании
  role: UserRole;
  firstName: string;
  lastName?: string;
  // ... остальные поля
}

export interface UpdateStaffDto {
  email?: string;
  phone?: string;
  password?: string; // Опциональное поле при обновлении
  role?: UserRole;
  // ... остальные поля
}
```

### 2. Обновить компонент создания пользователя

Пароль должен быть видимым (не скрыт звездочками) для OWNER и DEPUTY_OWNER:

```typescript
// components/CreateStaffForm.tsx или аналогичный компонент

import { isOwnerLevelRole } from '@/utils/roleHelpers';
import { useUserRole } from '@/hooks/useUserRole';

function CreateStaffForm() {
  const userRole = useUserRole();
  const [formData, setFormData] = useState<CreateStaffDto>({
    password: '',
    // ... другие поля
  });

  // Проверяем, может ли текущий пользователь видеть пароль
  const canSeePassword = isOwnerLevelRole(userRole);

  return (
    <form onSubmit={handleSubmit}>
      {/* ... другие поля формы */}
      
      <div>
        <label htmlFor="password">Пароль</label>
        <input
          type={canSeePassword ? "text" : "password"} // Видимый для OWNER/DEPUTY_OWNER
          id="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          required
        />
        {canSeePassword && (
          <p className="text-sm text-gray-500">
            Пароль будет виден вам после создания
          </p>
        )}
      </div>

      <button type="submit">Создать сотрудника</button>
    </form>
  );
}
```

### 3. Обновить компонент редактирования пользователя

При редактировании пароль должен отображаться, если он есть в ответе API:

```typescript
// components/EditStaffForm.tsx или аналогичный компонент

import { isOwnerLevelRole } from '@/utils/roleHelpers';
import { useUserRole } from '@/hooks/useUserRole';

function EditStaffForm({ staffId }: { staffId: string }) {
  const userRole = useUserRole();
  const [staff, setStaff] = useState<User | null>(null);
  const [formData, setFormData] = useState<UpdateStaffDto>({});
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Загрузить данные пользователя
    fetchStaff(staffId).then(setStaff);
  }, [staffId]);

  const canSeePassword = isOwnerLevelRole(userRole);
  const hasPassword = staff?.password !== undefined && staff.password !== null;

  return (
    <form onSubmit={handleSubmit}>
      {/* ... другие поля формы */}
      
      <div>
        <label htmlFor="password">Пароль</label>
        {hasPassword && canSeePassword ? (
          // Показываем текущий пароль, если он есть и пользователь может его видеть
          <div>
            <input
              type="text"
              id="password"
              value={staff.password}
              readOnly
              className="bg-gray-100"
            />
            <p className="text-sm text-gray-500 mt-1">
              Текущий пароль: {staff.password}
            </p>
            <button
              type="button"
              onClick={() => {
                setShowPassword(!showPassword);
                setFormData({ ...formData, password: '' });
              }}
            >
              {showPassword ? 'Отменить изменение' : 'Изменить пароль'}
            </button>
          </div>
        ) : (
          // Если пароль не виден или его нет, показываем обычное поле
          <input
            type="password"
            id="password"
            value={formData.password || ''}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder={hasPassword ? "Оставьте пустым, чтобы не менять" : "Введите новый пароль"}
          />
        )}
        
        {showPassword && (
          <input
            type="text"
            id="newPassword"
            value={formData.password || ''}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder="Введите новый пароль"
          />
        )}
      </div>

      <button type="submit">Сохранить изменения</button>
    </form>
  );
}
```

### 4. Обновить компонент списка пользователей

В таблице/списке пользователей можно показывать пароль для OWNER/DEPUTY_OWNER:

```typescript
// components/StaffList.tsx или аналогичный компонент

import { isOwnerLevelRole } from '@/utils/roleHelpers';
import { useUserRole } from '@/hooks/useUserRole';

function StaffList() {
  const userRole = useUserRole();
  const [staffList, setStaffList] = useState<User[]>([]);
  const canSeePasswords = isOwnerLevelRole(userRole);

  return (
    <table>
      <thead>
        <tr>
          <th>Имя</th>
          <th>Email</th>
          <th>Телефон</th>
          {canSeePasswords && <th>Пароль</th>}
          <th>Роль</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        {staffList.map((staff) => (
          <tr key={staff.id}>
            <td>{staff.staffProfile?.firstName} {staff.staffProfile?.lastName}</td>
            <td>{staff.email}</td>
            <td>{staff.phone}</td>
            {canSeePasswords && (
              <td>
                {staff.password ? (
                  <span className="font-mono text-sm">{staff.password}</span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
            )}
            <td>{staff.role}</td>
            <td>
              <button onClick={() => handleEdit(staff.id)}>Редактировать</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### 5. Обновить API клиент (если используется)

Убедитесь, что API клиент правильно обрабатывает поле `password`:

```typescript
// api/staff.ts или аналогичный файл

export interface StaffResponse {
  id: string;
  email?: string;
  phone?: string;
  password?: string; // Добавить это поле
  role: UserRole;
  studioId?: string;
  isActive: boolean;
  staffProfile?: StaffProfile;
  createdAt: string;
  updatedAt: string;
}

export async function createStaff(data: CreateStaffDto): Promise<StaffResponse> {
  const response = await fetch('/api/studios/:studioId/staff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function updateStaff(
  staffId: string,
  data: UpdateStaffDto
): Promise<StaffResponse> {
  const response = await fetch(`/api/staff/${staffId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function getStaffList(studioId: string): Promise<StaffResponse[]> {
  const response = await fetch(`/api/studios/${studioId}/staff`);
  return response.json();
}

export async function getStaffProfile(staffId: string): Promise<StaffResponse> {
  const response = await fetch(`/api/staff/${staffId}/profile`);
  return response.json();
}
```

## 🔒 Безопасность

**Важно:**
- Пароль возвращается в API только для ролей OWNER и DEPUTY_OWNER
- Backend автоматически скрывает пароль для других ролей
- На фронтенде также рекомендуется проверять роль перед отображением пароля
- Пароль отображается в открытом виде только для OWNER и DEPUTY_OWNER

## 📝 Примеры использования

### Пример 1: Создание пользователя с видимым паролем

```typescript
function CreateStaffPage() {
  const userRole = useUserRole();
  const canSeePassword = isOwnerLevelRole(userRole);

  const handleCreate = async (data: CreateStaffDto) => {
    const newStaff = await createStaff(data);
    
    if (canSeePassword && newStaff.password) {
      // Показать уведомление с паролем
      alert(`Пользователь создан! Пароль: ${newStaff.password}`);
    } else {
      alert('Пользователь создан!');
    }
  };

  return <CreateStaffForm onSubmit={handleCreate} />;
}
```

### Пример 2: Отображение пароля в модальном окне

```typescript
function StaffDetailsModal({ staff }: { staff: User }) {
  const userRole = useUserRole();
  const canSeePassword = isOwnerLevelRole(userRole);

  return (
    <Modal>
      <h2>Детали сотрудника</h2>
      <div>
        <p><strong>Email:</strong> {staff.email}</p>
        <p><strong>Телефон:</strong> {staff.phone}</p>
        {canSeePassword && staff.password && (
          <div>
            <p><strong>Пароль:</strong></p>
            <code className="bg-gray-100 p-2 rounded">
              {staff.password}
            </code>
            <button onClick={() => navigator.clipboard.writeText(staff.password!)}>
              Копировать
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
```

### Пример 3: Поле пароля с кнопкой показать/скрыть (для OWNER/DEPUTY_OWNER)

```typescript
function PasswordField({ 
  value, 
  onChange, 
  canSeePassword 
}: { 
  value: string;
  onChange: (value: string) => void;
  canSeePassword: boolean;
}) {
  const [showPassword, setShowPassword] = useState(canSeePassword);

  return (
    <div>
      <label>Пароль</label>
      <div className="flex gap-2">
        <input
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1"
        />
        {canSeePassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? "👁️" : "👁️‍🗨️"}
          </button>
        )}
      </div>
      {canSeePassword && (
        <p className="text-xs text-gray-500">
          Пароль будет сохранен и виден вам
        </p>
      )}
    </div>
  );
}
```

## ✅ Чеклист для внедрения

- [ ] Добавить поле `password?: string` в интерфейс `User`
- [ ] Обновить типы `CreateStaffDto` и `UpdateStaffDto`
- [ ] Обновить форму создания пользователя - сделать пароль видимым для OWNER/DEPUTY_OWNER
- [ ] Обновить форму редактирования - показывать текущий пароль для OWNER/DEPUTY_OWNER
- [ ] Обновить список пользователей - добавить колонку с паролем (только для OWNER/DEPUTY_OWNER)
- [ ] Обновить API клиент для работы с полем `password`
- [ ] Добавить проверку роли перед отображением пароля
- [ ] Протестировать создание пользователя (пароль должен быть виден)
- [ ] Протестировать редактирование пользователя (пароль должен быть виден)
- [ ] Протестировать, что другие роли не видят пароли

## 🎨 UI/UX рекомендации

1. **Визуальное выделение:** Пароль можно выделить моноширинным шрифтом (`font-mono`) для лучшей читаемости
2. **Копирование:** Добавьте кнопку "Копировать" рядом с паролем для удобства
3. **Индикация:** Покажите иконку или подпись, что пароль виден только для OWNER/DEPUTY_OWNER
4. **Предупреждение:** Можно добавить небольшое предупреждение о том, что пароль хранится в открытом виде

## 📌 Важные замечания

1. **Backend автоматически фильтрует:** Backend возвращает пароль только для OWNER и DEPUTY_OWNER, но на фронтенде также рекомендуется проверять роль
2. **Пароль при создании:** При создании пользователя пароль всегда передается и сохраняется
3. **Пароль при обновлении:** При обновлении пароль обновляется только если передано новое значение
4. **Пустой пароль:** Если пароль не задан или не виден, поле может быть пустым или показывать "—"

## 🔗 Связанные эндпоинты

- `POST /studios/:studioId/staff` - Создание пользователя (возвращает пароль для OWNER/DEPUTY_OWNER)
- `PATCH /staff/:userId` - Обновление пользователя (возвращает пароль для OWNER/DEPUTY_OWNER)
- `GET /studios/:studioId/staff` - Список пользователей (возвращает пароли для OWNER/DEPUTY_OWNER)
- `GET /staff/:userId/profile` - Профиль пользователя (возвращает пароль для OWNER/DEPUTY_OWNER)

Все эти эндпоинты автоматически возвращают поле `password` только для ролей OWNER и DEPUTY_OWNER.

