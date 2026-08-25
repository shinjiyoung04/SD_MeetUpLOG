package com.log.MeetupLog.domain.realtime.service;

import com.log.MeetupLog.domain.realtime.dto.UserRealtimeEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class UserRealtimePublisher {

    private final ApplicationEventPublisher eventPublisher;
    private final SimpMessageSendingOperations messagingTemplate;

    public void publish(Long userId, String eventType, Long resourceId) {
        if (userId == null || eventType == null || eventType.isBlank()) return;
        eventPublisher.publishEvent(new UserRealtimeEvent(
                userId,
                eventType,
                resourceId,
                LocalDateTime.now()
        ));
    }

    @TransactionalEventListener(
            phase = TransactionPhase.AFTER_COMMIT,
            fallbackExecution = true
    )
    public void deliver(UserRealtimeEvent event) {
        messagingTemplate.convertAndSendToUser(
                String.valueOf(event.userId()),
                "/queue/events",
                event
        );
    }
}
