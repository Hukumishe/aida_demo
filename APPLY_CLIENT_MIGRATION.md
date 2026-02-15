# Применение миграции для полей клиента

## Проблема
Ошибка: `The column clients.bonuses does not exist in the current database`

## Решение

Миграция создана и готова к применению. Нужно применить её на Railway.

### Способ 1: Через Railway CLI (рекомендуется)

```bash
railway run npx prisma migrate deploy
```

### Способ 2: Через Railway Dashboard

1. Откройте ваш проект на Railway
2. Перейдите в раздел "Deployments"
3. Найдите последний deployment
4. Откройте консоль (Console)
5. Выполните команду:
   ```bash
   npx prisma migrate deploy
   ```

### Способ 3: Вручную через SQL (если миграция не работает)

Если по какой-то причине миграция не применяется, можно выполнить SQL напрямую:

```sql
ALTER TABLE "clients" 
ADD COLUMN IF NOT EXISTS "bonuses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "discount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "balance" INTEGER NOT NULL DEFAULT 0;
```

**Важно:** Миграция уже содержит проверки на существование колонок, поэтому её можно безопасно применять несколько раз.

## Проверка

После применения миграции проверьте:

1. Запросы к `/clients` должны работать без ошибок
2. В базе данных должны появиться колонки:
   - `clients.bonuses`
   - `clients.discount`
   - `clients.balance`

## Файл миграции

Миграция находится в:
`prisma/migrations/20260215185605_add_client_bonuses_discount_balance/migration.sql`

