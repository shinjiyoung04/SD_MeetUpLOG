package com.log.MeetupLog.domain.recommendation.controller;

import com.log.MeetupLog.domain.chat.dto.ChatMessageDto;
import com.log.MeetupLog.domain.recommendation.service.AiRecommendationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/rooms/{roomId}/ai")
@RequiredArgsConstructor
public class AiRecommendationController {

    private final AiRecommendationService aiRecommendationService;

    @PostMapping("/recommendations")
    public ResponseEntity<ChatMessageDto> recommend(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long roomId
    ) {
        return ResponseEntity.ok(aiRecommendationService.analyze(userId, roomId));
    }
}
