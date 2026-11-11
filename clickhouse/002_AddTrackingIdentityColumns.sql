ALTER TABLE tracking_events ADD COLUMN IF NOT EXISTS click_id String DEFAULT '';
ALTER TABLE tracking_events ADD COLUMN IF NOT EXISTS fbp String DEFAULT '';
ALTER TABLE tracking_events ADD COLUMN IF NOT EXISTS fbc String DEFAULT '';
