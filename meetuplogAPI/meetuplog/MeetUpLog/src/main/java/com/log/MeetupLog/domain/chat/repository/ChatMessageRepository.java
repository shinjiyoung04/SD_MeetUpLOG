package com.log.MeetupLog.domain.chat.repository;

import com.log.MeetupLog.domain.chat.entity.ChatMessage;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findByRoomIdOrderBySentAtAsc(Long roomId);
    Optional<ChatMessage> findByClientMessageKey(String clientMessageKey);
    Optional<ChatMessage> findTopByRoomIdOrderBySentAtDesc(Long roomId);
    Optional<ChatMessage> findByIdAndRoomId(Long id, Long roomId);
    List<ChatMessage> findByRoomIdAndIdLessThanEqualOrderBySentAtAsc(Long roomId, Long id);
    List<ChatMessage> findTop200ByRoomIdAndMessageTypeOrderByIdDesc(
            Long roomId,
            ChatMessage.MessageType messageType
    );
    List<ChatMessage> findByRoomIdAndMessageTypeOrderByIdDesc(
            Long roomId,
            ChatMessage.MessageType messageType
    );

    @Query("""
            select message
            from ChatMessage message
            where message.roomId = :roomId
              and message.messageType = :messageType
              and message.messageStatus = :messageStatus
            order by message.id desc
            """)
    List<ChatMessage> findRecentAnalyzableMessages(
            @Param("roomId") Long roomId,
            @Param("messageType") ChatMessage.MessageType messageType,
            @Param("messageStatus") ChatMessage.MessageStatus messageStatus,
            Pageable pageable
    );
}
