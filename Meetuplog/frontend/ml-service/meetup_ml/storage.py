import json
from pathlib import Path
from threading import RLock

from .schemas import Movie


class JsonStore:
    def __init__(self, root: Path):
        self.root = root
        self.raw = root / "raw"
        self.normalized = root / "normalized"
        self.state = root / "state"
        self._movies_cache: list[Movie] | None = None
        self._movies_cache_path: Path | None = None
        self._movies_cache_mtime_ns: int | None = None
        self._movies_cache_lock = RLock()

        for path in (
            self.raw,
            self.normalized,
            self.state,
        ):
            path.mkdir(
                parents=True,
                exist_ok=True,
            )

    def append_jsonl(
        self,
        path: Path,
        row: dict,
    ) -> None:
        path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        with path.open(
            "a",
            encoding="utf-8",
        ) as stream:
            stream.write(
                json.dumps(
                    row,
                    ensure_ascii=False,
                )
                + "\n"
            )

    def save_movies(
        self,
        movies: list[Movie],
    ) -> Path:
        target = (
            self.normalized
            / "movies.json"
        )

        target.write_text(
            json.dumps(
                [
                    movie.model_dump()
                    for movie in movies
                ],
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        # Build a searchable actor/director registry from every collected title.
        # No nationality filter is applied: Korean and international credits are
        # preserved together, with TMDB IDs and original-name aliases when present.
        people: dict[str, dict] = {}
        for movie in movies:
            credits = [
                *movie.cast_people,
                *movie.director_people,
            ]
            if not credits:
                credits = [
                    *({"name": name, "role": "ACTOR"} for name in movie.cast),
                    *({"name": name, "role": "DIRECTOR"} for name in movie.directors),
                ]
            for credit in credits:
                row = credit if isinstance(credit, dict) else credit.model_dump()
                name = row.get("name")
                if not name:
                    continue
                key = str(row.get("person_id") or f"{row.get('role')}:{name.casefold()}")
                person = people.setdefault(key, {
                    "person_id": row.get("person_id"), "name": name,
                    "original_name": row.get("original_name"), "role": row.get("role"),
                    "aliases": [], "movie_ids": [],
                })
                person["aliases"] = list(dict.fromkeys([
                    *person["aliases"], name, row.get("original_name"),
                ]))
                person["aliases"] = [value for value in person["aliases"] if value]
                person["movie_ids"].append(movie.internal_id)
        (self.normalized / "people.json").write_text(
            json.dumps(list(people.values()), ensure_ascii=False, indent=2), encoding="utf-8"
        )

        with self._movies_cache_lock:
            self._movies_cache = list(movies)
            self._movies_cache_path = target
            self._movies_cache_mtime_ns = target.stat().st_mtime_ns

        return target

    def load_movies(
        self,
        use_fixture: bool = True,
    ) -> list[Movie]:
        default_target = (
            self.normalized
            / "movies.json"
        )

        target = default_target

        if not target.exists():
            if not use_fixture:
                return []

            target = (
                Path(__file__).parents[1]
                / "fixtures"
                / "movies.json"
            )

        mtime_ns = target.stat().st_mtime_ns

        with self._movies_cache_lock:
            if (
                self._movies_cache is not None
                and self._movies_cache_path == target
                and self._movies_cache_mtime_ns == mtime_ns
            ):
                # 호출부가 새 TMDB 영화를 append해도 공용 캐시 컨테이너는
                # 변하지 않도록 얕은 복사본을 반환합니다.
                return list(self._movies_cache)

            rows = json.loads(
                target.read_text(
                    encoding="utf-8",
                )
            )
            movies = [
                Movie.model_validate(row)
                for row in rows
            ]
            self._movies_cache = movies
            self._movies_cache_path = target
            self._movies_cache_mtime_ns = mtime_ns
            return list(movies)
