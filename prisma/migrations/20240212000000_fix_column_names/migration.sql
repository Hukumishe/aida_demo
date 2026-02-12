-- Fix column name case sensitivity issue
-- PostgreSQL created column as "requiredstaffcount" but Prisma expects "requiredStaffCount"
-- Check if column exists with wrong case and rename it

DO $$
BEGIN
    -- Check if column exists with lowercase name
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'services' 
        AND column_name = 'requiredstaffcount'
    ) THEN
        -- Rename column to match Prisma schema
        ALTER TABLE "services" RENAME COLUMN "requiredstaffcount" TO "requiredStaffCount";
    END IF;
END $$;

-- Ensure staff_services table exists (if migration wasn't applied)
CREATE TABLE IF NOT EXISTS "staff_services" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_services_pkey" PRIMARY KEY ("id")
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS "staff_services_studioId_staffUserId_idx" ON "staff_services"("studioId", "staffUserId");
CREATE INDEX IF NOT EXISTS "staff_services_serviceId_idx" ON "staff_services"("serviceId");

-- Create unique constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'staff_services_studioId_staffUserId_serviceId_key'
    ) THEN
        CREATE UNIQUE INDEX "staff_services_studioId_staffUserId_serviceId_key" 
        ON "staff_services"("studioId", "staffUserId", "serviceId");
    END IF;
END $$;

-- Add foreign keys if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'staff_services_studioId_fkey'
    ) THEN
        ALTER TABLE "staff_services" 
        ADD CONSTRAINT "staff_services_studioId_fkey" 
        FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'staff_services_staffUserId_fkey'
    ) THEN
        ALTER TABLE "staff_services" 
        ADD CONSTRAINT "staff_services_staffUserId_fkey" 
        FOREIGN KEY ("staffUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'staff_services_serviceId_fkey'
    ) THEN
        ALTER TABLE "staff_services" 
        ADD CONSTRAINT "staff_services_serviceId_fkey" 
        FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

