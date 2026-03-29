-- Migration: add_listing_packages
-- Add ListingPackage, ListingPackageItem, and ListingPackageView models

CREATE TABLE listing_packages (
  id           TEXT NOT NULL PRIMARY KEY,
  "contactId"  TEXT NOT NULL,
  title        TEXT NOT NULL,
  message      TEXT,
  "magicToken" TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
  "sentAt"     TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT listing_packages_contactId_fkey FOREIGN KEY ("contactId")
    REFERENCES contacts(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX listing_packages_contactId_idx ON listing_packages ("contactId");

CREATE TABLE listing_package_items (
  id           TEXT NOT NULL PRIMARY KEY,
  "packageId"  TEXT NOT NULL,
  "listingKey" TEXT NOT NULL,
  "addedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT listing_package_items_packageId_fkey FOREIGN KEY ("packageId")
    REFERENCES listing_packages(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX listing_package_items_packageId_idx ON listing_package_items ("packageId");
CREATE UNIQUE INDEX listing_package_items_packageId_listingKey_key ON listing_package_items ("packageId", "listingKey");

CREATE TABLE listing_package_views (
  id            TEXT NOT NULL PRIMARY KEY,
  "itemId"      TEXT NOT NULL,
  "contactId"   TEXT NOT NULL,
  "viewedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "durationSec" INTEGER,
  CONSTRAINT listing_package_views_itemId_fkey FOREIGN KEY ("itemId")
    REFERENCES listing_package_items(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX listing_package_views_itemId_idx ON listing_package_views ("itemId");
CREATE INDEX listing_package_views_contactId_idx ON listing_package_views ("contactId");
