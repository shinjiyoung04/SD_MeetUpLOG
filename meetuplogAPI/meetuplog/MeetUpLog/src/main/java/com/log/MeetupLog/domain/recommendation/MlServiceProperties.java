package com.log.MeetupLog.domain.recommendation;

import java.time.Duration;

@Deprecated(forRemoval = true)
public record MlServiceProperties(
        String baseUrl,
        Duration connectTimeout,
        Duration readTimeout
) {
    public MlServiceProperties {
        baseUrl = baseUrl == null || baseUrl.isBlank()
                ? "http://127.0.0.1:8000"
                : baseUrl.replaceAll("/+$", "");
        connectTimeout = connectTimeout == null ? Duration.ofSeconds(3) : connectTimeout;
        readTimeout = readTimeout == null ? Duration.ofSeconds(60) : readTimeout;
    }
}
