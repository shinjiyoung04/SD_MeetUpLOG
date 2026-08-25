import { useEffect, useState } from "react";

import GlobalThemeToggle from "../components/common/GlobalThemeToggle";
import { ArrowRightIcon, SparklesIcon } from "../components/common/Icons";
import useLiquidControlReflection from "../hooks/useLiquidControlReflection";

const getInitialColorMode = () => {
  const saved = window.localStorage.getItem("meetuplog-color-mode");
  if (saved === "light" || saved === "dark") return saved;
  return "light";
};

const ErrorPage = ({
  status = 500,
  title = "잠시 문제가 생겼어요",
  message = "요청을 처리하는 중 오류가 발생했습니다.",
  onHome,
  onRetry,
}) => {
  useLiquidControlReflection();

  const [colorMode, setColorMode] = useState(getInitialColorMode);

  useEffect(() => {
    document.documentElement.dataset.colorMode = colorMode;
    document.documentElement.style.colorScheme = colorMode;
    window.localStorage.setItem("meetuplog-color-mode", colorMode);
  }, [colorMode]);

  return (
    <main className="error-page" data-color-mode={colorMode}>
      <GlobalThemeToggle
        mode={colorMode}
        onToggle={() =>
          setColorMode((previous) => previous === "light" ? "dark" : "light")
        }
      />

      <div className="error-ambient" aria-hidden="true" />

      <section className="error-card">
        <div className="error-visual" aria-hidden="true">
          <span className="error-orbit error-orbit-one" />
          <span className="error-orbit error-orbit-two" />
          <span className="error-core"><SparklesIcon /></span>
          <strong>{status}</strong>
        </div>

        <div className="error-copy">
          <span className="landing-eyebrow">MEETUPLOG ERROR</span>
          <h1>{title}</h1>
          <p>{message}</p>

          <div className="error-actions">
            <button type="button" className="error-home-button" onClick={onHome}>
              처음으로
              <ArrowRightIcon />
            </button>
            {onRetry && (
              <button type="button" className="error-retry-button" onClick={onRetry}>
                다시 시도
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
};

export default ErrorPage;
