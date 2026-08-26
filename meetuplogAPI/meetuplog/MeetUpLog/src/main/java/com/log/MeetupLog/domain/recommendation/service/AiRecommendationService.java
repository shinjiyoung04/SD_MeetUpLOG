package com.log.MeetupLog.domain.recommendation.service;

import com.log.MeetupLog.domain.chat.dto.ChatMessageDto;
import com.log.MeetupLog.domain.chat.entity.ChatMessage;
import com.log.MeetupLog.domain.chat.repository.ChatMessageRepository;
import com.log.MeetupLog.domain.chat.service.ChatService;
import com.log.MeetupLog.domain.recommendation.dto.AiAnalysisEventResponse;
import com.log.MeetupLog.domain.room.entity.ChatRoom;
import com.log.MeetupLog.domain.room.entity.ChatRoomMember;
import com.log.MeetupLog.domain.room.entity.MemberStatus;
import com.log.MeetupLog.domain.room.entity.RoomRole;
import com.log.MeetupLog.domain.room.repository.ChatRoomMemberRepository;
import com.log.MeetupLog.domain.room.repository.ChatRoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class AiRecommendationService {

    private static final int MAX_ANALYSIS_MESSAGES = 200;

    private final ChatRoomMemberRepository roomMemberRepository;
    private final ChatRoomRepository roomRepository;
    private final ChatMessageRepository messageRepository;
    private final ChatService chatService;
    private final MlRecommendationClient mlRecommendationClient;
    private final SimpMessageSendingOperations messagingTemplate;
    private final ObjectMapper objectMapper;

    private final Map<Long, String> runningAnalyses = new ConcurrentHashMap<>();

    public ChatMessageDto analyze(Long requesterId, Long roomId) {
        requireOwner(requesterId, roomId);

        ChatRoom room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "채팅방을 찾을 수 없습니다."
                ));
        if (room.getConfirmedMovieKey() != null && !room.getConfirmedMovieKey().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "이미 영화가 확정되어 AI 추천을 다시 실행할 수 없습니다."
            );
        }

        String analysisId = UUID.randomUUID().toString();
        if (runningAnalyses.putIfAbsent(roomId, analysisId) != null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "이미 이 채팅방의 AI 분석이 진행 중입니다."
            );
        }

        publish(roomId, analysisId, "AI_ANALYSIS_STARTED", "AI가 분석 중입니다");

        try {
            List<ChatMessage> messages = loadAnalysisMessages(roomId);
            if (messages.isEmpty()) {
                throw new IllegalArgumentException("분석할 텍스트 대화가 없습니다.");
            }

            String resultJson = mlRecommendationClient.recommend(
                    roomId,
                    analysisId,
                    messages,
                    loadPreviouslyRecommendedMovieIds(roomId)
            );

            ChatMessageDto resultMessage = chatService.saveAiRecommendation(
                    roomId,
                    resultJson,
                    analysisId
            );
            messagingTemplate.convertAndSend("/sub/room/" + roomId, resultMessage);
            publish(
                    roomId,
                    analysisId,
                    "AI_ANALYSIS_COMPLETED",
                    "AI 분석이 완료되었습니다",
                    resultMessage
            );
            return resultMessage;
        } catch (IllegalArgumentException exception) {
            publish(roomId, analysisId, "AI_ANALYSIS_FAILED", exception.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, exception.getMessage(), exception);
        } catch (ResponseStatusException exception) {
            publish(roomId, analysisId, "AI_ANALYSIS_FAILED", exception.getReason());
            throw exception;
        } catch (Exception exception) {
            String message = "AI 추천 서비스 처리에 실패했습니다. ML 서버 상태를 확인해 주세요.";
            publish(roomId, analysisId, "AI_ANALYSIS_FAILED", message);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, message, exception);
        } finally {
            runningAnalyses.remove(roomId, analysisId);
        }
    }

    private void requireOwner(Long requesterId, Long roomId) {
        ChatRoomMember member = roomMemberRepository.findByRoomIdAndUserId(roomId, requesterId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "참여 중인 채팅방만 분석할 수 있습니다."
                ));

        if (member.getMemberStatus() != MemberStatus.ACTIVE || member.getRoomRole() != RoomRole.OWNER) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "방장만 AI 분석을 실행할 수 있습니다."
            );
        }
    }

    private List<ChatMessage> loadAnalysisMessages(Long roomId) {
        List<ChatMessage> newestFirst = messageRepository
                .findTop200ByRoomIdAndMessageTypeOrderByIdDesc(
                        roomId,
                        ChatMessage.MessageType.TEXT
                );

        List<ChatMessage> chronological = new ArrayList<>(newestFirst);
        Collections.reverse(chronological);
        return chronological.stream()
                .filter(message -> message.getSenderId() != null)
                .filter(message -> message.getMessageStatus() != ChatMessage.MessageStatus.DELETED)
                .filter(message -> message.getContent() != null && !message.getContent().isBlank())
                .limit(MAX_ANALYSIS_MESSAGES)
                .toList();
    }

    private List<String> loadPreviouslyRecommendedMovieIds(Long roomId) {
        List<ChatMessage> recommendationCards = messageRepository
                .findByRoomIdAndMessageTypeOrderByIdDesc(
                        roomId,
                        ChatMessage.MessageType.DECISION_CARD
                );
        Set<String> movieIds = new LinkedHashSet<>();

        for (ChatMessage card : recommendationCards) {
            if (card.getMessageStatus() == ChatMessage.MessageStatus.DELETED
                    || card.getContent() == null
                    || card.getContent().isBlank()) {
                continue;
            }

            try {
                JsonNode movies = objectMapper.readTree(card.getContent()).path("movies");
                if (!movies.isArray()) continue;

                for (JsonNode movie : movies) {
                    String movieId = movie.path("movieId").asText("").trim();
                    if (!movieId.isBlank()) movieIds.add(movieId);
                }
            } catch (RuntimeException ignored) {
                // 이전 형식의 카드가 섞여 있어도 새 추천 자체는 계속 진행합니다.
            }
        }

        return movieIds.stream().toList();
    }

    private void publish(Long roomId, String analysisId, String eventType, String message) {
        publish(roomId, analysisId, eventType, message, null);
    }

    private void publish(
            Long roomId,
            String analysisId,
            String eventType,
            String message,
            ChatMessageDto recommendation
    ) {
        messagingTemplate.convertAndSend(
                "/sub/room/" + roomId + "/events",
                AiAnalysisEventResponse.builder()
                        .eventType(eventType)
                        .roomId(roomId)
                        .analysisId(analysisId)
                        .message(message)
                        .recommendation(recommendation)
                        .occurredAt(LocalDateTime.now())
                        .build()
        );
    }
}
