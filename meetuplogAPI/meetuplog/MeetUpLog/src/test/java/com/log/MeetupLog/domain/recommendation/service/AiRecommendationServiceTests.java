package com.log.MeetupLog.domain.recommendation.service;

import com.log.MeetupLog.domain.chat.repository.ChatMessageRepository;
import com.log.MeetupLog.domain.chat.service.ChatService;
import com.log.MeetupLog.domain.room.entity.ChatRoom;
import com.log.MeetupLog.domain.room.entity.ChatRoomMember;
import com.log.MeetupLog.domain.room.entity.MemberStatus;
import com.log.MeetupLog.domain.room.entity.RoomRole;
import com.log.MeetupLog.domain.room.repository.ChatRoomMemberRepository;
import com.log.MeetupLog.domain.room.repository.ChatRoomRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AiRecommendationServiceTests {

    @Mock
    private ChatRoomMemberRepository roomMemberRepository;
    @Mock
    private ChatRoomRepository roomRepository;
    @Mock
    private ChatMessageRepository messageRepository;
    @Mock
    private ChatService chatService;
    @Mock
    private MlRecommendationClient mlRecommendationClient;
    @Mock
    private SimpMessageSendingOperations messagingTemplate;

    @InjectMocks
    private AiRecommendationService service;

    @Test
    void rejectsRecommendationAfterMovieIsConfirmed() {
        Long roomId = 10L;
        Long ownerId = 20L;
        ChatRoom room = ChatRoom.builder()
                .roomName("영화 모임")
                .topicType("MOVIE")
                .build();
        room.confirmDecision("447365", "가디언즈 오브 갤럭시 Vol. 3", 100L);
        ChatRoomMember owner = ChatRoomMember.builder()
                .chatRoom(room)
                .roomRole(RoomRole.OWNER)
                .memberStatus(MemberStatus.ACTIVE)
                .build();

        when(roomMemberRepository.findByRoomIdAndUserId(roomId, ownerId))
                .thenReturn(Optional.of(owner));
        when(roomRepository.findById(roomId)).thenReturn(Optional.of(room));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> service.analyze(ownerId, roomId)
        );

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
        assertEquals(
                "이미 영화가 확정되어 AI 추천을 다시 실행할 수 없습니다.",
                exception.getReason()
        );
        verifyNoInteractions(messageRepository, mlRecommendationClient, chatService);
    }
}
