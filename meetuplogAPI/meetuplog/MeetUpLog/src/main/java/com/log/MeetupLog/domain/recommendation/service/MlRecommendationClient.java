package com.log.MeetupLog.domain.recommendation.service;

import com.log.MeetupLog.domain.chat.entity.ChatMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MlRecommendationClient {

    private static final int RECOMMENDATION_COUNT = 3;

    private final RestClient mlRestClient;
    private final ObjectMapper objectMapper;

    /**
     * 현재 채팅 원문을 한 번에 분석하고, 팀원이 만든 그룹 추천 모델에
     * 분석된 사용자별 선호 프로필을 그대로 전달합니다.
     */
    public String recommend(
            Long roomId,
            String analysisId,
            List<ChatMessage> messages,
            List<String> excludedMovieIds
    ) {
        ObjectNode combinedRequest = objectMapper.createObjectNode();
        combinedRequest.put("room_id", String.valueOf(roomId));
        combinedRequest.put("round_id", "round-" + analysisId);
        combinedRequest.putArray("allowed_providers");
        combinedRequest.putArray("allowed_provider_types");
        combinedRequest.put("limit", RECOMMENDATION_COUNT);
        combinedRequest.put("include_unknown_watch_path", false);
        ArrayNode exclusions = combinedRequest.putArray("excluded_movie_ids");
        excludedMovieIds.stream()
                .filter(movieId -> movieId != null && !movieId.isBlank())
                .distinct()
                .forEach(exclusions::add);
        ArrayNode chatMessages = combinedRequest.putArray("messages");

        messages.forEach(message -> {
            ObjectNode item = chatMessages.addObject();
            item.put("message_id", message.getId());
            item.put("user_id", String.valueOf(message.getSenderId()));
            item.put("text", message.getContent());
            if (message.getReplyToMessageId() != null) {
                item.put("reply_to_message_id", message.getReplyToMessageId());
            }
        });

        JsonNode combined = mlRestClient.post()
                .uri("/v1/recommendations/from-chat")
                .body(combinedRequest)
                .retrieve()
                .body(JsonNode.class);

        JsonNode analysis = combined == null ? null : combined.get("analysis");
        JsonNode members = analysis == null ? null : analysis.get("members");
        if (members == null || !members.isArray() || members.isEmpty()) {
            throw new IllegalStateException("대화에서 추천에 필요한 취향 정보를 찾지 못했습니다.");
        }

        JsonNode recommendation = combined.get("recommendation");

        if (recommendation == null || !recommendation.path("recommendations").isArray()) {
            throw new IllegalStateException("AI 추천 결과 형식이 올바르지 않습니다.");
        }

        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("analysisId", analysisId);
        payload.put("summary", summarize(members));
        payload.put("mode", recommendation.path("mode").asText("CONSENSUS"));
        payload.put("modelVersion", recommendation.path("model_version").asText(""));
        payload.put("dataVersion", recommendation.path("data_version").asText(""));
        payload.put("generatedAt", recommendation.path("generated_at").asText(""));

        ArrayNode movies = payload.putArray("movies");
        int rank = 1;
        for (JsonNode item : recommendation.path("recommendations")) {
            if (rank > RECOMMENDATION_COUNT) break;
            JsonNode movie = item.path("movie");
            ObjectNode card = movies.addObject();
            card.put("rank", rank++);
            card.put("movieId", movie.path("internal_id").asText(""));
            if (!movie.path("tmdb_id").isMissingNode() && !movie.path("tmdb_id").isNull()) {
                card.put("tmdbId", movie.path("tmdb_id").asLong());
            }
            card.put("title", firstText(movie, "title_ko", "title_en", "title", "original_title"));
            card.set("genres", copyArray(movie.path("genres")));
            if (!movie.path("runtime").isMissingNode() && !movie.path("runtime").isNull()) {
                card.put("runtime", movie.path("runtime").asInt());
            }
            card.put("score", Math.round(clamp(item.path("group_score").asDouble()) * 100));
            card.put("posterPath", movie.path("poster_path").asText(""));
            card.put("overview", firstText(movie, "overview_ko", "overview", "overview_en"));
            card.put("releaseDate", movie.path("release_date").asText(""));
            card.set("cast", copyArray(movie.path("cast")));
            card.set("directors", copyArray(movie.path("directors")));
            card.set("reasons", copyArray(item.path("reasons")));
            card.set("providers", slimProviders(movie.path("providers")));
            card.put("providerLink", movie.path("provider_link").asText(""));
            card.put("watchPath", movie.path("watch_path").asText(""));
            card.put("watchPathStatus", item.path("watch_path_status").asText("UNKNOWN"));
            card.set("cinemaSources", copyArray(movie.path("cinema_sources")));
            if (!movie.path("tmdb_id").isMissingNode() && !movie.path("tmdb_id").isNull()) {
                card.put(
                        "detailUrl",
                        "https://www.themoviedb.org/movie/"
                                + movie.path("tmdb_id").asLong()
                                + "?language=ko-KR"
                );
            }
            card.put("evidenceLevel", item.path("evidence_level").asText("LOW"));
        }

        if (movies.size() != RECOMMENDATION_COUNT) {
            throw new IllegalStateException("서로 다른 영화 3편을 추천하지 못했습니다.");
        }

        // Jackson 3(Spring Boot 4)의 매핑 예외는 RuntimeException 계열이므로
        // Jackson 2의 checked JsonProcessingException 처리가 필요하지 않습니다.
        return objectMapper.writeValueAsString(payload);
    }

    private String summarize(JsonNode members) {
        List<String> likes = new ArrayList<>();
        List<String> dislikes = new ArrayList<>();
        List<String> people = new ArrayList<>();
        List<String> countries = new ArrayList<>();
        List<String> certifications = new ArrayList<>();
        List<String> ottPlatforms = new ArrayList<>();
        Integer maxRuntime = null;
        Integer minYear = null;
        boolean prefersTheater = false;

        for (JsonNode member : members) {
            appendFieldNames(likes, member.path("liked_genres"), 3);
            appendFieldNames(dislikes, member.path("disliked_genres"), 2);
            appendTextValues(people, member.path("liked_people"), 2);
            appendPersonNames(people, member.path("liked_actors"), 2);
            appendPersonNames(people, member.path("liked_directors"), 2);
            appendCountryNames(countries, member.path("countries"), 2);
            appendTextValues(certifications, member.path("certifications"), 2);
            appendTextValues(ottPlatforms, member.path("ott_platforms"), 3);
            prefersTheater = prefersTheater || member.path("prefers_theater").asBoolean(false);
            if (member.path("max_runtime").canConvertToInt()) {
                int value = member.path("max_runtime").asInt();
                maxRuntime = maxRuntime == null ? value : Math.min(maxRuntime, value);
            }
            if (member.path("min_year").canConvertToInt()) {
                int value = member.path("min_year").asInt();
                minYear = minYear == null ? value : Math.max(minYear, value);
            }
        }

        List<String> parts = new ArrayList<>();
        if (!likes.isEmpty()) parts.add(String.join("·", distinctLimit(likes, 3)) + " 장르 선호");
        if (!dislikes.isEmpty()) parts.add(String.join("·", distinctLimit(dislikes, 2)) + " 장르 제외");
        if (!people.isEmpty()) parts.add(String.join("·", distinctLimit(people, 2)) + " 관련 작품 선호");
        if (!countries.isEmpty()) parts.add(String.join("·", distinctLimit(countries, 2)) + " 영화 선호");
        if (!certifications.isEmpty()) parts.add(String.join("·", distinctLimit(certifications, 2)) + " 관람등급 적용");
        if (!ottPlatforms.isEmpty()) {
            parts.add(String.join("·", distinctLimit(ottPlatforms, 3)) + " 시청 경로 고려");
        }
        if (prefersTheater) parts.add("영화관 상영 여부 고려");
        if (minYear != null) parts.add(minYear + "년 이후 최신작 조건");
        if (maxRuntime != null) parts.add(maxRuntime + "분 이하 러닝타임 고려");

        return parts.isEmpty()
                ? "최근 대화에서 드러난 구성원별 취향과 그룹 적합도를 함께 고려했어요."
                : String.join(", ", parts) + " 등 대화 조건을 함께 고려했어요.";
    }

    private void appendFieldNames(List<String> target, JsonNode object, int limit) {
        if (!object.isObject()) return;
        for (String fieldName : object.propertyNames()) {
            if (target.size() >= limit * 3) break;
            JsonNode value = object.path(fieldName);
            if (value.asDouble(0) > 0) target.add(fieldName);
        }
    }

    private void appendTextValues(List<String> target, JsonNode array, int limit) {
        if (!array.isArray()) return;
        for (JsonNode item : array) {
            if (target.size() >= limit * 3) break;
            if (!item.asText("").isBlank()) target.add(item.asText());
        }
    }

    private void appendPersonNames(List<String> target, JsonNode array, int limit) {
        if (!array.isArray()) return;
        for (JsonNode item : array) {
            if (target.size() >= limit * 3) break;
            String name = firstText(item, "name", "original_name");
            if (!name.isBlank()) target.add(name);
        }
    }

    private void appendCountryNames(List<String> target, JsonNode array, int limit) {
        if (!array.isArray()) return;
        for (JsonNode item : array) {
            if (target.size() >= limit * 3) break;
            String code = item.asText("").trim().toUpperCase();
            if (code.isBlank()) continue;
            target.add(switch (code) {
                case "KR" -> "한국";
                case "US" -> "미국";
                case "JP" -> "일본";
                case "CN" -> "중국";
                case "GB" -> "영국";
                case "FR" -> "프랑스";
                default -> code;
            });
        }
    }

    private List<String> distinctLimit(List<String> values, int limit) {
        return values.stream().filter(value -> value != null && !value.isBlank())
                .distinct().limit(limit).toList();
    }

    private String firstText(JsonNode node, String... fields) {
        for (String field : fields) {
            String value = node.path(field).asText("").trim();
            if (!value.isBlank()) return value;
        }
        return "";
    }

    private ArrayNode copyArray(JsonNode source) {
        ArrayNode result = objectMapper.createArrayNode();
        if (source.isArray()) source.forEach(result::add);
        return result;
    }

    private ArrayNode slimProviders(JsonNode source) {
        ArrayNode result = objectMapper.createArrayNode();
        if (!source.isArray()) return result;
        source.forEach(provider -> {
            ObjectNode item = result.addObject();
            if (!provider.path("provider_id").isMissingNode()
                    && !provider.path("provider_id").isNull()) {
                item.put("providerId", provider.path("provider_id").asLong());
            }
            item.put("name", provider.path("name").asText(""));
            item.put("type", provider.path("type").asText(""));
            item.put("logoPath", provider.path("logo_path").asText(""));
            String detailUrl = firstText(
                    provider,
                    "detail_url",
                    "content_url",
                    "url",
                    "link"
            );
            if (!detailUrl.isBlank()) item.put("detailUrl", detailUrl);
        });
        return result;
    }

    private double clamp(double value) {
        return Math.max(0, Math.min(1, value));
    }
}
