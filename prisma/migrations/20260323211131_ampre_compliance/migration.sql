/*
  Warnings:

  - You are about to drop the column `resourceType` on the `reso_sync_logs` table. All the data in the column will be lost.

*/
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
