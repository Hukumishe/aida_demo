-- AlterTable: Add bonuses, discount, balance columns to clients table
-- Check if columns exist before adding them to avoid errors

DO $$
BEGIN
    -- Add bonuses column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'clients' 
        AND column_name = 'bonuses'
    ) THEN
        ALTER TABLE "clients" ADD COLUMN "bonuses" INTEGER NOT NULL DEFAULT 0;
    END IF;

    -- Add discount column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'clients' 
        AND column_name = 'discount'
    ) THEN
        ALTER TABLE "clients" ADD COLUMN "discount" INTEGER NOT NULL DEFAULT 0;
    END IF;

    -- Add balance column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'clients' 
        AND column_name = 'balance'
    ) THEN
        ALTER TABLE "clients" ADD COLUMN "balance" INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

