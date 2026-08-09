-- Migration: add_tool_usage_events
-- Add ToolUsageEvent model — tracks per-session usage counts of public tools
-- (e.g. Rent vs Buy) to drive the signup-prompt nudge.

CREATE TABLE tool_usage_events (
  id          TEXT NOT NULL PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  tool        TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX tool_usage_events_sessionId_tool_idx ON tool_usage_events ("sessionId", tool);
