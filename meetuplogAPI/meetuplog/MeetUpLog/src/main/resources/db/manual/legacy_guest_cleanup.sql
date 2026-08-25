-- 이 패치를 적용하기 전에 이미 중복으로 남은 게스트 참여 정보가 있을 때만
-- 서비스 점검 시간에 한 번 실행하세요. 현재 접속 중인 기존 게스트도 모두
-- 퇴장 처리되므로 적용 뒤에는 유효한 초대 링크로 다시 들어와야 합니다.

UPDATE chat_room_members AS member
JOIN users AS guest ON guest.user_id = member.user_id
SET member.member_status = 'LEFT',
    member.left_at = CURRENT_TIMESTAMP,
    member.notification_setting = 'OFF'
WHERE guest.account_type = 'GUEST'
  AND member.member_status = 'ACTIVE'
  AND member.guest_session_key_hash IS NULL;
