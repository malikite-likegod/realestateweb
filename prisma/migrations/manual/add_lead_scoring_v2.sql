-- Migration: add_lead_scoring_v2
-- Run this against your production PostgreSQL database.

-- 1. Add new columns to contacts
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS classification   TEXT    NOT NULL DEFAULT 'cold',
  ADD COLUMN IF NOT EXISTS "intentScore"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "urgencyScore"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "transitionScore" INTEGER NOT NULL DEFAULT 0;

-- 2. Create contact_sessions table
CREATE TABLE IF NOT EXISTS contact_sessions (
  id             TEXT        NOT NULL PRIMARY KEY,
  "contactId"    TEXT        NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  "sessionId"    TEXT        NOT NULL UNIQUE,
  "startedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "lastSeenAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "eventCount"   INTEGER     NOT NULL DEFAULT 0,
  "searchCount"  INTEGER     NOT NULL DEFAULT 0,
  "listingViews" INTEGER     NOT NULL DEFAULT 0,
  metadata       TEXT
);

CREATE INDEX IF NOT EXISTS contact_sessions_contactId_startedAt
  ON contact_sessions ("contactId", "startedAt");

-- 3. Add indexes to behavior_events
CREATE INDEX IF NOT EXISTS behavior_events_contactId_eventType_occurredAt
  ON behavior_events ("contactId", "eventType", "occurredAt");

CREATE INDEX IF NOT EXISTS behavior_events_contactId_occurredAt
  ON behavior_events ("contactId", "occurredAt");
