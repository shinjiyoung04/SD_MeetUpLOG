package com.log.MeetupLog.domain.notification.dto;

import com.log.MeetupLog.domain.notification.entity.UserNotification;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class NotificationResponse {
    private Long id;
    private String type;
    private String title;
    private String body;
    private boolean read;
    private boolean actionable;
    private String actionKind;
    private Long referenceId;
    private LocalDateTime createdAt;
    private LocalDateTime resolvedAt;

    public static NotificationResponse from(UserNotification notification) {
        return NotificationResponse.builder()
                .id(notification.getNotificationId())
                .type(notification.getNotificationType().name())
                .title(notification.getTitle())
                .body(notification.getBody())
                .read(notification.isRead())
                .actionable(notification.isActionable())
                .actionKind(notification.getActionKind() == null ? null : notification.getActionKind().name())
                .referenceId(notification.getReferenceId())
                .createdAt(notification.getCreatedAt())
                .resolvedAt(notification.getResolvedAt())
                .build();
    }
}
