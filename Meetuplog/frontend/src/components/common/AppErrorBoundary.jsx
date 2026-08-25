import { Component } from "react";

import ErrorPage from "../../pages/ErrorPage";

class AppErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorPage
          status={500}
          title="화면을 불러오지 못했어요"
          message="잠시 후 다시 시도하거나 처음 화면으로 돌아가 주세요."
          onHome={() => {
            window.history.replaceState({}, document.title, "/");
            window.location.reload();
          }}
          onRetry={() => window.location.reload()}
        />
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
