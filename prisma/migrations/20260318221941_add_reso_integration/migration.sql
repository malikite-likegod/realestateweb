/*
  Warnings:

  - You are about to drop the `idx_properties` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `idx_updates` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `propertyId` on the `contact_property_interests` table. All the data in the column will be lost.
  - Added the required column `resoPropertyId` to the `contact_property_interests` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "idx_properties_idxId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "idx_properties";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "idx_updates";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "reso_properties" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingKey" TEXT NOT NULL,
    "listingId" TEXT,
    "standardStatus" TEXT NOT NULL DEFAULT 'Active',
    "propertyType" TEXT,
    "propertySubType" TEXT,
    "listPrice" REAL,
    "originalListPrice" REAL,
    "closePrice" REAL,
    "bedroomsTotal" INTEGER,
    "bathroomsTotalInteger" INTEGER,
    "livingArea" REAL,
    "lotSizeAcres" REAL,
    "yearBuilt" INTEGER,
    "streetNumber" TEXT,
    "streetName" TEXT,
    "unitNumber" TEXT,
    "city" TEXT,
    "stateOrProvince" TEXT,
    "postalCode" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "publicRemarks" TEXT,
    "media" TEXT,
    "listAgentKey" TEXT,
    "listAgentName" TEXT,
    "listOfficeKey" TEXT,
    "listOfficeName" TEXT,
    "listDate" DATETIME,
    "modificationTimestamp" DATETIME,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawData" TEXT
);

-- CreateTable
CREATE TABLE "reso_sync_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "added" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "removed" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT,
    "duration" INTEGER
);

-- CreateTable
CREATE TABLE "saved_searches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "filters" TEXT NOT NULL,
    "contactId" TEXT,
    "userId" TEXT,
    "lastRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "saved_searches_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "saved_searches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_contact_property_interests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "resoPropertyId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'auto',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "contact_property_interests_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "contact_property_interests_resoPropertyId_fkey" FOREIGN KEY ("resoPropertyId") REFERENCES "reso_properties" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_contact_property_interests" ("contactId", "createdAt", "id", "notes", "source", "updatedAt") SELECT "contactId", "createdAt", "id", "notes", "source", "updatedAt" FROM "contact_property_interests";
DROP TABLE "contact_property_interests";
ALTER TABLE "new_contact_property_interests" RENAME TO "contact_property_interests";
CREATE UNIQUE INDEX "contact_property_interests_contactId_resoPropertyId_key" ON "contact_property_interests"("contactId", "resoPropertyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "reso_properties_listingKey_key" ON "reso_properties"("listingKey");
