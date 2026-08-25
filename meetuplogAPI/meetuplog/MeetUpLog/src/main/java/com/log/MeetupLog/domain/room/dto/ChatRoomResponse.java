package com.log.MeetupLog.domain.room.dto;

import com.log.MeetupLog.domain.room.entity.ChatRoom;
import com.log.MeetupLog.domain.room.entity.RoomStatus;
import com.log.MeetupLog.domain.room.entity.RoomType;
import com.log.MeetupLog.domain.room.entity.RoomRole;
import com.log.MeetupLog.domain.room.entity.ChatRoomMember;
import com.log.MeetupLog.domain.room.entity.NotificationSetting;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class ChatRoomResponse {

    private Long roomId;
    private RoomType roomType;
    private String roomName;
    private String description;
    private String roomImageUrl;
    private String topicType;
    private String lastMessage;
    private RoomRole myRole;
    private int maxMembers;
    private int currentMembers;
    private RoomStatus roomStatus;
    private Long createdById;
    private String createdByNickname;
    private LocalDateTime createdAt;
    private NotificationSetting notificationSetting;
    private LocalDateTime notificationMutedUntil;
    private boolean notificationsMuted;
    private String confirmedMovieKey;
    private String confirmedMovieTitle;
    private Long decisionMessageId;
    private LocalDateTime decisionConfirmedAt;
    private LocalDateTime decisionAllReadAt;
    private LocalDateTime scheduledCloseAt;

    public static ChatRoomResponse from(
            ChatRoom room,
            int currentMembers,
            ChatRoomMember member,
            String lastMessage
    ) {
        return ChatRoomResponse.builder()
                .roomId(room.getRoomId())
                .roomType(room.getRoomType())
                .roomName(room.getRoomName())
                .description(room.getDescription())
                .roomImageUrl(room.getRoomImageUrl())
                .topicType(room.getTopicType())
                .lastMessage(lastMessage)
                .myRole(member.getRoomRole())
                .maxMembers(room.getMaxMembers())
                .currentMembers(currentMembers)
                .roomStatus(room.getRoomStatus())
                .createdById(room.getCreatedBy().getUserId())
                .createdByNickname(room.getCreatedBy().getNickname())
                .createdAt(room.getCreatedAt())
                .notificationSetting(member.getNotificationSetting())
                .notificationMutedUntil(member.getNotificationMutedUntil())
                .notificationsMuted(member.isNotificationsMuted())
                .confirmedMovieKey(room.getConfirmedMovieKey())
                .confirmedMovieTitle(room.getConfirmedMovieTitle())
                .decisionMessageId(room.getDecisionMessageId())
                .decisionConfirmedAt(room.getDecisionConfirmedAt())
                .decisionAllReadAt(room.getDecisionAllReadAt())
                .scheduledCloseAt(room.getScheduledCloseAt())
                .build();
    }
}
