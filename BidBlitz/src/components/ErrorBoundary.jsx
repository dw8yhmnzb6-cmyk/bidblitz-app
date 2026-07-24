/**
 * Error Boundary & Global Error Handler
 * Fängt React Errors und sendet an Backend
 */
import { Component } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const getBrowserContext = () => {
  if (typeof window === "undefined") {
    return {
      href: "",
      page: "",
      path: "",
      search: "",
      userAgent: "",
    };
  }

  return {
    href: window.location?.href || "",
    page: `${window.location?.pathname || "/"}${window.location?.search || ""}`,
    path: window.location?.pathname || "/",
    search: window.location?.search || "",
    userAgent: window.navigator?.userAgent || "",
  };
};

const normalizeErrorMessage = (error) => {
  if (!error) return "Unknown frontend error";
  if (typeof error === "string") return error;
  if (error?.message) return error.message;
  try {
    return JSON.stringify(error);
  } catch (serializationError) {
    void serializationError;
    return String(error);
  }
};

const normalizeErrorStack = (error) => {
  if (!error) return "";
  if (typeof error?.stack === "string") return error.stack;
  return typeof error === "string" ? error : "";
};

const serializeError = (error) => {
  if (!error) return null;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack || "",
    };
  }

  if (typeof error === "string") {
    return { name: "Error", message: error, stack: "" };
  }

  try {
    return JSON.parse(JSON.stringify(error));
  } catch (serializationError) {
    void serializationError;
    return { value: String(error) };
  }
};

const resolveComponentName = (componentStack = "") => {
  const firstLine = componentStack
    .split("\n")
    .map((entry) => entry.trim())
    .find(Boolean);
  return firstLine || "UnknownComponent";
};

export const buildFrontendErrorPayload = ({
  error,
  errorInfo,
  level = "error",
  boundary = "root",
  meta = {},
}) => {
  const browser = getBrowserContext();
  const componentStack = errorInfo?.componentStack || meta.component_stack || "";

  return {
    message: normalizeErrorMessage(error),
    page: browser.page,
    stack: normalizeErrorStack(error),
    component_stack: componentStack,
    level,
    meta: {
      boundary,
      component: resolveComponentName(componentStack),
      path: browser.path,
      search: browser.search,
      href: browser.href,
      user_agent: browser.userAgent,
      error_name: error?.name || typeof error,
      error_serialized: serializeError(error),
      ...meta,
    },
  };
};

export async function postFrontendError(payload) {
  if (!API) return;

  try {
    await fetch(`${API}/api/monitoring/log-error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
  } catch (loggingError) {
    console.warn("[ErrorBoundary] Backend logging failed", loggingError);
  }
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });

    const payload = buildFrontendErrorPayload({
      error,
      errorInfo,
      boundary: this.props.boundaryName || "app-root",
      meta: {
        source: "react-error-boundary",
      },
    });

    console.error("[ErrorBoundary] React runtime error", {
      message: payload.message,
      stack: payload.stack,
      componentStack: payload.component_stack,
      page: payload.page,
      meta: payload.meta,
    });

    this.logError(payload);
  }

  async logError(errorData) {
    await postFrontendError(errorData);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} className="text-red-600" />
            </div>
            
            <h1 className="text-2xl font-bold mb-2">Etwas ist schiefgelaufen</h1>
            <p className="text-gray-600 mb-6">
              Ein unerwarteter Fehler ist aufgetreten. Wir haben das Problem protokolliert.
            </p>

            {process.env.NODE_ENV === "development" && this.state.error && (
              <div className="bg-gray-100 rounded-lg p-4 mb-6 text-left overflow-auto max-h-40">
                <p className="text-xs font-mono text-red-600">
                  {normalizeErrorMessage(this.state.error)}
                </p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="mt-3 text-[10px] text-slate-700 whitespace-pre-wrap break-words">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <button
              data-testid="error-boundary-reload-button"
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <RefreshCw size={20} />
              Seite neu laden
            </button>

            <button
              data-testid="error-boundary-reset-button"
              onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
              className="w-full mt-3 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
            >
              Erneut versuchen
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Global Error Handler Setup
 * Call this in App.jsx useEffect
 */
export function setupGlobalErrorHandler() {
  if (typeof window === "undefined") return;
  if (window.__bidblitzGlobalErrorHandlerInstalled) return;
  window.__bidblitzGlobalErrorHandlerInstalled = true;

  // Unhandled Promise Rejections
  window.addEventListener("unhandledrejection", (event) => {
    const payload = buildFrontendErrorPayload({
      error: event.reason,
      level: "warning",
      boundary: "unhandled-promise",
      meta: {
        source: "window.unhandledrejection",
      },
    });

    console.error("[GlobalError] Unhandled promise rejection", payload);
    logErrorToBackend(payload);
  });

  // Global errors
  window.addEventListener("error", (event) => {
    const payload = buildFrontendErrorPayload({
      error: event.error || event.message,
      level: "error",
      boundary: "window-error",
      meta: {
        source: "window.error",
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });

    console.error("[GlobalError] Window error", payload);
    logErrorToBackend(payload);
  });

  // Console errors (optional, might be noisy)
  const originalConsoleError = console.error;
  console.error = (...args) => {
    originalConsoleError(...args);

    const firstArg = args[0];
    const shouldLog = firstArg instanceof Error || (typeof firstArg === "string" && firstArg.startsWith("[LazyErrorBoundary]"));
    if (shouldLog) {
      logErrorToBackend(buildFrontendErrorPayload({
        error: firstArg,
        level: "warning",
        boundary: "console-error",
        meta: {
          source: "console.error",
          arg_count: args.length,
        },
      }));
    }
  };
}

async function logErrorToBackend(errorData) {
  await postFrontendError(errorData);
}

/**
 * Performance Monitoring
 */
export function trackPerformance() {
  if (typeof window === "undefined") return;
  if (!window.PerformanceObserver) return;

  // Largest Contentful Paint (LCP)
  const lcpObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1];
    
    trackMetric({
      page: window.location.pathname,
      metric_name: "LCP",
      value: lastEntry.renderTime || lastEntry.loadTime,
      rating: lastEntry.renderTime < 2500 ? "good" : lastEntry.renderTime < 4000 ? "needs-improvement" : "poor"
    });
  });
  
  try {
    lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] });
  } catch (e) {
    // Not supported
  }

  // First Input Delay (FID)
  const fidObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    entries.forEach((entry) => {
      trackMetric({
        page: window.location.pathname,
        metric_name: "FID",
        value: entry.processingStart - entry.startTime,
        rating: entry.processingStart - entry.startTime < 100 ? "good" : entry.processingStart - entry.startTime < 300 ? "needs-improvement" : "poor"
      });
    });
  });
  
  try {
    fidObserver.observe({ entryTypes: ["first-input"] });
  } catch (e) {
    // Not supported
  }

  // Cumulative Layout Shift (CLS)
  let clsValue = 0;
  const clsObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) {
        clsValue += entry.value;
      }
    }
  });
  
  try {
    clsObserver.observe({ entryTypes: ["layout-shift"] });
  } catch (e) {
    // Not supported
  }

  // Send CLS on page unload
  window.addEventListener("beforeunload", () => {
    if (clsValue > 0) {
      trackMetric({
        page: window.location.pathname,
        metric_name: "CLS",
        value: clsValue,
        rating: clsValue < 0.1 ? "good" : clsValue < 0.25 ? "needs-improvement" : "poor"
      });
    }
  });
}

async function trackMetric(metricData) {
  try {
    await fetch(`${API}/api/analytics/performance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(metricData),
    });
  } catch (e) {
    // Fail silently
  }
}

export default ErrorBoundary;
