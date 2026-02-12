# Как применить миграцию staff_services вручную

## Вариант 1: Через Railway CLI (Рекомендуется)

1. Установи Railway CLI (если еще не установлен):
   ```bash
   npm i -g @railway/cli
   ```

2. Войди в Railway:
   ```bash
   railway login
   ```

3. Подключись к проекту:
   ```bash
   railway link
   ```

4. Примени миграцию:
   ```bash
   railway run npx prisma migrate deploy
   ```

## Вариант 2: Через Railway Web Interface

1. Открой проект в Railway
2. Перейди в сервис с backend (AIDA_project)
3. Открой вкладку **"Deployments"**
4. Найди последний деплой
5. Проверь логи - должна быть команда `release` с `npx prisma migrate deploy`
6. Если миграция не применилась, нажми **"Redeploy"** или **"Deploy"**

## Вариант 3: Проверить через SQL напрямую

1. В Railway Database → вкладка **"Data"**
2. Должна быть таблица `staff_services`
3. Если её нет - миграция не применилась

## Что должно появиться

После применения миграции в базе данных должна появиться новая таблица:

**`staff_services`** с колонками:
- `id` (TEXT, PRIMARY KEY)
- `studioId` (TEXT, FOREIGN KEY → studios.id)
- `staffUserId` (TEXT, FOREIGN KEY → users.id)
- `serviceId` (TEXT, FOREIGN KEY → services.id)
- `createdAt` (TIMESTAMP)
- `updatedAt` (TIMESTAMP)

## Проверка

После применения миграции:
1. Открой Railway Database → вкладка **"Data"**
2. Должна появиться таблица `staff_services`
3. Таблица может быть пустой (это нормально)


