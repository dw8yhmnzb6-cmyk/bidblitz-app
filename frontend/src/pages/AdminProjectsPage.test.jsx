import { act } from "react";
import { createRoot } from "react-dom/client";
import AdminProjectsPage from "./AdminProjectsPage";

const project = { id: "eyes", name: "Eyes.BidBlitz", description: "Face Search", category: "Weitere", icon: "BB", color: "#7c3aed", url: "https://eyes.bidblitz.ae", admin_url: "https://eyes.bidblitz.ae", status: "active", position: 10, revision: 0, sso: true, sso_ready: true, open_mode: "sso", sso_message: "SSO konfiguriert; das Zielprojekt prüft Anmeldung und Rechte." };
const data = { owner: { email: "admin@bidblitz.ae" }, projects: [project] };
const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
let container, root, navigate;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.fetch = jest.fn().mockResolvedValue(response(data));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  navigate = jest.fn();
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); jest.restoreAllMocks(); });
// eslint-disable-next-line testing-library/no-unnecessary-act -- Raw ReactDOM createRoot requires act; Testing Library is not used here.
const render = async () => { await act(async () => root.render(<AdminProjectsPage onNavigate={navigate} />)); };
const button = (text) => [...container.querySelectorAll("button")].find((b) => b.textContent === text);
const click = async (element) => { await act(async () => element.click()); };
const change = async (input, value) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value").set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
};

test("failed SSO keeps project cards visible and permits retry", async () => {
  await render();
  fetch.mockResolvedValueOnce(response({ detail: "Projekt nicht erreichbar" }, 503));
  await click(button("Mit BidBlitz anmelden"));
  expect(container.querySelector("[role=alert]").textContent).toContain("Projekt nicht erreichbar");
  expect(container.querySelectorAll("article").length).toBe(1);
  expect(button("Mit BidBlitz anmelden").disabled).toBe(false);
  expect(fetch.mock.calls[1][1].headers["X-BidBlitz-Admin"]).toBe("1");
});

test("failed initial load can be retried", async () => {
  fetch.mockResolvedValueOnce(response({}, 401));
  await render();
  expect(container.textContent).toContain("Sitzung ist abgelaufen");
  expect(button("Neues Projekt hinzufügen")).toBeUndefined();
  await click(button("Erneut versuchen"));
  expect(container.querySelectorAll("article").length).toBe(1);
});

test("search has an empty result state", async () => {
  await render();
  await change(container.querySelector('input[placeholder="Projekt suchen…"]'), "gibtesnicht");
  expect(container.textContent).toContain("Keine Projekte für diesen Filter");
  expect(container.querySelectorAll("article").length).toBe(0);
});

test("editing sends only writable fields and preserves the revision", async () => {
  await render();
  await click(container.querySelector('[aria-label="Eyes.BidBlitz bearbeiten"]'));
  const name = container.querySelector('form input[maxlength="100"]');
  await change(name, "Eyes neu");
  fetch.mockResolvedValueOnce(response({ project: { ...project, name: "Eyes neu", revision: 1 } }));
  await act(async () => container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  const options = fetch.mock.calls[1][1];
  const body = JSON.parse(options.body);
  expect(options.method).toBe("PUT");
  expect(body.name).toBe("Eyes neu");
  expect(body.revision).toBe(0);
  expect(body.sso_message).toBeUndefined();
  expect(body.open_mode).toBeUndefined();
  expect(container.textContent).toContain("Projekt gespeichert.");
  expect(container.querySelector("h2").textContent).toBe("Eyes neu");
});

test("save conflict retains the draft for correction", async () => {
  await render();
  await click(container.querySelector('[aria-label="Eyes.BidBlitz bearbeiten"]'));
  fetch.mockResolvedValueOnce(response({ detail: "Das Projekt wurde inzwischen geändert. Bitte neu laden." }, 409));
  await act(async () => container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(container.querySelector("form")).not.toBeNull();
  expect(container.querySelector("[role=alert]").textContent).toContain("inzwischen geändert");
  expect(button("Speichern").disabled).toBe(false);
});

test("hidden projects cannot be opened", async () => {
  fetch.mockResolvedValueOnce(response({ ...data, projects: [{ ...project, status: "hidden", open_mode: "unavailable" }] }));
  await render();
  expect(button("Noch nicht verfügbar").disabled).toBe(true);
  expect(container.querySelector('[aria-label="Eyes.BidBlitz bearbeiten"]').disabled).toBe(false);
});

test("create adds the saved project without losing existing cards", async () => {
  await render();
  await click(button("Neues Projekt hinzufügen"));
  await change(container.querySelector('form input[maxlength="100"]'), "Neu");
  await change(container.querySelector('form input[minlength="2"]'), "neu");
  fetch.mockResolvedValueOnce(response({ project: { ...project, id: "neu", name: "Neu", position: 100, open_mode: "unavailable", revision: 1 } }, 201));
  await act(async () => container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(fetch.mock.calls[1][1].method).toBe("POST");
  expect(JSON.parse(fetch.mock.calls[1][1].body).id).toBe("neu");
  expect(container.querySelectorAll("article").length).toBe(2);
});


test("prepared access stays disabled and summary shows connection state", async () => {
  fetch.mockResolvedValueOnce(response({ ...data, projects: [{ ...project, sso_ready: false, open_mode: "unavailable" }] }));
  await render();
  expect(button("Noch nicht verfügbar").disabled).toBe(true);
  expect(container.textContent).toContain("0 interne Einstiege · 0 SSO-Aussteller konfiguriert · 1 vorbereitet · 0 ohne SSO-Empfänger");
});

test("native modules open their own fixed admin entry without SSO", async () => {
  fetch.mockResolvedValueOnce(response({ ...data, projects: [{ ...project, id: "pay", name: "BidBlitz Pay", kind: "module", open_mode: "internal", native_path: "/admin/payments", admin_url: "https://evil.example" }] }));
  await render();
  await click(button("Admin öffnen"));
  expect(navigate).toHaveBeenCalledWith("/admin/payments");
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("malformed native entry cannot redirect out of the admin", async () => {
  fetch.mockResolvedValueOnce(response({ ...data, projects: [{ ...project, open_mode: "internal", native_path: "https://evil.example" }] }));
  await render();
  await click(button("Admin öffnen"));
  expect(navigate).not.toHaveBeenCalled();
  expect(container.querySelector("[role=alert]").textContent).toContain("nicht freigegeben");
});

test("rights view shows exact safe operations and opens the requested service module", async () => {
  fetch.mockResolvedValueOnce(response({ owner: { email: "admin@bidblitz.ae", database_role: "admin", can_manage_privileged_roles: true, can_cleanup_demo_data: false, service_modules: [{ id: "dating", name: "Dating", operations: ["read", "moderate"], note: "Keine harte Löschung" }] }, projects: [{ ...project, access_profile: { scope: "separate_project", required_role: "admin" } }] }));
  await render();
  await click(button("Alle Rechte & Admin-Bereiche"));
  expect(container.textContent).toContain("Aktuelle BidBlitz-Rolle: admin");
  expect(container.textContent).toContain("Ansehen · Moderieren");
  expect(container.textContent).toContain("Erforderliche lokale Rolle: admin");
  await click(button("Dating verwalten"));
  expect(navigate).toHaveBeenCalledWith("/admin/modules", { module: "dating" });
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("project aliases are searchable and modules can be filtered independently", async () => {
  fetch.mockResolvedValueOnce(response({ ...data, projects: [{ ...project, id: "spy", name: "Spy BidBlitz", aliases: ["BidBlitz Device"], kind: "project" }, { ...project, id: "staff", name: "BidBlitz Staff", kind: "module" }] }));
  await render();
  await change(container.querySelector('input[placeholder="Projekt suchen…"]'), "Device");
  expect(container.querySelectorAll("article").length).toBe(1);
  expect(container.textContent).toContain("Spy BidBlitz");
  await change(container.querySelector('input[placeholder="Projekt suchen…"]'), "");
  await change(container.querySelectorAll("select")[1], "module");
  expect(container.querySelectorAll("article").length).toBe(1);
  expect(container.textContent).toContain("BidBlitz Staff");
});

const diagnostic = { state: "issuer_ready", can_attempt: true, remote_access_verified: false,
  summary: "Aussteller konfiguriert; Zielzugriff bleibt unbestätigt.",
  issuer_settings: ["BIDBLITZ_SSO_EYES_SECRET"], checks: [
    { id: "key", label: "Aussteller-Schlüssel", state: "passed", detail: "Schlüsselwert bleibt verborgen." },
    { id: "local_account", label: "Lokales Admin-Konto", state: "pending", detail: "Bestehendes aktives Konto mit Rolle admin prüfen." },
  ] };

test("connection view uses loaded diagnostics without issuing codes or extra requests", async () => {
  fetch.mockResolvedValueOnce(response({ ...data, projects: [{ ...project, integration: diagnostic }] }));
  await render();
  await click(button("Anbindungen & offene Schritte"));
  expect(container.textContent).toContain("Zielzugriff bleibt unbestätigt");
  expect(container.textContent).toContain("1 offene Prüfungen");
  expect(container.textContent).toContain("BIDBLITZ_SSO_EYES_SECRET");
  expect(fetch).toHaveBeenCalledTimes(1);
  fetch.mockResolvedValueOnce(response({ detail: "Empfänger noch nicht erreichbar" }, 503));
  await click(button("Mit BidBlitz anmelden"));
  expect(fetch.mock.calls[1][0]).toContain("/api/admin/sso/eyes");
  expect(container.querySelector("[role=alert]").textContent).toContain("Empfänger noch nicht erreichbar");
});

test("connection checks filter and search missing setup while keeping blocked access disabled", async () => {
  fetch.mockResolvedValueOnce(response({ ...data, projects: [{ ...project, integration: diagnostic },
    { ...project, id: "verify", name: "BidBlitz Verify", open_mode: "unavailable", integration: { ...diagnostic, state: "issuer_incomplete", can_attempt: false, checks: [{ id: "destination", label: "Erlaubtes Übergabeziel", state: "blocked", detail: "Vertrauenswürdige HTTPS-Origin fehlt." }], receiver_setup: { sandbox_only: true, identity_setting: "BBV_BIDBLITZ_LOCAL_ADMIN_EMAIL", owner_setting: "BBV_BIDBLITZ_OWNER_ID", secret_setting: "BBV_BIDBLITZ_SSO_SHARED_SECRET", migration: "SQLite" } } }] }));
  await render();
  await click(button("Anbindungen & offene Schritte"));
  await change(container.querySelector('[aria-labelledby="project-connections-title"] select'), "blocked");
  expect(container.querySelectorAll("article").length).toBe(1);
  expect(container.textContent).toContain("ausschließlich Sandbox");
  expect(button("Mit BidBlitz anmelden").disabled).toBe(true);
  await change(container.querySelector('input[placeholder="Projekt, Rolle oder Prüfschritt suchen…"]'), "gibtesnicht");
  expect(container.textContent).toContain("Keine Anbindungen für diesen Filter");
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("connection view edits catalogue but never submits derived diagnostics", async () => {
  fetch.mockResolvedValueOnce(response({ ...data, projects: [{ ...project, integration: diagnostic }] }));
  await render();
  await click(button("Anbindungen & offene Schritte"));
  await click(button("Katalog bearbeiten"));
  fetch.mockResolvedValueOnce(response({ project: { ...project, integration: diagnostic, revision: 1 } }));
  await act(async () => container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(JSON.parse(fetch.mock.calls[1][1].body).integration).toBeUndefined();
  expect(container.textContent).toContain("Projekt gespeichert.");
});

test("old API without diagnostics never offers an unverified connection action", async () => {
  await render();
  await click(button("Anbindungen & offene Schritte"));
  expect(container.textContent).toContain("Anbindungsdiagnose noch nicht verfügbar");
  expect(button("Mit BidBlitz anmelden").disabled).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(1);
});
