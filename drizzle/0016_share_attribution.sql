ALTER TABLE behavior_events ADD COLUMN share_ref TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS behavior_share_ref ON behavior_events(share_ref,created_at);
