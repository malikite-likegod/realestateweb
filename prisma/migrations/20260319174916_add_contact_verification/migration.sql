-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_contacts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "jobTitle" TEXT,
    "avatarUrl" TEXT,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'lead',
    "leadScore" INTEGER NOT NULL DEFAULT 0,
    "birthday" DATETIME,
    "emailOptOut" BOOLEAN NOT NULL DEFAULT false,
    "smsOptOut" BOOLEAN NOT NULL DEFAULT false,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" DATETIME,
    "emailVerificationTokenHash" TEXT,
    "emailVerificationSentAt" DATETIME,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "phoneVerifiedAt" DATETIME,
    "phoneOtpCode" TEXT,
    "phoneOtpExpiresAt" DATETIME,
    "phoneOtpAttempts" INTEGER NOT NULL DEFAULT 0,
    "phoneSessionTokenHash" TEXT,
    "notes" TEXT,
    "address" TEXT,
    "city" TEXT,
    "province" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'CA',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_contacts" ("address", "avatarUrl", "birthday", "city", "company", "country", "createdAt", "email", "emailOptOut", "firstName", "id", "jobTitle", "lastName", "leadScore", "notes", "phone", "postalCode", "province", "smsOptOut", "source", "status", "updatedAt") SELECT "address", "avatarUrl", "birthday", "city", "company", "country", "createdAt", "email", "emailOptOut", "firstName", "id", "jobTitle", "lastName", "leadScore", "notes", "phone", "postalCode", "province", "smsOptOut", "source", "status", "updatedAt" FROM "contacts";
DROP TABLE "contacts";
ALTER TABLE "new_contacts" RENAME TO "contacts";
CREATE UNIQUE INDEX "contacts_email_key" ON "contacts"("email");
CREATE UNIQUE INDEX "contacts_emailVerificationTokenHash_key" ON "contacts"("emailVerificationTokenHash");
CREATE UNIQUE INDEX "contacts_phoneSessionTokenHash_key" ON "contacts"("phoneSessionTokenHash");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
