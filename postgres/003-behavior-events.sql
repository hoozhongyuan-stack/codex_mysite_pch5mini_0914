CREATE TABLE IF NOT EXISTS behavior_events (
 id TEXT PRIMARY KEY NOT NULL,
 channel TEXT NOT NULL CHECK(channel IN ('website','mini')),
 visitor_hash TEXT NOT NULL,
 session_hash TEXT NOT NULL,
 event TEXT NOT NULL,
 path TEXT NOT NULL,
 target TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS behavior_time_channel ON behavior_events(created_at,channel);
CREATE TABLE IF NOT EXISTS behavior_metadata (id TEXT PRIMARY KEY NOT NULL, started_at TEXT NOT NULL);
