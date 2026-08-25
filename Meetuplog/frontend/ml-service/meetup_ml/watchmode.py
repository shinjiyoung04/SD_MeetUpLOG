from __future__ import annotations

import re
from functools import lru_cache
from typing import Iterable

import httpx

from .config import settings
from .schemas import Movie, Provider


WATCHMODE_TYPE_TO_PROVIDER_TYPE = {
    "sub": "flatrate",
    "rent": "rent",
    "buy": "buy",
    "free": "free",
}

# TMDB와 Watchmode가 같은 서비스를 조금 다른 이름으로 표기하는 경우를 정규화한다.
_PROVIDER_NAME_ALIASES = {
    "amazonprimevideo": "primevideo",
    "primevideo": "primevideo",
    "amazonvideo": "primevideo",
    "amazon": "primevideo",
    "disneyplus": "disneyplus",
    "disney": "disneyplus",
    "netflix": "netflix",
    "watcha": "watcha",
    "왓챠": "watcha",
    "tving": "tving",
    "티빙": "tving",
    "wavve": "wavve",
    "웨이브": "wavve",
    "coupangplay": "coupangplay",
    "쿠팡플레이": "coupangplay",
    "appletvplus": "appletvplus",
    "appletv": "appletv",
}


def _provider_key(name: str | None) -> str:
    if not name:
        return ""
    compact = "".join(re.findall(r"[0-9a-z가-힣]+", name.casefold()))
    return _PROVIDER_NAME_ALIASES.get(compact, compact)


def _valid_web_url(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    if value.startswith("https://") or value.startswith("http://"):
        return value
    return None


@lru_cache(maxsize=512)
def _fetch_watchmode_sources(tmdb_id: int, region: str) -> tuple[dict, ...]:
    """Watchmode에서 작품별 OTT 원문 URL을 가져온다.

    TMDB watch/providers는 서비스 목록만 주고 작품 딥링크는 주지 않으므로,
    추천 결과 3편에 한해서 Watchmode의 TMDB-ID 기반 sources API를 조회한다.
    API 키가 없거나 조회가 실패하면 추천 자체는 실패시키지 않고 빈 결과를 반환한다.
    """
    api_key = (settings.watchmode_api_key or "").strip()
    if not api_key:
        return ()

    url = (
        f"{settings.watchmode_base_url.rstrip('/')}/title/"
        f"movie-{int(tmdb_id)}/sources/"
    )

    try:
        response = httpx.get(
            url,
            params={"regions": region},
            headers={"X-API-Key": api_key},
            timeout=settings.watchmode_timeout_seconds,
            follow_redirects=True,
        )
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError, TypeError):
        return ()

    if not isinstance(payload, list):
        return ()

    # 한국 소스만 남기고, 실제 웹 작품 URL이 있는 항목만 사용한다.
    result: list[dict] = []
    for source in payload:
        if not isinstance(source, dict):
            continue
        source_region = str(source.get("region") or "").upper()
        if source_region and source_region != region.upper():
            continue
        web_url = _valid_web_url(source.get("web_url"))
        source_type = WATCHMODE_TYPE_TO_PROVIDER_TYPE.get(str(source.get("type") or ""))
        if not web_url or not source_type:
            continue
        result.append({**source, "web_url": web_url, "provider_type": source_type})

    return tuple(result)


def apply_watchmode_sources(movie: Movie, sources: Iterable[dict]) -> Movie:
    """TMDB provider 항목에 Watchmode 작품 상세 URL을 결합한다.

    추천/필터링용 provider_id와 availability는 기존 TMDB 데이터를 유지하고,
    URL만 Watchmode의 web_url을 주입한다. 따라서 추천 로직에는 영향을 주지 않는다.
    """
    normalized_sources = [source for source in sources if isinstance(source, dict)]
    if not normalized_sources:
        return movie

    by_name: dict[str, list[dict]] = {}
    for source in normalized_sources:
        key = _provider_key(str(source.get("name") or ""))
        if key:
            by_name.setdefault(key, []).append(source)

    existing_pairs: set[tuple[str, str]] = set()

    for provider in movie.providers:
        provider_key = _provider_key(provider.name)
        existing_pairs.add((provider_key, provider.type))
        candidates = by_name.get(provider_key, [])
        if not candidates:
            continue

        # 같은 서비스라도 구독/대여/구매 링크가 다를 수 있으므로
        # 타입까지 일치하는 작품 URL만 붙인다.
        selected = next(
            (
                source
                for source in candidates
                if source.get("provider_type") == provider.type
                and _valid_web_url(source.get("web_url"))
            ),
            None,
        )

        if selected:
            provider.detail_url = _valid_web_url(selected.get("web_url"))

    # Watchmode에는 있는데 TMDB KR provider 목록에는 없는 소스도 결과에 포함한다.
    # 이 단계는 추천 순위 계산 이후에 실행되므로 provider_id 기반 추천 로직에는 영향을 주지 않는다.
    for source in normalized_sources:
        source_name = str(source.get("name") or "").strip()
        source_type = str(source.get("provider_type") or "")
        source_url = _valid_web_url(source.get("web_url"))
        source_key = _provider_key(source_name)
        pair = (source_key, source_type)
        if not source_name or not source_key or not source_url or pair in existing_pairs:
            continue
        try:
            source_id = int(source.get("source_id") or 0)
        except (TypeError, ValueError):
            source_id = 0
        movie.providers.append(
            Provider(
                provider_id=source_id,
                name=source_name,
                type=source_type,
                detail_url=source_url,
            )
        )
        existing_pairs.add(pair)

    return movie


def attach_direct_provider_links(movies: Iterable[Movie]) -> None:
    """추천 결과 영화에 OTT 작품 직접 링크를 best-effort로 붙인다."""
    if not (settings.watchmode_api_key or "").strip():
        return

    region = (settings.watchmode_region or "KR").strip().upper() or "KR"
    for movie in movies:
        if movie.tmdb_id is None:
            continue
        sources = _fetch_watchmode_sources(int(movie.tmdb_id), region)
        apply_watchmode_sources(movie, sources)
