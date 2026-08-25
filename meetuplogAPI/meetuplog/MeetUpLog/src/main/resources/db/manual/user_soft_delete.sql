ALTER TABLE users
    ADD COLUMN withdrawn_at DATETIME NULL,
    ADD COLUMN withdrawn_email_hash VARCHAR(64) NULL;

CREATE INDEX idx_users_withdrawn_email_hash
    ON users (withdrawn_email_hash);
