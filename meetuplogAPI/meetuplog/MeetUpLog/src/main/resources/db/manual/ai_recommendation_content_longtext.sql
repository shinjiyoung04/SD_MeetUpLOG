-- AI 추천 카드 JSON은 일반 채팅 문자열보다 훨씬 클 수 있으므로
-- chat_messages.content 컬럼을 LONGTEXT로 확장합니다.
-- 기존 데이터는 유지됩니다.
ALTER TABLE chat_messages
    MODIFY COLUMN content LONGTEXT NULL;
