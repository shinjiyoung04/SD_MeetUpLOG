package com.log.MeetupLog.domain.recommendation.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "meetup.ml-service")
public record MlServiceProperties(
        String baseUrl,
        Duration connectTimeout,
        Duration readTimeout
) {
    public MlServiceProperties {
        baseUrl = baseUrl == null || baseUrl.isBlank()
                ? "http://127.0.0.1:8000"
                : baseUrl;
        connectTimeout = connectTimeout == null ? Duration.ofSeconds(5) : connectTimeout;
        readTimeout = readTimeout == null ? Duration.ofSeconds(120) : readTimeout;
    }
}
