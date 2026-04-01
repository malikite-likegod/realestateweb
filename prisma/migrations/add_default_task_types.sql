-- Seed default task types for real estate CRM.
-- Safe to run multiple times — ON CONFLICT DO NOTHING skips existing names.

INSERT INTO task_types (id, name, color, "textColor", "isDefault", "createdAt")
VALUES
  (gen_random_uuid()::text, 'Call',             '#3b82f6', '#ffffff', true, now()),
  (gen_random_uuid()::text, 'Meeting',          '#8b5cf6', '#ffffff', true, now()),
  (gen_random_uuid()::text, 'Email',            '#10b981', '#ffffff', true, now()),
  (gen_random_uuid()::text, 'Follow-Up',        '#f59e0b', '#ffffff', true, now()),
  (gen_random_uuid()::text, 'Property Showing', '#ef4444', '#ffffff', true, now()),
  (gen_random_uuid()::text, 'Document Review',  '#6366f1', '#ffffff', true, now()),
  (gen_random_uuid()::text, 'Offer Prep',       '#ec4899', '#ffffff', true, now()),
  (gen_random_uuid()::text, 'Contract Review',  '#14b8a6', '#ffffff', true, now()),
  (gen_random_uuid()::text, 'To-Do',            '#64748b', '#ffffff', true, now())
ON CONFLICT (name) DO NOTHING;
