-- AlterTable
ALTER TABLE "users" ADD COLUMN "resetTokenHash" TEXT,
ADD COLUMN "resetTokenExpiry" DATETIME,
ADD COLUMN "passwordChangedAt" DATETIME;
