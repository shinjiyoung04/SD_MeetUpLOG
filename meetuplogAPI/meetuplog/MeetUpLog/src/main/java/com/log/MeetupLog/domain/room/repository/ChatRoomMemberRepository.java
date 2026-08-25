package com.log.MeetupLog.domain.room.repository;

import com.log.MeetupLog.domain.room.entity.ChatRoomMember;
import com.log.MeetupLog.domain.room.entity.MemberStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.List;

public interface ChatRoomMemberRepository extends JpaRepository<ChatRoomMember, Long> {

    @Query("SELECT COUNT(m) > 0 FROM ChatRoomMember m WHERE m.chatRoom.roomId = :roomId AND m.user.userId = :userId AND m.memberStatus = :memberStatus")
    boolean existsByRoomIdAndUserIdAndStatus(@Param("roomId") Long roomId,
                                             @Param("userId") Long userId,
                                             @Param("memberStatus") MemberStatus memberStatus);

    @Query("SELECT m FROM ChatRoomMember m WHERE m.chatRoom.roomId = :roomId AND m.user.userId = :userId")
    Optional<ChatRoomMember> findByRoomIdAndUserId(@Param("roomId") Long roomId,
                                                   @Param("userId") Long userId);

    @Query("SELECT m FROM ChatRoomMember m JOIN FETCH m.user WHERE m.chatRoom.roomId = :roomId AND m.guestSessionKeyHash = :guestSessionKeyHash")
    Optional<ChatRoomMember> findByRoomIdAndGuestSessionKeyHash(
            @Param("roomId") Long roomId,
            @Param("guestSessionKeyHash") String guestSessionKeyHash
    );

    @Query("SELECT COUNT(m) FROM ChatRoomMember m WHERE m.chatRoom.roomId = :roomId AND m.memberStatus = :memberStatus AND m.user.accountStatus = com.log.MeetupLog.domain.user.entity.AccountStatus.ACTIVE")
    int countByRoomIdAndStatus(@Param("roomId") Long roomId,
                               @Param("memberStatus") MemberStatus memberStatus);

    @Query("SELECT m FROM ChatRoomMember m JOIN FETCH m.chatRoom WHERE m.user.userId = :userId AND m.memberStatus = :memberStatus ORDER BY m.chatRoom.createdAt DESC")
    List<ChatRoomMember> findAllByUserIdAndStatus(
            @Param("userId") Long userId,
            @Param("memberStatus") MemberStatus memberStatus
    );

    @Query("SELECT m FROM ChatRoomMember m JOIN FETCH m.user WHERE m.chatRoom.roomId = :roomId AND m.memberStatus = :memberStatus AND m.user.accountStatus = com.log.MeetupLog.domain.user.entity.AccountStatus.ACTIVE ORDER BY m.joinedAt ASC")
    List<ChatRoomMember> findAllByRoomIdAndStatus(
            @Param("roomId") Long roomId,
            @Param("memberStatus") MemberStatus memberStatus
    );
}
