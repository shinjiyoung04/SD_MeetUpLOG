import {
  SparklesIcon,
} from '../common/Icons'

const AiResultCard = ({
  movies = [],
  summary,
  onDetail,
  onConfirm,
  confirmedMovieKey = null,
  canConfirm = false,
  confirming = false,
}) => {
  const topMovies =
    movies.slice(0, 3)

  return (
    <div className="ai-result-wrapper">
      <div className="ai-avatar">
        <SparklesIcon />
      </div>

      <article className="ai-result-card ai-wireframe-card">
        <div className="ai-wireframe-tabs">
          <span>
            AI 영화 추천 카드
          </span>

          <span
            className={
              confirmedMovieKey
                ? 'completed'
                : ''
            }
          >
            {confirmedMovieKey
              ? '추천 확정 완료'
              : '구성원 의견 수집 중'}
          </span>
        </div>

        <div className="ai-wireframe-summary">
          <span
            className="ai-summary-icon"
            aria-hidden="true"
          >
            💬
          </span>

          <p>
            <strong>
              대화 요약
            </strong>

            <span>
              {summary ||
                '최근 대화에서 드러난 구성원별 취향과 그룹 적합도를 함께 고려했어요.'}
            </span>
          </p>
        </div>

        <div className="ai-wireframe-grid">
          {topMovies.map(
            (movie) => {
              const movieKey = String(movie.tmdbId ?? movie.movieId ?? movie.id ?? movie.rank)
              const confirmed = String(confirmedMovieKey ?? '') === movieKey

              return (
                <article
                  className={`ai-candidate-card ${
                    confirmed
                      ? 'confirmed'
                      : ''
                  }`}
                  key={`${movie.rank}-${movie.title}`}
                >
                  <header className="ai-candidate-heading">
                    <div>
                      <strong>
                        {movie.title}
                      </strong>

                      <span>
                        {movie.genres} · {movie.runtime}
                      </span>
                    </div>

                    <span className="ai-candidate-score">
                      <strong>
                        {movie.score}
                      </strong>

                      <small>
                        match
                      </small>
                    </span>
                  </header>

                  <button
                    type="button"
                    className="ai-candidate-poster"
                    onClick={() =>
                      onDetail?.(
                        movie,
                      )
                    }
                    aria-label={`${movie.title} 상세 정보 보기`}
                  >
                    <span className="ai-candidate-rank">
                      TOP {movie.rank}
                    </span>

                    {movie.posterUrl ? (
                      <img
                        src={movie.posterUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <>
                        <span className="ai-poster-icon" aria-hidden="true">🎬</span>
                        <span>영화 포스터</span>
                      </>
                    )}
                  </button>

                  <div className="ai-candidate-actions">
                    <button
                      type="button"
                      onClick={() =>
                        onDetail?.(
                          movie,
                        )
                      }
                    >
                      상세 정보
                    </button>

                    <button
                      type="button"
                      className="confirm"
                      aria-pressed={
                        confirmed
                      }
                      disabled={!canConfirm || confirming || Boolean(confirmedMovieKey)}
                      title={!canConfirm ? '방장만 추천 결과를 확정할 수 있습니다.' : undefined}
                      onClick={() =>
                        onConfirm?.(movie)
                      }
                    >
                      {confirmed
                        ? '확정됨'
                        : confirming
                          ? '확정 중'
                          : '확정'}
                    </button>
                  </div>
                </article>
              )
            },
          )}
        </div>
      </article>
    </div>
  )
}

export default AiResultCard
