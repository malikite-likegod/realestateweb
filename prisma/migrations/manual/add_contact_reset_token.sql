-- Migration: add_contact_reset_token
-- Add resetTokenHash / resetTokenExpiry to contacts — client portal
-- forgot/reset-password flow, mirroring the existing columns on users.

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS "resetTokenHash"   TEXT,
  ADD COLUMN IF NOT EXISTS "resetTokenExpiry" TIMESTAMP(3);
