# Railway Setup Guide - Подключение базы данных

## Шаг 1: Получить DATABASE_URL из Postgres

1. Откройте сервис **Postgres** в Railway
2. Перейдите на вкладку **Variables**
3. Найдите переменную `DATABASE_URL` или `POSTGRES_URL`
4. Скопируйте значение (формат: `postgresql://postgres:password@hostname:port/railway`)

## Шаг 2: Добавить переменные окружения в AIDA_project

Откройте сервис **AIDA_project** → **Variables** и добавьте:

### Обязательные переменные:

```env
DATABASE_URL=<скопированное значение из Postgres>
JWT_SECRET=<сгенерируйте сильный секрет>
JWT_REFRESH_SECRET=<сгенерируйте сильный секрет>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
PORT=3000
NODE_ENV=production
```

### Опциональные переменные:

```env
CORS_ORIGIN=https://your-frontend-domain.com
```

## Шаг 3: Сгенерировать JWT секреты

Выполните в терминале:

```bash
# Генерация JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Генерация JWT_REFRESH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Скопируйте результаты в соответствующие переменные.

## Шаг 4: Использовать Service Reference (рекомендуется)

Вместо ручного копирования DATABASE_URL, Railway может автоматически подключить базу:

1. В сервисе **AIDA_project** → **Variables**
2. Нажмите **"New Variable"** → **"Reference"**
3. Выберите сервис **Postgres**
4. Выберите переменную **DATABASE_URL** (или **POSTGRES_URL**)
5. Сохраните

Это автоматически создаст связь между сервисами.

## Шаг 5: Создать начальную миграцию (если еще не создана)

Локально выполните:

```bash
npm run prisma:migrate
```

Это создаст папку `prisma/migrations/` с начальной миграцией.

Затем закоммитьте и запушьте изменения:

```bash
git add prisma/migrations/
git commit -m "Add initial database migration"
git push
```

## Шаг 6: Проверить деплой

После пуша Railway автоматически:
1. Применит миграции (команда `release` в Procfile)
2. Сгенерирует Prisma Client
3. Запустит приложение

Проверьте логи в Railway, чтобы убедиться, что:
- ✅ Миграции применены успешно
- ✅ Приложение запущено
- ✅ Нет ошибок подключения к БД

## Шаг 7: Проверить работу

1. Откройте ваш домен Railway (например: `https://aida-project.up.railway.app`)
2. Проверьте health endpoint: `https://your-domain.railway.app/health`
3. Проверьте Swagger: `https://your-domain.railway.app/docs`

## Troubleshooting

### Ошибка: "Can't reach database server"
- Проверьте, что DATABASE_URL правильно скопирован
- Убедитесь, что Postgres сервис запущен (статус "Online")

### Ошибка: "Migration failed"
- Проверьте логи в Railway
- Убедитесь, что миграции закоммичены в репозиторий
- Проверьте, что Procfile содержит команду `release`

### Ошибка: "Prisma Client not generated"
- Проверьте, что в Procfile есть `npx prisma generate`
- Проверьте логи сборки в Railway

