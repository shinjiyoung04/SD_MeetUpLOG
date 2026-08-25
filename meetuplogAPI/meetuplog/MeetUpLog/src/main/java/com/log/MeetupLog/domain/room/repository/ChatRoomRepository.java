package com.log.MeetupLog.domain.room.repository;

import com.log.MeetupLog.domain.room.entity.ChatRoom;
import com.log.MeetupLog.domain.room.entity.RoomStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.time.LocalDateTime;

public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {
    List<ChatRoom> findAllByRoomStatusOrderByCreatedAtDesc(RoomStatus roomStatus);
    List<ChatRoom> findAllByRoomStatusAndScheduledCloseAtLessThanEqual(
            RoomStatus roomStatus,
            LocalDateTime scheduledCloseAt
    );
}
