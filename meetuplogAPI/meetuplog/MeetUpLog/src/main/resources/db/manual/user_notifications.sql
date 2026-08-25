CREATE TABLE IF NOT EXISTS user_notifications (
    notification_id BIGINT NOT NULL AUTO_INCREMENT,
    recipient_id BIGINT NOT NULL,
    notification_type VARCHAR(40) NOT NULL,
    title VARCHAR(100) NOT NULL,
    body VARCHAR(500) NOT NULL,
    action_kind VARCHAR(30) NULL,
    reference_id BIGINT NULL,
    created_at DATETIME(6) NOT NULL,
    read_at DATETIME(6) NULL,
    resolved_at DATETIME(6) NULL,
    deleted_at DATETIME(6) NULL,
    PRIMARY KEY (notification_id),
    CONSTRAINT fk_user_notification_recipient
        FOREIGN KEY (recipient_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT uk_notification_action_reference
        UNIQUE (recipient_id, action_kind, reference_id),
    INDEX idx_notification_recipient_created (recipient_id, created_at),
    INDEX idx_notification_recipient_read (recipient_id, read_at)
);
