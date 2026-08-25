package com.log.MeetupLog.domain.room.dto;

import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class KickRoomMemberRequest {

    @Size(max = 200)
    private String reason;
}
