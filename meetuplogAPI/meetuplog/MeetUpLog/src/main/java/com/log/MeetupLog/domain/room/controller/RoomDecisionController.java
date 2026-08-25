package com.log.MeetupLog.domain.room.controller;

import com.log.MeetupLog.domain.room.dto.ChatRoomEventResponse;
import com.log.MeetupLog.domain.room.dto.RoomDecisionConfirmRequest;
import com.log.MeetupLog.domain.room.service.RoomDecisionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/rooms/{roomId}/decision")
@RequiredArgsConstructor
public class RoomDecisionController {
    private final RoomDecisionService roomDecisionService;

    @PostMapping("/confirm")
    public ResponseEntity<ChatRoomEventResponse> confirm(
            @AuthenticationPrincipal Long userId,
            @PathVariable("roomId") Long roomId,
            @RequestBody RoomDecisionConfirmRequest request
    ) {
        return ResponseEntity.ok(roomDecisionService.confirm(userId, roomId, request));
    }
}
