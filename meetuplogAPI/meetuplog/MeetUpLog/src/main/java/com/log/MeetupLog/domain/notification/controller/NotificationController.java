package com.log.MeetupLog.domain.notification.controller;

import com.log.MeetupLog.domain.notification.dto.NotificationPageResponse;
import com.log.MeetupLog.domain.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    public NotificationPageResponse getNotifications(
            @AuthenticationPrincipal Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "8") int size
    ) {
        return notificationService.getNotifications(userId, page, size);
    }

    @PutMapping("/{notificationId}/read")
    public ResponseEntity<Void> markRead(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long notificationId
    ) {
        notificationService.markRead(userId, notificationId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/read-all")
    public ResponseEntity<Void> markAllRead(@AuthenticationPrincipal Long userId) {
        notificationService.markAllRead(userId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{notificationId}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal Long userId,
            @PathVariable Long notificationId
    ) {
        notificationService.delete(userId, notificationId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteAll(@AuthenticationPrincipal Long userId) {
        notificationService.deleteAll(userId);
        return ResponseEntity.noContent().build();
    }
}
