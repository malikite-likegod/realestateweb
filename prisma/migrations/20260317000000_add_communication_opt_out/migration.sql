-- AlterTable: add opt-out fields to contacts
ALTER TABLE "contacts" ADD COLUMN "emailOptOut" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "contacts" ADD COLUMN "smsOptOut" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: communication_opt_log
CREATE TABLE "communication_opt_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedById" TEXT,
    "reason" TEXT,
    CONSTRAINT "communication_opt_log_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "communication_opt_log_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "communication_opt_log_contactId_changedAt_idx" ON "communication_opt_log"("contactId", "changedAt");
