import {
  useEffect,
  useRef,
} from 'react'

import {
  ArrowDownIcon,
  CloseIcon,
  SearchIcon,
} from '../common/Icons'

const MessageSearchBar = ({
  open,
  query,
  resultCount,
  activeIndex,
  onQueryChange,
  onPrevious,
  onNext,
  onClose,
}) => {
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [open])

  if (!open) return null

  const position = resultCount > 0
    ? `${activeIndex + 1}/${resultCount}`
    : '0/0'

  return (
    <section
      className="message-search-toolbar"
      role="search"
      aria-label="현재 채팅방 메시지 검색"
    >
      <label className="message-search-field">
        <SearchIcon />

        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder="메시지 검색"
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              onClose()
              return
            }

            if (event.key === 'Enter') {
              event.preventDefault()
              if (event.shiftKey) onPrevious()
              else onNext()
            }
          }}
        />

        {query && (
          <button
            type="button"
            className="message-search-clear"
            onClick={() => {
              onQueryChange('')
              inputRef.current?.focus()
            }}
            aria-label="메시지 검색어 지우기"
          >
            <CloseIcon />
          </button>
        )}
      </label>

      <span className="message-search-count" aria-live="polite">
        {position}
      </span>

      <div className="message-search-navigation">
        <button
          type="button"
          className="message-search-previous"
          onClick={onPrevious}
          disabled={resultCount === 0}
          aria-label="이전 검색 결과"
        >
          <ArrowDownIcon />
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={resultCount === 0}
          aria-label="다음 검색 결과"
        >
          <ArrowDownIcon />
        </button>
      </div>

      <button
        type="button"
        className="message-search-close"
        onClick={onClose}
        aria-label="메시지 검색 닫기"
      >
        <CloseIcon />
      </button>
    </section>
  )
}

export default MessageSearchBar
