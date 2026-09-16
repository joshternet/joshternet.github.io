CREATE TABLE seed_nominations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    origin TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'claimed', 'processed', 'rejected')),
    submitted_at TEXT NOT NULL
        DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    claimed_at TEXT,
    claim_expires_at TEXT,
    processed_at TEXT
);

CREATE INDEX seed_nominations_status_submitted_at_idx
    ON seed_nominations (status, submitted_at);
