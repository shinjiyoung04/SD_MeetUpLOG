import meetup_ml.api as api_module


def test_reset_room_chat_clears_correction_lru_cache(monkeypatch):
    reset_rooms = []

    monkeypatch.setattr(
        api_module.database,
        "reset_room",
        lambda room_id: reset_rooms.append(room_id),
    )
    monkeypatch.setattr(
        api_module.text_corrector,
        "correct",
        lambda text: text,
    )

    api_module._correct_message.cache_clear()
    api_module._correct_message("room-1", 1, "액션 영화")
    assert api_module._correct_message.cache_info().currsize == 1

    response = api_module.reset_room_chat("room-1")

    assert reset_rooms == ["room-1"]
    assert api_module._correct_message.cache_info().currsize == 0
    assert response == {"room_id": "room-1", "status": "RESET"}
