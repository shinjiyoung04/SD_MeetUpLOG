package com.log.MeetupLog.domain.room.service;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import com.log.MeetupLog.domain.chat.dto.ChatMessageDto;
import com.log.MeetupLog.domain.chat.service.ChatService;
import com.log.MeetupLog.domain.room.dto.ChatRoomEventResponse;
import com.log.MeetupLog.domain.room.dto.RoomDecisionConfirmRequest;
import com.log.MeetupLog.domain.room.entity.ChatRoom;
import com.log.MeetupLog.domain.room.entity.ChatRoomMember;
import com.log.MeetupLog.domain.room.entity.MemberStatus;
import com.log.MeetupLog.domain.room.entity.RoomRole;
import com.log.MeetupLog.domain.room.repository.ChatRoomMemberRepository;
import com.log.MeetupLog.domain.room.repository.ChatRoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class RoomDecisionService {

    private final ChatRoomRepository roomRepository;
    private final ChatRoomMemberRepository memberRepository;
    private final ChatService chatService;
    private final SimpMessageSendingOperations messagingTemplate;
    private final ObjectMapper objectMapper;

    @Transactional
    public ChatRoomEventResponse confirm(Long userId, Long roomId, RoomDecisionConfirmRequest request) {
        ChatRoomMember owner = memberRepository.findByRoomIdAndUserId(roomId, userId)
                .filter(member -> member.getMemberStatus() == MemberStatus.ACTIVE)
                .orElseThrow(() -> new IllegalStateException("현재 참여 중인 채팅방이 아닙니다."));
        if (owner.getRoomRole() != RoomRole.OWNER) {
            throw new SecurityException("추천 결과는 방장만 확정할 수 있습니다.");
        }
        if (request == null || request.getMovieKey() == null || request.getMovieTitle() == null) {
            throw new IllegalArgumentException("확정할 영화 정보가 필요합니다.");
        }

        ChatRoom room = roomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 채팅방입니다."));
        if (room.getConfirmedMovieKey() != null) {
            throw new IllegalStateException("이미 추천 결과가 확정되었습니다.");
        }
        ChatMessageDto confirmationMessage = chatService.saveDecisionCard(
                roomId,
                writeDecisionCard(request)
        );
        room.confirmDecision(
                request.getMovieKey(),
                request.getMovieTitle(),
                confirmationMessage.getMessageId()
        );

        ChatRoomEventResponse event = ChatRoomEventResponse.builder()
                .eventType("DECISION_CONFIRMED")
                .roomId(roomId)
                .roomName(room.getRoomName())
                .actorId(userId)
                .actorNickname(owner.getUser().getNickname())
                .movieKey(room.getConfirmedMovieKey())
                .movieTitle(room.getConfirmedMovieTitle())
                .decisionMessageId(room.getDecisionMessageId())
                .decisionConfirmedAt(room.getDecisionConfirmedAt())
                .occurredAt(LocalDateTime.now())
                .build();

        afterCommit(() -> {
            messagingTemplate.convertAndSend("/sub/room/" + roomId, confirmationMessage);
            messagingTemplate.convertAndSend("/sub/room/" + roomId + "/events", event);
        });
        return event;
    }

    private String writeDecisionCard(RoomDecisionConfirmRequest request) {
        Map<String, Object> movie = new LinkedHashMap<>();
        if (request.getMovie() != null) {
            movie.putAll(request.getMovie());
        }
        movie.putIfAbsent("movieId", request.getMovieKey().trim());
        movie.putIfAbsent("title", request.getMovieTitle().trim());

        Map<String, Object> card = new LinkedHashMap<>();
        card.put("version", 1);
        card.put("kind", "AI_CONFIRMED");
        card.put("confirmedAt", LocalDateTime.now().toString());
        card.put("movie", movie);

        try {
            return objectMapper.writeValueAsString(card);
        } catch (JacksonException exception) {
            throw new IllegalArgumentException("확정 영화 정보를 저장할 수 없습니다.", exception);
        }
    }

    private void afterCommit(Runnable action) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            action.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                action.run();
            }
        });
    }
}
