# Применение миграции для исправления ошибок базы данных

## Проблемы в логах:

1. **`column services.requiredStaffCount does not exist`**
   - PostgreSQL создал колонку как `requiredstaffcount` (нижний регистр)
   - Prisma ожидает `requiredStaffCount` (camelCase)

2. **`relation "public.staff_services" does not exist`**
   - Таблица `staff_services` не создана
   - Миграция не была применена

## Решение:

Создана миграция `20240212000000_fix_column_names`, которая:
- Переименует колонку `requiredstaffcount` → `requiredStaffCount`
- Создаст таблицу `staff_services` если её нет
- Создаст все необходимые индексы и foreign keys

## Как применить миграцию:

### Вариант 1: Через Railway CLI (Рекомендуется)

```bash
# 1. Войди в Railway
railway login

# 2. Подключись к проекту
railway link

# 3. Примени миграцию
railway run npx prisma migrate deploy
```

### Вариант 2: Автоматически при деплое

Миграция должна примениться автоматически при следующем деплое, так как в `Procfile` есть команда:
```
release: npx prisma migrate deploy && npx prisma generate
```

Но если нужно применить срочно - используй Вариант 1.

## Проверка после применения:

1. **Проверь логи Railway** - не должно быть ошибок про `requiredStaffCount` и `staff_services`
2. **Проверь базу данных:**
   - Таблица `staff_services` должна существовать
   - Колонка `services.requiredStaffCount` должна существовать (не `requiredstaffcount`)
3. **Проверь API:**
   - `GET /studios/:studioId/services` должен работать без 500 ошибки
   - `GET /studios/:studioId/staff` должен работать без ошибок про `staff_services`

## Если миграция не применилась автоматически:

1. Открой Railway → сервис backend → вкладка **"Deployments"**
2. Нажми **"Redeploy"** или **"Deploy"**
3. Проверь логи - должна быть команда `release` с `npx prisma migrate deploy`
4. Убедись, что миграция применилась успешно


