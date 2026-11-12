ALTER TABLE tracking_events ADD COLUMN IF NOT EXISTS engaged_seconds UInt16 DEFAULT 0;
ALTER TABLE tracking_events ADD COLUMN IF NOT EXISTS scroll_depth UInt8 DEFAULT 0;
