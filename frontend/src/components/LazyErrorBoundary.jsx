import React from "react";
import { buildFrontendErrorPayload, postFrontendError } from "./ErrorBoundary";

/**
 * LazyErrorBoundary — catches failures in React.lazy() chunks (network errors,
 * missing imports, runtime errors) and renders a retry UI instead of an
 * unrecoverable blank screen.
 */
export default class LazyErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    const payload = buildFrontendErrorPayload({
      error,
      errorInfo: info,
      boundary: this.props.boundaryName || "lazy-chunk",
      meta: {
        source: "react-lazy-error-boundary",
      },
    });

    console.error("[LazyErrorBoundary]", {
      message: payload.message,
      stack: payload.stack,
      componentStack: payload.component_stack,
      page: payload.page,
      meta: payload.meta,
    });

    postFrontendError(payload);
  }

  reset = () => {
    this.setState({ error: null });
    if (this.props.onReset) this.props.onReset();
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
      return (
        <div
          data-testid="lazy-error-boundary"
          className="min-h-[200px] flex flex-col items-center justify-center gap-3 p-6 text-center"
        >
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-2xl">⚠️</div>
          <p className="text-sm font-semibold text-white/80">Ein Fehler ist aufgetreten</p>
          <p className="text-xs text-white/40 max-w-xs">{this.state.error?.message || "Unbekannter Fehler"}</p>
          <button
            data-testid="lazy-error-retry-btn"
            onClick={this.reset}
            className="px-4 py-2 rounded-lg bg-[#00E0FF]/10 border border-[#00E0FF]/20 text-[#00E0FF] text-xs font-bold"
          >
            Erneut versuchen
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
