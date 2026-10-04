import fs from "fs";
import path from "path";
import { ADMIN_ACCESS_AREAS, NATIVE_ADMIN_PATHS } from "./projectAccessAreas";

test("every named admin route is present exactly once in the rights navigator", () => {
  const app = fs.readFileSync(path.join(__dirname, "../../App.js"), "utf8");
  const specialRoutes = fs.readFileSync(path.join(__dirname, "../../app/renderSpecialRoutes.jsx"), "utf8");
  const mainRoutes = [...app.matchAll(/case "(\/admin(?:\/[^" ]+)?|\/car-rental\/admin(?:\/[^" ]+)?|\/mining-trust-admin)"/g)].map((match) => match[1]);
  const additionalRoutes = [...specialRoutes.matchAll(/basePath === "(\/admin\/[^" ]+)"/g)].map((match) => match[1]);
  const expected = [...new Set([...mainRoutes, ...additionalRoutes])].filter((route) => route !== "/admin" && route !== "/admin/projects");
  const actual = ADMIN_ACCESS_AREAS.map((area) => area.path);
  expect(actual.slice().sort()).toEqual(expected.slice().sort());
  expect(new Set(actual).size).toBe(actual.length);
  expect(NATIVE_ADMIN_PATHS.has("/admin/payments")).toBe(true);
  expect(NATIVE_ADMIN_PATHS.has("/admin/fake")).toBe(false);
  expect(NATIVE_ADMIN_PATHS.has("https://evil.example/admin")).toBe(false);
});

test("existing admin-only AI assistant does not advertise super-admin navigation", () => {
  expect(ADMIN_ACCESS_AREAS.find((area) => area.path === "/admin/ai-assistant").roles).toEqual(["admin"]);
});

test("account banner does not cover the central project header", () => {
  const app = fs.readFileSync(path.join(__dirname, "../../App.js"), "utf8");
  expect(app).toContain('<ActiveAccountBanner inline={routeBase === "/admin/projects"} />');
});
