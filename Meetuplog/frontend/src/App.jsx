import { useState } from "react";

import AppErrorBoundary from "./components/common/AppErrorBoundary";
import AuthPage from "./pages/AuthPage";
import ChatMainPage from "./pages/ChatMainPage";
import ErrorPage from "./pages/ErrorPage";
import LandingPage from "./pages/LandingPage";

const USE_MOCK_AUTH = import.meta.env.VITE_USE_MOCK_AUTH === "true";

const SESSION_KEY = USE_MOCK_AUTH
  ? "meetuplog-auth-session-mock"
  : "meetuplog-auth-session-v2";
const LEGACY_SESSION_KEY = "meetuplog-auth-session";
const PENDING_INVITE_KEY = "meetuplog-pending-invite";

const readSession = () => {
  try {
    const value = window.sessionStorage.getItem(SESSION_KEY);
    if (value) return JSON.parse(value);
  } catch {
    window.sessionStorage.removeItem(SESSION_KEY);
  }

  return null;
};

const clearStoredSession = () => {
  window.localStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(LEGACY_SESSION_KEY);
  window.sessionStorage.removeItem(LEGACY_SESSION_KEY);
};

const readPendingInvite = () => {
  try {
    const value = window.sessionStorage.getItem(PENDING_INVITE_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    window.sessionStorage.removeItem(PENDING_INVITE_KEY);
    return null;
  }
};

const readInitialEntry = () => {
  const currentUrl = new URL(window.location.href);
  const segments = currentUrl.pathname.split("/").filter(Boolean);
  const inviteIndex = segments.indexOf("invite");
  const inviteToken = inviteIndex >= 0
    ? segments[inviteIndex + 1]
    : currentUrl.searchParams.get("invite");
  const oauthCallback =
    currentUrl.searchParams.has("oauthCode") ||
    currentUrl.searchParams.has("oauth") ||
    currentUrl.searchParams.has("oauthError");
  const legacyAuthPath = currentUrl.pathname === "/auth" ||
    currentUrl.pathname.startsWith("/auth/");

  if (inviteToken) {
    const inviteContext = {
      supplied: true,
      token: inviteToken,
      roomId: Number(currentUrl.searchParams.get("roomId")) || 1,
      roomName: currentUrl.searchParams.get("roomName") || "초대받은 채팅방",
    };

    window.sessionStorage.setItem(
      PENDING_INVITE_KEY,
      JSON.stringify(inviteContext),
    );
    window.history.replaceState({}, document.title, "/");

    return { screen: "auth", authView: "guest", inviteContext };
  }

  if (oauthCallback || legacyAuthPath) {
    const search = currentUrl.searchParams.toString();
    window.history.replaceState(
      {},
      document.title,
      `/${search ? `?${search}` : ""}`,
    );

    return {
      screen: "auth",
      authView: currentUrl.pathname.includes("signup") ? "signup" : "login",
      inviteContext: null,
    };
  }

  const pendingInvite = readPendingInvite();
  if (pendingInvite) {
    return { screen: "auth", authView: "guest", inviteContext: pendingInvite };
  }

  if (currentUrl.pathname !== "/") {
    window.history.replaceState({}, document.title, "/");
    return {
      screen: "error",
      error: {
        status: 404,
        title: "페이지를 찾을 수 없어요",
        message: "요청한 화면이 없거나 이동된 주소입니다.",
      },
    };
  }

  return { screen: "landing", authView: "login", inviteContext: null };
};

const INITIAL_ENTRY = readInitialEntry();

const AppContent = () => {
  const [session, setSession] = useState(readSession);
  const [entry, setEntry] = useState(INITIAL_ENTRY);

  const showLanding = () => {
    window.sessionStorage.removeItem(PENDING_INVITE_KEY);
    window.history.replaceState({}, document.title, "/");
    setEntry({ screen: "landing", authView: "login", inviteContext: null });
  };

  const showAuth = (authView = "login") => {
    window.history.replaceState({}, document.title, "/");
    setEntry({ screen: "auth", authView, inviteContext: null });
  };

  const showError = (error) => {
    window.history.replaceState({}, document.title, "/");
    setEntry({
      screen: "error",
      error: {
        status: error?.status || 500,
        title: error?.status === 503
          ? "서비스에 연결할 수 없어요"
          : "잠시 문제가 생겼어요",
        message: error?.message || "요청을 처리하는 중 오류가 발생했습니다.",
      },
    });
  };

  const handleAuthenticated = (nextSession) => {
    if (!nextSession) return;

    clearStoredSession();
    window.sessionStorage.removeItem(PENDING_INVITE_KEY);
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
    window.history.replaceState({}, document.title, "/");
    setSession(nextSession);
  };

  const handleLogout = () => {
    clearStoredSession();
    window.sessionStorage.removeItem(PENDING_INVITE_KEY);
    window.history.replaceState({}, document.title, "/");
    setSession(null);
    setEntry({ screen: "landing", authView: "login", inviteContext: null });
  };

  if (entry.screen === "error") {
    return (
      <ErrorPage
        {...entry.error}
        onHome={showLanding}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (session) {
    return (
      <ChatMainPage
        key={`${session.type}:${session.user?.id ?? "unknown"}`}
        authSession={session}
        onLogout={handleLogout}
        onSessionChange={handleAuthenticated}
      />
    );
  }

  if (entry.screen === "auth") {
    return (
      <AuthPage
        key={`${entry.authView}:${entry.inviteContext?.token || "member"}`}
        initialView={entry.authView}
        initialInviteContext={entry.inviteContext}
        onAuthenticated={handleAuthenticated}
        onBackToLanding={showLanding}
        onFatalError={showError}
      />
    );
  }

  return (
    <LandingPage
      onLogin={() => showAuth("login")}
      onSignup={() => showAuth("signup")}
    />
  );
};

const App = () => (
  <AppErrorBoundary>
    <AppContent />
  </AppErrorBoundary>
);

export default App;
