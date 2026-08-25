const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? '/api'
).replace(/\/$/, '')

const resolveAssetUrl = (value) => {
  if (!value || /^(?:https?:|data:|blob:)/i.test(value)) return value ?? null
  if (!value.startsWith('/')) return value

  try {
    return /^https?:\/\//i.test(API_BASE_URL)
      ? `${new URL(API_BASE_URL).origin}${value}`
      : value
  } catch {
    return value
  }
}

export class ChatApiError extends Error {
  constructor(message, status = 0, body = null) {
    super(message)
    this.name = 'ChatApiError'
    this.status = status
    this.body = body
  }
}

const readBody = async (response) => {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

const getErrorMessage = (body, status) => {
  if (typeof body === 'string' && body.trim()) return body
  return body?.message ?? body?.detail ?? body?.error ?? `요청 처리에 실패했습니다. (${status})`
}

const request = async (path, { accessToken, signal, ...options } = {}) => {
  let response
  const isFormData = options.body instanceof FormData

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal,
      headers: {
        Accept: 'application/json',
        ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new ChatApiError(
      '채팅 서버에 연결할 수 없습니다. 백엔드 실행 상태를 확인해 주세요.',
    )
  }

  const body = await readBody(response)
  if (!response.ok) {
    throw new ChatApiError(getErrorMessage(body, response.status), response.status, body)
  }

  return body
}

const formatMessageTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(11, 16)

  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

const formatStructuredRoomPreview = (payload) => {
  if (!payload || typeof payload !== 'object') return null

  const isConfirmedMovie =
    payload?.kind === 'AI_CONFIRMED' ||
    (payload?.movie && payload?.confirmedAt)

  if (isConfirmedMovie) {
    const title = payload?.movie?.title ?? payload?.movieTitle ?? ''
    return title
      ? `${title}가 최종 영화로 확정되었습니다.`
      : 'AI 추천 영화가 최종 확정되었습니다.'
  }

  if (
    payload?.analysisId ||
    payload?.summary ||
    Array.isArray(payload?.movies)
  ) {
    return 'AI 영화 추천이 도착했습니다.'
  }

  return null
}

const formatRoomPreview = (value) => {
  if (value && typeof value === 'object') {
    return formatStructuredRoomPreview(value) || '새 대화를 시작해보세요.'
  }
  if (typeof value !== 'string') return value || '새 대화를 시작해보세요.'

  const preview = value.trim()
  if (!preview) return '새 대화를 시작해보세요.'
  if (!preview.startsWith('{') && !preview.startsWith('[')) return preview

  try {
    const payload = JSON.parse(preview)
    return formatStructuredRoomPreview(payload) || preview
  } catch {
    return preview
  }
}

export const normalizeRoom = (room) => {
  const mutedUntil = room.notificationMutedUntil ?? null
  const muted = Boolean(room.notificationsMuted) ||
    room.notificationSetting === 'OFF' ||
    Boolean(mutedUntil && new Date(mutedUntil).getTime() > Date.now())

  return {
    id: room.roomId ?? room.id,
    name: room.roomName ?? room.name ?? '이름 없는 채팅방',
    topicType: room.topicType ?? room.category ?? 'ETC',
    lastMessage: formatRoomPreview(
      room.lastMessage ?? room.description ?? '새 대화를 시작해보세요.',
    ),
    unreadCount: muted ? 0 : Number(room.unreadCount ?? 0),
    memberCount: Number(room.currentMembers ?? room.memberCount ?? 0),
    maxMembers: Number(room.maxMembers ?? 9),
    roomType: room.roomType ?? 'GROUP',
    roomStatus: room.roomStatus ?? 'ACTIVE',
    createdById: room.createdById ?? null,
    createdByNickname: room.createdByNickname ?? '',
    myRole: room.myRole ?? null,
    roomImageUrl: room.roomImageUrl ?? null,
    description: room.description ?? '',
    notificationSetting: room.notificationSetting ?? 'ALL',
    notificationMutedUntil: mutedUntil,
    notificationsMuted: muted,
    confirmedMovieKey: room.confirmedMovieKey ?? null,
    confirmedMovieTitle: room.confirmedMovieTitle ?? null,
    decisionMessageId: room.decisionMessageId ?? null,
    decisionConfirmedAt: room.decisionConfirmedAt ?? null,
    decisionAllReadAt: room.decisionAllReadAt ?? null,
    scheduledCloseAt: room.scheduledCloseAt ?? null,
  }
}

const parseAiPayload = (value) => {
  if (!value) return null
  if (typeof value === 'object') return value

  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const normalizeAiMovie = (movie, index) => {
  const posterPath = movie?.posterUrl ?? movie?.posterPath ?? ''
  const posterUrl = posterPath.startsWith('/')
    ? `https://image.tmdb.org/t/p/w500${posterPath}`
    : posterPath || null
  const genres = Array.isArray(movie?.genres)
    ? movie.genres.join(' · ')
    : movie?.genres ?? '장르 정보 없음'
  const runtimeNumber = Number(movie?.runtime)
  const runtime = Number.isFinite(runtimeNumber) && runtimeNumber > 0
    ? `${runtimeNumber}분`
    : typeof movie?.runtime === 'string' && movie.runtime.trim()
      ? movie.runtime
      : '상영시간 미정'
  const scoreNumber = Number(movie?.score)

  return {
    ...movie,
    rank: Number(movie?.rank ?? index + 1),
    movieId: movie?.movieId ?? movie?.internal_id ?? movie?.movie_id ?? String(movie?.tmdbId ?? ''),
    tmdbId: movie?.tmdbId ?? movie?.tmdb_id ?? null,
    title: movie?.title || '제목 정보 없음',
    genres,
    runtime,
    score: Number.isFinite(scoreNumber)
      ? Math.max(0, Math.min(100, Math.round(scoreNumber)))
      : 0,
    posterUrl,
    reasons: Array.isArray(movie?.reasons) ? movie.reasons : [],
    providers: Array.isArray(movie?.providers) ? movie.providers : [],
    cast: Array.isArray(movie?.cast) ? movie.cast : [],
    directors: Array.isArray(movie?.directors) ? movie.directors : [],
    cinemaSources: Array.isArray(movie?.cinemaSources)
      ? movie.cinemaSources
      : Array.isArray(movie?.cinema_sources)
        ? movie.cinema_sources
        : [],
    watchPath: movie?.watchPath ?? movie?.watch_path ?? null,
    watchPathStatus: movie?.watchPathStatus ?? movie?.watch_path_status ?? 'UNKNOWN',
  }
}

export const normalizeMessage = (message) => {
  const status = message.messageStatus ?? 'ACTIVE'
  const type = message.messageType ?? message.type ?? 'TEXT'
  const aiPayload = type === 'DECISION_CARD'
    ? parseAiPayload(message.content)
    : null
  const confirmedPayload = aiPayload?.movie
    ? aiPayload
    : null

  return {
    id: message.messageId ?? message.id ?? message.clientMessageKey,
    roomId: message.roomId,
    senderId: message.senderId ?? 0,
    senderName: message.senderNickname ?? message.senderName ?? '알 수 없음',
    senderProfileImageUrl: resolveAssetUrl(
      message.senderProfileImageUrl ?? message.profileImageUrl ?? null,
    ),
    content: status === 'DELETED'
      ? ''
      : confirmedPayload
        ? `${confirmedPayload.movie.title ?? '영화'} 확정`
        : (message.content ?? ''),
    sentAt: formatMessageTime(message.sentAt),
    sentAtRaw: message.sentAt ?? null,
    type: confirmedPayload
      ? 'AI_CONFIRMED'
      : type === 'DECISION_CARD'
        ? 'AI_RESULT'
        : type,
    movies: (confirmedPayload ? [] : aiPayload?.movies ?? message.movies ?? []).map(normalizeAiMovie),
    movie: confirmedPayload
      ? normalizeAiMovie(confirmedPayload.movie, 0)
      : message.movie ?? null,
    aiSummary: aiPayload?.summary ?? message.aiSummary ?? '',
    analysisId: aiPayload?.analysisId ?? message.analysisId ?? null,
    modelVersion: aiPayload?.modelVersion ?? message.modelVersion ?? '',
    confirmedAt: confirmedPayload?.confirmedAt ?? message.confirmedAt ?? null,
    imageUrl: resolveAssetUrl(message.imageUrl),
    imageMimeType: message.imageMimeType ?? null,
    imageSize: message.imageSize ?? null,
    replyToId: message.replyToMessageId ?? message.replyToId ?? null,
    relatedEntityType: message.relatedEntityType ?? null,
    relatedEntityId: message.relatedEntityId ?? null,
    clientMessageKey: message.clientMessageKey ?? null,
    unreadCount: Number(message.unreadCount ?? 0),
    edited: status === 'EDITED',
    deleted: status === 'DELETED',
    pending: Boolean(message.pending),
    failed: Boolean(message.failed),
    systemEvent: message.systemEvent ?? null,
    reactions: message.reactions ?? {},
    realtimeEvent: message.eventType ?? null,
  }
}

export const normalizeMember = (member) => ({
  id: member.userId ?? member.memberId ?? member.id,
  accountId: member.accountId ?? null,
  nickname: member.nickname ?? '알 수 없음',
  email: member.email ?? '',
  role: member.accountType === 'GUEST'
    ? 'GUEST'
    : member.roomRole ?? member.role ?? 'MEMBER',
  accountType: member.accountType ?? 'MEMBER',
  accountStatus: member.accountStatus ?? 'ACTIVE',
  presence: member.presence ?? 'OFFLINE',
  profileImageUrl: resolveAssetUrl(member.profileImageUrl ?? null),
  statusMessage: member.statusMessage ?? '',
})

export const getMyRooms = async (accessToken, signal) => {
  const rooms = await request('/v1/rooms', { accessToken, signal })
  return Array.isArray(rooms) ? rooms.map(normalizeRoom) : []
}

export const getRoom = async (accessToken, roomId, signal) => {
  const room = await request(`/v1/rooms/${roomId}`, { accessToken, signal })
  return normalizeRoom(room)
}

export const getRoomMessages = async (accessToken, roomId, signal) => {
  const messages = await request(`/v1/rooms/${roomId}/messages`, {
    accessToken,
    signal,
  })
  return Array.isArray(messages) ? messages.map(normalizeMessage) : []
}

export const getRoomMembers = async (accessToken, roomId, signal) => {
  const members = await request(`/v1/rooms/${roomId}/members`, {
    accessToken,
    signal,
  })
  return Array.isArray(members)
    ? members
        .map(normalizeMember)
        .filter((member) => member.accountStatus !== 'INACTIVE')
    : []
}

export const markRoomMessagesRead = (accessToken, roomId, lastReadMessageId) =>
  request(`/v1/rooms/${roomId}/read`, {
    accessToken,
    method: 'POST',
    body: JSON.stringify({ lastReadMessageId }),
  })

export const createRoom = async (accessToken, values) => {
  const room = await request('/v1/rooms', {
    accessToken,
    method: 'POST',
    body: JSON.stringify({
      roomName: values.name,
      topicType: values.topicType,
      maxMembers: values.maxMembers,
      description: values.description ?? '',
    }),
  })
  return normalizeRoom(room)
}

export const joinRoom = (accessToken, roomId) =>
  request(`/v1/rooms/${roomId}/join`, {
    accessToken,
    method: 'POST',
  })

export const updateRoom = async (accessToken, roomId, roomName) => {
  const room = await request(`/v1/rooms/${roomId}`, {
    accessToken,
    method: 'PATCH',
    body: JSON.stringify({ roomName }),
  })
  return normalizeRoom(room)
}

export const deleteRoom = (accessToken, roomId) =>
  request(`/v1/rooms/${roomId}`, {
    accessToken,
    method: 'DELETE',
  })

export const leaveRoom = (accessToken, roomId) =>
  request(`/v1/rooms/${roomId}/leave`, {
    accessToken,
    method: 'POST',
  })

export const kickRoomMember = (accessToken, roomId, memberId, reason = '') =>
  request(`/v1/rooms/${roomId}/members/${memberId}/kick`, {
    accessToken,
    method: 'POST',
    body: JSON.stringify({ reason: reason.trim() }),
  })

export const getRoomNotificationSetting = (accessToken, roomId, signal) =>
  request(`/v1/rooms/${roomId}/notification-setting`, {
    accessToken,
    signal,
  })

export const updateRoomNotificationSetting = (accessToken, roomId, mode) =>
  request(`/v1/rooms/${roomId}/notification-setting`, {
    accessToken,
    method: 'PUT',
    body: JSON.stringify({ mode }),
  })

export const requestAiRecommendation = async (accessToken, roomId) => {
  return request(`/v1/rooms/${roomId}/ai/recommendations`, {
    accessToken,
    method: 'POST',
  })
}

export const confirmRoomDecision = (accessToken, roomId, movie) =>
  request(`/v1/rooms/${roomId}/decision/confirm`, {
    accessToken,
    method: 'POST',
    body: JSON.stringify({
      movieKey: String(movie.tmdbId ?? movie.movieId ?? movie.id ?? movie.rank),
      movieTitle: movie.title,
      movie: {
        movieId: movie.movieId ?? null,
        tmdbId: movie.tmdbId ?? null,
        title: movie.title,
        genres: movie.genres,
        runtime: movie.runtime,
        score: movie.score,
        overview: movie.overview,
        reasons: movie.reasons,
        providers: movie.providers,
        cast: movie.cast,
        directors: movie.directors,
        releaseDate: movie.releaseDate,
        posterUrl: movie.posterUrl,
        watchPath: movie.watchPath,
        watchPathStatus: movie.watchPathStatus,
        cinemaSources: movie.cinemaSources,
      },
    }),
  })

export const createWebSocketTicket = (accessToken, signal) =>
  request('/v1/chat/ws-ticket', {
    accessToken,
    signal,
    method: 'POST',
  })

export const editChatMessage = async (accessToken, roomId, messageId, content) => {
  const message = await request(`/v1/rooms/${roomId}/messages/${messageId}`, {
    accessToken,
    method: 'PATCH',
    body: JSON.stringify({ content }),
  })
  return normalizeMessage(message)
}

export const deleteChatMessage = async (accessToken, roomId, messageId) => {
  const message = await request(`/v1/rooms/${roomId}/messages/${messageId}`, {
    accessToken,
    method: 'DELETE',
  })
  return normalizeMessage(message)
}

export const uploadChatImage = async (accessToken, roomId, file) => {
  const formData = new FormData()
  formData.append('file', file)

  const image = await request(`/v1/rooms/${roomId}/images`, {
    accessToken,
    method: 'POST',
    body: formData,
  })

  return {
    ...image,
    serverImageUrl: image?.imageUrl,
    imageUrl: resolveAssetUrl(image?.imageUrl),
  }
}
