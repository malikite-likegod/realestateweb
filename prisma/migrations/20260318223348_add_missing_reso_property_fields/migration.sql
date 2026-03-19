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
INSERT INTO "new_reso_properties" ("bathroomsTotalInteger", "bedroomsTotal", "city", "closePrice", "country", "createdAt", "id", "lastSyncedAt", "latitude", "listAgentKey", "listAgentName", "listDate", "listOfficeKey", "listOfficeName", "listPrice", "listingId", "listingKey", "livingArea", "longitude", "lotSizeSquareFeet", "media", "modificationTimestamp", "originalListPrice", "postalCode", "privateRemarks", "propertySubType", "propertyType", "publicRemarks", "rawJson", "standardStatus", "stateOrProvince", "streetName", "streetNumber", "unitNumber", "updatedAt", "yearBuilt") SELECT "bathroomsTotalInteger", "bedroomsTotal", "city", "closePrice", "country", "createdAt", "id", "lastSyncedAt", "latitude", "listAgentKey", "listAgentName", "listDate", "listOfficeKey", "listOfficeName", "listPrice", "listingId", "listingKey", "livingArea", "longitude", "lotSizeSquareFeet", "media", "modificationTimestamp", "originalListPrice", "postalCode", "privateRemarks", "propertySubType", "propertyType", "publicRemarks", "rawJson", "standardStatus", "stateOrProvince", "streetName", "streetNumber", "unitNumber", "updatedAt", "yearBuilt" FROM "reso_properties";
DROP TABLE "reso_properties";
ALTER TABLE "new_reso_properties" RENAME TO "reso_properties";
CREATE UNIQUE INDEX "reso_properties_listingKey_key" ON "reso_properties"("listingKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
