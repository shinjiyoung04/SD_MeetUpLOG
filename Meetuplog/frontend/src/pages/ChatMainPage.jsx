import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import ChatSidebar from "../components/chat/ChatSidebar";
import ChatHeader from "../components/chat/ChatHeader";
import MessageList from "../components/chat/MessageList";
import MessageSearchBar from "../components/chat/MessageSearchBar";
import TypingIndicator from "../components/chat/TypingIndicator";
import MessageComposer from "../components/chat/MessageComposer";
import MemberPanel from "../components/chat/MemberPanel";
import RoomThemeBackdrop from "../components/chat/RoomThemeBackdrop";
import DeleteAccountModal from "../components/modals/DeleteAccountModal";

import WorkspaceHome from "../components/workspace/WorkspaceHome";
import FriendAddWorkspace from "../components/workspace/FriendAddWorkspace";
import NotificationsWorkspace from "../components/workspace/NotificationsWorkspace";
import ProfileEditWorkspace from "../components/workspace/ProfileEditWorkspace";

import CreateRoomModal from "../components/modals/CreateRoomModal";
import KickMemberModal from "../components/modals/KickMemberModal";
import KickedMemberNoticeModal from "../components/modals/KickedMemberNoticeModal";
import RoomMenuModal from "../components/modals/RoomMenuModal";
import AppModal from "../components/common/AppModal";

import {
  currentUser as initialCurrentUser,
  initialChatRooms,
  initialFriends,
  initialMembers,
  initialMessagesByRoom,
  initialNotifications,
  mockAiMovies,
} from "../data/mockChatData";

import { getRoomTheme } from "../config/roomThemes";

import useLiquidControlReflection from "../hooks/useLiquidControlReflection";
import GlobalThemeToggle from "../components/common/GlobalThemeToggle";
import { changeMyPassword } from "../api/memberApi";
import {
  convertGuestAccount,
  deleteMyAccount,
  getMyProfile,
  removeProfileImage,
  unlinkKakao,
  updateMyProfile,
  uploadProfileImage,
} from "../api/profileApi";
import {
  createRoom as createChatRoom,
  confirmRoomDecision,
  deleteRoom as deleteChatRoom,
  deleteChatMessage,
  editChatMessage,
  getRoomNotificationSetting,
  getMyRooms,
  getRoomMembers,
  getRoomMessages,
  normalizeMessage,
  normalizeRoom,
  kickRoomMember,
  leaveRoom as leaveChatRoom,
  markRoomMessagesRead,
  requestAiRecommendation,
  updateRoom as updateChatRoom,
  updateRoomNotificationSetting,
  uploadChatImage,
} from "../api/chatApi";
import {
  acceptFriendRequest,
  acceptRoomMemberInvite,
  createRoomInviteLink,
  deleteAllNotifications,
  deleteNotification,
  getActiveRoomInviteLink,
  getFriends,
  getNotifications,
  getSentRoomMemberInvites,
  joinRoomByInvite,
  markAllNotificationsRead,
  markNotificationRead,
  blockFriend,
  removeFriend,
  rejectFriendRequest,
  rejectRoomMemberInvite,
  revokeRoomInviteLink,
  sendRoomMemberInvite,
} from "../api/socialApi";
import useRealtimeChat from "../hooks/useRealtimeChat";
import { getMovieWatchLinks } from "../utils/movieLinks";
import {
  BellIcon,
  CloseIcon,
  KakaoIcon,
  LogoutIcon,
  MenuIcon,
  PencilIcon,
  TrashIcon,
  UserPlusIcon,
} from "../components/common/Icons";

const PRESENCE_KEYS = new Set(["ONLINE", "AWAY", "OFFLINE"]);

const USE_MOCK_CHAT = import.meta.env.VITE_USE_MOCK_CHAT === "true";

const normalizeMessageSearchText = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/\s+/g, " ")
    .trim();

const normalizeCreditNames = (value) => {
  const entries = Array.isArray(value) ? value : value ? [value] : [];

  return entries
    .map((entry) => (typeof entry === "string" ? entry : entry?.name))
    .filter(Boolean);
};

const findLastMatching = (items, predicate) => {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) {
      return items[index];
    }
  }

  return null;
};

const areRoomNotificationsMuted = (room) => {
  if (!room) return false;
  if (room.notificationSetting === "OFF") return true;

  const mutedUntil = room.notificationMutedUntil;
  if (mutedUntil) {
    return new Date(mutedUntil).getTime() > Date.now();
  }

  return Boolean(room.notificationsMuted);
};

const normalizePresenceIdentity = (value) => {
  if (value == null) return null;

  const identity = String(value).trim();
  if (!identity) return null;
  if (/^id:\d+$/i.test(identity)) return identity.toLocaleLowerCase();
  if (/^\d+$/.test(identity)) return `id:${identity}`;

  const userIdMatch = identity.match(/^(?:user|guest)-(\d+)$/i);
  if (userIdMatch) return `id:${userIdMatch[1]}`;

  if (/^account:/i.test(identity)) {
    return `account:${identity.slice(identity.indexOf(":") + 1)}`;
  }

  if (/^email:/i.test(identity)) {
    return `email:${identity.slice(identity.indexOf(":") + 1).toLocaleLowerCase()}`;
  }

  if (identity.includes("@")) return `email:${identity.toLocaleLowerCase()}`;
  return null;
};

const getPresenceIdentities = (person) => {
  if (!person) return [];

  const identities = new Set();
  const userId = person.id ?? person.userId;
  const normalizedPayloadIdentity = normalizePresenceIdentity(person.identity);

  if (userId != null) identities.add(`id:${userId}`);
  if (normalizedPayloadIdentity) identities.add(normalizedPayloadIdentity);
  if (person.accountId) identities.add(`account:${person.accountId}`);
  if (person.email)
    identities.add(`email:${String(person.email).toLocaleLowerCase()}`);

  return Array.from(identities);
};

const getPresenceIdentity = (person) =>
  getPresenceIdentities(person)[0] ?? null;

const resolvePresence = (directory, person) => {
  const identity = getPresenceIdentities(person).find(
    (key) => directory[key] != null,
  );
  return identity ? directory[identity] : person?.presence;
};

const createPresenceDirectory = (...groups) => {
  const directory = {};

  groups.flat().forEach((person) => {
    if (PRESENCE_KEYS.has(person?.presence)) {
      getPresenceIdentities(person).forEach((identity) => {
        directory[identity] = person.presence;
      });
    }
  });

  return directory;
};

const ChatMainPage = ({ authSession, onLogout, onSessionChange }) => {
  useLiquidControlReflection();

  const isGuest = authSession?.type === "guest";

  const sessionUser = {
    ...initialCurrentUser,
    ...authSession?.user,
    role:
      authSession?.user?.role ?? (isGuest ? "GUEST" : initialCurrentUser.role),
    email:
      authSession?.user?.email ?? (isGuest ? "" : initialCurrentUser.email),
    statusMessage: isGuest
      ? "게스트로 참여 중"
      : (authSession?.user?.statusMessage ?? initialCurrentUser.statusMessage),
    presence: authSession?.user?.presence ?? "ONLINE",
  };

  const sessionRooms = isGuest
    ? [
        {
          ...(initialChatRooms.find(
            (room) => room.id === authSession?.inviteRoomId,
          ) ?? initialChatRooms[0]),
          id: authSession?.inviteRoomId ?? initialChatRooms[0].id,
          name: authSession?.inviteRoomName ?? initialChatRooms[0].name,
          memberCount:
            (initialChatRooms.find(
              (room) => room.id === authSession?.inviteRoomId,
            )?.memberCount ?? initialChatRooms[0].memberCount) + 1,
        },
      ]
    : initialChatRooms;

  const sessionMembers = (() => {
    const currentMember = {
      id: sessionUser.id,
      accountId: sessionUser.accountId,
      nickname: sessionUser.nickname,
      email: sessionUser.email,
      role: sessionUser.role,
      presence: sessionUser.presence,
      profileImageUrl: sessionUser.profileImageUrl,
      statusMessage: sessionUser.statusMessage,
    };

    const alreadyIncluded = initialMembers.some(
      (member) =>
        (currentMember.id != null && member.id === currentMember.id) ||
        (currentMember.accountId &&
          member.accountId === currentMember.accountId),
    );

    return alreadyIncluded
      ? initialMembers.map((member) =>
          (currentMember.id != null && member.id === currentMember.id) ||
          (currentMember.accountId &&
            member.accountId === currentMember.accountId)
            ? { ...member, ...currentMember }
            : member,
        )
      : [currentMember, ...initialMembers];
  })();

  const sessionMessages = isGuest
    ? {
        ...initialMessagesByRoom,
        [sessionRooms[0].id]: [
          ...(initialMessagesByRoom[sessionRooms[0].id] ?? []),
          {
            id: `guest-join-${sessionUser.id}`,
            eventId: `guest-join-${sessionUser.id}`,
            senderId: 0,
            senderName: "System",
            content: `${sessionUser.nickname}님이 입장했습니다.`,
            sentAt: "",
            type: "SYSTEM",
            systemEvent: "JOIN",
          },
        ],
      }
    : initialMessagesByRoom;

  const [colorMode, setColorMode] = useState(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    const saved = window.localStorage.getItem("meetuplog-color-mode");

    if (saved === "light" || saved === "dark") {
      return saved;
    }

    return window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.documentElement.dataset.colorMode = colorMode;

    document.documentElement.style.colorScheme = colorMode;

    window.localStorage.setItem("meetuplog-color-mode", colorMode);
  }, [colorMode]);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!mobileSidebarOpen) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setMobileSidebarOpen(false);
      }
    };

    const desktopQuery = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = (event) => {
      if (event.matches) setMobileSidebarOpen(false);
    };

    document.addEventListener("keydown", closeOnEscape);
    desktopQuery.addEventListener?.("change", closeOnDesktop);

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      desktopQuery.removeEventListener?.("change", closeOnDesktop);
    };
  }, [mobileSidebarOpen]);

  const [userProfile, setUserProfile] = useState(sessionUser);

  const [rooms, setRooms] = useState(
    USE_MOCK_CHAT || isGuest ? sessionRooms : [],
  );

  const [baseFriends, setBaseFriends] = useState(
    isGuest ? [] : USE_MOCK_CHAT ? initialFriends : [],
  );

  const [presenceDirectory, setPresenceDirectory] = useState(() =>
    createPresenceDirectory(
      initialCurrentUser,
      isGuest ? [] : initialFriends,
      sessionMembers,
    ),
  );

  const [baseMembers, setBaseMembers] = useState(sessionMembers);

  useEffect(() => {
    const accountToken = authSession?.accessToken;

    if (!accountToken) return undefined;

    const controller = new AbortController();

    getMyProfile(accountToken, controller.signal)
      .then((profile) => {
        if (!profile) return;

        setUserProfile((previous) => ({
          ...previous,
          ...profile,
          id: profile.userId ?? profile.id ?? previous.id,
          accountId:
            previous.accountId ?? `user-${profile.userId ?? profile.id}`,
          role: previous.role,
          presence: previous.presence ?? "ONLINE",
        }));

        setBaseMembers((previous) =>
          previous.map((member) =>
            member.id === (profile.userId ?? profile.id)
              ? {
                  ...member,
                  nickname: profile.nickname,
                  email: profile.email,
                  profileImageUrl: profile.profileImageUrl,
                  statusMessage: profile.statusMessage,
                  accountType: profile.accountType,
                }
              : member,
          ),
        );
      })
      .catch((error) => {
        if (error?.name !== "AbortError") {
          console.error("프로필 조회 실패:", error);
        }
      });

    return () => controller.abort();
  }, [authSession?.accessToken]);

  const [activeMenu, setActiveMenu] = useState("chat");

  const friends = useMemo(
    () =>
      baseFriends.map((friend) => ({
        ...friend,
        presence: resolvePresence(presenceDirectory, friend),
      })),
    [baseFriends, presenceDirectory],
  );

  const applyRealtimePresence = useCallback(
    (payload) => {
      const presence = payload?.presence;
      const identities = getPresenceIdentities(payload);

      if (identities.length === 0 || !PRESENCE_KEYS.has(presence)) {
        return;
      }

      setPresenceDirectory((previous) => {
        const next = { ...previous };
        identities.forEach((identity) => {
          next[identity] = presence;
        });
        return next;
      });

      const currentUserIdentities = new Set(getPresenceIdentities(userProfile));

      if (identities.some((identity) => currentUserIdentities.has(identity))) {
        setUserProfile((previous) => ({
          ...previous,
          presence,
        }));
      }
    },
    [userProfile.accountId, userProfile.email, userProfile.id],
  );

  useEffect(() => {
    const handleWindowPresence = (event) => {
      applyRealtimePresence(event.detail);
    };

    window.addEventListener("meetuplog:presence-change", handleWindowPresence);

    const channel =
      "BroadcastChannel" in window
        ? new BroadcastChannel("meetuplog-presence")
        : null;

    if (channel) {
      channel.onmessage = (event) => {
        applyRealtimePresence(event.data);
      };
    }

    return () => {
      window.removeEventListener(
        "meetuplog:presence-change",
        handleWindowPresence,
      );
      channel?.close();
    };
  }, [applyRealtimePresence]);

  const [workspaceMode, setWorkspaceMode] = useState(isGuest ? "chat" : "home");

  const [returnWorkspaceMode, setReturnWorkspaceMode] = useState("home");

  const [selectedRoomId, setSelectedRoomId] = useState(
    isGuest ? (sessionRooms[0]?.id ?? null) : null,
  );

  const [messagesByRoom, setMessagesByRoom] = useState(
    USE_MOCK_CHAT ? sessionMessages : {},
  );

  const [notifications, setNotifications] = useState(
    USE_MOCK_CHAT ? initialNotifications : [],
  );

  const [pendingInvitesByRoom, setPendingInvitesByRoom] = useState({});
  const [inviteLinksByRoom, setInviteLinksByRoom] = useState({});
  const [inviteLinkBusy, setInviteLinkBusy] = useState(false);
  const [notificationActionBusyId, setNotificationActionBusyId] =
    useState(null);
  const [notificationPage, setNotificationPage] = useState(0);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationSummary, setNotificationSummary] = useState(() => ({
    totalCount: USE_MOCK_CHAT ? initialNotifications.length : 0,
    unreadCount: USE_MOCK_CHAT
      ? initialNotifications.filter((notification) => !notification.read).length
      : 0,
    totalPages: USE_MOCK_CHAT && initialNotifications.length ? 1 : 0,
    page: 0,
    size: 8,
  }));

  const friendRefreshPromiseRef = useRef(null);
  const notificationRefreshPromiseRef = useRef(null);
  const notificationRefreshRequestIdRef = useRef(0);
  const realtimeUserRefreshTimerRef = useRef(null);

  const refreshFriends = useCallback(
    (signal) => {
      if (USE_MOCK_CHAT || isGuest || !authSession?.accessToken) {
        return Promise.resolve();
      }

      if (friendRefreshPromiseRef.current) {
        return friendRefreshPromiseRef.current;
      }

      const refreshPromise = getFriends(authSession.accessToken, signal)
        .then((friendList) => {
          setBaseFriends(friendList);
          setPresenceDirectory((previous) => ({
            ...previous,
            ...createPresenceDirectory(friendList),
          }));
        })
        .finally(() => {
          if (friendRefreshPromiseRef.current === refreshPromise) {
            friendRefreshPromiseRef.current = null;
          }
        });

      friendRefreshPromiseRef.current = refreshPromise;
      return refreshPromise;
    },
    [authSession?.accessToken, isGuest],
  );

  const refreshNotifications = useCallback(
    (signal, requestedPage = notificationPage, force = false) => {
      if (USE_MOCK_CHAT || isGuest || !authSession?.accessToken) {
        return Promise.resolve();
      }

      if (
        !force &&
        notificationRefreshPromiseRef.current?.page === requestedPage
      ) {
        return notificationRefreshPromiseRef.current.promise;
      }

      const requestId = notificationRefreshRequestIdRef.current + 1;
      notificationRefreshRequestIdRef.current = requestId;
      setNotificationLoading(true);
      const refreshPromise = getNotifications(authSession.accessToken, {
        page: requestedPage,
        size: 8,
        signal,
      })
        .then((notificationResult) => {
          if (requestId !== notificationRefreshRequestIdRef.current) return;
          setNotifications(notificationResult.items);
          setNotificationSummary(notificationResult);
          if (notificationResult.page !== requestedPage) {
            setNotificationPage(notificationResult.page);
          }
        })
        .finally(() => {
          if (
            notificationRefreshPromiseRef.current?.promise === refreshPromise
          ) {
            notificationRefreshPromiseRef.current = null;
          }
          if (requestId === notificationRefreshRequestIdRef.current) {
            setNotificationLoading(false);
          }
        });

      notificationRefreshPromiseRef.current = {
        page: requestedPage,
        promise: refreshPromise,
      };
      return refreshPromise;
    },
    [authSession?.accessToken, isGuest, notificationPage],
  );

  useEffect(() => {
    if (USE_MOCK_CHAT || isGuest || !authSession?.accessToken) return undefined;
    const controller = new AbortController();
    refreshFriends(controller.signal).catch((error) => {
      if (error?.name !== "AbortError")
        console.error("친구 목록 조회 실패:", error);
    });
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshFriends().catch(() => {});
      }
    }, 60000);
    return () => {
      controller.abort();
      window.clearInterval(refreshTimer);
    };
  }, [authSession?.accessToken, isGuest, refreshFriends]);

  useEffect(() => {
    if (USE_MOCK_CHAT || isGuest || !authSession?.accessToken) return undefined;
    const controller = new AbortController();
    refreshNotifications(controller.signal).catch((error) => {
      if (error?.name !== "AbortError")
        console.error("알림 목록 조회 실패:", error);
    });
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshNotifications().catch(() => {});
      }
    }, 15000);
    return () => {
      controller.abort();
      window.clearInterval(refreshTimer);
    };
  }, [authSession?.accessToken, isGuest, refreshNotifications]);

  useEffect(() => {
    if (
      USE_MOCK_CHAT ||
      isGuest ||
      !authSession?.accessToken ||
      !selectedRoomId
    )
      return undefined;
    const controller = new AbortController();
    getSentRoomMemberInvites(
      authSession.accessToken,
      selectedRoomId,
      controller.signal,
    )
      .then((invites) => {
        setPendingInvitesByRoom((previous) => ({
          ...previous,
          [selectedRoomId]: invites.map((invite) => invite.inviteeId),
        }));
      })
      .catch((error) => {
        if (error?.name !== "AbortError")
          console.error("보낸 채팅방 초대 조회 실패:", error);
      });
    return () => controller.abort();
  }, [authSession?.accessToken, isGuest, selectedRoomId]);

  const [typingUsers, setTypingUsers] = useState(
    USE_MOCK_CHAT ? [{ id: 2, nickname: "민수" }] : [],
  );

  const typingTimersRef = useRef(new Map());
  const inviteJoinAttemptedRef = useRef(false);
  const lastReadSentRef = useRef(new Map());
  const unreadCountUpdatesRef = useRef(new Map());

  const acknowledgeRoomRead = useCallback(
    (roomId, messageId) => {
      if (
        USE_MOCK_CHAT ||
        !authSession?.accessToken ||
        !roomId ||
        !Number.isFinite(Number(messageId))
      ) {
        return;
      }

      const roomKey = String(roomId);
      const messageKey = String(messageId);
      if (lastReadSentRef.current.get(roomKey) === messageKey) return;

      lastReadSentRef.current.set(roomKey, messageKey);
      markRoomMessagesRead(
        authSession.accessToken,
        roomId,
        Number(messageId),
      ).catch((error) => {
        if (lastReadSentRef.current.get(roomKey) === messageKey) {
          lastReadSentRef.current.delete(roomKey);
        }
        if (error?.name !== "AbortError") {
          console.error("채팅방 읽음 처리 실패:", error);
        }
      });
    },
    [authSession?.accessToken],
  );

  useEffect(() => {
    if (
      USE_MOCK_CHAT ||
      isGuest ||
      inviteJoinAttemptedRef.current ||
      !authSession?.accessToken
    )
      return;
    const segments = window.location.pathname.split("/").filter(Boolean);
    const inviteIndex = segments.indexOf("invite");
    const inviteToken = inviteIndex >= 0 ? segments[inviteIndex + 1] : null;
    if (!inviteToken) return;

    inviteJoinAttemptedRef.current = true;
    joinRoomByInvite(authSession.accessToken, inviteToken)
      .then((response) => {
        const room = normalizeRoom(response);
        setRooms((previous) =>
          previous.some((item) => item.id === room.id)
            ? previous.map((item) => (item.id === room.id ? room : item))
            : [room, ...previous],
        );
        setSelectedRoomId(room.id);
        setWorkspaceMode("chat");
        setActiveMenu("chat");
        window.history.replaceState({}, document.title, "/");
      })
      .catch((error) => window.alert(error.message));
  }, [authSession?.accessToken, isGuest]);

  const handleRealtimeMessage = useCallback(
    (payload) => {
      const incoming = normalizeMessage(payload);
      const roomId = incoming.roomId;
      if (!roomId) return;
      const isCreatedEvent = !["MESSAGE_UPDATED", "MESSAGE_DELETED"].includes(
        incoming.realtimeEvent,
      );

      if (
        isCreatedEvent &&
        String(roomId) === String(selectedRoomId) &&
        String(incoming.senderId) !== String(userProfile.id)
      ) {
        acknowledgeRoomRead(roomId, incoming.id);
      }

      setMessagesByRoom((previous) => {
        const messages = previous[roomId] ?? [];
        const unreadUpdateKey = `${roomId}:${incoming.id}`;
        const queuedUnreadCount =
          unreadCountUpdatesRef.current.get(unreadUpdateKey);
        const resolvedIncoming =
          queuedUnreadCount == null
            ? incoming
            : {
                ...incoming,
                unreadCount: Number(queuedUnreadCount),
              };

        if (queuedUnreadCount != null) {
          unreadCountUpdatesRef.current.delete(unreadUpdateKey);
        }

        const existingIndex = messages.findIndex(
          (message) =>
            (resolvedIncoming.id != null &&
              String(message.id) === String(resolvedIncoming.id)) ||
            (resolvedIncoming.clientMessageKey &&
              message.clientMessageKey === resolvedIncoming.clientMessageKey),
        );

        if (existingIndex < 0) {
          return {
            ...previous,
            [roomId]: [...messages, resolvedIncoming],
          };
        }

        const nextMessages = [...messages];
        const existingMessage = messages[existingIndex];
        const existingUnreadCount = Number(existingMessage.unreadCount ?? 0);
        const incomingUnreadCount = Number(
          resolvedIncoming.unreadCount ?? existingUnreadCount,
        );
        nextMessages[existingIndex] = {
          ...existingMessage,
          ...resolvedIncoming,
          unreadCount:
            existingMessage.pending && queuedUnreadCount == null
              ? incomingUnreadCount
              : Math.min(existingUnreadCount, incomingUnreadCount),
          reactions:
            resolvedIncoming.realtimeEvent &&
            Object.keys(resolvedIncoming.reactions ?? {}).length === 0
              ? (existingMessage.reactions ?? {})
              : resolvedIncoming.reactions,
          pending: false,
          failed: false,
        };

        return {
          ...previous,
          [roomId]: nextMessages,
        };
      });

      setRooms((previous) =>
        previous.map((room) =>
          room.id === roomId
            ? {
                ...room,
                lastMessage: isCreatedEvent
                  ? incoming.type === "IMAGE"
                    ? "사진을 보냈습니다."
                    : incoming.type === "AI_RESULT"
                      ? "AI 영화 추천이 도착했습니다."
                      : incoming.type === "AI_CONFIRMED"
                        ? incoming.movie?.title
                          ? `${incoming.movie.title}가 최종 영화로 확정되었습니다.`
                          : "AI 추천 영화가 최종 확정되었습니다."
                        : incoming.content || room.lastMessage
                  : room.lastMessage,
                unreadCount: !isCreatedEvent
                  ? (room.unreadCount ?? 0)
                  : areRoomNotificationsMuted(room)
                    ? 0
                    : String(roomId) === String(selectedRoomId) ||
                        String(incoming.senderId) === String(userProfile.id)
                      ? 0
                      : (room.unreadCount ?? 0) + 1,
              }
            : room,
        ),
      );
    },
    [acknowledgeRoomRead, selectedRoomId, userProfile.id],
  );

  const handleRealtimeTyping = useCallback(
    (payload) => {
      const userId = payload?.userId ?? payload?.senderId;
      const roomId = payload?.roomId;

      if (!userId || userId === userProfile.id || roomId !== selectedRoomId)
        return;

      const timerKey = `${roomId}:${userId}`;
      window.clearTimeout(typingTimersRef.current.get(timerKey));

      setTypingUsers((previous) => {
        const withoutUser = previous.filter((user) => user.id !== userId);
        return payload.typing === false
          ? withoutUser
          : [
              ...withoutUser,
              { id: userId, nickname: payload.nickname ?? "참여자" },
            ];
      });

      if (payload.typing !== false) {
        const timer = window.setTimeout(() => {
          setTypingUsers((previous) =>
            previous.filter((user) => user.id !== userId),
          );
          typingTimersRef.current.delete(timerKey);
        }, 5500);
        typingTimersRef.current.set(timerKey, timer);
      }
    },
    [selectedRoomId, userProfile.id],
  );

  const handleRealtimeReaction = useCallback((payload) => {
    const roomId = payload?.roomId;
    const messageId = payload?.messageId;
    const emoji = payload?.emoji;
    const userIds = Array.isArray(payload?.userIds) ? payload.userIds : [];

    if (!roomId || !messageId || !emoji) return;

    setMessagesByRoom((previous) => {
      const roomMessages = previous[roomId] ?? [];
      const messageIndex = roomMessages.findIndex(
        (message) => String(message.id) === String(messageId),
      );

      if (messageIndex < 0) return previous;

      const nextMessages = [...roomMessages];
      const target = nextMessages[messageIndex];
      const reactions = { ...(target.reactions ?? {}) };

      if (userIds.length > 0) reactions[emoji] = userIds;
      else delete reactions[emoji];

      nextMessages[messageIndex] = { ...target, reactions };

      return {
        ...previous,
        [roomId]: nextMessages,
      };
    });
  }, []);

  const handleRealtimeRead = useCallback((payload) => {
    const roomId = payload?.roomId;
    const unreadCounts = payload?.unreadCounts;

    if (!roomId || !unreadCounts || typeof unreadCounts !== "object") return;

    setMessagesByRoom((previous) => {
      const roomMessages = previous[roomId] ?? [];
      const knownIds = new Set(
        roomMessages.map((message) => String(message.id)),
      );
      Object.entries(unreadCounts).forEach(([messageId, count]) => {
        if (!knownIds.has(String(messageId))) {
          unreadCountUpdatesRef.current.set(
            `${roomId}:${messageId}`,
            Number(count),
          );
        }
      });
      let changed = false;
      const nextMessages = roomMessages.map((message) => {
        const nextCount =
          unreadCounts[message.id] ?? unreadCounts[String(message.id)];
        if (nextCount == null) {
          return message;
        }
        unreadCountUpdatesRef.current.delete(`${roomId}:${message.id}`);
        const currentCount = Number(message.unreadCount ?? nextCount);
        const resolvedCount = Math.min(currentCount, Number(nextCount));
        if (resolvedCount === currentCount) return message;
        changed = true;
        return { ...message, unreadCount: resolvedCount };
      });

      return changed ? { ...previous, [roomId]: nextMessages } : previous;
    });
  }, []);

  const handleRealtimeRoomEvent = useCallback(
    (payload) => {
      const roomId = payload?.roomId;
      const eventType = payload?.eventType;
      if (!roomId || !eventType) return;

      const currentMembers = Number(payload.currentMembers);
      const hasCurrentMembers = Number.isFinite(currentMembers);

      if (eventType === "AI_ANALYSIS_STARTED") {
        setAiAnalyzingRoomId(roomId);
        return;
      }

      if (
        eventType === "AI_ANALYSIS_COMPLETED" ||
        eventType === "AI_ANALYSIS_FAILED"
      ) {
        if (eventType === "AI_ANALYSIS_COMPLETED" && payload.recommendation) {
          handleRealtimeMessage(payload.recommendation);
        }
        setAiAnalyzingRoomId((current) =>
          String(current) === String(roomId) ? null : current,
        );
        return;
      }

      const refreshSelectedRoomMembers = () => {
        if (
          USE_MOCK_CHAT ||
          !authSession?.accessToken ||
          String(selectedRoomId) !== String(roomId)
        ) {
          return;
        }

        getRoomMembers(authSession.accessToken, roomId)
          .then((serverMembers) => {
            setBaseMembers(serverMembers);
            setPresenceDirectory((previous) => ({
              ...previous,
              ...createPresenceDirectory(serverMembers),
            }));
          })
          .catch((error) => {
            if (error?.name !== "AbortError") {
              console.error("참여자 실시간 동기화 실패:", error);
            }
          });
      };

      if (eventType === "ROOM_UPDATED") {
        setRooms((previous) =>
          previous.map((room) =>
            String(room.id) === String(roomId)
              ? { ...room, name: payload.roomName || room.name }
              : room,
          ),
        );
        return;
      }

      if (eventType === "DECISION_CONFIRMED") {
        setRooms((previous) =>
          previous.map((room) =>
            String(room.id) === String(roomId)
              ? {
                  ...room,
                  confirmedMovieKey: payload.movieKey,
                  confirmedMovieTitle: payload.movieTitle,
                  lastMessage: payload.movieTitle
                    ? `${payload.movieTitle}가 최종 영화로 확정되었습니다.`
                    : "AI 추천 영화가 최종 확정되었습니다.",
                  decisionMessageId: payload.decisionMessageId,
                  decisionConfirmedAt: payload.decisionConfirmedAt,
                }
              : room,
          ),
        );
        setConfirmingMovieKey(null);
        return;
      }

      if (eventType === "DECISION_ALL_READ") {
        setRooms((previous) =>
          previous.map((room) =>
            String(room.id) === String(roomId)
              ? { ...room, scheduledCloseAt: payload.scheduledCloseAt }
              : room,
          ),
        );
        return;
      }

      if (eventType === "MEMBER_JOINED") {
        setRooms((previous) =>
          previous.map((room) =>
            String(room.id) === String(roomId)
              ? {
                  ...room,
                  memberCount: hasCurrentMembers
                    ? currentMembers
                    : (room.memberCount ?? 0) + 1,
                }
              : room,
          ),
        );
        refreshSelectedRoomMembers();
        return;
      }

      if (eventType === "MEMBER_LEFT") {
        setBaseMembers((previous) =>
          previous.filter(
            (member) => String(member.id) !== String(payload.actorId),
          ),
        );
        setRooms((previous) =>
          previous.map((room) =>
            String(room.id) === String(roomId)
              ? {
                  ...room,
                  memberCount: hasCurrentMembers
                    ? currentMembers
                    : Math.max(0, (room.memberCount ?? 1) - 1),
                }
              : room,
          ),
        );

        if (String(payload.actorId) !== String(userProfile.id)) {
          refreshSelectedRoomMembers();
        }

        if (String(payload.actorId) !== String(userProfile.id)) return;
      }

      if (eventType === "MEMBER_KICKED") {
        const targetMemberId =
          payload.targetMemberId ?? payload.memberId ?? payload.targetUserId;

        if (targetMemberId == null) return;

        setBaseMembers((previous) =>
          previous.filter(
            (member) => String(member.id) !== String(targetMemberId),
          ),
        );
        setRooms((previous) =>
          previous.map((room) =>
            String(room.id) === String(roomId)
              ? {
                  ...room,
                  memberCount: hasCurrentMembers
                    ? currentMembers
                    : Math.max(0, (room.memberCount ?? 1) - 1),
                }
              : room,
          ),
        );

        if (String(targetMemberId) !== String(userProfile.id)) {
          refreshSelectedRoomMembers();
          return;
        }

        setKickedNotice({
          roomId,
          roomName: payload.roomName ?? "채팅방",
          reason: payload.reason?.trim() ?? "",
        });
        setRooms((previous) =>
          previous.filter((room) => String(room.id) !== String(roomId)),
        );
        setMessagesByRoom((previous) => {
          const next = { ...previous };
          delete next[roomId];
          delete next[String(roomId)];
          return next;
        });
        setSelectedRoomId(null);
        setMemberDrawerOpen(false);
        setWorkspaceMode(isGuest ? "chat" : "home");
        setModal(null);
        return;
      }

      if (
        eventType === "ROOM_DELETED" ||
        (eventType === "MEMBER_LEFT" &&
          String(payload.actorId) === String(userProfile.id))
      ) {
        setRooms((previous) =>
          previous.filter((room) => String(room.id) !== String(roomId)),
        );
        setMessagesByRoom((previous) => {
          const next = { ...previous };
          delete next[roomId];
          delete next[String(roomId)];
          return next;
        });
        setSelectedRoomId((current) =>
          String(current) === String(roomId) ? null : current,
        );
        setWorkspaceMode(isGuest ? "chat" : "home");
        setModal(null);
      }
    },
    [
      authSession?.accessToken,
      handleRealtimeMessage,
      isGuest,
      selectedRoomId,
      userProfile.id,
    ],
  );

  const handleRealtimeUserEvent = useCallback(
    (payload) => {
      if (USE_MOCK_CHAT || isGuest || !payload?.eventType) return;

      window.clearTimeout(realtimeUserRefreshTimerRef.current);
      realtimeUserRefreshTimerRef.current = window.setTimeout(() => {
        if (payload.eventType === "FRIENDS_CHANGED") {
          refreshFriends().catch((error) => {
            if (error?.name !== "AbortError") {
              console.error("친구 실시간 동기화 실패:", error);
            }
          });
        }

        if (
          payload.eventType === "NOTIFICATIONS_CHANGED" ||
          payload.eventType === "FRIENDS_CHANGED"
        ) {
          refreshNotifications(undefined, notificationPage, true).catch(
            (error) => {
              if (error?.name !== "AbortError") {
                console.error("알림 실시간 동기화 실패:", error);
              }
            },
          );
        }
      }, 100);
    },
    [isGuest, notificationPage, refreshFriends, refreshNotifications],
  );

  useEffect(
    () => () => window.clearTimeout(realtimeUserRefreshTimerRef.current),
    [],
  );

  const {
    connectionState: chatConnectionState,
    sendMessage: sendRealtimeMessage,
    sendTyping: sendRealtimeTyping,
    sendReaction: sendRealtimeReaction,
    sendPresence: sendRealtimePresence,
  } = useRealtimeChat({
    accessToken: USE_MOCK_CHAT ? null : authSession?.accessToken,
    roomIds: rooms.map((room) => room.id),
    onMessage: handleRealtimeMessage,
    onTyping: handleRealtimeTyping,
    onReaction: handleRealtimeReaction,
    onRead: handleRealtimeRead,
    onPresence: applyRealtimePresence,
    onRoomEvent: handleRealtimeRoomEvent,
    onUserEvent: handleRealtimeUserEvent,
  });

  useEffect(() => {
    if (
      USE_MOCK_CHAT ||
      chatConnectionState !== "connected" ||
      !authSession?.accessToken
    ) {
      return undefined;
    }

    const controller = new AbortController();
    const refreshTimer = window.setTimeout(() => {
      sendRealtimePresence({
        presence: PRESENCE_KEYS.has(userProfile.presence)
          ? userProfile.presence
          : "ONLINE",
      });

      if (!isGuest) {
        refreshFriends(controller.signal).catch((error) => {
          if (error?.name !== "AbortError") {
            console.error("실시간 연결 후 친구 상태 동기화 실패:", error);
          }
        });
      }

      if (selectedRoomId) {
        getRoomMembers(
          authSession.accessToken,
          selectedRoomId,
          controller.signal,
        )
          .then((serverMembers) => {
            setBaseMembers(serverMembers);
            setPresenceDirectory((previous) => ({
              ...previous,
              ...createPresenceDirectory(serverMembers),
            }));
          })
          .catch((error) => {
            if (error?.name !== "AbortError") {
              console.error("실시간 연결 후 참여자 상태 동기화 실패:", error);
            }
          });
      }
    }, 120);

    return () => {
      window.clearTimeout(refreshTimer);
      controller.abort();
    };
  }, [chatConnectionState]);

  useEffect(() => {
    if (USE_MOCK_CHAT || !authSession?.accessToken) return undefined;

    const controller = new AbortController();

    getMyRooms(authSession.accessToken, controller.signal)
      .then((serverRooms) => {
        setRooms(serverRooms);

        if (isGuest && serverRooms.length === 1) {
          setSelectedRoomId(serverRooms[0].id);
          setWorkspaceMode("chat");
        }
      })
      .catch((error) => {
        if (error?.name !== "AbortError") {
          console.error("채팅방 목록 조회 실패:", error);
        }
      });

    return () => controller.abort();
  }, [authSession?.accessToken, isGuest]);

  useEffect(() => {
    if (USE_MOCK_CHAT || !authSession?.accessToken || !selectedRoomId)
      return undefined;

    const controller = new AbortController();

    Promise.all([
      getRoomMessages(
        authSession.accessToken,
        selectedRoomId,
        controller.signal,
      ),
      getRoomMembers(
        authSession.accessToken,
        selectedRoomId,
        controller.signal,
      ),
    ])
      .then(([serverMessages, serverMembers]) => {
        setMessagesByRoom((previous) => ({
          ...previous,
          [selectedRoomId]: serverMessages,
        }));
        setBaseMembers(serverMembers);
        setPresenceDirectory((previous) => ({
          ...previous,
          ...createPresenceDirectory(serverMembers),
        }));
      })
      .catch((error) => {
        if (error?.name !== "AbortError") {
          console.error("채팅방 데이터 조회 실패:", error);
        }
      });

    return () => controller.abort();
  }, [authSession?.accessToken, selectedRoomId]);

  useEffect(() => {
    setTypingUsers([]);
  }, [selectedRoomId]);

  useEffect(
    () => () => {
      typingTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      typingTimersRef.current.clear();
    },
    [],
  );

  const [localTyping, setLocalTyping] = useState(false);

  const [messageSearchOpen, setMessageSearchOpen] = useState(false);

  const [messageSearchQuery, setMessageSearchQuery] = useState("");

  const [messageSearchIndex, setMessageSearchIndex] = useState(0);

  const [aiAnalyzingRoomId, setAiAnalyzingRoomId] = useState(null);

  const [confirmingMovieKey, setConfirmingMovieKey] = useState(null);

  const [memberDrawerOpen, setMemberDrawerOpen] = useState(false);

  const [modal, setModal] = useState(null);

  const [accountActionSubmitting, setAccountActionSubmitting] = useState(false);

  const [accountActionError, setAccountActionError] = useState("");

  const [kickTarget, setKickTarget] = useState(null);

  const [kickedNotice, setKickedNotice] = useState(null);

  const processedRoomEventIds = useRef(new Set());

  const [aiDetailMovie, setAiDetailMovie] = useState(null);

  useEffect(() => {
    const supportedEvents = new Set([
      "MEMBER_JOINED",
      "MEMBER_LEFT",
      "MEMBER_KICKED",
    ]);

    const applyRoomMemberEvent = (payload) => {
      if (!payload || !supportedEvents.has(payload.type) || !payload.roomId)
        return;

      const eventId =
        payload.eventId ??
        `${payload.type}-${payload.roomId}-${payload.memberId}-${Date.now()}`;
      if (processedRoomEventIds.current.has(eventId)) return;
      processedRoomEventIds.current.add(eventId);
      const eventConfig = {
        MEMBER_JOINED: {
          content: `${payload.memberName}님이 입장했습니다.`,
          systemEvent: "JOIN",
          memberDelta: 1,
        },
        MEMBER_LEFT: {
          content: `${payload.memberName}님이 퇴장했습니다.`,
          systemEvent: "LEAVE",
          memberDelta: -1,
        },
        MEMBER_KICKED: {
          content: `${payload.memberName}님이 강퇴당했습니다.`,
          systemEvent: "KICK",
          memberDelta: -1,
        },
      }[payload.type];

      setMessagesByRoom((previous) => {
        const roomMessages = previous[payload.roomId] ?? [];
        if (roomMessages.some((message) => message.eventId === eventId))
          return previous;

        return {
          ...previous,
          [payload.roomId]: [
            ...roomMessages,
            {
              id: eventId,
              eventId,
              senderId: 0,
              senderName: "System",
              content: eventConfig.content,
              sentAt: "",
              type: "SYSTEM",
              systemEvent: eventConfig.systemEvent,
            },
          ],
        };
      });

      setBaseMembers((previous) => {
        if (payload.type === "MEMBER_JOINED") {
          if (previous.some((member) => member.id === payload.memberId))
            return previous;
          return [
            ...previous,
            payload.member ?? {
              id: payload.memberId,
              nickname: payload.memberName,
              role: "MEMBER",
              presence: "ONLINE",
              profileImageUrl: null,
              statusMessage: "",
            },
          ];
        }

        return previous.filter((member) => member.id !== payload.memberId);
      });

      const currentUserRemoved =
        payload.memberId === userProfile.id &&
        (payload.type === "MEMBER_LEFT" || payload.type === "MEMBER_KICKED");

      setRooms((previous) =>
        currentUserRemoved
          ? previous.filter((room) => room.id !== payload.roomId)
          : previous.map((room) =>
              room.id === payload.roomId
                ? {
                    ...room,
                    memberCount: Math.max(
                      0,
                      (room.memberCount ?? 0) + eventConfig.memberDelta,
                    ),
                  }
                : room,
            ),
      );

      if (
        payload.type !== "MEMBER_KICKED" ||
        payload.memberId !== userProfile.id
      ) {
        if (currentUserRemoved) {
          setSelectedRoomId(null);
          setMemberDrawerOpen(false);
          setWorkspaceMode("home");
        }
        return;
      }

      setKickedNotice({
        roomId: payload.roomId,
        roomName: payload.roomName,
        reason: payload.reason?.trim() ?? "",
      });
      setSelectedRoomId(null);
      setMemberDrawerOpen(false);
      setWorkspaceMode("home");
    };

    const handleWindowMemberEvent = (event) =>
      applyRoomMemberEvent(event.detail);
    window.addEventListener(
      "meetuplog:room-member-event",
      handleWindowMemberEvent,
    );

    let roomEventChannel = null;
    if ("BroadcastChannel" in window) {
      roomEventChannel = new BroadcastChannel("meetuplog-room-events");
      roomEventChannel.addEventListener("message", (event) => {
        applyRoomMemberEvent(event.data);
      });
    }

    return () => {
      window.removeEventListener(
        "meetuplog:room-member-event",
        handleWindowMemberEvent,
      );
      roomEventChannel?.close();
    };
  }, [userProfile.id]);

  const [replyTarget, setReplyTarget] = useState(null);

  const [editingMessage, setEditingMessage] = useState(null);

  const [editMessageDraft, setEditMessageDraft] = useState("");

  const [deleteMessageTarget, setDeleteMessageTarget] = useState(null);

  const selectedRoom = useMemo(() => {
    if (selectedRoomId === null) {
      return null;
    }

    return rooms.find((room) => room.id === selectedRoomId) ?? null;
  }, [rooms, selectedRoomId]);

  const members = useMemo(() => {
    return baseMembers.map((member) => {
      if (member.id !== userProfile.id) {
        return {
          ...member,
          presence: resolvePresence(presenceDirectory, member),
        };
      }

      return {
        ...member,
        nickname: userProfile.nickname,
        presence: userProfile.presence,
        profileImageUrl: userProfile.profileImageUrl,
        statusMessage: userProfile.statusMessage,
      };
    });
  }, [baseMembers, presenceDirectory, userProfile]);

  const roomTheme = selectedRoom
    ? getRoomTheme(selectedRoom.topicType)
    : getRoomTheme("ETC");

  const currentMessages = selectedRoom
    ? (messagesByRoom[selectedRoom.id] ?? [])
    : [];

  const aiDetailMovieKey = aiDetailMovie
    ? String(
        aiDetailMovie.tmdbId ??
          aiDetailMovie.movieId ??
          aiDetailMovie.id ??
          aiDetailMovie.rank,
      )
    : null;

  const aiDetailIsConfirmed = Boolean(
    aiDetailMovieKey &&
    selectedRoom?.confirmedMovieKey &&
    String(selectedRoom.confirmedMovieKey) === aiDetailMovieKey,
  );

  const aiDetailDirectors = normalizeCreditNames(
    aiDetailMovie?.directors ?? aiDetailMovie?.director,
  );
  const aiDetailCast = normalizeCreditNames(aiDetailMovie?.cast);
  const aiDetailProviders = Array.from(
    new Map(
      (aiDetailMovie?.providers ?? [])
        .filter((provider) => provider?.name)
        .map((provider) => [
          provider.name,
          {
            ...provider,
            logoUrl:
              provider.logoUrl ??
              (provider.logoPath
                ? `https://image.tmdb.org/t/p/w92${provider.logoPath}`
                : null),
          },
        ]),
    ).values(),
  );

  const aiDetailWatchLinks = getMovieWatchLinks(aiDetailMovie);

  const deferredMessageSearchQuery = useDeferredValue(messageSearchQuery);

  const messageSearchEntries = useMemo(() => {
    if (!messageSearchOpen) return [];

    return currentMessages.reduce((entries, message) => {
      if (
        !message.deleted &&
        message.type !== "SYSTEM" &&
        message.type !== "AI_RESULT"
      ) {
        entries.push({
          id: message.id,
          searchableText: normalizeMessageSearchText(
            [message.content, message.senderName].filter(Boolean).join(" "),
          ),
        });
      }

      return entries;
    }, []);
  }, [currentMessages, messageSearchOpen]);

  const messageSearchResults = useMemo(() => {
    const query = normalizeMessageSearchText(deferredMessageSearchQuery);
    if (!messageSearchOpen || !query) return [];

    return messageSearchEntries
      .filter(({ searchableText }) => searchableText.includes(query))
      .map(({ id }) => id);
  }, [deferredMessageSearchQuery, messageSearchEntries, messageSearchOpen]);

  useEffect(() => {
    setMessageSearchIndex((previous) => {
      if (messageSearchResults.length === 0) return 0;
      return Math.min(previous, messageSearchResults.length - 1);
    });
  }, [messageSearchResults.length]);

  const closeMessageSearch = useCallback(() => {
    setMessageSearchOpen(false);
    setMessageSearchQuery("");
    setMessageSearchIndex(0);
  }, []);

  const openMessageSearch = useCallback(() => {
    if (!selectedRoom?.id || workspaceMode !== "chat") return;
    setMessageSearchOpen(true);
  }, [selectedRoom?.id, workspaceMode]);

  const moveMessageSearch = useCallback(
    (direction) => {
      setMessageSearchIndex((previous) => {
        const count = messageSearchResults.length;
        if (count === 0) return 0;
        return (previous + direction + count) % count;
      });
    },
    [messageSearchResults.length],
  );

  useEffect(() => {
    const handleFindShortcut = (event) => {
      const findShortcut =
        (event.ctrlKey || event.metaKey) &&
        event.key.toLocaleLowerCase() === "f";

      if (findShortcut && selectedRoom?.id && workspaceMode === "chat") {
        event.preventDefault();
        setMessageSearchOpen(true);
        return;
      }

      if (event.key === "Escape" && messageSearchOpen) {
        event.preventDefault();
        closeMessageSearch();
      }
    };

    window.addEventListener("keydown", handleFindShortcut);
    return () => window.removeEventListener("keydown", handleFindShortcut);
  }, [closeMessageSearch, messageSearchOpen, selectedRoom?.id, workspaceMode]);

  useEffect(() => {
    if (USE_MOCK_CHAT || !authSession?.accessToken || !selectedRoom?.id) {
      return;
    }

    const latestMessage = findLastMatching(
      currentMessages,
      (message) => Number.isFinite(Number(message.id)) && !message.pending,
    );

    if (!latestMessage) return;

    const roomKey = String(selectedRoom.id);
    const messageKey = String(latestMessage.id);
    if (lastReadSentRef.current.get(roomKey) === messageKey) return;

    lastReadSentRef.current.set(roomKey, messageKey);
    markRoomMessagesRead(
      authSession.accessToken,
      selectedRoom.id,
      Number(latestMessage.id),
    )
      .then(handleRealtimeRead)
      .catch((error) => {
        if (lastReadSentRef.current.get(roomKey) === messageKey) {
          lastReadSentRef.current.delete(roomKey);
        }
        if (error?.name !== "AbortError") {
          console.error("채팅방 읽음 처리 실패:", error);
        }
      });
  }, [
    authSession?.accessToken,
    currentMessages,
    handleRealtimeRead,
    selectedRoom?.id,
  ]);

  const isOwner =
    selectedRoom?.myRole === "OWNER" ||
    members.some(
      (member) => member.id === userProfile.id && member.role === "OWNER",
    ) ||
    (USE_MOCK_CHAT && userProfile.role === "OWNER");

  const aiAnalyzing = selectedRoom
    ? String(aiAnalyzingRoomId) === String(selectedRoom.id)
    : false;

  const unreadNotificationCount = USE_MOCK_CHAT
    ? notifications.filter((notification) => !notification.read).length
    : notificationSummary.unreadCount;

  const participantTypingUsers = useMemo(() => {
    const map = new Map();

    typingUsers.forEach((user) => {
      map.set(user.id, user);
    });

    if (localTyping) {
      map.set(userProfile.id, {
        id: userProfile.id,
        nickname: userProfile.nickname,
      });
    }

    return Array.from(map.values());
  }, [typingUsers, localTyping, userProfile.id, userProfile.nickname]);

  const handleSelectRoom = (roomId) => {
    setLocalTyping(false);
    setReplyTarget(null);
    setEditingMessage(null);
    setDeleteMessageTarget(null);
    closeMessageSearch();
    setSelectedRoomId(roomId);
    setWorkspaceMode("chat");

    setRooms((previous) =>
      previous.map((room) =>
        room.id === roomId
          ? {
              ...room,
              unreadCount: 0,
            }
          : room,
      ),
    );
  };

  const handleTypingChange = useCallback(
    (typing) => {
      setLocalTyping(typing);

      if (USE_MOCK_CHAT || !selectedRoomId) return;

      sendRealtimeTyping({
        roomId: selectedRoomId,
        userId: userProfile.id,
        nickname: userProfile.nickname,
        typing,
      });
    },
    [selectedRoomId, sendRealtimeTyping, userProfile.id, userProfile.nickname],
  );

  const handleHome = () => {
    if (isGuest) {
      setSelectedRoomId(sessionRooms[0]?.id ?? null);
      setWorkspaceMode("chat");
      return;
    }

    setLocalTyping(false);
    setReplyTarget(null);
    setEditingMessage(null);
    setDeleteMessageTarget(null);
    closeMessageSearch();
    setSelectedRoomId(null);
    setWorkspaceMode("home");
  };

  const handleChangeMenu = (menu) => {
    setActiveMenu(menu);
  };

  const openWorkspacePage = (nextMode) => {
    setReturnWorkspaceMode(workspaceMode);

    setWorkspaceMode(nextMode);
  };

  const closeWorkspacePage = () => {
    setWorkspaceMode(returnWorkspaceMode);
  };

  const handlePresenceChange = (presence) => {
    if (!PRESENCE_KEYS.has(presence)) {
      return;
    }

    const identities = getPresenceIdentities(userProfile);

    setUserProfile((previous) => ({
      ...previous,
      presence,
    }));

    if (identities.length > 0) {
      setPresenceDirectory((previous) => {
        const next = { ...previous };
        identities.forEach((identity) => {
          next[identity] = presence;
        });
        return next;
      });

      const payload = {
        identity: identities[0],
        userId: userProfile.id,
        accountId: userProfile.accountId,
        email: userProfile.email,
        presence,
        changedAt: new Date().toISOString(),
      };

      window.dispatchEvent(
        new CustomEvent("meetuplog:presence-change", {
          detail: payload,
        }),
      );

      if ("BroadcastChannel" in window) {
        const channel = new BroadcastChannel("meetuplog-presence");
        channel.postMessage(payload);
        channel.close();
      }
    }

    if (!USE_MOCK_CHAT) {
      sendRealtimePresence({ presence });
    }
  };

  const handleProfileSave = async (values) => {
    const updatedProfile = await updateMyProfile(
      authSession.accessToken,
      values,
    );

    setUserProfile((previous) => ({
      ...previous,
      ...updatedProfile,
      id: updatedProfile.userId ?? updatedProfile.id ?? previous.id,
      role: previous.role,
      presence: previous.presence,
    }));

    setBaseMembers((previous) =>
      previous.map((member) =>
        member.id === userProfile.id
          ? {
              ...member,
              nickname: updatedProfile.nickname,
              profileImageUrl: updatedProfile.profileImageUrl,
              statusMessage: updatedProfile.statusMessage,
            }
          : member,
      ),
    );

    setWorkspaceMode(returnWorkspaceMode);
    return updatedProfile;
  };

  const handleGuestConversion = async (values) => {
    const response = await convertGuestAccount(authSession.accessToken, values);

    const nextUser = {
      ...userProfile,
      id: response?.userId ?? response?.id ?? userProfile.id,
      accountId: response?.accountId ?? userProfile.accountId,
      email: response?.email ?? values.email,
      nickname: response?.nickname ?? values.nickname,
      accountType: response?.accountType ?? "MEMBER",
      role: "MEMBER",
      statusMessage: response?.statusMessage ?? "",
      kakaoLinked: false,
    };

    const nextSession = {
      ...authSession,
      type: "member",
      provider: "LOCAL",
      accessToken:
        response?.accountToken ??
        response?.accessToken ??
        authSession.accessToken,
      user: nextUser,
    };

    onSessionChange?.(nextSession, true);
    return nextSession;
  };

  const updateMessageInRoom = (roomId, messageId, updater) => {
    setMessagesByRoom((previous) => ({
      ...previous,

      [roomId]: (previous[roomId] ?? []).map((message) =>
        message.id === messageId ? updater(message) : message,
      ),
    }));
  };

  const scheduleMockReadReceipts = (roomId, messageId) => {
    const delays = [1800, 3600, 5600];

    delays.forEach((delay) => {
      window.setTimeout(() => {
        updateMessageInRoom(roomId, messageId, (message) => ({
          ...message,

          unreadCount: Math.max(0, Number(message.unreadCount ?? 0) - 1),
        }));
      }, delay);
    });
  };

  const handleSend = (content, replyToId = null) => {
    if (!selectedRoom || !content?.trim()) return;

    const now = new Date();
    const clientMessageKey =
      globalThis.crypto?.randomUUID?.() ??
      `message-${userProfile.id}-${now.getTime()}`;
    const messageId = `pending-${clientMessageKey}`;
    const unreadCount = Math.max(0, members.length - 1);
    const newMessage = {
      id: messageId,
      roomId: selectedRoom.id,
      senderId: userProfile.id,
      senderName: userProfile.nickname,
      content: content.trim(),
      sentAt: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      type: "TEXT",
      unreadCount,
      replyToId,
      clientMessageKey,
      pending: !USE_MOCK_CHAT,
    };

    setMessagesByRoom((previous) => ({
      ...previous,
      [selectedRoom.id]: [...(previous[selectedRoom.id] ?? []), newMessage],
    }));

    setRooms((previous) =>
      previous.map((room) =>
        room.id === selectedRoom.id
          ? {
              ...room,
              lastMessage: content.trim(),
            }
          : room,
      ),
    );

    setReplyTarget(null);
    setEditingMessage(null);

    if (USE_MOCK_CHAT && unreadCount > 0) {
      scheduleMockReadReceipts(selectedRoom.id, messageId);
    }

    if (!USE_MOCK_CHAT) {
      const sent = sendRealtimeMessage({
        roomId: selectedRoom.id,
        messageType: "TEXT",
        content: content.trim(),
        replyToMessageId: replyToId,
        clientMessageKey,
      });

      if (!sent) {
        updateMessageInRoom(selectedRoom.id, messageId, (message) => ({
          ...message,
          pending: false,
          failed: true,
        }));
      }
    }
  };

  const handleSendImage = async (attachment, replyToId = null) => {
    if (!selectedRoom || !attachment?.file) {
      return;
    }

    let uploaded;

    if (USE_MOCK_CHAT) {
      const imageUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve(typeof reader.result === "string" ? reader.result : "");
        reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
        reader.readAsDataURL(attachment.file);
      });
      uploaded = {
        imageUrl,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        size: attachment.size,
      };
    } else {
      uploaded = await uploadChatImage(
        authSession.accessToken,
        selectedRoom.id,
        attachment.file,
      );
    }

    const now = new Date();

    const time = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes(),
    ).padStart(2, "0")}`;

    const clientMessageKey =
      globalThis.crypto?.randomUUID?.() ??
      `image-${userProfile.id}-${now.getTime()}`;

    const messageId = USE_MOCK_CHAT
      ? Date.now()
      : `pending-${clientMessageKey}`;

    const unreadCount = Math.max(0, members.length - 1);

    const newMessage = {
      id: messageId,
      senderId: userProfile.id,
      senderName: userProfile.nickname,
      content: uploaded.fileName || "사진",
      sentAt: time,
      type: "IMAGE",
      imageUrl: uploaded.imageUrl,
      imageMimeType: uploaded.mimeType,
      imageSize: uploaded.size,
      unreadCount,
      replyToId,
      clientMessageKey,
      pending: !USE_MOCK_CHAT,
    };

    setMessagesByRoom((previous) => ({
      ...previous,
      [selectedRoom.id]: [...(previous[selectedRoom.id] ?? []), newMessage],
    }));

    setRooms((previous) =>
      previous.map((room) =>
        room.id === selectedRoom.id
          ? {
              ...room,
              lastMessage: "사진을 보냈습니다.",
            }
          : room,
      ),
    );

    setReplyTarget(null);
    setEditingMessage(null);

    if (USE_MOCK_CHAT && unreadCount > 0) {
      scheduleMockReadReceipts(selectedRoom.id, messageId);
    }

    if (!USE_MOCK_CHAT) {
      const sent = sendRealtimeMessage({
        roomId: selectedRoom.id,
        messageType: "IMAGE",
        content: uploaded.fileName || "사진",
        imageUrl: uploaded.serverImageUrl ?? uploaded.imageUrl,
        imageMimeType: uploaded.mimeType,
        imageSize: uploaded.size,
        replyToMessageId: replyToId,
        clientMessageKey,
      });

      if (!sent) {
        updateMessageInRoom(selectedRoom.id, messageId, (message) => ({
          ...message,
          pending: false,
          failed: true,
        }));
        throw new Error("실시간 채팅 연결을 확인한 뒤 다시 보내주세요.");
      }
    }
  };

  const handleReplyMessage = (message) => {
    if (!message || message.deleted) {
      return;
    }

    setEditingMessage(null);
    setReplyTarget(message);
  };

  const handleEditMessage = (message) => {
    if (!message || message.deleted || message.senderId !== userProfile.id) {
      return;
    }

    setReplyTarget(null);
    setEditingMessage(message);
    setEditMessageDraft(message.content);
    setModal("EDIT_MESSAGE");
  };

  const handleSaveEdit = async (messageId, content) => {
    if (!selectedRoom) {
      return;
    }

    const roomId = selectedRoom.id;

    try {
      const saved = USE_MOCK_CHAT
        ? { content, edited: true, deleted: false }
        : await editChatMessage(
            authSession.accessToken,
            roomId,
            messageId,
            content,
          );

      updateMessageInRoom(roomId, messageId, (message) => {
        if (message.senderId !== userProfile.id || message.deleted)
          return message;
        return { ...message, ...saved, content, edited: true, pending: false };
      });
    } catch (error) {
      window.alert(error?.message || "메시지를 수정하지 못했습니다.");
      return false;
    }

    setEditingMessage(null);
    setEditMessageDraft("");
    setReplyTarget(null);

    setRooms((previous) =>
      previous.map((room) => {
        if (room.id !== selectedRoom.id) {
          return room;
        }

        const roomMessages = messagesByRoom[selectedRoom.id] ?? [];

        const lastTextMessage = findLastMatching(
          roomMessages,
          (message) => message.type === "TEXT" && !message.deleted,
        );

        if (lastTextMessage?.id !== messageId) {
          return room;
        }

        return {
          ...room,
          lastMessage: content,
        };
      }),
    );

    return true;
  };

  const requestDeleteMessage = (message) => {
    if (!message || message.deleted || message.senderId !== userProfile.id) {
      return;
    }

    setDeleteMessageTarget(message);

    setModal("DELETE_MESSAGE");
  };

  const confirmDeleteMessage = async () => {
    if (!selectedRoom || !deleteMessageTarget) {
      setModal(null);
      return;
    }

    const messageId = deleteMessageTarget.id;

    try {
      if (!USE_MOCK_CHAT) {
        await deleteChatMessage(
          authSession.accessToken,
          selectedRoom.id,
          messageId,
        );
      }
    } catch (error) {
      window.alert(error?.message || "메시지를 삭제하지 못했습니다.");
      return;
    }

    updateMessageInRoom(selectedRoom.id, messageId, (message) => ({
      ...message,
      content: "",
      deleted: true,
      edited: false,
    }));

    if (editingMessage?.id === messageId) {
      setEditingMessage(null);
    }

    if (replyTarget?.id === messageId) {
      setReplyTarget(null);
    }

    setDeleteMessageTarget(null);

    setModal(null);
  };

  const cancelMessageContext = () => {
    setReplyTarget(null);
    setEditingMessage(null);
  };

  const handleToggleReaction = (messageId, emoji) => {
    if (!selectedRoom) {
      return;
    }

    updateMessageInRoom(selectedRoom.id, messageId, (message) => {
      if (message.deleted) {
        return message;
      }

      const reactions = {
        ...(message.reactions ?? {}),
      };

      const currentUsers = Array.isArray(reactions[emoji])
        ? [...reactions[emoji]]
        : [];

      const alreadyReacted = currentUsers.includes(userProfile.id);

      const nextUsers = alreadyReacted
        ? currentUsers.filter((userId) => userId !== userProfile.id)
        : [...currentUsers, userProfile.id];

      if (nextUsers.length === 0) {
        delete reactions[emoji];
      } else {
        reactions[emoji] = nextUsers;
      }

      return {
        ...message,
        reactions,
      };
    });

    if (!USE_MOCK_CHAT) {
      sendRealtimeReaction({
        roomId: selectedRoom.id,
        messageId,
        emoji,
      });
    }
  };

  const handleRecommend = async () => {
    if (
      !selectedRoom ||
      !roomTheme.aiSupported ||
      !isOwner ||
      aiAnalyzingRoomId !== null
    ) {
      return;
    }

    const targetRoomId = selectedRoom.id;

    setAiAnalyzingRoomId(targetRoomId);

    if (USE_MOCK_CHAT) {
      window.setTimeout(() => {
        setAiAnalyzingRoomId(null);
        setMessagesByRoom((previous) => ({
          ...previous,
          [targetRoomId]: [
            ...(previous[targetRoomId] ?? []),
            {
              id: Date.now(),
              type: "AI_RESULT",
              movies: mockAiMovies,
              aiSummary:
                "최근 대화에서 드러난 구성원별 취향을 함께 고려했어요.",
            },
          ],
        }));
      }, 1200);
      return;
    }

    try {
      const result = await requestAiRecommendation(
        authSession.accessToken,
        targetRoomId,
      );
      handleRealtimeMessage(result);
    } catch (error) {
      setAiAnalyzingRoomId((current) =>
        String(current) === String(targetRoomId) ? null : current,
      );
      window.alert(error.message);
    }
  };

  const handleConfirmRecommendation = async (movie) => {
    if (!selectedRoom || !isOwner || selectedRoom.confirmedMovieKey) return;
    const movieKey = String(
      movie.tmdbId ?? movie.movieId ?? movie.id ?? movie.rank,
    );
    setConfirmingMovieKey(movieKey);

    if (USE_MOCK_CHAT) {
      setRooms((previous) =>
        previous.map((room) =>
          room.id === selectedRoom.id
            ? {
                ...room,
                confirmedMovieKey: movieKey,
                confirmedMovieTitle: movie.title,
              }
            : room,
        ),
      );
      setConfirmingMovieKey(null);
      return;
    }

    try {
      await confirmRoomDecision(
        authSession.accessToken,
        selectedRoom.id,
        movie,
      );
    } catch (error) {
      setConfirmingMovieKey(null);
      window.alert(error.message);
    }
  };

  const handleCreateRoom = async ({ name, topicType, maxMembers }) => {
    const safeMaxMembers = Math.min(9, Math.max(2, Number(maxMembers) || 8));

    if (!USE_MOCK_CHAT && authSession?.accessToken) {
      try {
        const newRoom = await createChatRoom(authSession.accessToken, {
          name,
          topicType,
          maxMembers: safeMaxMembers,
        });

        setRooms((previous) => [
          newRoom,
          ...previous.filter((room) => room.id !== newRoom.id),
        ]);
        setMessagesByRoom((previous) => ({
          ...previous,
          [newRoom.id]: previous[newRoom.id] ?? [],
        }));
        setModal(null);
        setActiveMenu("chat");
        setSelectedRoomId(newRoom.id);
        setWorkspaceMode("chat");
        return;
      } catch (error) {
        console.error("채팅방 생성 실패:", error);
        window.alert(error?.message ?? "채팅방을 만들지 못했습니다.");
        return;
      }
    }

    const newRoomId =
      rooms.length > 0 ? Math.max(...rooms.map((room) => room.id)) + 1 : 1;

    const newRoom = {
      id: newRoomId,
      name,
      topicType,

      lastMessage: "새 채팅방이 생성되었습니다.",

      unreadCount: 0,
      memberCount: 1,
      maxMembers: safeMaxMembers,
    };

    setRooms((previous) => [newRoom, ...previous]);

    setMessagesByRoom((previous) => ({
      ...previous,

      [newRoomId]: [
        {
          id: Date.now(),

          senderId: 0,

          senderName: "System",

          content: `${userProfile.nickname}님이 채팅방을 만들었습니다.`,

          sentAt: "",

          type: "SYSTEM",
        },
      ],
    }));

    setModal(null);
    setActiveMenu("chat");
    setSelectedRoomId(newRoomId);
    setWorkspaceMode("chat");
  };

  const handleKickMember = async (member, reason = "") => {
    if (!member) {
      return;
    }

    try {
      if (USE_MOCK_CHAT) {
        const kickPayload = {
          type: "MEMBER_KICKED",
          eventId: `kick-${selectedRoomId}-${member.id}-${Date.now()}`,
          roomId: selectedRoom?.id ?? selectedRoomId,
          roomName: selectedRoom?.name ?? "채팅방",
          memberId: member.id,
          memberName: member.nickname,
          reason: reason.trim(),
        };

        window.dispatchEvent(
          new CustomEvent("meetuplog:room-member-event", {
            detail: kickPayload,
          }),
        );

        if ("BroadcastChannel" in window) {
          const roomEventChannel = new BroadcastChannel(
            "meetuplog-room-events",
          );
          roomEventChannel.postMessage(kickPayload);
          roomEventChannel.close();
        }
      } else {
        await kickRoomMember(
          authSession.accessToken,
          selectedRoomId,
          member.id,
          reason,
        );
      }

      setKickTarget(null);
    } catch (error) {
      window.alert(error.message);
    }
  };

  const handleInviteFriend = async (friend) => {
    if (!friend || !selectedRoomId) return;

    try {
      if (!USE_MOCK_CHAT) {
        await sendRoomMemberInvite(
          authSession.accessToken,
          selectedRoomId,
          friend.id,
        );
      }
      setPendingInvitesByRoom((previous) => {
        const roomInvites = previous[selectedRoomId] ?? [];
        if (roomInvites.includes(friend.id)) return previous;
        return { ...previous, [selectedRoomId]: [...roomInvites, friend.id] };
      });
    } catch (error) {
      window.alert(error.message);
    }
  };

  const issueRoomInviteLink = async () => {
    if (!selectedRoomId || inviteLinkBusy) return;
    setInviteLinkBusy(true);
    try {
      const link = USE_MOCK_CHAT
        ? { invitePath: "/invite/demo-token", maxUses: 50 }
        : await createRoomInviteLink(authSession.accessToken, selectedRoomId, {
            expiresInHours: 24,
            maxUses: 50,
          });
      setInviteLinksByRoom((previous) => ({
        ...previous,
        [selectedRoomId]: link,
      }));
      return link;
    } finally {
      setInviteLinkBusy(false);
    }
  };

  const handleCreateInviteLink = async () => {
    try {
      await issueRoomInviteLink();
    } catch (error) {
      window.alert(error.message);
    }
  };

  const handleLoadActiveInviteLink = async () => {
    if (!selectedRoomId || USE_MOCK_CHAT)
      return inviteLinksByRoom[selectedRoomId] ?? null;
    const activeLink = await getActiveRoomInviteLink(
      authSession.accessToken,
      selectedRoomId,
    );
    setInviteLinksByRoom((previous) => {
      const current = previous[selectedRoomId];
      const next =
        activeLink && current?.inviteId === activeLink.inviteId
          ? {
              ...activeLink,
              invitePath: current.invitePath,
              inviteToken: current.inviteToken,
            }
          : activeLink;
      return { ...previous, [selectedRoomId]: next };
    });
    return activeLink;
  };

  const handleRevokeInviteLink = async () => {
    const inviteLink = inviteLinksByRoom[selectedRoomId];
    if (!inviteLink?.inviteId) return;
    if (!USE_MOCK_CHAT) {
      await revokeRoomInviteLink(
        authSession.accessToken,
        selectedRoomId,
        inviteLink.inviteId,
      );
    }
    setInviteLinksByRoom((previous) => ({
      ...previous,
      [selectedRoomId]: null,
    }));
  };

  const handleUpdateRoomNotification = async (mode) => {
    let setting;
    if (USE_MOCK_CHAT) {
      const now = Date.now();
      const durations = {
        MUTE_30_MINUTES: 30 * 60 * 1000,
        MUTE_1_HOUR: 60 * 60 * 1000,
        MUTE_2_HOURS: 2 * 60 * 60 * 1000,
      };
      setting = {
        notificationSetting: mode === "MUTE_UNTIL_ENABLED" ? "OFF" : "ALL",
        mutedUntil: durations[mode]
          ? new Date(now + durations[mode]).toISOString()
          : null,
        muted: mode !== "ENABLED",
      };
    } else {
      setting = await updateRoomNotificationSetting(
        authSession.accessToken,
        selectedRoomId,
        mode,
      );
    }

    setRooms((previous) =>
      previous.map((room) =>
        room.id === selectedRoomId
          ? {
              ...room,
              notificationSetting: setting.notificationSetting,
              notificationMutedUntil: setting.mutedUntil,
              notificationsMuted: setting.muted,
              unreadCount: setting.muted ? 0 : room.unreadCount,
            }
          : room,
      ),
    );
  };

  const handleLoadRoomNotification = async () => {
    if (USE_MOCK_CHAT) return;
    const setting = await getRoomNotificationSetting(
      authSession.accessToken,
      selectedRoomId,
    );
    setRooms((previous) =>
      previous.map((room) =>
        room.id === selectedRoomId
          ? {
              ...room,
              notificationSetting: setting.notificationSetting,
              notificationMutedUntil: setting.mutedUntil,
              notificationsMuted: setting.muted,
              unreadCount: setting.muted ? 0 : room.unreadCount,
            }
          : room,
      ),
    );
  };

  const handleRenameRoom = async (roomName) => {
    const updatedRoom = USE_MOCK_CHAT
      ? { ...selectedRoom, name: roomName }
      : await updateChatRoom(authSession.accessToken, selectedRoomId, roomName);
    setRooms((previous) =>
      previous.map((room) =>
        room.id === selectedRoomId ? { ...room, ...updatedRoom } : room,
      ),
    );
  };

  const removeRoomFromWorkspace = (roomId) => {
    setRooms((previous) => previous.filter((room) => room.id !== roomId));
    setMessagesByRoom((previous) => {
      const next = { ...previous };
      delete next[roomId];
      return next;
    });
    setSelectedRoomId(null);
    setModal(null);
    setWorkspaceMode(isGuest ? "chat" : "home");
  };

  const handleDeleteRoom = async () => {
    const roomId = selectedRoomId;
    if (!USE_MOCK_CHAT) {
      await deleteChatRoom(authSession.accessToken, roomId);
    }
    removeRoomFromWorkspace(roomId);
  };

  const handleLeaveRoom = async () => {
    const roomId = selectedRoomId;
    if (!USE_MOCK_CHAT) {
      await leaveChatRoom(authSession.accessToken, roomId);
    }
    removeRoomFromWorkspace(roomId);
    if (isGuest) onLogout?.();
  };

  const handleSessionLogout = async () => {
    if (!isGuest) {
      onLogout?.();
      return;
    }

    const roomId = selectedRoomId ?? authSession?.inviteRoomId;
    if (!USE_MOCK_CHAT && roomId) {
      try {
        await leaveChatRoom(authSession.accessToken, roomId);
      } catch (error) {
        if (![400, 403, 404, 409].includes(error?.status)) {
          window.alert(error.message);
          return;
        }
      }
    }

    onLogout?.();
  };

  const handleDismissKickedNotice = () => {
    setKickedNotice(null);
    if (isGuest) onLogout?.();
  };

  const handleAcceptNotification = async (notification) => {
    if (!notification?.actionable) return;
    setNotificationActionBusyId(notification.id);
    try {
      if (notification.actionKind === "FRIEND_REQUEST") {
        const friend = await acceptFriendRequest(
          authSession.accessToken,
          notification.referenceId,
        );
        setBaseFriends((previous) =>
          previous.some((item) => item.id === friend.id)
            ? previous
            : [...previous, friend],
        );
      } else if (notification.actionKind === "ROOM_INVITE") {
        const room = normalizeRoom(
          await acceptRoomMemberInvite(
            authSession.accessToken,
            notification.referenceId,
          ),
        );
        setRooms((previous) =>
          previous.some((item) => item.id === room.id)
            ? previous.map((item) => (item.id === room.id ? room : item))
            : [room, ...previous],
        );
      }
      if (USE_MOCK_CHAT) {
        setNotifications((previous) =>
          previous.map((item) =>
            item.id === notification.id
              ? { ...item, read: true, actionable: false }
              : item,
          ),
        );
      } else {
        await refreshNotifications(undefined, notificationPage, true);
      }
    } catch (error) {
      window.alert(error.message);
    } finally {
      setNotificationActionBusyId(null);
    }
  };

  const handleRejectNotification = async (notification) => {
    if (!notification?.actionable) return;
    setNotificationActionBusyId(notification.id);
    try {
      if (notification.actionKind === "FRIEND_REQUEST") {
        await rejectFriendRequest(
          authSession.accessToken,
          notification.referenceId,
        );
      } else if (notification.actionKind === "ROOM_INVITE") {
        await rejectRoomMemberInvite(
          authSession.accessToken,
          notification.referenceId,
        );
      }
      if (USE_MOCK_CHAT) {
        setNotifications((previous) =>
          previous.map((item) =>
            item.id === notification.id
              ? { ...item, read: true, actionable: false }
              : item,
          ),
        );
      } else {
        await refreshNotifications(undefined, notificationPage, true);
      }
    } catch (error) {
      window.alert(error.message);
    } finally {
      setNotificationActionBusyId(null);
    }
  };

  const handleRemoveFriend = async (friend) => {
    if (!window.confirm(`${friend.nickname}님을 친구 목록에서 삭제할까요?`))
      return;
    try {
      await removeFriend(authSession.accessToken, friend.id);
      setBaseFriends((previous) =>
        previous.filter((item) => item.id !== friend.id),
      );
    } catch (error) {
      window.alert(error.message);
    }
  };

  const handleBlockFriend = async (friend) => {
    const reason = window.prompt(
      `${friend.nickname}님을 차단할 사유를 입력하세요. (선택)`,
      "",
    );
    if (reason === null) return;
    try {
      await blockFriend(authSession.accessToken, friend.id, reason);
      setBaseFriends((previous) =>
        previous.filter((item) => item.id !== friend.id),
      );
    } catch (error) {
      window.alert(error.message);
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    if (USE_MOCK_CHAT) {
      setNotifications((previous) =>
        previous.filter((notification) => notification.id !== notificationId),
      );
      return;
    }

    try {
      await deleteNotification(authSession.accessToken, notificationId);
      const nextPage =
        notifications.length === 1 && notificationPage > 0
          ? notificationPage - 1
          : notificationPage;
      if (nextPage !== notificationPage) setNotificationPage(nextPage);
      await refreshNotifications(undefined, nextPage, true);
    } catch (error) {
      window.alert(error.message);
    }
  };

  const handleMarkNotificationRead = async (notificationId) => {
    const target = notifications.find(
      (notification) => notification.id === notificationId,
    );
    if (!target || target.read) return;

    setNotifications((previous) =>
      previous.map((notification) =>
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification,
      ),
    );
    setNotificationSummary((previous) => ({
      ...previous,
      unreadCount: Math.max(0, previous.unreadCount - 1),
    }));

    if (USE_MOCK_CHAT) return;
    try {
      await markNotificationRead(authSession.accessToken, notificationId);
    } catch (error) {
      await refreshNotifications(undefined, notificationPage, true).catch(
        () => {},
      );
      window.alert(error.message);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    if (USE_MOCK_CHAT) {
      setNotifications((previous) =>
        previous.map((notification) => ({
          ...notification,
          read: true,
        })),
      );
      return;
    }
    try {
      await markAllNotificationsRead(authSession.accessToken);
      await refreshNotifications(undefined, notificationPage, true);
    } catch (error) {
      window.alert(error.message);
    }
  };

  const handleDeleteAllNotifications = async () => {
    if (USE_MOCK_CHAT) {
      setNotifications([]);
      return;
    }
    try {
      await deleteAllNotifications(authSession.accessToken);
      setNotificationPage(0);
      await refreshNotifications(undefined, 0, true);
    } catch (error) {
      window.alert(error.message);
    }
  };

  const renderMainShell = () => {
    if (workspaceMode === "chat" && selectedRoom) {
      return (
        <div className="chat-room-stage" key={selectedRoom.id}>
          <ChatHeader
            room={selectedRoom}
            theme={roomTheme}
            memberCount={members.length}
            isOwner={isOwner}
            onBack={isGuest ? null : handleHome}
            onOpenMembers={() => setMemberDrawerOpen(true)}
            onOpenRoomMenu={() => setModal("ROOM_MENU")}
          />

          <div className="chat-body">
            <div className="conversation-column">
              <RoomThemeBackdrop
                topicType={selectedRoom.topicType}
                roomKey={selectedRoom.id}
              />

              <MessageSearchBar
                open={messageSearchOpen}
                query={messageSearchQuery}
                resultCount={messageSearchResults.length}
                activeIndex={messageSearchIndex}
                onQueryChange={(value) => {
                  setMessageSearchQuery(value);
                  setMessageSearchIndex(0);
                }}
                onPrevious={() => moveMessageSearch(-1)}
                onNext={() => moveMessageSearch(1)}
                onClose={closeMessageSearch}
              />

              <MessageList
                key={selectedRoomId}
                messages={currentMessages}
                currentUserId={userProfile.id}
                onAiDetail={(movie) => setAiDetailMovie(movie)}
                onAiConfirm={handleConfirmRecommendation}
                canConfirmAi={isOwner}
                confirmedMovieKey={selectedRoom.confirmedMovieKey}
                confirmingMovieKey={confirmingMovieKey}
                onReplyMessage={handleReplyMessage}
                onEditMessage={handleEditMessage}
                onDeleteMessage={requestDeleteMessage}
                onToggleReaction={handleToggleReaction}
                searchResultIds={messageSearchResults}
                activeSearchMessageId={
                  messageSearchResults[messageSearchIndex] ?? null
                }
              />

              <TypingIndicator
                typingUsers={typingUsers}
                aiAnalyzing={aiAnalyzing}
              />

              <MessageComposer
                onSend={handleSend}
                onSendImage={handleSendImage}
                onSaveEdit={handleSaveEdit}
                onRecommend={handleRecommend}
                onOpenSearch={openMessageSearch}
                onTypingChange={handleTypingChange}
                onCancelContext={cancelMessageContext}
                replyTarget={replyTarget}
                editingMessage={
                  modal === "EDIT_MESSAGE" ? null : editingMessage
                }
                aiSupported={roomTheme.aiSupported && isOwner}
                aiAnalyzing={aiAnalyzing}
              />
            </div>

            <MemberPanel
              members={members}
              typingUsers={participantTypingUsers}
              isOwner={isOwner}
              variant="desktop"
              onRequestKick={setKickTarget}
              friends={friends}
              onInviteFriend={handleInviteFriend}
              pendingInviteIds={pendingInvitesByRoom[selectedRoomId] ?? []}
              inviteLink={inviteLinksByRoom[selectedRoomId]}
              inviteLinkBusy={inviteLinkBusy}
              onCreateInviteLink={handleCreateInviteLink}
            />
          </div>
        </div>
      );
    }

    if (workspaceMode === "profile-edit") {
      return (
        <div className="chat-room-stage utility-room-stage">
          <header className="chat-header utility-workspace-header">
            <div className="chat-header-left">
              <div className="chat-room-avatar utility-header-avatar">
                <PencilIcon />
              </div>

              <div className="chat-room-info">
                <div className="chat-room-title-row">
                  <h2>프로필 편집</h2>
                </div>

                <div className="room-theme-description">
                  다른 사람에게 보이는 프로필 정보를 관리합니다
                </div>
              </div>
            </div>

            <button
              type="button"
              className="utility-close-button"
              onClick={closeWorkspacePage}
            >
              <CloseIcon />
            </button>
          </header>

          <div className="chat-body">
            <div className="conversation-column utility-conversation-column">
              <ProfileEditWorkspace
                user={userProfile}
                onBack={closeWorkspacePage}
                onSave={handleProfileSave}
                onUploadProfileImage={(file) =>
                  uploadProfileImage(authSession.accessToken, file).then(
                    (profile) => {
                      setUserProfile((previous) => ({
                        ...previous,
                        ...profile,
                        role: previous.role,
                        presence: previous.presence,
                      }));
                      return profile;
                    },
                  )
                }
                onRemoveProfileImage={() =>
                  removeProfileImage(authSession.accessToken).then(
                    (profile) => {
                      setUserProfile((previous) => ({
                        ...previous,
                        ...profile,
                        role: previous.role,
                        presence: previous.presence,
                      }));
                      return profile;
                    },
                  )
                }
                onChangePassword={(values) =>
                  changeMyPassword(authSession.accessToken, values)
                }
                onDeleteAccount={() => {
                  setAccountActionError("");
                  setModal("DELETE_ACCOUNT");
                }}
                onUnlinkKakao={() => {
                  setAccountActionError("");
                  setModal("UNLINK_KAKAO");
                }}
                onConvertGuest={handleGuestConversion}
              />
            </div>
          </div>
        </div>
      );
    }

    if (workspaceMode === "friend-add") {
      return (
        <div className="chat-room-stage utility-room-stage">
          <header className="chat-header utility-workspace-header">
            <div className="chat-header-left">
              <div className="chat-room-avatar utility-header-avatar">
                <UserPlusIcon />
              </div>

              <div className="chat-room-info">
                <div className="chat-room-title-row">
                  <h2>친구 추가</h2>
                </div>

                <div className="room-theme-description">
                  닉네임이나 이메일로 친구를 찾아보세요
                </div>
              </div>
            </div>

            <button
              type="button"
              className="utility-close-button"
              onClick={closeWorkspacePage}
            >
              <CloseIcon />
            </button>
          </header>

          <div className="chat-body">
            <div className="conversation-column utility-conversation-column">
              <FriendAddWorkspace
                onBack={closeWorkspacePage}
                accessToken={authSession?.accessToken}
              />
            </div>
          </div>
        </div>
      );
    }

    if (workspaceMode === "notifications") {
      return (
        <div className="chat-room-stage utility-room-stage">
          <header className="chat-header utility-workspace-header">
            <div className="chat-header-left">
              <div className="chat-room-avatar utility-header-avatar">
                <BellIcon />
              </div>

              <div className="chat-room-info">
                <div className="chat-room-title-row">
                  <h2>알림</h2>
                </div>

                <div className="room-theme-description">
                  MeetupLog의 새로운 소식을 확인하세요
                </div>
              </div>
            </div>

            <button
              type="button"
              className="utility-close-button"
              onClick={closeWorkspacePage}
            >
              <CloseIcon />
            </button>
          </header>

          <div className="chat-body">
            <div className="conversation-column utility-conversation-column">
              <NotificationsWorkspace
                notifications={notifications}
                onBack={closeWorkspacePage}
                onDelete={handleDeleteNotification}
                onDeleteAll={handleDeleteAllNotifications}
                onMarkAllRead={handleMarkAllNotificationsRead}
                onMarkRead={handleMarkNotificationRead}
                onAccept={handleAcceptNotification}
                onReject={handleRejectNotification}
                actionBusyId={notificationActionBusyId}
                totalCount={
                  USE_MOCK_CHAT
                    ? notifications.length
                    : notificationSummary.totalCount
                }
                unreadCount={unreadNotificationCount}
                page={notificationPage}
                totalPages={
                  USE_MOCK_CHAT
                    ? notifications.length
                      ? 1
                      : 0
                    : notificationSummary.totalPages
                }
                loading={notificationLoading}
                onPageChange={setNotificationPage}
              />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="chat-room-stage home-room-stage">
        <header className="chat-header home-workspace-header">
          <div className="chat-header-left">
            <div className="chat-room-avatar home-header-avatar">M</div>

            <div className="chat-room-info">
              <div className="chat-room-title-row">
                <h2>MeetupLog</h2>
              </div>

              <div className="room-theme-description">
                대화를 시작하고 모임의 결정을 만들어보세요
              </div>
            </div>
          </div>
        </header>

        <div className="chat-body">
          <div className="conversation-column main-home-column">
            <WorkspaceHome
              user={userProfile}
              rooms={rooms}
              onSelectRoom={handleSelectRoom}
              onCreateRoom={() => setModal("CREATE_ROOM")}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`chat-page ${mobileSidebarOpen ? "mobile-sidebar-open" : ""}`}
      data-theme={roomTheme.key}
      data-color-mode={colorMode}
      data-chat-connection={chatConnectionState}
      style={{
        "--theme-accent": roomTheme.accent,

        "--theme-accent-rgb": roomTheme.accentRgb,

        "--theme-accent-soft": roomTheme.accentSoft,

        "--theme-background": roomTheme.background,
      }}
    >
      <button
        type="button"
        className="mobile-navigation-button"
        onClick={() => setMobileSidebarOpen(true)}
        aria-label="주 메뉴 열기"
        aria-expanded={mobileSidebarOpen}
        aria-controls="app-sidebar-navigation"
      >
        <MenuIcon />
      </button>

      <button
        type="button"
        className="mobile-sidebar-backdrop"
        aria-label="주 메뉴 닫기"
        onClick={() => setMobileSidebarOpen(false)}
      />

      <GlobalThemeToggle
        mode={colorMode}
        onToggle={() =>
          setColorMode((previous) => (previous === "light" ? "dark" : "light"))
        }
      />

      <ChatSidebar
        rooms={rooms}
        friends={friends}
        selectedRoomId={selectedRoomId}
        onSelectRoom={(roomId) => {
          handleSelectRoom(roomId);
          setMobileSidebarOpen(false);
        }}
        activeMenu={activeMenu}
        onChangeMenu={handleChangeMenu}
        currentUser={userProfile}
        isGuest={isGuest}
        unreadNotificationCount={unreadNotificationCount}
        onHome={() => {
          handleHome();
          setMobileSidebarOpen(false);
        }}
        onCreateRoom={() => {
          setModal("CREATE_ROOM");
          setMobileSidebarOpen(false);
        }}
        onAddFriend={() => {
          openWorkspacePage("friend-add");
          setMobileSidebarOpen(false);
        }}
        onRemoveFriend={handleRemoveFriend}
        onBlockFriend={handleBlockFriend}
        onNotifications={() => {
          openWorkspacePage("notifications");
          setMobileSidebarOpen(false);
        }}
        onEditProfile={() => {
          openWorkspacePage("profile-edit");
          setMobileSidebarOpen(false);
        }}
        onPresenceChange={handlePresenceChange}
        onLogout={() => {
          setModal("LOGOUT");
          setMobileSidebarOpen(false);
        }}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <section className="chat-main">{renderMainShell()}</section>

      {memberDrawerOpen && selectedRoom && (
        <div className="member-drawer-layer">
          <button
            type="button"
            className="member-drawer-backdrop"
            aria-label="참여자 목록 닫기"
            onClick={() => setMemberDrawerOpen(false)}
          />

          <MemberPanel
            members={members}
            typingUsers={participantTypingUsers}
            isOwner={isOwner}
            variant="drawer"
            onClose={() => setMemberDrawerOpen(false)}
            onRequestKick={(member) => {
              setMemberDrawerOpen(false);

              setKickTarget(member);
            }}
            friends={friends}
            onInviteFriend={handleInviteFriend}
            pendingInviteIds={pendingInvitesByRoom[selectedRoomId] ?? []}
            inviteLink={inviteLinksByRoom[selectedRoomId]}
            inviteLinkBusy={inviteLinkBusy}
            onCreateInviteLink={handleCreateInviteLink}
          />
        </div>
      )}

      <CreateRoomModal
        open={modal === "CREATE_ROOM"}
        onClose={() => setModal(null)}
        onCreate={handleCreateRoom}
      />

      <KickMemberModal
        open={kickTarget !== null}
        member={kickTarget}
        onClose={() => setKickTarget(null)}
        onConfirm={handleKickMember}
      />

      <KickedMemberNoticeModal
        notice={kickedNotice}
        onConfirm={handleDismissKickedNotice}
      />

      <AppModal
        open={modal === "LOGOUT"}
        title={isGuest ? "게스트 참여 종료" : "로그아웃"}
        subtitle={
          isGuest
            ? "초대받은 채팅방에서 나갑니다."
            : "현재 MeetupLog 세션을 안전하게 종료합니다."
        }
        eyebrow={isGuest ? "GUEST SESSION" : "ACCOUNT SESSION"}
        icon={<LogoutIcon />}
        className="logout-modal"
        onClose={() => setModal(null)}
        size="small"
      >
        <div className="logout-confirm">
          <div className="logout-confirm-message">
            <strong>
              {isGuest ? "초대방에서 나갈까요?" : "정말 로그아웃할까요?"}
            </strong>

            <p>
              {isGuest
                ? "게스트 세션이 종료되며, 다시 참여하려면 초대 링크가 필요합니다."
                : "이 기기의 로그인 상태가 해제되고 로그인 화면으로 이동합니다."}
            </p>
          </div>

          <div className="modal-action-row">
            <button
              type="button"
              className="secondary-action"
              onClick={() => setModal(null)}
            >
              취소
            </button>

            <button
              type="button"
              className="primary-action"
              onClick={async () => {
                setModal(null);
                await handleSessionLogout();
              }}
            >
              <LogoutIcon />
              {isGuest ? "나가기" : "로그아웃"}
            </button>
          </div>
        </div>
      </AppModal>

      <AppModal
        open={modal === "UNLINK_KAKAO"}
        title="카카오 연동 해제"
        subtitle="카카오 계정과 MeetupLog의 연결을 해제합니다."
        eyebrow="KAKAO ACCOUNT"
        onClose={() => {
          if (!accountActionSubmitting) setModal(null);
        }}
        size="small"
      >
        <div className="delete-account-confirm">
          <div className="account-danger-summary kakao-unlink-summary">
            <span className="account-danger-summary-icon">
              <KakaoIcon />
            </span>
            <div>
              <strong>카카오 연동을 해제할까요?</strong>
              <p>
                연동 해제 후 현재 세션이 종료됩니다. 다시 이용하려면 카카오
                연결을 새로 진행해야 합니다.
              </p>
            </div>
          </div>

          {accountActionError && (
            <div className="profile-password-status error" role="alert">
              {accountActionError}
            </div>
          )}

          <div className="modal-action-row">
            <button
              type="button"
              className="secondary-action"
              disabled={accountActionSubmitting}
              onClick={() => setModal(null)}
            >
              취소
            </button>

            <button
              type="button"
              className="danger-action"
              disabled={accountActionSubmitting}
              onClick={async () => {
                setAccountActionSubmitting(true);
                setAccountActionError("");

                try {
                  await unlinkKakao(authSession.accessToken);
                  setModal(null);
                  onLogout?.();
                } catch (error) {
                  setAccountActionError(
                    error?.message || "카카오 연동을 해제하지 못했습니다.",
                  );
                } finally {
                  setAccountActionSubmitting(false);
                }
              }}
            >
              {accountActionSubmitting ? "해제 중..." : "연동 해제"}
            </button>
          </div>
        </div>
      </AppModal>

      <DeleteAccountModal
        open={modal === "DELETE_ACCOUNT"}
        submitting={accountActionSubmitting}
        error={accountActionError}
        onClose={() => {
          setModal(null);
          setAccountActionError("");
        }}
        onConfirm={async () => {
          setAccountActionSubmitting(true);
          setAccountActionError("");

          try {
            await deleteMyAccount(authSession.accessToken);

            setModal(null);
            onLogout?.();
          } catch (error) {
            setAccountActionError(
              error?.message || "회원탈퇴를 처리하지 못했습니다.",
            );
          } finally {
            setAccountActionSubmitting(false);
          }
        }}
      />

      <AppModal
        open={modal === "EDIT_MESSAGE"}
        title="메시지 수정"
        icon={<PencilIcon />}
        className="message-action-modal"
        onClose={() => {
          setEditingMessage(null);
          setEditMessageDraft("");
          setModal(null);
        }}
        size="small"
      >
        <div className="message-edit-confirm">
          <label className="message-edit-field">
            <span>
              수정할 내용
              <small>{editMessageDraft.length}/1000</small>
            </span>

            <textarea
              value={editMessageDraft}
              maxLength={1000}
              autoFocus
              onChange={(event) => setEditMessageDraft(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  editMessageDraft.trim() &&
                  editMessageDraft.trim() !== editingMessage?.content
                ) {
                  event.preventDefault();
                  handleSaveEdit(editingMessage.id, editMessageDraft.trim());
                  setModal(null);
                }
              }}
            />
          </label>

          <div className="modal-action-row">
            <button
              type="button"
              className="secondary-action"
              onClick={() => {
                setEditingMessage(null);
                setEditMessageDraft("");
                setModal(null);
              }}
            >
              취소
            </button>

            <button
              type="button"
              className="primary-action"
              disabled={
                !editMessageDraft.trim() ||
                editMessageDraft.trim() === editingMessage?.content
              }
              onClick={() => {
                handleSaveEdit(editingMessage.id, editMessageDraft.trim());
                setModal(null);
              }}
            >
              <PencilIcon />
              수정 저장
            </button>
          </div>
        </div>
      </AppModal>

      <AppModal
        open={modal === "DELETE_MESSAGE"}
        title="메시지 삭제"
        icon={<TrashIcon />}
        className="message-action-modal message-delete-modal"
        onClose={() => {
          setDeleteMessageTarget(null);

          setModal(null);
        }}
        size="small"
      >
        <div className="delete-message-confirm">
          <div className="delete-message-preview">
            <span>삭제할 메시지</span>
            <p>{deleteMessageTarget?.content}</p>
          </div>

          <div className="modal-action-row">
            <button
              type="button"
              className="secondary-action"
              onClick={() => {
                setDeleteMessageTarget(null);

                setModal(null);
              }}
            >
              취소
            </button>

            <button
              type="button"
              className="danger-action"
              onClick={confirmDeleteMessage}
            >
              <TrashIcon />
              삭제
            </button>
          </div>
        </div>
      </AppModal>

      <RoomMenuModal
        open={modal === "ROOM_MENU"}
        room={selectedRoom}
        memberCount={members.length || selectedRoom?.memberCount || 0}
        isOwner={isOwner}
        inviteLink={inviteLinksByRoom[selectedRoomId]}
        onClose={() => setModal(null)}
        onLoadInviteLink={handleLoadActiveInviteLink}
        onCreateInviteLink={issueRoomInviteLink}
        onRevokeInviteLink={handleRevokeInviteLink}
        onLoadNotification={handleLoadRoomNotification}
        onUpdateNotification={handleUpdateRoomNotification}
        onRenameRoom={handleRenameRoom}
        onDeleteRoom={handleDeleteRoom}
        onLeaveRoom={handleLeaveRoom}
      />

      <AppModal
        open={aiDetailMovie !== null}
        title="추천 상세"
        subtitle="추천 근거와 현재 확인된 OTT·예매 경로를 함께 확인하세요."
        size="large"
        className="ai-detail-app-modal"
        onClose={() => setAiDetailMovie(null)}
      >
        {aiDetailMovie && (
          <div className="ai-detail-modal">
            <section className="ai-detail-hero">
              <div className="ai-detail-poster">
                {aiDetailMovie.posterUrl ? (
                  <img
                    src={aiDetailMovie.posterUrl}
                    alt={`${aiDetailMovie.title} 포스터`}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  "🎬"
                )}
              </div>

              <div className="ai-detail-heading">
                <span className="ai-detail-eyebrow">MEETUP AI PICK</span>
                <h3>{aiDetailMovie.title}</h3>
                <p>
                  {[
                    aiDetailMovie.releaseDate?.slice?.(0, 4),
                    aiDetailMovie.genres,
                    aiDetailMovie.runtime,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>

                <div className="ai-detail-score">
                  <strong>{aiDetailMovie.score}</strong>
                  <span>그룹 적합도</span>
                </div>
              </div>
            </section>

            <section className="ai-detail-section">
              <h4>줄거리</h4>
              <p className="ai-detail-description">
                {aiDetailMovie.overview || "영화 줄거리 정보가 없습니다."}
              </p>
            </section>

            {(aiDetailDirectors.length > 0 || aiDetailCast.length > 0) && (
              <section className="ai-detail-section ai-detail-credits">
                <h4>배우 · 감독</h4>
                {aiDetailDirectors.length > 0 && (
                  <div>
                    <strong>감독</strong>
                    <p>{aiDetailDirectors.slice(0, 3).join(", ")}</p>
                  </div>
                )}
                {aiDetailCast.length > 0 && (
                  <div>
                    <strong>출연</strong>
                    <p>{aiDetailCast.slice(0, 8).join(", ")}</p>
                  </div>
                )}
              </section>
            )}

            <section className="ai-detail-section ai-detail-provider-section">
              <div className="ai-detail-provider-heading">
                <div>
                  <h4>국내 시청 경로</h4>

                  <p>
                    {aiDetailIsConfirmed
                      ? "확정된 영화의 국내 OTT 검색 및 예매 사이트로 이동할 수 있어요."
                      : "현재 론칭된 OTT 정보입니다. 영화 확정 후 검색·예매 링크를 이용할 수 있어요."}
                  </p>
                </div>

                <span>{aiDetailIsConfirmed ? "확정 영화" : "확정 전"}</span>
              </div>

              {aiDetailIsConfirmed ? (
                /*
                 * 확정 후
                 * 실제 링크가 있는 <a> 태그를 표시합니다.
                 */
                aiDetailWatchLinks.length > 0 ? (
                  <div
                    className="ai-detail-provider-list ai-detail-watch-link-list"
                    aria-label="확정 영화의 OTT 및 예매 경로"
                  >
                    {aiDetailWatchLinks.slice(0, 10).map((link) => (
                      <a
                        key={`${link.kind}-${link.name}-${link.detail}-${link.url}`}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => {
                          if (
                            link.kind === "OTT" &&
                            link.titleSearchSupported === false
                          ) {
                            navigator.clipboard
                              ?.writeText(aiDetailMovie.title)
                              .catch(() => {});
                          }
                        }}
                        aria-label={
                          link.kind === "CINEMA"
                            ? `${link.name} 예매 페이지 열기`
                            : link.titleSearchSupported === false
                              ? `${aiDetailMovie.title} 제목을 복사하고 ${link.name} 검색 페이지 열기`
                              : `${link.name}에서 ${aiDetailMovie.title} 검색하기`
                        }
                      >
                        <span
                          className="ai-detail-provider-logo"
                          aria-hidden="true"
                        >
                          {link.logoUrl ? (
                            <img src={link.logoUrl} alt="" loading="lazy" />
                          ) : (
                            <span
                              className={`ai-detail-watch-kind ${
                                link.kind === "CINEMA" ? "cinema" : "ott"
                              }`}
                            >
                              {link.kind === "CINEMA" ? "예매" : "OTT"}
                            </span>
                          )}
                        </span>

                        <span className="ai-detail-watch-copy">
                          <strong>{link.name}</strong>

                          <small>
                            {link.kind === "OTT" &&
                            link.titleSearchSupported === false
                              ? "제목 복사 후 검색 ↗"
                              : `${link.detail || "바로가기"} ↗`}
                          </small>
                        </span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <span className="ai-detail-link-unavailable">
                    연결할 수 있는 국내 OTT 또는 예매 경로가 없습니다.
                  </span>
                )
              ) : /*
               * 확정 전
               * 링크가 없는 <span>만 표시합니다.
               */
              aiDetailProviders.length > 0 ? (
                <div
                  className="ai-detail-provider-list ai-detail-provider-info-list is-locked"
                  aria-label="현재 론칭된 OTT 서비스"
                >
                  {aiDetailProviders.slice(0, 8).map((provider) => (
                    <span
                      key={`${provider.name}-${provider.type ?? "unknown"}`}
                    >
                      <span
                        className="ai-detail-provider-logo"
                        aria-hidden="true"
                      >
                        {provider.logoUrl ? (
                          <img src={provider.logoUrl} alt="" loading="lazy" />
                        ) : (
                          "OTT"
                        )}
                      </span>

                      <span className="ai-detail-watch-copy">
                        <strong>{provider.name}</strong>
                        <small>확정 후 링크 제공</small>
                      </span>
                    </span>
                  ))}
                </div>
              ) : (
                <span className="ai-detail-link-unavailable">
                  현재 확인된 국내 OTT 론칭 정보가 없습니다.
                </span>
              )}
            </section>

            {aiDetailIsConfirmed && (
              <section className="ai-detail-section ai-detail-confirmed-link-section">
                <div>
                  <span className="ai-detail-confirmed-badge">확정 완료</span>
                  <h4>확정 영화 상세 정보</h4>
                  <p>영화 정보 페이지도 함께 확인할 수 있어요.</p>
                </div>

                {aiDetailMovie.tmdbId ? (
                  <a
                    className="ai-detail-external-link"
                    href={`https://www.themoviedb.org/movie/${aiDetailMovie.tmdbId}?language=ko-KR`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    영화 상세 정보 보기 ↗
                  </a>
                ) : (
                  <span className="ai-detail-link-unavailable">
                    연결할 수 있는 상세 페이지 정보가 없습니다.
                  </span>
                )}
              </section>
            )}

            {aiDetailMovie.reasons?.length > 0 && (
              <section className="ai-detail-section">
                <h4>추천에 반영된 이유</h4>
                <ul className="ai-detail-reasons">
                  {aiDetailMovie.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </AppModal>
    </div>
  );
};

export default ChatMainPage;
