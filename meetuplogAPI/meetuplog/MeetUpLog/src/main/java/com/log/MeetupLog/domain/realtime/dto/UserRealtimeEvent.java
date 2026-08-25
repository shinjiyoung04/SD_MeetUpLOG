package com.log.MeetupLog.domain.realtime.dto;

import java.time.LocalDateTime;

public record UserRealtimeEvent(
        Long userId,
        String eventType,
        Long resourceId,
        LocalDateTime occurredAt
) {
}
