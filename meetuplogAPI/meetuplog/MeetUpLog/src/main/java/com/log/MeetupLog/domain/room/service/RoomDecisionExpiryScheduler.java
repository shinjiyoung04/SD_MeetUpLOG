package com.log.MeetupLog.domain.room.service;

import com.log.MeetupLog.domain.room.entity.ChatRoom;
import com.log.MeetupLog.domain.room.entity.RoomStatus;
import com.log.MeetupLog.domain.room.repository.ChatRoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class RoomDecisionExpiryScheduler {
    private final ChatRoomRepository roomRepository;
    private final ChatRoomService chatRoomService;

    @Scheduled(fixedDelayString = "${app.room-expiry-check-ms:60000}")
    public void closeExpiredDecisionRooms() {
        for (ChatRoom room : roomRepository.findAllByRoomStatusAndScheduledCloseAtLessThanEqual(
                RoomStatus.ACTIVE,
                LocalDateTime.now()
        )) {
            chatRoomService.expireRoom(room.getRoomId());
        }
    }
}
