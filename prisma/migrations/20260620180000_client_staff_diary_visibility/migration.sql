CREATE TYPE "ClientStaffDiaryVisibility" AS ENUM ('PRIVATE', 'SHARED');

ALTER TABLE "client_staff_diary_entries"
  ADD COLUMN "visibility" "ClientStaffDiaryVisibility" NOT NULL DEFAULT 'PRIVATE';

CREATE INDEX "client_staff_diary_entries_clientId_visibility_createdAt_idx"
  ON "client_staff_diary_entries"("clientId", "visibility", "createdAt");
