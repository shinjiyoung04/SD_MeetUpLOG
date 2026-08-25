import {
  BellIcon,
  CheckIcon,
  CloseIcon,
  MailIcon,
  UserPlusIcon,
} from '../common/Icons'

const NOTIFICATION_META = {
  INVITE: {
    label: '채팅방 초대',
    icon: MailIcon,
    tone: 'invite',
  },
  ROOM_INVITE: {
    label: '채팅방 초대',
    icon: MailIcon,
    tone: 'invite',
  },
  ROOM_INVITE_ACCEPTED: {
    label: '초대 수락',
    icon: CheckIcon,
    tone: 'system',
  },
  ROOM_INVITE_REJECTED: {
    label: '초대 거절',
    icon: MailIcon,
    tone: 'invite',
  },
  FRIEND_REQUEST: {
    label: '친구 요청',
    icon: UserPlusIcon,
    tone: 'friend',
  },
  FRIEND: {
    label: '친구 요청',
    icon: UserPlusIcon,
    tone: 'friend',
  },
  FRIEND_REQUEST_ACCEPTED: {
    label: '요청 수락',
    icon: CheckIcon,
    tone: 'system',
  },
  FRIEND_REQUEST_REJECTED: {
    label: '요청 거절',
    icon: UserPlusIcon,
    tone: 'friend',
  },
  SYSTEM: {
    label: '시스템 알림',
    icon: CheckIcon,
    tone: 'system',
  },
}

const NotificationsWorkspace = ({
  notifications,
  onBack,
  onDelete,
  onDeleteAll,
  onMarkAllRead,
  onMarkRead,
  onAccept,
  onReject,
  actionBusyId,
  totalCount = notifications.length,
  unreadCount = notifications.filter((notification) => !notification.read).length,
  page = 0,
  totalPages = notifications.length ? 1 : 0,
  onPageChange,
  loading = false,
}) => {
  const firstPage = Math.max(0, Math.min(page - 2, totalPages - 5))
  const visiblePages = Array.from(
    { length: Math.min(5, totalPages) },
    (_, index) => firstPage + index,
  )

  return (
    <main className="notifications-workspace">
      <button
        type="button"
        className="workspace-mobile-back"
        onClick={onBack}
      >
        ← 돌아가기
      </button>

      <header className="workspace-section-header notifications-header">
        <div className="notifications-title-group">
          <span className="notifications-heading-icon">
            <BellIcon />
          </span>

          <div>
            <span>NOTIFICATIONS</span>
            <h1>알림</h1>
            <p>
              채팅방 초대, 친구 요청과 모임의 중요한 변경사항을 한곳에서 확인합니다.
            </p>
          </div>
        </div>

        <div className="notifications-actions">
          <button
            type="button"
            className="workspace-secondary-button"
            onClick={onMarkAllRead}
            disabled={unreadCount === 0}
          >
            모두 읽음
          </button>

          <button
            type="button"
            className="workspace-danger-button"
            onClick={onDeleteAll}
            disabled={totalCount === 0}
          >
            알림 모두 지우기
          </button>
        </div>
      </header>

      <section className="notifications-summary">
        <div className="notifications-summary-card total">
          <span className="notifications-summary-icon">
            <BellIcon />
          </span>
          <div>
            <span>전체 알림</span>
            <strong>{totalCount}</strong>
          </div>
        </div>

        <div className="notifications-summary-card unread">
          <span className="notifications-summary-icon">
            <MailIcon />
          </span>
          <div>
            <span>읽지 않은 알림</span>
            <strong>{unreadCount}</strong>
          </div>
        </div>
      </section>

      <section className="workspace-notification-list">
        {notifications.length === 0 ? (
          <div className="notifications-empty">
            <span>✓</span>
            <strong>새 알림이 없습니다</strong>
            <p>새로운 소식이 생기면 이곳에 표시됩니다.</p>
          </div>
        ) : (
          notifications.map((notification, index) => {
            const meta =
              NOTIFICATION_META[notification.type] ??
              NOTIFICATION_META.SYSTEM
            const NotificationIcon = meta.icon
            const busy = actionBusyId === notification.id

            return (
              <article
                key={notification.id}
                className={`workspace-notification-item ${
                  notification.read ? 'read' : 'unread'
                } notification-tone-${meta.tone} ${
                  notification.read ? '' : 'notification-markable'
                }`}
                style={{ '--notification-order': index }}
                onClick={() => {
                  if (!notification.read) onMarkRead?.(notification.id)
                }}
              >
                <div className="workspace-notification-icon">
                  <NotificationIcon />
                </div>

                <div className="workspace-notification-body">
                  <div className="workspace-notification-meta">
                    <span>{meta.label}</span>

                    {!notification.read && (
                      <span className="workspace-new-badge">NEW</span>
                    )}
                  </div>

                  <strong className="workspace-notification-title">
                    {notification.title}
                  </strong>

                  <p>{notification.body}</p>
                  <time>{notification.time}</time>

                  {notification.actionable && (
                    <div className="workspace-notification-response-actions">
                      <button
                        type="button"
                        className="notification-accept-button"
                        disabled={busy}
                        onClick={(event) => {
                          event.stopPropagation()
                          onAccept?.(notification)
                        }}
                      >
                        {busy ? (
                          <i className="notification-action-spinner" />
                        ) : (
                          <CheckIcon />
                        )}
                        {busy ? '처리 중' : '수락'}
                      </button>
                      <button
                        type="button"
                        className="notification-reject-button"
                        disabled={busy}
                        onClick={(event) => {
                          event.stopPropagation()
                          onReject?.(notification)
                        }}
                      >
                        <CloseIcon />
                        거절
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="notification-delete-button"
                  aria-label={`${notification.title} 알림 지우기`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onDelete(notification.id)
                  }}
                >
                  <CloseIcon />
                </button>
              </article>
            )
          })
        )}
      </section>

      {totalPages > 1 && (
        <nav className="notifications-pagination" aria-label="알림 페이지">
          <button
            type="button"
            onClick={() => onPageChange?.(page - 1)}
            disabled={loading || page <= 0}
            aria-label="이전 알림 페이지"
          >
            ‹
          </button>

          {visiblePages.map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              className={pageNumber === page ? 'selected' : ''}
              aria-current={pageNumber === page ? 'page' : undefined}
              onClick={() => onPageChange?.(pageNumber)}
              disabled={loading}
            >
              {pageNumber + 1}
            </button>
          ))}

          <button
            type="button"
            onClick={() => onPageChange?.(page + 1)}
            disabled={loading || page >= totalPages - 1}
            aria-label="다음 알림 페이지"
          >
            ›
          </button>
        </nav>
      )}
    </main>
  )
}

export default NotificationsWorkspace
