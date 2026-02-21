# Применение миграции для добавления роли ADMIN

## Проблема

При попытке использовать роль `ADMIN` возникает ошибка:
```
ERROR: invalid input value for enum "UserRole": "ADMIN"
```

Это означает, что миграция для добавления роли `ADMIN` в enum `UserRole` не была применена к базе данных.

## Решение

### Вариант 1: Через Prisma CLI (рекомендуется)

**Для локальной разработки:**
```bash
npx prisma migrate dev
```

**Для продакшена (Railway, Docker, и т.д.):**
```bash
npx prisma migrate deploy
```

### Вариант 2: Напрямую через SQL

Если у вас есть прямой доступ к базе данных PostgreSQL, выполните SQL команду:

```sql
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ADMIN';
```

**Важно:** Команда `ADD VALUE IF NOT EXISTS` безопасна - она не вызовет ошибку, если значение уже существует.

### Вариант 3: Через Railway Database Console

1. Откройте ваш проект на Railway
2. Перейдите в раздел **Database** → **Postgres**
3. Откройте вкладку **Data** или **Query**
4. Выполните SQL команду:
   ```sql
   ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ADMIN';
   ```

### Вариант 4: Через psql (если есть доступ)

```bash
psql $DATABASE_URL -c "ALTER TYPE \"UserRole\" ADD VALUE IF NOT EXISTS 'ADMIN';"
```

## Проверка

После применения миграции проверьте, что роль добавлена:

```sql
SELECT unnest(enum_range(NULL::"UserRole")) AS role;
```

Должны быть видны все роли:
- OWNER
- ADMIN
- MANAGER
- MASTER

## Автоматическое применение на Railway

Если вы используете Railway, миграция должна применяться автоматически при деплое благодаря `Procfile`:

```
release: npx prisma migrate deploy && npx prisma generate
```

Если миграция не применилась автоматически:

1. Проверьте логи деплоя в Railway
2. Убедитесь, что файл миграции существует: `prisma/migrations/20260216143432_add_admin_role/migration.sql`
3. Примените миграцию вручную через Railway Database Console (см. Вариант 3)

## После применения миграции

1. **Перегенерируйте Prisma Client:**
   ```bash
   npx prisma generate
   ```

2. **Перезапустите приложение:**
   - На Railway: миграция применится автоматически при следующем деплое
   - Локально: перезапустите сервер

3. **Создайте пользователя с ролью ADMIN:**
   - Через seed скрипт: `npm run seed` (создаст `admin@example.com / admin123`)
   - Через API: `POST /studios/:studioId/staff` с `role: "ADMIN"`

## Файл миграции

Миграция находится в:
```
prisma/migrations/20260216143432_add_admin_role/migration.sql
```

Содержимое:
```sql
-- AlterEnum
-- Add ADMIN to UserRole enum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ADMIN';
```

## Troubleshooting

### Ошибка: "cannot alter type because it is used by a table"

Если вы получаете эту ошибку, это означает, что enum используется в таблице. В PostgreSQL нельзя изменить enum, если он используется. В этом случае:

1. Убедитесь, что используете PostgreSQL 9.1+ (поддерживает `ADD VALUE`)
2. Используйте `IF NOT EXISTS` для безопасности
3. Если проблема сохраняется, может потребоваться более сложная миграция

### Ошибка: "enum value already exists"

Если роль ADMIN уже существует, это нормально. Команда с `IF NOT EXISTS` просто пропустит добавление.

## Связанные документы

- [Система ролей и прав доступа](./LOVABLE_USER_ROLES.md)
- [Общие инструкции по миграциям](./APPLY_MIGRATIONS.md)








