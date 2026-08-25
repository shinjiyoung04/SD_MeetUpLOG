package com.log.MeetupLog.domain.notification.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class NotificationPageResponse {
    private List<NotificationResponse> items;
    private long totalCount;
    private long unreadCount;
    private int page;
    private int size;
    private int totalPages;
}
