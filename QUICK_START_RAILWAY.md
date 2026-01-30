# Быстрое подключение к Railway Postgres

## Вариант 1: Через Service Reference (Рекомендуется) ⭐

1. Откройте сервис **AIDA_project** в Railway
2. Перейдите на вкладку **Variables**
3. Нажмите **"New Variable"** → выберите **"Reference"**
4. Выберите сервис **Postgres**
5. Выберите переменную **DATABASE_URL** (или **POSTGRES_URL**)
6. Сохраните

Railway автоматически подключит базу данных!

## Вариант 2: Вручную

1. Откройте сервис **Postgres** → **Variables**
2. Скопируйте значение `DATABASE_URL` или `POSTGRES_URL`
3. Откройте сервис **AIDA_project** → **Variables**
4. Добавьте новую переменную:
   - **Name**: `DATABASE_URL`
   - **Value**: вставьте скопированное значение
5. Сохраните

## Добавить остальные переменные

В сервисе **AIDA_project** → **Variables** добавьте:

```env
JWT_SECRET=<сгенерируйте через команду ниже>
JWT_REFRESH_SECRET=<сгенерируйте через команду ниже>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
PORT=3000
NODE_ENV=production
```

### Сгенерировать секреты:

```bash
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# JWT_REFRESH_SECRET (запустите еще раз)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Создать начальную миграцию

**Важно:** Перед деплоем нужно создать миграцию локально:

```bash
# 1. Убедитесь, что у вас есть DATABASE_URL в .env (локально)
# 2. Создайте миграцию
npm run prisma:migrate

# 3. Закоммитьте и запушьте
git add prisma/migrations/
git commit -m "Add initial database migration"
git push
```

После пуша Railway автоматически применит миграции при деплое!

## Проверка

После деплоя проверьте:
- ✅ Логи в Railway (должны быть сообщения об успешном применении миграций)
- ✅ Health endpoint: `https://your-app.railway.app/health`
- ✅ Swagger: `https://your-app.railway.app/docs`


