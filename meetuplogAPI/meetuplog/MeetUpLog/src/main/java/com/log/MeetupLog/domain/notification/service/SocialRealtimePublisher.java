package com.log.MeetupLog.domain.notification.service;

import com.log.MeetupLog.domain.notification.dto.SocialRealtimeEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Component
@RequiredArgsConstructor
public class SocialRealtimePublisher {

    private final SimpMessagingTemplate messagingTemplate;

    public void publish(Long userId, String type, Long referenceId) {
        if (userId == null || type == null || type.isBlank()) return;

        Runnable action = () -> messagingTemplate.convertAndSendToUser(
                String.valueOf(userId),
                "/queue/social",
                new SocialRealtimeEvent(type, referenceId)
        );

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
            return;
        }

        action.run();
    }
}
