-- Seed default follow-up cadence rules for the smart follow-up analyzer.
-- Cadence per 2025-2026 real estate best practices:
--   hot: every 2-4 weeks, warm: every 1-2 months, cool: quarterly minimum,
--   past_client: 6-12x/year, soi: quarterly minimum.
-- Safe to run multiple times — ON CONFLICT DO NOTHING skips existing segments.

INSERT INTO follow_up_rules (id, segment, "intervalDays", "preferredChannel", "taskTitleTemplate", priority, "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'hot',         21, 'call',  'Call {{firstName}} {{lastName}} — hot lead check-in',   'high',   true, now(), now()),
  (gen_random_uuid()::text, 'warm',        45, 'email', 'Follow up with {{firstName}} {{lastName}} — market update', 'normal', true, now(), now()),
  (gen_random_uuid()::text, 'cool',        90, 'email', 'Quarterly check-in with {{firstName}} {{lastName}}',    'normal', true, now(), now()),
  (gen_random_uuid()::text, 'past_client', 45, 'text',  'Touch base with past client {{firstName}} {{lastName}}', 'normal', true, now(), now()),
  (gen_random_uuid()::text, 'soi',         90, 'text',  'SOI check-in — {{firstName}} {{lastName}}',              'low',    true, now(), now())
ON CONFLICT (segment) DO NOTHING;
