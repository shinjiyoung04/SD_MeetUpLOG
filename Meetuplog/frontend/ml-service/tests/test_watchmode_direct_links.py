from meetup_ml.schemas import Movie, Provider
from meetup_ml.watchmode import apply_watchmode_sources


def test_watchmode_web_url_is_attached_to_matching_tmdb_provider():
    movie = Movie(
        internal_id="mov_demo",
        tmdb_id=123,
        title="Demo",
        providers=[
            Provider(
                provider_id=119,
                name="Amazon Prime Video",
                type="flatrate",
            ),
            Provider(
                provider_id=337,
                name="Disney Plus",
                type="flatrate",
            ),
        ],
    )

    apply_watchmode_sources(
        movie,
        [
            {
                "name": "Prime Video",
                "provider_type": "flatrate",
                "web_url": "https://www.primevideo.com/detail/example",
            },
            {
                "name": "Disney+",
                "provider_type": "flatrate",
                "web_url": "https://www.disneyplus.com/movies/example/id",
            },
        ],
    )

    assert movie.providers[0].detail_url == "https://www.primevideo.com/detail/example"
    assert movie.providers[1].detail_url == "https://www.disneyplus.com/movies/example/id"


def test_non_http_watchmode_value_is_not_used():
    movie = Movie(
        internal_id="mov_demo",
        tmdb_id=123,
        title="Demo",
        providers=[Provider(provider_id=8, name="Netflix", type="flatrate")],
    )

    apply_watchmode_sources(
        movie,
        [{
            "name": "Netflix",
            "provider_type": "flatrate",
            "web_url": "Deeplinks available for paid plans only.",
        }],
    )

    assert movie.providers[0].detail_url is None


def test_watchmode_only_source_is_appended_after_ranking():
    movie = Movie(internal_id="mov_demo", tmdb_id=123, title="Demo", providers=[])

    apply_watchmode_sources(
        movie,
        [{
            "source_id": 999,
            "name": "TVING",
            "provider_type": "flatrate",
            "web_url": "https://www.tving.com/contents/example",
        }],
    )

    assert len(movie.providers) == 1
    assert movie.providers[0].name == "TVING"
    assert movie.providers[0].detail_url == "https://www.tving.com/contents/example"
