import * as Sentry from "@sentry/react";
import { initializeErrorMonitoring } from "./errorMonitoring";

jest.mock("@sentry/react", () => ({ init: jest.fn() }));

describe("opt-in Sentry error monitoring", () => {
  const originalDsn = process.env.REACT_APP_SENTRY_DSN;

  afterEach(() => {
    jest.clearAllMocks();
    if (originalDsn === undefined) {
      delete process.env.REACT_APP_SENTRY_DSN;
    } else {
      process.env.REACT_APP_SENTRY_DSN = originalDsn;
    }
  });

  test("never starts monitoring without an explicitly configured DSN", () => {
    delete process.env.REACT_APP_SENTRY_DSN;
    expect(initializeErrorMonitoring()).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  test("disables PII, tracing, and breadcrumbs when enabled", () => {
    process.env.REACT_APP_SENTRY_DSN = "https://public@example.invalid/1";
    expect(initializeErrorMonitoring()).toBe(true);
    const options = Sentry.init.mock.calls[0][0];
    expect(options.sendDefaultPii).toBe(false);
    expect(options.tracesSampleRate).toBe(0);
    expect(options.maxBreadcrumbs).toBe(0);
    const event = {
      user: { email: "private@example.invalid" },
      request: { url: "/private" },
      contexts: { device: { model: "test" } },
      breadcrumbs: [{ message: "private" }],
      message: "synthetic test error",
    };
    expect(options.beforeSend(event)).toEqual({ message: "synthetic test error" });
  });
});
