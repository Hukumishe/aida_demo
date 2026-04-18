-- CreateEnum
CREATE TYPE "ClientGender" AS ENUM ('MALE', 'FEMALE');

-- AlterTable
ALTER TABLE "clients" ADD COLUMN "gender" "ClientGender";
