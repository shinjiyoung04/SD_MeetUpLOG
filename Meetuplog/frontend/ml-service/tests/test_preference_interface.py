from fastapi.testclient import TestClient

import meetup_ml.api as api_module
from meetup_ml.api import app
from meetup_ml.database import MeetupDatabase
from meetup_ml.preference_interface import build_preference_deltas
from meetup_ml.schemas import (
    ChatAnalyzeResponse,
    ChatMessage,
    ChatRecommendRequest,
    GroupRecommendRequest,
    Movie,
    Preference,
    Provider,
)


def test_preference_deltas_include_upsert_remove_and_source():
    before = [Preference(user_id="A", liked_genres={"Action": .8}, max_runtime=120)]
    after = [Preference(user_id="A", disliked_genres={"Horror": .7})]
    deltas = build_preference_deltas(before, after, "message-2")
    keys = {(item.target_type, item.target_value, item.operation): item for item in deltas}

    assert ("GENRE", "Action", "REMOVE") in keys
    assert keys[("GENRE", "Horror", "UPSERT")].score == -.7
    assert ("CONSTRAINT", "max_runtime:LTE", "REMOVE") in keys
    assert all(item.source_message_id == "message-2" for item in deltas)


def test_message_idempotency_and_state_version(tmp_path, monkeypatch):
    database = MeetupDatabase(tmp_path / "interface.db")
    monkeypatch.setattr(api_module, "database", database)
    client = TestClient(app)
    payload = {
        "room_id": "room-interface",
        "round_id": "round-1",
        "user_id": "A",
        "text": "액션 영화 좋아",
        "idempotency_key": "message-100",
    }

    first = client.post("/v1/chat/messages", json=payload)
    duplicate = client.post("/v1/chat/messages", json=payload)

    assert first.status_code == 200
    assert first.json()["state_version"] == 1
    assert duplicate.status_code == 200
    assert duplicate.json()["processing_status"] == "DUPLICATE"
    assert duplicate.json()["state_version"] == 1
    assert len(database.messages("room-interface")) == 1


def test_stale_room_state_is_rejected(tmp_path, monkeypatch):
    database = MeetupDatabase(tmp_path / "stale.db")
    monkeypatch.setattr(api_module, "database", database)
    database.add_message("room-state", "A", "액션 영화 좋아", idempotency_key="m-1")
    database.save_preferences("room-state", [Preference(user_id="A", liked_genres={"Action": .8})])
    response = TestClient(app).post(
        "/v1/chat/rooms/room-state/recommendations",
        json={"round_id": "r-1", "expected_state_version": 0},
    )

    assert response.status_code == 409
    assert response.json()["detail"]["error"]["code"] == "STALE_PREFERENCE_STATE"


def test_from_chat_accumulates_preferences_and_only_rerolls_unchanged_state(
    tmp_path,
    monkeypatch,
):
    database = MeetupDatabase(tmp_path / "from-chat.db")
    analyses = iter([
        ChatAnalyzeResponse(
            members=[Preference(user_id="A", liked_genres={"액션": 0.8})],
            analyses=[],
        ),
        ChatAnalyzeResponse(
            members=[Preference(user_id="A", min_year=2020)],
            analyses=[],
        ),
        ChatAnalyzeResponse(
            members=[Preference(user_id="A", min_year=2020)],
            analyses=[],
        ),
    ])
    recommendation_calls = []

    monkeypatch.setattr(api_module, "database", database)
    monkeypatch.setattr(api_module.store, "load_movies", lambda: [])
    monkeypatch.setattr(
        api_module,
        "_analyze_corrected",
        lambda *_args, **_kwargs: next(analyses),
    )

    def fake_recommendation(request, **kwargs):
        recommendation_calls.append((request.model_copy(deep=True), kwargs))
        return {"recommendations": []}

    monkeypatch.setattr(
        api_module,
        "_run_group_recommendation",
        fake_recommendation,
    )

    def request(round_id):
        return ChatRecommendRequest(
            room_id="room-cumulative",
            round_id=round_id,
            messages=[ChatMessage(message_id=1, user_id="A", text="조건")],
            excluded_movie_ids=["old-top-1"],
        )

    api_module.recommendation_from_chat(request("round-1"))
    api_module.recommendation_from_chat(request("round-2"))
    api_module.recommendation_from_chat(request("round-3"))

    saved = database.preferences("room-cumulative")
    assert len(saved) == 1
    assert saved[0].liked_genres == {"액션": 0.8}
    assert saved[0].min_year == 2020

    first, second, third = recommendation_calls
    assert first[0].excluded_movie_ids == []
    assert first[1]["include_history_exclusions"] is False
    assert second[0].excluded_movie_ids == []
    assert second[1]["include_history_exclusions"] is False
    assert third[0].excluded_movie_ids == ["old-top-1"]
    assert third[1]["include_history_exclusions"] is True


def test_mixed_ott_and_theater_preferences_do_not_overwrite_each_other():
    request = GroupRecommendRequest(
        room_id="mixed-watch",
        round_id="round-1",
        members=[
            Preference(
                user_id="A",
                ott_platforms=["넷플릭스", "티빙"],
                ott_strict=True,
            ),
            Preference(user_id="B", ott_platforms=["디즈니+"]),
            Preference(user_id="C", prefers_theater=True),
        ],
    )
    movies = [
        Movie(
            internal_id="netflix",
            title="넷플릭스 영화",
            providers=[Provider(provider_id=8, name="Netflix", type="flatrate")],
        ),
        Movie(
            internal_id="disney",
            title="디즈니 영화",
            providers=[Provider(provider_id=337, name="Disney Plus", type="flatrate")],
            is_now_playing=True,
        ),
    ]

    api_module._apply_watch_preferences(request, movies)

    assert request.allowed_providers == []
    assert request.require_now_playing is False
    assert request.include_unknown_watch_path is False


def test_strict_ott_is_the_filter_when_no_theater_preference_exists():
    request = GroupRecommendRequest(
        room_id="strict-ott",
        round_id="round-1",
        members=[
            Preference(
                user_id="A",
                ott_platforms=["넷플릭스"],
                ott_strict=True,
            ),
            Preference(user_id="B", ott_platforms=["디즈니+"]),
        ],
    )
    movies = [
        Movie(
            internal_id="netflix",
            title="넷플릭스 영화",
            providers=[Provider(provider_id=8, name="Netflix", type="flatrate")],
        ),
        Movie(
            internal_id="disney",
            title="디즈니 영화",
            providers=[Provider(provider_id=337, name="Disney Plus", type="flatrate")],
        ),
    ]

    api_module._apply_watch_preferences(request, movies)

    assert request.allowed_providers == [8]
    assert request.include_unknown_watch_path is False
