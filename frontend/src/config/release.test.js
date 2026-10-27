describe("store-safe runtime scoping", () => {
  const originalStoreSafe = process.env.REACT_APP_STORE_SAFE_MODE;

  afterEach(() => {
    jest.resetModules();
    jest.dontMock("@capacitor/core");
    if (originalStoreSafe === undefined) delete process.env.REACT_APP_STORE_SAFE_MODE;
    else process.env.REACT_APP_STORE_SAFE_MODE = originalStoreSafe;
  });

  test("public web keeps auctions and mining visible even when store-safe env is enabled", () => {
    process.env.REACT_APP_STORE_SAFE_MODE = "true";
    jest.doMock("@capacitor/core", () => ({
      Capacitor: { isNativePlatform: () => false },
    }));

    jest.isolateModules(() => {
      const release = require("./release");
      expect(release.STORE_SAFE_MODE).toBe(false);
      expect(release.isStoreBlockedPath("/auctions")).toBe(false);
      expect(release.isStoreBlockedPath("/mining")).toBe(false);
      expect(release.filterStoreSafeItems([
        { id: "auctions", route: "/auctions" },
        { id: "mining", route: "/mining" },
      ])).toHaveLength(2);
    });
  });

  test("native store build still blocks store-restricted modules", () => {
    process.env.REACT_APP_STORE_SAFE_MODE = "true";
    jest.doMock("@capacitor/core", () => ({
      Capacitor: { isNativePlatform: () => true },
    }));

    jest.isolateModules(() => {
      const release = require("./release");
      expect(release.STORE_SAFE_MODE).toBe(true);
      expect(release.isStoreBlockedPath("/auctions")).toBe(true);
      expect(release.isStoreBlockedPath("/mining")).toBe(true);
      expect(release.filterStoreSafeItems([
        { id: "auctions", route: "/auctions" },
        { id: "mining", route: "/mining" },
        { id: "wallet", route: "/wallet" },
      ])).toEqual([{ id: "wallet", route: "/wallet" }]);
    });
  });
});
