const mockHealth = { requestAuthorization: jest.fn(), readSamples: jest.fn() };

beforeEach(() => {
  jest.resetModules();
  delete window.Capacitor;
});

afterEach(() => {
  delete window.Capacitor;
  jest.clearAllMocks();
});

function setup(platform, native) {
  window.Capacitor = {
    getPlatform: () => platform,
    isNativePlatform: () => native,
  };
  let pluginLoads = 0;
  jest.doMock("@capgo/capacitor-health", () => {
    pluginLoads += 1;
    return { Health: mockHealth };
  });
  const bridge = require("./capacitorBridge");
  return { bridge, getPluginLoads: () => pluginLoads };
}

test("Android exposes no health feature and never imports the native health plugin", async () => {
  const { bridge, getPluginLoads } = setup("android", true);
  expect(bridge.supportsHealthFeatures()).toBe(false);
  await expect(bridge.loadNativeHealthBridge()).resolves.toBeNull();
  expect(getPluginLoads()).toBe(0);
  expect(mockHealth.requestAuthorization).not.toHaveBeenCalled();
  expect(mockHealth.readSamples).not.toHaveBeenCalled();
});

test("Android health stays unavailable even when the native flag is missing", async () => {
  const { bridge, getPluginLoads } = setup("android", false);
  expect(bridge.supportsHealthFeatures()).toBe(false);
  await expect(bridge.loadNativeHealthBridge()).resolves.toBeNull();
  expect(getPluginLoads()).toBe(0);
});

test("existing iOS health integration remains available", async () => {
  const { bridge, getPluginLoads } = setup("ios", true);
  expect(bridge.supportsHealthFeatures()).toBe(true);
  await expect(bridge.loadNativeHealthBridge()).resolves.toBe(mockHealth);
  expect(getPluginLoads()).toBe(1);
});

test("web preview never loads a native health plugin", async () => {
  const { bridge, getPluginLoads } = setup("web", false);
  expect(bridge.supportsHealthFeatures()).toBe(true);
  await expect(bridge.loadNativeHealthBridge()).resolves.toBeNull();
  expect(getPluginLoads()).toBe(0);
});

test("plain browser with no Capacitor bridge returns no native health access", async () => {
  const bridge = require("./capacitorBridge");
  await expect(bridge.loadNativeHealthBridge()).resolves.toBeNull();
});
