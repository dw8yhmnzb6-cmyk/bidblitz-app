import { getAppShellFlags } from "./appShellFlags";

test("mobility map uses an immersive shell on mobile", () => {
  for (const route of ["/mobility-map", "/mobility-map?mode=scooter", "/mobility-map?mode=taxi"]) {
    const flags = getAppShellFlags(route, false);
    expect(flags.showBackToHome).toBe(false);
    expect(flags.showBottomNav).toBe(false);
  }
});

test("mobility center keeps normal app navigation", () => {
  const flags = getAppShellFlags("/mobility-center", false);
  expect(flags.showBackToHome).toBe(true);
  expect(flags.showBottomNav).toBe(true);
});

test("desktop never receives the mobile bottom navigation", () => {
  const flags = getAppShellFlags("/mobility-center", true);
  expect(flags.showBottomNav).toBe(false);
});


test("admin routes use their own shell on mobile", () => {
  for (const route of ["/admin", "/admin/mobility-pricing", "/admin/investor-dashboard"]) {
    const flags = getAppShellFlags(route, false);
    expect(flags.isAdminShell).toBe(true);
    expect(flags.showBackToHome).toBe(false);
    expect(flags.showBottomNav).toBe(false);
  }
});
