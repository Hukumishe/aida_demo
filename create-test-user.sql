-- SQL для создания тестового OWNER пользователя
-- Пароль: owner123
-- Email: owner@example.com

-- Сначала создайте студию (если еще нет)
INSERT INTO "studios" ("id", "name", "address", "timezone", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'Beauty Studio Moscow',
  'Moscow, Tverskaya st. 1',
  'Europe/Moscow',
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING
RETURNING "id";

-- Создайте OWNER пользователя
-- Пароль: owner123 (bcrypt hash)
INSERT INTO "users" ("id", "email", "phone", "passwordHash", "role", "studioId", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'owner@example.com',
  '+79991234567',
  '$2b$10$rOzJqZqKqKqKqKqKqKqKqOqKqKqKqKqKqKqKqKqKqKqKqKqKqKqKqKq', -- Временно, нужно сгенерировать правильный hash
  'OWNER',
  NULL, -- OWNER не привязан к студии
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("email") DO NOTHING;

-- Примечание: Нужно сгенерировать правильный bcrypt hash для пароля "owner123"
-- Это можно сделать через Node.js:
-- const bcrypt = require('bcrypt');
-- const hash = await bcrypt.hash('owner123', 10);
-- console.log(hash);


