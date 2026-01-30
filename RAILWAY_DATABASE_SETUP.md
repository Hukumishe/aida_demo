# Настройка DATABASE_URL в Railway

## Проблема
Приложение запускается, но не может подключиться к базе данных:
```
PrismaClientInitializationError: error: Environment variable not found: DATABASE_URL.
```

## Решение: Добавить DATABASE_URL

### Способ 1: Service Reference (Рекомендуется) ⭐

1. Откройте сервис **AIDA_project** в Railway
2. Перейдите на вкладку **Variables**
3. Нажмите **"New Variable"** → выберите **"Reference"**
4. Выберите сервис **Postgres**
5. Выберите переменную **DATABASE_URL** (или **POSTGRES_URL**)
6. Сохраните

Railway автоматически подключит базу данных!

### Способ 2: Вручную

1. Откройте сервис **Postgres** в Railway
2. Перейдите на вкладку **Variables**
3. Найдите переменную `DATABASE_URL` или `POSTGRES_URL`
4. Скопируйте её значение (формат: `postgresql://postgres:password@hostname:port/railway`)
5. Откройте сервис **AIDA_project** → **Variables**
6. Добавьте новую переменную:
   - **Name**: `DATABASE_URL`
   - **Value**: вставьте скопированное значение
7. Сохраните

## После добавления DATABASE_URL

Railway автоматически перезапустит приложение, и оно подключится к базе данных.

Проверьте логи - должно появиться сообщение об успешном подключении к базе данных.

## Проверка

После добавления переменной проверьте:
1. ✅ Логи в Railway (не должно быть ошибки DATABASE_URL)
2. ✅ Health endpoint: `https://your-app.railway.app/health`
3. ✅ Swagger: `https://your-app.railway.app/docs`


