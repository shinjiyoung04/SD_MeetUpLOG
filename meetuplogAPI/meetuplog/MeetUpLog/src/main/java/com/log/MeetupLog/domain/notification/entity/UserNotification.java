package com.log.MeetupLog.domain.notification.entity;

import com.log.MeetupLog.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "user_notifications",
        indexes = {
                @Index(name = "idx_notification_recipient_created", columnList = "recipient_id, created_at"),
                @Index(name = "idx_notification_recipient_read", columnList = "recipient_id, read_at")
        },
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_notification_action_reference",
                        columnNames = {"recipient_id", "action_kind", "reference_id"}
                )
        }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserNotification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "notification_id")
    private Long notificationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recipient_id", nullable = false)
    private User recipient;

    @Enumerated(EnumType.STRING)
    @Column(name = "notification_type", nullable = false, length = 40)
    private NotificationType notificationType;

    @Column(name = "title", nullable = false, length = 100)
    private String title;

    @Column(name = "body", nullable = false, length = 500)
    private String body;

    @Enumerated(EnumType.STRING)
    @Column(name = "action_kind", length = 30)
    private NotificationActionKind actionKind;

    @Column(name = "reference_id")
    private Long referenceId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "read_at")
    private LocalDateTime readAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Builder
    public UserNotification(
            User recipient,
            NotificationType notificationType,
            String title,
            String body,
            NotificationActionKind actionKind,
            Long referenceId
    ) {
        this.recipient = recipient;
        this.notificationType = notificationType;
        this.title = title;
        this.body = body;
        this.actionKind = actionKind;
        this.referenceId = referenceId;
        this.createdAt = LocalDateTime.now();
    }

    public boolean isRead() {
        return readAt != null;
    }

    public boolean isActionable() {
        return actionKind != null && resolvedAt == null;
    }

    public boolean isDeleted() {
        return deletedAt != null;
    }

    public void markRead() {
        if (readAt == null) {
            readAt = LocalDateTime.now();
        }
    }

    public void resolve() {
        LocalDateTime now = LocalDateTime.now();
        if (readAt == null) {
            readAt = now;
        }
        if (resolvedAt == null) {
            resolvedAt = now;
        }
    }

    public void dismiss() {
        if (deletedAt == null) {
            deletedAt = LocalDateTime.now();
        }
    }
}
