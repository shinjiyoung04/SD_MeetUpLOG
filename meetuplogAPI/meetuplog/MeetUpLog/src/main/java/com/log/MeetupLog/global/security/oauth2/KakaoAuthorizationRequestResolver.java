package com.log.MeetupLog.global.security.oauth2;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class KakaoAuthorizationRequestResolver implements OAuth2AuthorizationRequestResolver {

    private final DefaultOAuth2AuthorizationRequestResolver delegate;

    public KakaoAuthorizationRequestResolver(
            ClientRegistrationRepository clientRegistrationRepository
    ) {
        this.delegate = new DefaultOAuth2AuthorizationRequestResolver(
                clientRegistrationRepository,
                "/oauth2/authorization"
        );
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
        return forceKakaoLogin(delegate.resolve(request));
    }

    @Override
    public OAuth2AuthorizationRequest resolve(
            HttpServletRequest request,
            String clientRegistrationId
    ) {
        return forceKakaoLogin(delegate.resolve(request, clientRegistrationId));
    }

    private OAuth2AuthorizationRequest forceKakaoLogin(
            OAuth2AuthorizationRequest authorizationRequest
    ) {
        if (
                authorizationRequest == null ||
                !authorizationRequest.getAuthorizationUri().contains("kauth.kakao.com")
        ) {
            return authorizationRequest;
        }

        Map<String, Object> parameters = new LinkedHashMap<>(
                authorizationRequest.getAdditionalParameters()
        );
        parameters.put("prompt", "login");

        return OAuth2AuthorizationRequest
                .from(authorizationRequest)
                .additionalParameters(parameters)
                .build();
    }
}
