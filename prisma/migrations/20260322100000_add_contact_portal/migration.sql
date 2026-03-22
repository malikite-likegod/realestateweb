ALTER TABLE "contacts" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "contacts" ADD COLUMN "accountStatus" TEXT;
ALTER TABLE "contacts" ADD COLUMN "invitationTokenHash" TEXT;
ALTER TABLE "contacts" ADD COLUMN "invitationExpiresAt" DATETIME;

CREATE TABLE "contact_saved_listings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "savedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "contact_saved_listings_contactId_listingId_key"
    ON "contact_saved_listings"("contactId", "listingId");
