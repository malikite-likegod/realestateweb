-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_automation_sequences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "repeatAnnually" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_automation_sequences" ("createdAt", "description", "id", "isActive", "name", "trigger", "updatedAt") SELECT "createdAt", "description", "id", "isActive", "name", "trigger", "updatedAt" FROM "automation_sequences";
DROP TABLE "automation_sequences";
ALTER TABLE "new_automation_sequences" RENAME TO "automation_sequences";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
