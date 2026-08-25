import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import MessageBubble from './MessageBubble'
import AiResultCard from './AiResultCard'
import ConfirmedMovieCard from './ConfirmedMovieCard'
import {
  ArrowDownIcon,
} from '../common/Icons'

const SCROLL_BOTTOM_THRESHOLD =
  260

const MIN_MESSAGES_FOR_JUMP =
  10

const findLastMessage = (
  messages,
) => {
  for (
    let index = messages.length - 1;
    index >= 0;
    index -= 1
  ) {
    if (messages[index]) {
      return messages[index]
    }
  }

  return null
}

const MessageList = ({
  messages,
  currentUserId,
  onAiDetail,
  onAiConfirm,
  canConfirmAi = false,
  confirmedMovieKey = null,
  confirmingMovieKey = null,
  onReplyMessage,
  onEditMessage,
  onDeleteMessage,
  onToggleReaction,
  searchResultIds = [],
  activeSearchMessageId = null,
}) => {
  const listRef =
    useRef(null)

  const messageRefs =
    useRef(
      new Map(),
    )

  const previousLastIdRef =
    useRef(null)

  const nearBottomRef =
    useRef(true)

  const scrollFrameRef =
    useRef(null)

  const highlightTimerRef =
    useRef(null)

  const [
    selectedMessageId,
    setSelectedMessageId,
  ] = useState(null)

  const [
    highlightedMessageId,
    setHighlightedMessageId,
  ] = useState(null)

  const [
    showJumpToLatest,
    setShowJumpToLatest,
  ] = useState(false)

  const messageMap =
    useMemo(() => {
      const nextMessageMap =
        new Map()

      messages.forEach(
        (message) => {
          if (
            message.type !==
            'AI_RESULT' &&
            message.type !==
            'AI_CONFIRMED'
          ) {
            nextMessageMap.set(
              message.id,
              message,
            )
          }
        },
      )

      return nextMessageMap
    }, [messages])

  const searchResultIdSet = useMemo(
    () => new Set(searchResultIds.map((id) => String(id))),
    [searchResultIds],
  )

  useEffect(() => {
    const element =
      listRef.current

    if (!element) {
      return
    }

    const lastMessage =
      findLastMessage(
        messages,
      )

    const lastId =
      lastMessage?.id ??
      null

    const lastMessageIsMine =
      lastMessage?.senderId ===
      currentUserId

    if (
      previousLastIdRef.current !==
      lastId
    ) {
      const isInitialLoad =
        previousLastIdRef.current ===
        null

      const shouldFollowLatest =
        isInitialLoad ||
        nearBottomRef.current ||
        lastMessageIsMine

      if (shouldFollowLatest) {
        element.scrollTo({
          top:
            element.scrollHeight,
          behavior:
            isInitialLoad
              ? 'auto'
              : 'smooth',
        })

        nearBottomRef.current =
          true

        setShowJumpToLatest(
          false,
        )
      } else if (
        messages.length >=
        MIN_MESSAGES_FOR_JUMP
      ) {
        setShowJumpToLatest(
          true,
        )
      }

      previousLastIdRef.current =
        lastId
    }
  }, [
    currentUserId,
    messages,
  ])

  useEffect(() => {
    if (
      selectedMessageId &&
      !messages.some(
        (message) =>
          message.id ===
          selectedMessageId &&
          !message.deleted,
      )
    ) {
      setSelectedMessageId(
        null,
      )
    }
  }, [
    messages,
    selectedMessageId,
  ])

  useEffect(() => {
    if (!selectedMessageId) return undefined

    const closeFromOutside = (event) => {
      if (!listRef.current?.contains(event.target)) {
        setSelectedMessageId(null)
      }
    }

    document.addEventListener('pointerdown', closeFromOutside)
    return () => document.removeEventListener('pointerdown', closeFromOutside)
  }, [selectedMessageId])

  useEffect(() => {
    return () => {
      if (
        highlightTimerRef.current
      ) {
        window.clearTimeout(
          highlightTimerRef.current,
        )
      }

      if (
        scrollFrameRef.current
      ) {
        window.cancelAnimationFrame(
          scrollFrameRef.current,
        )
      }
    }
  }, [])

  const updateScrollPosition =
    () => {
      const list =
        listRef.current

      if (!list) return

      const distanceFromBottom =
        list.scrollHeight -
        list.scrollTop -
        list.clientHeight

      const nearBottom =
        distanceFromBottom <
        SCROLL_BOTTOM_THRESHOLD

      nearBottomRef.current =
        nearBottom

      setShowJumpToLatest(
        messages.length >=
          MIN_MESSAGES_FOR_JUMP &&
          !nearBottom,
      )
    }

  const handleScroll = () => {
    if (
      scrollFrameRef.current
    ) {
      return
    }

    scrollFrameRef.current =
      window.requestAnimationFrame(
        () => {
          scrollFrameRef.current =
            null
          updateScrollPosition()
        },
      )
  }

  const scrollToLatest = () => {
    const list =
      listRef.current

    if (!list) return

    nearBottomRef.current = true
    setShowJumpToLatest(false)

    list.scrollTo({
      top: list.scrollHeight,
      behavior: 'smooth',
    })
  }

  const jumpToMessage = (
    messageId,
  ) => {
    const list =
      listRef.current

    const element =
      messageRefs.current.get(
        messageId,
      )

    if (
      !list ||
      !element
    ) {
      return
    }

    const top =
      element.offsetTop -
      list.clientHeight /
        2 +
      element.offsetHeight /
        2

    list.scrollTo({
      top:
        Math.max(
          0,
          top,
        ),
      behavior:
        'smooth',
    })

    setHighlightedMessageId(null)

    if (
      highlightTimerRef.current
    ) {
      window.clearTimeout(
        highlightTimerRef.current,
      )
    }

    window.requestAnimationFrame(
      () => {
        window.requestAnimationFrame(
          () => {
            setHighlightedMessageId(
              messageId,
            )

            highlightTimerRef.current =
              window.setTimeout(
                () =>
                  setHighlightedMessageId(
                    null,
                  ),
                1450,
              )
          },
        )
      },
    )
  }

  useEffect(() => {
    if (activeSearchMessageId == null) return
    jumpToMessage(activeSearchMessageId)
  }, [activeSearchMessageId])

  return (
    <div className="message-list-shell">
      <main
        ref={listRef}
        className="message-list"
        onScroll={handleScroll}
        onClick={(event) => {
          if (
            !event.target.closest?.('.message-action-menu') &&
            !event.target.closest?.('.message-bubble')
          ) {
            setSelectedMessageId(
              null,
            )
          }
        }}
      >
      <div className="chat-date-divider">
        <span>오늘</span>
      </div>

      {messages.length ===
        0 && (
        <div className="room-start-message">
          <div className="room-start-icon">
            ✦
          </div>

          <strong>
            대화를 시작해보세요
          </strong>

          <p>
            모임에 대한 이야기를 나누고
            <br />
            함께 결정을 만들어가세요.
          </p>
        </div>
      )}

      {messages.map(
        (message) => {
          if (
            message.type ===
            'AI_RESULT'
          ) {
            return (
              <AiResultCard
                key={
                  message.id
                }
                movies={
                  message.movies
                }
                summary={
                  message.aiSummary
                }
                onDetail={
                  onAiDetail
                }
                onConfirm={onAiConfirm}
                canConfirm={canConfirmAi}
                confirmedMovieKey={confirmedMovieKey}
                confirming={Boolean(confirmingMovieKey)}
              />
            )
          }

          if (
            message.type ===
            'AI_CONFIRMED'
          ) {
            return (
              <ConfirmedMovieCard
                key={message.id}
                movie={message.movie}
                onDetail={onAiDetail}
              />
            )
          }

          const selected =
            selectedMessageId ===
            message.id

          return (
            <div
              key={
                message.id
              }
              data-message-id={message.id}
              ref={(element) => {
                if (element) {
                  messageRefs.current.set(
                    message.id,
                    element,
                  )
                } else {
                  messageRefs.current.delete(
                    message.id,
                  )
                }
              }}
              className={[
                'message-anchor',
                searchResultIdSet.has(String(message.id))
                  ? 'message-search-match'
                  : '',
                activeSearchMessageId != null &&
                String(activeSearchMessageId) === String(message.id)
                  ? 'message-search-current'
                  : '',
                highlightedMessageId ===
                message.id
                  ? 'message-jump-highlight'
                  : '',
              ].join(' ')}
            >
              <MessageBubble
                message={
                  message
                }
                mine={
                  message.senderId ===
                  currentUserId
                }
                selected={
                  selected
                }
                currentUserId={
                  currentUserId
                }
                replyMessage={
                  message.replyToId
                    ? messageMap.get(
                        message.replyToId,
                      )
                    : null
                }
                onSelect={() =>
                  setSelectedMessageId(
                    (previous) =>
                      previous ===
                      message.id
                        ? null
                        : message.id,
                  )
                }
                onReply={(
                  target,
                ) => {
                  setSelectedMessageId(
                    null,
                  )

                  onReplyMessage?.(
                    target,
                  )
                }}
                onEdit={(
                  target,
                ) => {
                  setSelectedMessageId(
                    null,
                  )

                  onEditMessage?.(
                    target,
                  )
                }}
                onDelete={(
                  target,
                ) => {
                  setSelectedMessageId(
                    null,
                  )

                  onDeleteMessage?.(
                    target,
                  )
                }}
                onToggleReaction={(
                  messageId,
                  emoji,
                ) => {
                  onToggleReaction?.(
                    messageId,
                    emoji,
                  )
                }}
                onJumpToMessage={
                  jumpToMessage
                }
              />
            </div>
          )
        },
      )}
      </main>

      {showJumpToLatest && (
        <button
          type="button"
          className="jump-to-latest-button"
          onClick={scrollToLatest}
          aria-label="최신 메시지로 이동"
          title="최신 메시지로 이동"
        >
          <ArrowDownIcon />
        </button>
      )}
    </div>
  )
}

export default MessageList
