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
    "listPrice" REAL,
    "originalListPrice" REAL,
    "closePrice" REAL,
    "listingContractDate" DATETIME,
    "purchaseContractDate" DATETIME,
    "closeDate" DATETIME,
    "bedroomsTotal" INTEGER,
    "bathroomsTotalInteger" INTEGER,
    "garageSpaces" INTEGER,
    "poolPrivateYN" BOOLEAN NOT NULL DEFAULT false,
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
INSERT INTO "new_reso_properties" ("bathroomsTotalInteger", "bedroomsTotal", "city", "closeDate", "closePrice", "country", "createdAt", "garageSpaces", "id", "lastSyncedAt", "latitude", "listAgentKey", "listAgentName", "listDate", "listOfficeKey", "listOfficeName", "listPrice", "listingContractDate", "listingId", "listingKey", "livingArea", "longitude", "lotSizeSquareFeet", "media", "modificationTimestamp", "originalListPrice", "poolPrivateYN", "postalCode", "privateRemarks", "propertySubType", "propertyType", "publicRemarks", "purchaseContractDate", "rawJson", "standardStatus", "stateOrProvince", "streetName", "streetNumber", "unitNumber", "updatedAt", "yearBuilt") SELECT "bathroomsTotalInteger", "bedroomsTotal", "city", "closeDate", "closePrice", "country", "createdAt", "garageSpaces", "id", "lastSyncedAt", "latitude", "listAgentKey", "listAgentName", "listDate", "listOfficeKey", "listOfficeName", "listPrice", "listingContractDate", "listingId", "listingKey", "livingArea", "longitude", "lotSizeSquareFeet", "media", "modificationTimestamp", "originalListPrice", "poolPrivateYN", "postalCode", "privateRemarks", "propertySubType", "propertyType", "publicRemarks", "purchaseContractDate", "rawJson", "standardStatus", "stateOrProvince", "streetName", "streetNumber", "unitNumber", "updatedAt", "yearBuilt" FROM "reso_properties";
DROP TABLE "reso_properties";
ALTER TABLE "new_reso_properties" RENAME TO "reso_properties";
CREATE UNIQUE INDEX "reso_properties_listingKey_key" ON "reso_properties"("listingKey");
CREATE INDEX "reso_properties_modificationTimestamp_idx" ON "reso_properties"("modificationTimestamp");
CREATE INDEX "reso_properties_standardStatus_idx" ON "reso_properties"("standardStatus");
CREATE INDEX "reso_properties_standardStatus_city_idx" ON "reso_properties"("standardStatus", "city");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "reso_sync_logs_syncedAt_idx" ON "reso_sync_logs"("syncedAt");

-- CreateIndex
CREATE INDEX "saved_searches_contactId_idx" ON "saved_searches"("contactId");

-- CreateIndex
CREATE INDEX "saved_searches_userId_idx" ON "saved_searches"("userId");
