package com.log.MeetupLog.domain.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;
import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatReadReceiptDto {
    private Long roomId;
    private Long userId;
    private Long lastReadMessageId;
    private Map<Long, Integer> unreadCounts;
    private String decisionEventType;
    private String confirmedMovieKey;
    private String confirmedMovieTitle;
    private Long decisionMessageId;
    private LocalDateTime scheduledCloseAt;
}
