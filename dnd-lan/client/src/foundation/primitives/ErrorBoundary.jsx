import React from "react";
import { formatError } from "../../lib/formatError.js";
import { t } from "../../i18n/index.js";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.props.onError?.(error, info);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const message = formatError(this.state.error, t("errorBoundary.fallbackMessage"));
    return (
      <div className="vintage-shell">
        <div className="vintage-book">
          <div className="vintage-page">
            <div className="card taped no-stamp">
              <div className="error-boundary-title">{t("errorBoundary.title")}</div>
              <div className="small error-boundary-subtitle">
                {t("errorBoundary.subtitle")}
              </div>
              <div className="paper-note error-boundary-details">
                <div className="title">{t("errorBoundary.details")}</div>
                <div className="small">{message}</div>
              </div>
              <div className="row error-boundary-actions">
                <button className="btn" onClick={() => window.location.reload()}>
                  {t("errorBoundary.reload")}
                </button>
                <button className="btn secondary" onClick={() => (window.location.href = "/")}>
                  {t("errorBoundary.home")}
                </button>
                <button className="btn secondary" onClick={this.reset}>
                  {t("errorBoundary.tryAgain")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
