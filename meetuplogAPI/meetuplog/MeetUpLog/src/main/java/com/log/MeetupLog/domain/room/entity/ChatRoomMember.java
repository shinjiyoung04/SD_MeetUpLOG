package com.log.MeetupLog.domain.room.entity;

import com.log.MeetupLog.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "chat_room_members", uniqueConstraints = {
        @UniqueConstraint(name = "room_user_unique", columnNames = {"room_id", "user_id"})
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@EntityListeners(AuditingEntityListener.class)
public class ChatRoomMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "room_member_id")
    private Long roomMemberId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private ChatRoom chatRoom;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "room_role", nullable = false, length = 20)
    private RoomRole roomRole;

    @Enumerated(EnumType.STRING)
    @Column(name = "member_status", nullable = false, length = 20)
    private MemberStatus memberStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "notification_setting", nullable = false, length = 20)
    private NotificationSetting notificationSetting;

    @Column(name = "last_read_message_id")
    private Long lastReadMessageId;

    @Column(name = "notification_muted_until")
    private LocalDateTime notificationMutedUntil;

    @Column(name = "guest_session_key_hash", length = 64)
    private String guestSessionKeyHash;

    @Column(name = "kick_reason", length = 200)
    private String kickReason;

    @CreatedDate
    @Column(name = "joined_at", updatable = false)
    private LocalDateTime joinedAt;

    @Column(name = "left_at")
    private LocalDateTime leftAt;

    @Column(name = "room_user_unique", length = 50)
    private String roomUserUnique;

    @Builder
    public ChatRoomMember(ChatRoom chatRoom, User user, RoomRole roomRole, MemberStatus memberStatus, NotificationSetting notificationSetting) {
        this.chatRoom = chatRoom;
        this.user = user;
        this.roomRole = roomRole != null ? roomRole : RoomRole.MEMBER;
        this.memberStatus = memberStatus != null ? memberStatus : MemberStatus.ACTIVE;
        this.notificationSetting = notificationSetting != null ? notificationSetting : NotificationSetting.ALL;
        this.roomUserUnique = (chatRoom != null && user != null) ? (chatRoom.getRoomId() + "_" + user.getUserId()) : null;
    }

    public void rejoin() {
        if (this.memberStatus == MemberStatus.KICKED || this.memberStatus == MemberStatus.BLOCKED) {
            throw new IllegalStateException("강퇴 또는 차단된 사용자는 다시 입장할 수 없습니다.");
        }
        activateMember();
    }

    public void rejoinFromOwnerInvitation() {
        if (this.memberStatus == MemberStatus.BLOCKED) {
            throw new IllegalStateException("차단된 사용자는 다시 입장할 수 없습니다.");
        }
        activateMember();
        this.notificationSetting = NotificationSetting.ALL;
        this.notificationMutedUntil = null;
    }

    private void activateMember() {
        this.memberStatus = MemberStatus.ACTIVE;
        this.leftAt = null;
        this.kickReason = null;
        if (this.roomRole == null) {
            this.roomRole = RoomRole.MEMBER;
        }
    }

    public void bindGuestSessionKey(String guestSessionKeyHash) {
        if (guestSessionKeyHash == null || guestSessionKeyHash.isBlank()) {
            throw new IllegalArgumentException("게스트 세션 키가 없습니다.");
        }
        this.guestSessionKeyHash = guestSessionKeyHash;
    }

    public void kick(String reason) {
        if (this.roomRole == RoomRole.OWNER) {
            throw new IllegalStateException("방장은 강퇴할 수 없습니다.");
        }
        this.memberStatus = MemberStatus.KICKED;
        this.leftAt = LocalDateTime.now();
        this.kickReason = reason == null || reason.isBlank() ? null : reason.trim();
        this.notificationSetting = NotificationSetting.OFF;
        this.notificationMutedUntil = null;
    }

    public void markRead(Long messageId) {
        if (messageId == null) {
            return;
        }
        if (this.lastReadMessageId == null || messageId > this.lastReadMessageId) {
            this.lastReadMessageId = messageId;
        }
    }

    public void leave() {
        this.memberStatus = MemberStatus.LEFT;
        this.leftAt = LocalDateTime.now();
    }

    public void leaveBecauseRoomDeleted() {
        this.memberStatus = MemberStatus.LEFT;
        this.roomRole = RoomRole.MEMBER;
        this.leftAt = LocalDateTime.now();
        this.notificationSetting = NotificationSetting.OFF;
        this.notificationMutedUntil = null;
    }

    public void enableNotifications() {
        this.notificationSetting = NotificationSetting.ALL;
        this.notificationMutedUntil = null;
    }

    public void muteNotificationsUntil(LocalDateTime mutedUntil) {
        this.notificationSetting = NotificationSetting.ALL;
        this.notificationMutedUntil = mutedUntil;
    }

    public void muteNotificationsIndefinitely() {
        this.notificationSetting = NotificationSetting.OFF;
        this.notificationMutedUntil = null;
    }

    public boolean isNotificationsMuted() {
        return this.notificationSetting == NotificationSetting.OFF
                || (this.notificationMutedUntil != null
                && this.notificationMutedUntil.isAfter(LocalDateTime.now()));
    }
}
