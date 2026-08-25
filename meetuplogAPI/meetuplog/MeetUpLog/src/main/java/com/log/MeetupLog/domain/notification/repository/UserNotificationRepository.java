package com.log.MeetupLog.domain.notification.repository;

import com.log.MeetupLog.domain.notification.entity.NotificationActionKind;
import com.log.MeetupLog.domain.notification.entity.UserNotification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserNotificationRepository extends JpaRepository<UserNotification, Long> {

    Page<UserNotification> findByRecipient_UserIdAndDeletedAtIsNullOrderByCreatedAtDesc(
            Long recipientId,
            Pageable pageable
    );

    List<UserNotification> findByRecipient_UserIdAndDeletedAtIsNullOrderByCreatedAtDesc(Long recipientId);

    Optional<UserNotification> findByNotificationIdAndRecipient_UserIdAndDeletedAtIsNull(
            Long notificationId,
            Long recipientId
    );

    Optional<UserNotification> findByRecipient_UserIdAndActionKindAndReferenceId(
            Long recipientId,
            NotificationActionKind actionKind,
            Long referenceId
    );

    boolean existsByRecipient_UserIdAndActionKindAndReferenceId(
            Long recipientId,
            NotificationActionKind actionKind,
            Long referenceId
    );

    long countByRecipient_UserIdAndReadAtIsNullAndDeletedAtIsNull(Long recipientId);
}
