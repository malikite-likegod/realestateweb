/*
  Warnings:

  - You are about to drop the column `resourceType` on the `reso_sync_logs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "reso_properties" ADD COLUMN "contractStatus" TEXT;
ALTER TABLE "reso_properties" ADD COLUMN "documentsChangeTimestamp" DATETIME;
ALTER TABLE "reso_properties" ADD COLUMN "listAgentFullName" TEXT;
ALTER TABLE "reso_properties" ADD COLUMN "majorChangeTimestamp" DATETIME;
ALTER TABLE "reso_properties" ADD COLUMN "mediaChangeTimestamp" DATETIME;
ALTER TABLE "reso_properties" ADD COLUMN "mlsStatus" TEXT;
ALTER TABLE "reso_properties" ADD COLUMN "photosChangeTimestamp" DATETIME;

-- CreateTable
CREATE TABLE "ampre_sync_checkpoints" (
    "syncType" TEXT NOT NULL PRIMARY KEY,
    "lastTimestamp" DATETIME,
    "lastKey" TEXT NOT NULL DEFAULT '0',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "reso_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberKey" TEXT NOT NULL,
    "memberFullName" TEXT,
    "memberEmail" TEXT,
    "memberMobilePhone" TEXT,
    "memberStatus" TEXT,
    "officeKey" TEXT,
    "officeName" TEXT,
    "modificationTimestamp" DATETIME,
    "photosChangeTimestamp" DATETIME,
    "lastSyncedAt" DATETIME NOT NULL,
    "rawJson" TEXT
);

-- CreateTable
CREATE TABLE "reso_offices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "officeKey" TEXT NOT NULL,
    "officeName" TEXT,
    "officeEmail" TEXT,
    "officePhone" TEXT,
    "modificationTimestamp" DATETIME,
    "photosChangeTimestamp" DATETIME,
    "lastSyncedAt" DATETIME NOT NULL,
    "rawJson" TEXT
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "contactId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_reso_sync_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncType" TEXT NOT NULL DEFAULT 'idx_property',
    "added" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "deleted" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "notes" TEXT
);
INSERT INTO "new_reso_sync_logs" ("added", "deleted", "durationMs", "errors", "id", "notes", "syncedAt", "updated") SELECT "added", "deleted", "durationMs", "errors", "id", "notes", "syncedAt", "updated" FROM "reso_sync_logs";
DROP TABLE "reso_sync_logs";
ALTER TABLE "new_reso_sync_logs" RENAME TO "reso_sync_logs";
CREATE INDEX "reso_sync_logs_syncedAt_idx" ON "reso_sync_logs"("syncedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "reso_members_memberKey_key" ON "reso_members"("memberKey");

-- CreateIndex
CREATE UNIQUE INDEX "reso_offices_officeKey_key" ON "reso_offices"("officeKey");

-- CreateIndex
CREATE INDEX "notifications_isRead_createdAt_idx" ON "notifications"("isRead", "createdAt");
