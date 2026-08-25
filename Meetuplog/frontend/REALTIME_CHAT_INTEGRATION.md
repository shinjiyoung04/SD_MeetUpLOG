# 실시간 채팅 프론트엔드 연동

- `src/api/chatApi.js`: 백엔드 DTO를 기존 UI의 room/message/member 구조로 변환합니다.
- `src/realtime/stompClient.js`: 추가 패키지 없이 STOMP 1.2 프레임을 처리합니다.
- `src/hooks/useRealtimeChat.js`: 티켓 발급, 구독, 재연결, 메시지·입력 이벤트를 관리합니다.
- `ChatMainPage.jsx`: 서버 방 목록/내역/참여자를 불러오고 낙관적 메시지를 서버 응답으로 치환합니다.
- `vite.config.js`: `/api`와 `/ws`를 Spring Boot 8080 포트로 프록시합니다.

백엔드 없이 디자인만 확인하려면 `.env`에서 `VITE_USE_MOCK_CHAT=true`로 설정합니다. 실제 연동은 `false`입니다.
