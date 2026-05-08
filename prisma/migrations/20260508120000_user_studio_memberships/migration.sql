-- Сотрудник может быть привязан к нескольким филиалам (кроме сетевых ролей с studioId user = null).

CREATE TABLE "user_studio_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_studio_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_studio_memberships_userId_studioId_key" ON "user_studio_memberships"("userId", "studioId");
CREATE INDEX "user_studio_memberships_studioId_idx" ON "user_studio_memberships"("studioId");
CREATE INDEX "user_studio_memberships_userId_idx" ON "user_studio_memberships"("userId");

ALTER TABLE "user_studio_memberships" ADD CONSTRAINT "user_studio_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_studio_memberships" ADD CONSTRAINT "user_studio_memberships_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Один membership на текущий user.studioId для всех филиальных пользователей
INSERT INTO "user_studio_memberships" ("id", "userId", "studioId", "createdAt")
SELECT
    'usm_' || substring(md5(u.id || u."studioId"), 1, 10),
    u.id,
    u."studioId",
    CURRENT_TIMESTAMP
FROM "users" AS u
WHERE u."studioId" IS NOT NULL;
