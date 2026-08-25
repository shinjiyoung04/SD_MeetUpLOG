package com.log.MeetupLog.domain.recommendation.dto;

import com.log.MeetupLog.domain.chat.dto.ChatMessageDto;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class AiAnalysisEventResponse {
    private String eventType;
    private Long roomId;
    private String analysisId;
    private String message;
    private ChatMessageDto recommendation;
    private LocalDateTime occurredAt;
}
