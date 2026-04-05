-- Пользователь DEVELOPER для входа на Railway (один раз, если ещё нет роли DEVELOPER).
-- Пароль в открытом виде совпадает с полем password (как у owner в CRM): Developer1!
-- Телефон: +77008887766 | Email: developer@example.com
-- organizationId — первая организация в БД (после миграций организаций она есть).

INSERT INTO "users" (
    "id",
    "email",
    "phone",
    "passwordHash",
    "password",
    "role",
    "organizationId",
    "studioId",
    "isActive",
    "createdAt",
    "updatedAt"
)
SELECT
    'usr_devplatform1',
    'developer@example.com',
    '+77008887766',
    '$2b$10$.Ua0bMDzUYDwCcUgUcZBfON8utEcdF.1jzDDMTEgTVKU0Y5ukMWqS',
    'Developer1!',
    'DEVELOPER'::"UserRole",
    o."id",
    NULL,
    true,
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
FROM (SELECT "id" FROM "organizations" ORDER BY "createdAt" ASC LIMIT 1) AS o
WHERE NOT EXISTS (SELECT 1 FROM "users" WHERE "role" = 'DEVELOPER'::"UserRole")
  AND NOT EXISTS (SELECT 1 FROM "users" WHERE "phone" = '+77008887766');
