-- 게스트 중복 참여 방지 및 강퇴 사유 저장
-- 운영 DB에서는 먼저 백업한 뒤 한 번만 실행하세요.

ALTER TABLE chat_room_members
    ADD COLUMN guest_session_key_hash VARCHAR(64) NULL,
    ADD COLUMN kick_reason VARCHAR(200) NULL;

CREATE INDEX idx_chat_room_guest_session
    ON chat_room_members (room_id, guest_session_key_hash);
