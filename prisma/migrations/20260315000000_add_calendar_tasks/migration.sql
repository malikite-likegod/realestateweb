-- CreateTable: task_types with predefined defaults
CREATE TABLE "task_types" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "task_types_name_key" ON "task_types"("name");

-- Seed predefined task types
INSERT INTO "task_types" ("id","name","color","isDefault","createdAt") VALUES
  ('tasktype_followup',   'Follow Up',    '#6366f1', true,  CURRENT_TIMESTAMP),
  ('tasktype_call',       'Call',         '#22c55e', true,  CURRENT_TIMESTAMP),
  ('tasktype_email',      'Email',        '#3b82f6', true,  CURRENT_TIMESTAMP),
  ('tasktype_text',       'Text',         '#a855f7', true,  CURRENT_TIMESTAMP),
  ('tasktype_showing',    'Showing',      '#f59e0b', true,  CURRENT_TIMESTAMP),
  ('tasktype_closing',    'Closing',      '#ef4444', true,  CURRENT_TIMESTAMP),
  ('tasktype_openhouse',  'Open House',   '#ec4899', true,  CURRENT_TIMESTAMP),
  ('tasktype_inspection', 'Inspection',   '#14b8a6', true,  CURRENT_TIMESTAMP),
  ('tasktype_walkthrough','Walk Through', '#f97316', true,  CURRENT_TIMESTAMP),
  ('tasktype_meeting',    'Meeting',      '#64748b', true,  CURRENT_TIMESTAMP);

-- AlterTable: extend tasks with calendar fields
ALTER TABLE "tasks" ADD COLUMN "taskTypeId"    TEXT;
ALTER TABLE "tasks" ADD COLUMN "startDatetime" DATETIME;
ALTER TABLE "tasks" ADD COLUMN "endDatetime"   DATETIME;
ALTER TABLE "tasks" ADD COLUMN "allDay"        BOOLEAN NOT NULL DEFAULT false;
