package com.log.MeetupLog.global.security;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class SecurityConfigTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void unauthenticatedApiRequestReturns401WithoutOAuthRedirect() throws Exception {
        mockMvc.perform(get("/api/v1/friends"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().doesNotExist(HttpHeaders.LOCATION));
    }

    @Test
    void invalidBearerTokenReturns401WithoutOAuthRedirect() throws Exception {
        mockMvc.perform(get("/api/v1/friends")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer invalid-token"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().doesNotExist(HttpHeaders.LOCATION));
    }

    @Test
    void localFrontendPreflightRequestIsAllowed() throws Exception {
        mockMvc.perform(options("/api/v1/friends")
                        .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string(
                        HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN,
                        "http://localhost:5173"
                ));
    }
}
