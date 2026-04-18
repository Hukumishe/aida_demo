-- Разрешить один глобальный промпт на ключ (organizationId IS NULL) и отдельные промпты на пару (organizationId, key).
DROP INDEX IF EXISTS "prompts_key_key";

CREATE UNIQUE INDEX "prompts_key_global_unique" ON "prompts" ("key") WHERE "organizationId" IS NULL;

CREATE UNIQUE INDEX "prompts_organizationId_key_unique" ON "prompts" ("organizationId", "key")
WHERE "organizationId" IS NOT NULL;
