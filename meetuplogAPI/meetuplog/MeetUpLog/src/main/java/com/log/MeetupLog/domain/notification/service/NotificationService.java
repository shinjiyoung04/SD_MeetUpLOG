package com.log.MeetupLog.domain.notification.service;

import com.log.MeetupLog.domain.friend.entity.FriendRequest;
import com.log.MeetupLog.domain.friend.entity.FriendRequestStatus;
import com.log.MeetupLog.domain.friend.repository.FriendRequestRepository;
import com.log.MeetupLog.domain.notification.dto.NotificationPageResponse;
import com.log.MeetupLog.domain.notification.dto.NotificationResponse;
import com.log.MeetupLog.domain.notification.entity.NotificationActionKind;
import com.log.MeetupLog.domain.notification.entity.NotificationType;
import com.log.MeetupLog.domain.notification.entity.UserNotification;
import com.log.MeetupLog.domain.notification.repository.UserNotificationRepository;
import com.log.MeetupLog.domain.room.invite.entity.RoomMemberInvite;
import com.log.MeetupLog.domain.room.invite.entity.RoomMemberInviteStatus;
import com.log.MeetupLog.domain.room.invite.repository.RoomMemberInviteRepository;
import com.log.MeetupLog.domain.realtime.service.UserRealtimePublisher;
import com.log.MeetupLog.domain.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NotificationService {

    private static final int MAX_NOTIFICATIONS_PER_USER = 30;
    private static final int DEFAULT_PAGE_SIZE = 8;
    private static final int MAX_PAGE_SIZE = 20;

    private final UserNotificationRepository notificationRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final RoomMemberInviteRepository roomMemberInviteRepository;
    private final UserRealtimePublisher realtimePublisher;

    @Transactional
    public NotificationPageResponse getNotifications(Long userId, int requestedPage, int requestedSize) {
        synchronizePendingRequests(userId);

        int size = requestedSize <= 0
                ? DEFAULT_PAGE_SIZE
                : Math.min(requestedSize, MAX_PAGE_SIZE);
        int page = Math.max(requestedPage, 0);
        Page<UserNotification> result = notificationRepository
                .findByRecipient_UserIdAndDeletedAtIsNullOrderByCreatedAtDesc(
                        userId,
                        PageRequest.of(page, size)
                );

        if (result.getTotalPages() > 0 && page >= result.getTotalPages()) {
            page = result.getTotalPages() - 1;
            result = notificationRepository
                    .findByRecipient_UserIdAndDeletedAtIsNullOrderByCreatedAtDesc(
                            userId,
                            PageRequest.of(page, size)
                    );
        }

        return NotificationPageResponse.builder()
                .items(result.getContent().stream().map(NotificationResponse::from).toList())
                .totalCount(result.getTotalElements())
                .unreadCount(notificationRepository.countByRecipient_UserIdAndReadAtIsNullAndDeletedAtIsNull(userId))
                .page(page)
                .size(size)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional
    public void markRead(Long userId, Long notificationId) {
        requireOwned(userId, notificationId).markRead();
        realtimePublisher.publish(userId, "NOTIFICATIONS_CHANGED", notificationId);
    }

    @Transactional
    public void markAllRead(Long userId) {
        notificationRepository.findByRecipient_UserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId)
                .forEach(UserNotification::markRead);
        realtimePublisher.publish(userId, "NOTIFICATIONS_CHANGED", null);
    }

    @Transactional
    public void delete(Long userId, Long notificationId) {
        UserNotification notification = requireOwned(userId, notificationId);
        if (notification.isActionable()) {
            notification.dismiss();
        } else {
            notificationRepository.delete(notification);
        }
        realtimePublisher.publish(userId, "NOTIFICATIONS_CHANGED", notificationId);
    }

    @Transactional
    public void deleteAll(Long userId) {
        notificationRepository.findByRecipient_UserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId)
                .forEach(notification -> {
                    if (notification.isActionable()) {
                        notification.dismiss();
                    } else {
                        notificationRepository.delete(notification);
                    }
                });
        realtimePublisher.publish(userId, "NOTIFICATIONS_CHANGED", null);
    }

    @Transactional
    public void createFriendRequest(FriendRequest request) {
        createActionNotification(
                request.getReceiver(),
                NotificationType.FRIEND_REQUEST,
                "친구 요청",
                request.getRequester().getNickname() + "님이 친구 요청을 보냈습니다."
                        + optionalMessage(request.getRequestMessage()),
                NotificationActionKind.FRIEND_REQUEST,
                request.getFriendRequestId()
        );
    }

    @Transactional
    public void completeFriendRequest(FriendRequest request, boolean accepted) {
        resolveAction(
                request.getReceiver().getUserId(),
                NotificationActionKind.FRIEND_REQUEST,
                request.getFriendRequestId()
        );

        createHistoryNotification(
                request.getRequester(),
                accepted ? NotificationType.FRIEND_REQUEST_ACCEPTED : NotificationType.FRIEND_REQUEST_REJECTED,
                accepted ? "친구 요청 수락" : "친구 요청 거절",
                request.getReceiver().getNickname() + "님이 친구 요청을 "
                        + (accepted ? "수락했어요." : "거절했어요.")
        );
    }

    @Transactional
    public void createRoomInvite(RoomMemberInvite invite) {
        createActionNotification(
                invite.getInvitee(),
                NotificationType.ROOM_INVITE,
                "채팅방 초대",
                invite.getInviter().getNickname() + "님이 ‘" + invite.getRoom().getRoomName() + "’에 초대했습니다.",
                NotificationActionKind.ROOM_INVITE,
                invite.getRoomMemberInviteId()
        );
    }

    @Transactional
    public void completeRoomInvite(RoomMemberInvite invite, boolean accepted) {
        resolveAction(
                invite.getInvitee().getUserId(),
                NotificationActionKind.ROOM_INVITE,
                invite.getRoomMemberInviteId()
        );

        createHistoryNotification(
                invite.getInviter(),
                accepted ? NotificationType.ROOM_INVITE_ACCEPTED : NotificationType.ROOM_INVITE_REJECTED,
                accepted ? "채팅방 초대 수락" : "채팅방 초대 거절",
                invite.getInvitee().getNickname() + "님이 ‘" + invite.getRoom().getRoomName() + "’ 초대를 "
                        + (accepted ? "수락했어요." : "거절했어요.")
        );
    }

    private void synchronizePendingRequests(Long userId) {
        friendRequestRepository.findReceived(userId, FriendRequestStatus.PENDING)
                .forEach(this::createFriendRequest);

        roomMemberInviteRepository.findReceived(userId, RoomMemberInviteStatus.PENDING).stream()
                .filter(invite -> !invite.isExpired())
                .forEach(this::createRoomInvite);
    }

    private void createActionNotification(
            User recipient,
            NotificationType type,
            String title,
            String body,
            NotificationActionKind actionKind,
            Long referenceId
    ) {
        if (notificationRepository.existsByRecipient_UserIdAndActionKindAndReferenceId(
                recipient.getUserId(), actionKind, referenceId)) {
            return;
        }

        UserNotification saved = notificationRepository.save(UserNotification.builder()
                .recipient(recipient)
                .notificationType(type)
                .title(title)
                .body(body)
                .actionKind(actionKind)
                .referenceId(referenceId)
                .build());
        enforceRetention(recipient.getUserId());
        realtimePublisher.publish(recipient.getUserId(), "NOTIFICATIONS_CHANGED", saved.getNotificationId());
    }

    private void createHistoryNotification(User recipient, NotificationType type, String title, String body) {
        UserNotification saved = notificationRepository.save(UserNotification.builder()
                .recipient(recipient)
                .notificationType(type)
                .title(title)
                .body(body)
                .build());
        enforceRetention(recipient.getUserId());
        realtimePublisher.publish(recipient.getUserId(), "NOTIFICATIONS_CHANGED", saved.getNotificationId());
    }

    private void resolveAction(Long recipientId, NotificationActionKind actionKind, Long referenceId) {
        notificationRepository
                .findByRecipient_UserIdAndActionKindAndReferenceId(recipientId, actionKind, referenceId)
                .ifPresent(notification -> {
                    if (notification.isDeleted()) {
                        notificationRepository.delete(notification);
                    } else {
                        notification.resolve();
                    }
                    realtimePublisher.publish(recipientId, "NOTIFICATIONS_CHANGED", notification.getNotificationId());
                });
    }

    private void enforceRetention(Long recipientId) {
        List<UserNotification> notifications =
                notificationRepository.findByRecipient_UserIdAndDeletedAtIsNullOrderByCreatedAtDesc(recipientId);
        if (notifications.size() > MAX_NOTIFICATIONS_PER_USER) {
            notificationRepository.deleteAll(
                    notifications.subList(MAX_NOTIFICATIONS_PER_USER, notifications.size())
            );
        }
    }

    private UserNotification requireOwned(Long userId, Long notificationId) {
        return notificationRepository.findByNotificationIdAndRecipient_UserIdAndDeletedAtIsNull(
                        notificationId,
                        userId
                )
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 알림입니다."));
    }

    private String optionalMessage(String message) {
        return message == null || message.isBlank() ? "" : " · " + message.trim();
    }
}
