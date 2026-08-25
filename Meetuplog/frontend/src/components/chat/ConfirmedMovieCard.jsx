import { useMemo, useState } from "react";

import { SparklesIcon } from "../common/Icons";
import {
  getMovieWatchLinks,
  getPrimaryWatchLink,
  shareMovieToKakao,
} from "../../utils/movieLinks";

const ConfirmedMovieCard = ({ movie, onDetail }) => {
  const [shareStatus, setShareStatus] = useState("");

  const watchLinks = useMemo(() => getMovieWatchLinks(movie), [movie]);

  const primaryWatchLink = useMemo(() => getPrimaryWatchLink(movie), [movie]);

  if (!movie) return null;

  const handleShare = async () => {
    setShareStatus("공유 준비 중");

    try {
      const mode = await shareMovieToKakao(movie);

      setShareStatus(
        mode === "COPIED" ? "링크가 복사됐어요." : "공유창이 열렸어요.",
      );
    } catch (error) {
      if (error?.name === "AbortError") {
        setShareStatus("");
        return;
      }

      setShareStatus(error?.message || "링크를 복사하지 못했습니다.");
    }
  };

  const handleWatchLinkClick = (link) => {
    if (link?.kind !== "OTT" || link.titleSearchSupported !== false) {
      return;
    }

    navigator.clipboard
      ?.writeText(movie.title)
      .then(() => {
        setShareStatus(`‘${movie.title}’ 제목을 복사했어요.`);
      })
      .catch(() => {
        setShareStatus(`${link.name} 검색 화면에서 영화 제목을 입력해 주세요.`);
      });
  };

  const getProviderDetail = (link) => {
    if (link.kind === "OTT" && link.titleSearchSupported === false) {
      return "제목 복사 후 검색";
    }

    return `${link.detail || "시청"} ↗`;
  };

  const getPrimaryButtonText = () => {
    if (!primaryWatchLink) {
      return "상세 정보 보기";
    }

    if (primaryWatchLink.kind === "CINEMA") {
      return "예매하러 가기";
    }

    if (
      primaryWatchLink.kind === "OTT" &&
      primaryWatchLink.titleSearchSupported === false
    ) {
      return "제목 복사 후 검색";
    }

    return "작품 검색하기";
  };

  return (
    <div className="ai-result-wrapper ai-confirmed-wrapper">
      <div className="ai-avatar ai-confirmed-avatar" aria-label="Meetup AI">
        <SparklesIcon />
      </div>

      <article className="ai-confirmed-card">
        <div className="ai-confirmed-badge">AI 추천 확정</div>

        <div className="ai-confirmed-content">
          <button
            type="button"
            className="ai-confirmed-poster"
            onClick={() => onDetail?.(movie)}
            aria-label={`${movie.title} 상세 정보 보기`}
          >
            {movie.posterUrl ? (
              <img
                src={movie.posterUrl}
                alt={`${movie.title} 포스터`}
                loading="lazy"
              />
            ) : (
              <span aria-hidden="true">🎬</span>
            )}
          </button>

          <div className="ai-confirmed-copy">
            <span className="ai-confirmed-eyebrow">우리 모임의 영화</span>

            <h3>{movie.title}</h3>

            <p>{[movie.genres, movie.runtime].filter(Boolean).join(" · ")}</p>

            {watchLinks.length > 0 ? (
              <div
                className="ai-confirmed-providers"
                aria-label="시청 가능한 곳"
              >
                {watchLinks.slice(0, 4).map((link) => (
                  <a
                    key={`${link.kind}-${link.name}-${link.detail}-${link.url}`}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => handleWatchLinkClick(link)}
                    aria-label={
                      link.kind === "CINEMA"
                        ? `${link.name} 예매 페이지 열기`
                        : link.titleSearchSupported === false
                          ? `${movie.title} 제목을 복사하고 ${link.name} 검색 페이지 열기`
                          : `${link.name}에서 ${movie.title} 검색하기`
                    }
                  >
                    {link.logoUrl ? (
                      <img src={link.logoUrl} alt="" />
                    ) : (
                      <span
                        className={`ai-confirmed-provider-fallback ${
                          link.kind === "CINEMA" ? "cinema" : "ott"
                        }`}
                        aria-hidden="true"
                      >
                        {link.kind === "CINEMA" ? "예매" : "OTT"}
                      </span>
                    )}

                    <strong>{link.name}</strong>

                    <small>{getProviderDetail(link)}</small>
                  </a>
                ))}
              </div>
            ) : (
              <span className="ai-watch-unavailable">
                현재 확인된 국내 OTT 또는 예매 정보가 없어요.
              </span>
            )}
          </div>
        </div>

        <div className="ai-confirmed-actions">
          {primaryWatchLink ? (
            <a
              className="ai-confirmed-booking-button"
              href={primaryWatchLink.url}
              target="_blank"
              rel="noreferrer"
              onClick={() => handleWatchLinkClick(primaryWatchLink)}
              aria-label={
                primaryWatchLink.kind === "CINEMA"
                  ? `${primaryWatchLink.name} 예매 페이지 열기`
                  : primaryWatchLink.titleSearchSupported === false
                    ? `${movie.title} 제목을 복사하고 ${primaryWatchLink.name} 검색 페이지 열기`
                    : `${primaryWatchLink.name}에서 ${movie.title} 검색하기`
              }
            >
              <span>{getPrimaryButtonText()}</span>
              <small>{primaryWatchLink.name} ↗</small>
            </a>
          ) : (
            <button
              type="button"
              className="ai-confirmed-detail-button"
              onClick={() => onDetail?.(movie)}
            >
              상세 정보 보기
            </button>
          )}

          <button
            type="button"
            className="kakao-share-button"
            onClick={handleShare}
          >
            링크 복사하기
          </button>
        </div>

        {shareStatus && (
          <p className="ai-share-status" role="status">
            {shareStatus}
          </p>
        )}
      </article>
    </div>
  );
};

export default ConfirmedMovieCard;
