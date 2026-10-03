import React, { act } from "react";
import { createRoot } from "react-dom/client";
import WebUpdateBanner from "./WebUpdateBanner";

let mockNative = false;
jest.mock("../services/capacitorBridge", () => ({ isNativeApp: () => mockNative }));

const originalFetch = global.fetch;
const originalBuildId = process.env.REACT_APP_BUILD_ID;
const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
let root, container, meta, workerEvents;
const banner = () => container.querySelector('[data-testid="web-update-banner"]');
// Direct ReactDOM rendering requires act; this is not Testing Library's render.
// eslint-disable-next-line testing-library/no-unnecessary-act
const mountBanner = async () => { await act(async () => { root.render(<WebUpdateBanner />); }); };

beforeEach(() => {
  mockNative = false;
  process.env.REACT_APP_BUILD_ID = "loaded-build";
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ build_id: "server-build" }) });
  workerEvents = new EventTarget();
  workerEvents.getRegistration = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: workerEvents });
  meta = document.createElement("meta");
  meta.name = "bidblitz-build-version";
  meta.content = "server-build";
  document.head.appendChild(meta);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  global.IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  meta.remove();
  global.fetch = originalFetch;
  if (originalBuildId === undefined) delete process.env.REACT_APP_BUILD_ID;
  else process.env.REACT_APP_BUILD_ID = originalBuildId;
  if (originalServiceWorker) Object.defineProperty(navigator, "serviceWorker", originalServiceWorker);
  else delete navigator.serviceWorker;
  delete global.IS_REACT_ACT_ENVIRONMENT;
});

test("detects a new server build against the loaded bundle with just one uncached request", async () => {
  await mountBanner();
  expect(banner()).not.toBeNull();
  expect(banner().textContent).toContain("server-build");
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/version.json?ts="), { cache: "no-store" });
});

test("does not announce an update when the server and loaded bundle match", async () => {
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ build_id: "loaded-build" }) });
  await mountBanner();
  expect(banner()).toBeNull();
});

test("uses the document build only when a bundle build is unavailable", async () => {
  delete process.env.REACT_APP_BUILD_ID;
  meta.content = "document-build";
  await mountBanner();
  expect(banner()).not.toBeNull();
});

test("ignores failed HTTP responses and network failures", async () => {
  global.fetch.mockResolvedValue({ ok: false, json: async () => ({ build_id: "invalid-build" }) });
  await mountBanner();
  expect(banner()).toBeNull();
  global.fetch.mockRejectedValue(new Error("offline"));
  await act(async () => { window.dispatchEvent(new Event("focus")); });
  expect(banner()).toBeNull();
});

test("checks again when the app regains focus and accepts frontend_version", async () => {
  global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ build_id: "loaded-build" }) });
  await mountBanner();
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ frontend_version: "next-build" }) });
  await act(async () => { window.dispatchEvent(new Event("focus")); });
  expect(banner().textContent).toContain("next-build");
});

test("reads the service worker buildId and ignores an activation of the current build", async () => {
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ build_id: "loaded-build" }) });
  await mountBanner();
  act(() => workerEvents.dispatchEvent(new MessageEvent("message", { data: { type: "SW_UPDATED", buildId: "loaded-build" } })));
  expect(banner()).toBeNull();
  act(() => workerEvents.dispatchEvent(new MessageEvent("message", { data: { type: "SW_UPDATED", buildId: "sw-next-build" } })));
  expect(banner().textContent).toContain("sw-next-build");
});

test("native apps do not fetch or show web updates", async () => {
  mockNative = true;
  await mountBanner();
  expect(global.fetch).not.toHaveBeenCalled();
  expect(banner()).toBeNull();
});
