-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "forStaffUserId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stock_movements_forStaffUserId_idx" ON "stock_movements"("forStaffUserId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_forStaffUserId_fkey'
  ) THEN
    ALTER TABLE "stock_movements"
      ADD CONSTRAINT "stock_movements_forStaffUserId_fkey"
      FOREIGN KEY ("forStaffUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
