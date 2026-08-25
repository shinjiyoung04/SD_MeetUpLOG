ALTER TABLE chat_rooms
    ADD COLUMN confirmed_movie_key VARCHAR(100) NULL,
    ADD COLUMN confirmed_movie_title VARCHAR(200) NULL,
    ADD COLUMN decision_message_id BIGINT NULL,
    ADD COLUMN decision_confirmed_at DATETIME(6) NULL,
    ADD COLUMN decision_all_read_at DATETIME(6) NULL,
    ADD COLUMN scheduled_close_at DATETIME(6) NULL;

CREATE INDEX idx_chat_rooms_scheduled_close
    ON chat_rooms (room_status, scheduled_close_at);
