package com.log.MeetupLog.domain.room.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.Map;

@Getter
@NoArgsConstructor
public class RoomDecisionConfirmRequest {
    private String movieKey;
    private String movieTitle;
    private Map<String, Object> movie;

    public RoomDecisionConfirmRequest(String movieKey, String movieTitle) {
        this.movieKey = movieKey;
        this.movieTitle = movieTitle;
    }
}
