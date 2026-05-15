/**
 * Error Boundary & Global Error Handler
 * Fängt React Errors und sendet an Backend
 */
import { Component } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
    
    this.setState({ error, errorInfo });

    // Log error to backend
    this.logError({
      error_type: "react_error",
      message: error.toString(),
      stack_trace: errorInfo.componentStack,
      context: {
        component: errorInfo.componentStack?.split("\n")[1],
      },
      page: window.location.pathname,
      severity: "error",
    });
  }

  async logError(errorData) {
    try {
      await fetch(`${API}/api/monitoring/log-error`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(errorData),
      });
    } catch (e) {
      console.error("Failed to log error:", e);
    }
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
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <RefreshCw size={20} />
              Seite neu laden
            </button>

            <button
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
  // Unhandled Promise Rejections
  window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled promise rejection:", event.reason);
    
    logErrorToBackend({
      error_type: "unhandled_promise",
      message: event.reason?.message || String(event.reason),
      stack_trace: event.reason?.stack,
      page: window.location.pathname,
      severity: "warning",
    });
  });

  // Global errors
  window.addEventListener("error", (event) => {
    console.error("Global error:", event.error);
    
    logErrorToBackend({
      error_type: "global_error",
      message: event.message,
      stack_trace: event.error?.stack,
      context: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
      page: window.location.pathname,
      severity: "error",
    });
  });

  // Console errors (optional, might be noisy)
  const originalConsoleError = console.error;
  console.error = (...args) => {
    originalConsoleError(...args);
    
    // Only log errors, not warnings
    if (args.length > 0 && args[0] instanceof Error) {
      logErrorToBackend({
        error_type: "console_error",
        message: args[0].message,
        stack_trace: args[0].stack,
        page: window.location.pathname,
        severity: "warning",
      });
    }
  };
}

async function logErrorToBackend(errorData) {
  try {
    await fetch(`${API}/api/monitoring/log-error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(errorData),
    });
  } catch (e) {
    // Fail silently
  }
}

/**
 * Performance Monitoring
 */
export function trackPerformance() {
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
