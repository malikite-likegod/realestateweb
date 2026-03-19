/*
  Warnings:

  - You are about to drop the column `lotSizeAcres` on the `reso_properties` table. All the data in the column will be lost.
  - You are about to drop the column `rawData` on the `reso_properties` table. All the data in the column will be lost.
  - You are about to drop the column `duration` on the `reso_sync_logs` table. All the data in the column will be lost.
  - You are about to drop the column `removed` on the `reso_sync_logs` table. All the data in the column will be lost.
  - You are about to alter the column `errors` on the `reso_sync_logs` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - Added the required column `updatedAt` to the `reso_properties` table without a default value. This is not possible if the table is not empty.
  - Made the column `city` on table `reso_properties` required. This step will fail if there are existing NULL values in that column.
  - Made the column `listPrice` on table `reso_properties` required. This step will fail if there are existing NULL values in that column.
  - Made the column `stateOrProvince` on table `reso_properties` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `saved_searches` table without a default value. This is not possible if the table is not empty.
  - Made the column `name` on table `saved_searches` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_reso_properties" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingKey" TEXT NOT NULL,
    "listingId" TEXT,
    "standardStatus" TEXT NOT NULL DEFAULT 'Active',
    "propertyType" TEXT,
    "propertySubType" TEXT,
    "listPrice" REAL NOT NULL,
    "originalListPrice" REAL,
    "closePrice" REAL,
    "bedroomsTotal" INTEGER,
    "bathroomsTotalInteger" INTEGER,
    "livingArea" REAL,
    "lotSizeSquareFeet" REAL,
    "yearBuilt" INTEGER,
    "streetNumber" TEXT,
    "streetName" TEXT,
    "unitNumber" TEXT,
    "city" TEXT NOT NULL,
    "stateOrProvince" TEXT NOT NULL,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'CA',
    "latitude" REAL,
    "longitude" REAL,
    "publicRemarks" TEXT,
    "privateRemarks" TEXT,
    "media" TEXT,
    "listAgentKey" TEXT,
    "listAgentName" TEXT,
    "listOfficeKey" TEXT,
    "listOfficeName" TEXT,
    "listDate" DATETIME,
    "modificationTimestamp" DATETIME,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_reso_properties" ("bathroomsTotalInteger", "bedroomsTotal", "city", "closePrice", "id", "lastSyncedAt", "latitude", "listAgentKey", "listAgentName", "listDate", "listOfficeKey", "listOfficeName", "listPrice", "listingId", "listingKey", "livingArea", "longitude", "media", "modificationTimestamp", "originalListPrice", "postalCode", "propertySubType", "propertyType", "publicRemarks", "standardStatus", "stateOrProvince", "streetName", "streetNumber", "unitNumber", "yearBuilt") SELECT "bathroomsTotalInteger", "bedroomsTotal", "city", "closePrice", "id", "lastSyncedAt", "latitude", "listAgentKey", "listAgentName", "listDate", "listOfficeKey", "listOfficeName", "listPrice", "listingId", "listingKey", "livingArea", "longitude", "media", "modificationTimestamp", "originalListPrice", "postalCode", "propertySubType", "propertyType", "publicRemarks", "standardStatus", "stateOrProvince", "streetName", "streetNumber", "unitNumber", "yearBuilt" FROM "reso_properties";
DROP TABLE "reso_properties";
ALTER TABLE "new_reso_properties" RENAME TO "reso_properties";
CREATE UNIQUE INDEX "reso_properties_listingKey_key" ON "reso_properties"("listingKey");
CREATE TABLE "new_reso_sync_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resourceType" TEXT NOT NULL DEFAULT 'Property',
    "added" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "deleted" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "notes" TEXT
);
INSERT INTO "new_reso_sync_logs" ("added", "errors", "id", "syncedAt", "updated") SELECT "added", coalesce("errors", 0) AS "errors", "id", "syncedAt", "updated" FROM "reso_sync_logs";
DROP TABLE "reso_sync_logs";
ALTER TABLE "new_reso_sync_logs" RENAME TO "reso_sync_logs";
CREATE TABLE "new_saved_searches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "filters" TEXT NOT NULL,
    "contactId" TEXT,
    "userId" TEXT,
    "lastRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "saved_searches_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "saved_searches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_saved_searches" ("contactId", "createdAt", "filters", "id", "lastRunAt", "name", "userId") SELECT "contactId", "createdAt", "filters", "id", "lastRunAt", "name", "userId" FROM "saved_searches";
DROP TABLE "saved_searches";
ALTER TABLE "new_saved_searches" RENAME TO "saved_searches";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
