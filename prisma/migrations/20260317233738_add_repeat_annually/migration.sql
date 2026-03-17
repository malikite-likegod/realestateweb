-- AlterTable
ALTER TABLE "landing_pages" ADD COLUMN "agentBio" TEXT;
ALTER TABLE "landing_pages" ADD COLUMN "agentEmail" TEXT;
ALTER TABLE "landing_pages" ADD COLUMN "agentName" TEXT;
ALTER TABLE "landing_pages" ADD COLUMN "agentPhone" TEXT;
ALTER TABLE "landing_pages" ADD COLUMN "agentPhoto" TEXT;
ALTER TABLE "landing_pages" ADD COLUMN "agentTitle" TEXT;
ALTER TABLE "landing_pages" ADD COLUMN "autoTags" TEXT;
ALTER TABLE "landing_pages" ADD COLUMN "ctaSubtitle" TEXT;
ALTER TABLE "landing_pages" ADD COLUMN "ctaTitle" TEXT;
ALTER TABLE "landing_pages" ADD COLUMN "metaDesc" TEXT;
ALTER TABLE "landing_pages" ADD COLUMN "metaTitle" TEXT;

-- CreateTable
CREATE TABLE "contact_phones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'mobile',
    "number" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contact_phones_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "contact_addresses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'home',
    "street" TEXT,
    "city" TEXT,
    "province" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'CA',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contact_addresses_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "market_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "reportMonth" TEXT,
    "area" TEXT,
    "excerpt" TEXT,
    "body" TEXT NOT NULL,
    "coverImage" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" DATETIME,
    "authorName" TEXT,
    "ctaTitle" TEXT,
    "ctaSubtitle" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "metaTitle" TEXT,
    "metaDesc" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "availability_schedules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "agentTitle" TEXT,
    "agentEmail" TEXT,
    "agentPhone" TEXT,
    "agentPhoto" TEXT,
    "meetingTitle" TEXT NOT NULL DEFAULT 'Book a Meeting',
    "meetingDescription" TEXT,
    "meetingDurationMin" INTEGER NOT NULL DEFAULT 30,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 15,
    "advanceDays" INTEGER NOT NULL DEFAULT 30,
    "timezone" TEXT NOT NULL DEFAULT 'America/Toronto',
    "windows" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "booking_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestEmail" TEXT NOT NULL,
    "guestPhone" TEXT,
    "guestMessage" TEXT,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "adminNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "booking_events_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "availability_schedules" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
CREATE TABLE "new_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "dueAt" DATETIME,
    "startDatetime" DATETIME,
    "endDatetime" DATETIME,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "taskTypeId" TEXT,
    "assigneeId" TEXT,
    "createdById" TEXT,
    "contactId" TEXT,
    "dealId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tasks_taskTypeId_fkey" FOREIGN KEY ("taskTypeId") REFERENCES "task_types" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tasks_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tasks_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_tasks" ("allDay", "assigneeId", "completedAt", "contactId", "createdAt", "createdById", "dealId", "description", "dueAt", "endDatetime", "id", "priority", "startDatetime", "status", "taskTypeId", "title", "updatedAt") SELECT "allDay", "assigneeId", "completedAt", "contactId", "createdAt", "createdById", "dealId", "description", "dueAt", "endDatetime", "id", "priority", "startDatetime", "status", "taskTypeId", "title", "updatedAt" FROM "tasks";
DROP TABLE "tasks";
ALTER TABLE "new_tasks" RENAME TO "tasks";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "market_reports_slug_key" ON "market_reports"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "availability_schedules_slug_key" ON "availability_schedules"("slug");
