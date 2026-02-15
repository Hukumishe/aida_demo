-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('ERROR', 'WARN', 'INFO', 'DEBUG', 'VERBOSE');

-- CreateEnum
CREATE TYPE "LogType" AS ENUM ('HTTP_REQUEST', 'HTTP_RESPONSE', 'ERROR', 'AUTH', 'DATABASE', 'BUSINESS_LOGIC', 'SYSTEM');

-- CreateTable
CREATE TABLE IF NOT EXISTS "logs" (
    "id" TEXT NOT NULL,
    "level" "LogLevel" NOT NULL,
    "type" "LogType" NOT NULL,
    "message" TEXT NOT NULL,
    "context" TEXT,
    "userId" TEXT,
    "studioId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "method" TEXT,
    "url" TEXT,
    "statusCode" INTEGER,
    "error" TEXT,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "logs_level_idx" ON "logs"("level");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "logs_type_idx" ON "logs"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "logs_createdAt_idx" ON "logs"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "logs_userId_idx" ON "logs"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "logs_studioId_idx" ON "logs"("studioId");



