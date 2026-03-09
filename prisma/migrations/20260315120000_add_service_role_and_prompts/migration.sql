-- Добавить роль SERVICE в enum UserRole
ALTER TYPE "UserRole" ADD VALUE 'SERVICE';

-- Таблица промптов (панель доступна только роли SERVICE)
CREATE TABLE IF NOT EXISTS "prompts" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "prompts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "prompts_key_key" ON "prompts"("key");
