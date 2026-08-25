package com.log.MeetupLog.domain.room.service;

import com.log.MeetupLog.domain.room.dto.ChatRoomEventResponse;
import com.log.MeetupLog.domain.room.entity.ChatRoom;
import com.log.MeetupLog.domain.room.entity.ChatRoomMember;
import com.log.MeetupLog.domain.room.entity.MemberStatus;
import com.log.MeetupLog.domain.room.entity.RoomStatus;
import com.log.MeetupLog.domain.room.repository.ChatRoomMemberRepository;
import com.log.MeetupLog.domain.room.repository.ChatRoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class RoomDecisionLifecycleService {

    private final ChatRoomRepository roomRepository;
    private final ChatRoomMemberRepository memberRepository;
    private final SimpMessageSendingOperations messagingTemplate;

    @Transactional
    public void checkAfterRead(Long roomId) {
        ChatRoom room = roomRepository.findById(roomId).orElse(null);
        if (room == null || room.getRoomStatus() != RoomStatus.ACTIVE
                || room.getDecisionMessageId() == null || room.getDecisionAllReadAt() != null) {
            return;
        }

        List<ChatRoomMember> members = memberRepository.findAllByRoomIdAndStatus(roomId, MemberStatus.ACTIVE);
        boolean everyoneRead = !members.isEmpty() && members.stream().allMatch(member ->
                member.getLastReadMessageId() != null
                        && member.getLastReadMessageId() >= room.getDecisionMessageId()
        );
        if (!everyoneRead) return;

        LocalDateTime now = LocalDateTime.now();
        if (!room.scheduleCloseAfterEveryoneRead(now)) return;

        ChatRoomEventResponse event = ChatRoomEventResponse.builder()
                .eventType("DECISION_ALL_READ")
                .roomId(roomId)
                .roomName(room.getRoomName())
                .movieKey(room.getConfirmedMovieKey())
                .movieTitle(room.getConfirmedMovieTitle())
                .decisionMessageId(room.getDecisionMessageId())
                .scheduledCloseAt(room.getScheduledCloseAt())
                .occurredAt(now)
                .build();
        afterCommit(() -> messagingTemplate.convertAndSend(
                "/sub/room/" + roomId + "/events", event
        ));
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
