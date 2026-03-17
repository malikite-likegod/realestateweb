-- CreateTable
CREATE TABLE "deal_stage_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dealId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "enteredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitedAt" DATETIME,
    "movedById" TEXT,
    CONSTRAINT "deal_stage_history_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "deal_stage_history_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "stages" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "deal_stage_history_movedById_fkey" FOREIGN KEY ("movedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_deals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "value" REAL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "stageId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "closedAt" DATETIME,
    "expectedClose" DATETIME,
    "probability" INTEGER NOT NULL DEFAULT 50,
    "propertyId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "deals_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "stages" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "deals_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "deals_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_deals" ("closedAt", "createdAt", "currency", "expectedClose", "id", "notes", "probability", "propertyId", "stageId", "title", "updatedAt", "value") SELECT "closedAt", "createdAt", "currency", "expectedClose", "id", "notes", "probability", "propertyId", "stageId", "title", "updatedAt", "value" FROM "deals";
DROP TABLE "deals";
ALTER TABLE "new_deals" RENAME TO "deals";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
