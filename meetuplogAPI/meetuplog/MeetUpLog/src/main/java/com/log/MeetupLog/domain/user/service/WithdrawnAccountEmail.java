package com.log.MeetupLog.domain.user.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;

public final class WithdrawnAccountEmail {

    private WithdrawnAccountEmail() {
    }

    public static String normalize(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    public static String fingerprint(String email) {
        String normalizedEmail = normalize(email);
        if (normalizedEmail == null || normalizedEmail.isBlank()) {
            return null;
        }

        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(
                    digest.digest(normalizedEmail.getBytes(StandardCharsets.UTF_8))
            );
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256을 사용할 수 없습니다.", exception);
        }
    }

    public static String anonymized(Long userId) {
        return "withdrawn_" + userId + "@deleted.invalid";
    }
}
