import { useEffect, useRef, useState } from "react";

import GlobalThemeToggle from "../components/common/GlobalThemeToggle";
import {
  ArrowRightIcon,
  CheckIcon,
  SparklesIcon,
  UserPlusIcon,
  UsersIcon,
} from "../components/common/Icons";
import useLiquidControlReflection from "../hooks/useLiquidControlReflection";

const getInitialColorMode = () => {
  const saved = window.localStorage.getItem("meetuplog-color-mode");
  if (saved === "light" || saved === "dark") return saved;

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const steps = [
  {
    number: "01",
    icon: <UserPlusIcon />,
    title: "모임을 만들어요",
    copy: "주제에 맞는 채팅방을 만들고 친구를 초대하세요.",
  },
  {
    number: "02",
    icon: <UsersIcon />,
    title: "의견을 모아요",
    copy: "실시간 대화와 반응으로 모두의 취향을 남겨요.",
  },
  {
    number: "03",
    icon: <SparklesIcon />,
    title: "함께 결정해요",
    copy: "AI가 대화를 분석해 모임에 맞는 선택을 추천해요.",
  },
];

const LandingPage = ({ onLogin, onSignup }) => {
  useLiquidControlReflection();

  const pageRef = useRef(null);
  const [colorMode, setColorMode] = useState(getInitialColorMode);

  useEffect(() => {
    document.documentElement.dataset.colorMode = colorMode;
    document.documentElement.style.colorScheme = colorMode;
    window.localStorage.setItem("meetuplog-color-mode", colorMode);
  }, [colorMode]);

  return (
    <main ref={pageRef} className="landing-page" data-color-mode={colorMode}>
      <GlobalThemeToggle
        mode={colorMode}
        onToggle={() =>
          setColorMode((previous) => previous === "light" ? "dark" : "light")
        }
      />

      <div className="landing-ambient landing-ambient-one" aria-hidden="true" />
      <div className="landing-ambient landing-ambient-two" aria-hidden="true" />

      <nav className="landing-nav" aria-label="주요 메뉴">
        <button
          type="button"
          className="landing-brand"
          onClick={() =>
            pageRef.current?.scrollTo({ top: 0, behavior: "smooth" })
          }
        >
          <span>M</span>
          <div>
            <strong>MeetupLog</strong>
            <small>Decide together</small>
          </div>
        </button>

        <div className="landing-nav-actions">
          <button type="button" className="landing-login-button" onClick={onLogin}>
            로그인
          </button>
          <button type="button" className="landing-signup-button" onClick={onSignup}>
            시작하기
            <ArrowRightIcon />
          </button>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-eyebrow">MEETUPLOG</span>
          <h1>
            대화는 가볍게,
            <br />
            결정은 함께.
          </h1>
          <p>
            흩어진 의견을 한곳에 모으고
            <br />
            우리 모임에 꼭 맞는 답을 찾아보세요.
          </p>

          <div className="landing-hero-actions">
            <button type="button" className="landing-primary-button" onClick={onSignup}>
              무료로 시작하기
              <ArrowRightIcon />
            </button>
            <button type="button" className="landing-secondary-button" onClick={onLogin}>
              이미 계정이 있어요
            </button>
          </div>

          <div className="landing-trust-row">
            <span><CheckIcon />실시간 채팅</span>
            <span><CheckIcon />친구 초대</span>
            <span><CheckIcon />AI 추천</span>
          </div>
        </div>

        <div className="landing-hero-visual" aria-hidden="true">
          <div className="landing-orbit orbit-outer" />
          <div className="landing-orbit orbit-inner" />
          <span className="landing-core">M</span>
          <span className="landing-node landing-node-chat">💬</span>
          <span className="landing-node landing-node-friends"><UsersIcon /></span>
          <span className="landing-node landing-node-ai"><SparklesIcon /></span>

          <div className="landing-floating-card landing-floating-message">
            <span className="landing-mini-avatar">민</span>
            <div>
              <small>민수</small>
              <strong>이번 주말에 뭐 할까?</strong>
            </div>
          </div>

          <div className="landing-floating-card landing-floating-result">
            <span><SparklesIcon /></span>
            <div>
              <small>AI 추천 완료</small>
              <strong>우리 모임의 선택을 찾았어요</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-how" aria-labelledby="landing-how-title">
        <header>
          <span className="landing-eyebrow">HOW IT WORKS</span>
          <h2 id="landing-how-title">세 단계면 충분해요</h2>
          <p>복잡한 준비 없이 모임을 만들고 대화를 시작하세요.</p>
        </header>

        <div className="landing-step-grid">
          {steps.map((step) => (
            <article key={step.number} className="landing-step-card">
              <div className="landing-step-card-top">
                <span className="landing-step-icon">{step.icon}</span>
                <small>{step.number}</small>
              </div>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-cta">
        <div>
          <span className="landing-eyebrow">START TOGETHER</span>
          <h2>오늘의 대화가<br />내일의 결정이 되도록.</h2>
        </div>
        <button type="button" onClick={onSignup}>
          MeetupLog 시작하기
          <ArrowRightIcon />
        </button>
      </section>

      <footer className="landing-footer">
        <div className="landing-brand compact">
          <span>M</span>
          <div>
            <strong>MeetupLog</strong>
            <small>Decide together</small>
          </div>
        </div>
        <p>© 2026 MeetupLog</p>
      </footer>
    </main>
  );
};

export default LandingPage;
