import React from "react";
import { formatError } from "../../lib/formatError.js";

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

    const message = formatError(this.state.error, "Что-то пошло не так.");
    return (
      <div className="vintage-shell">
        <div className="vintage-book">
          <div className="vintage-page">
            <div className="card taped no-stamp">
              <div style={{ fontWeight: 1000, fontSize: 20 }}>Упс, ошибка интерфейса</div>
              <div className="small" style={{ marginTop: 6 }}>
                Мы уже знаем, что приложение может восстановиться после перезагрузки.
              </div>
              <div className="paper-note" style={{ marginTop: 10 }}>
                <div className="title">Подробности</div>
                <div className="small">{message}</div>
              </div>
              <div className="row" style={{ marginTop: 12, flexWrap: "wrap" }}>
                <button className="btn" onClick={() => window.location.reload()}>
                  Перезагрузить
                </button>
                <button className="btn secondary" onClick={() => (window.location.href = "/")}>
                  На главную
                </button>
                <button className="btn secondary" onClick={this.reset}>
                  Попробовать снова
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
