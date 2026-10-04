import { act } from "react";
import { createRoot } from "react-dom/client";
import AdminProjectsPage from "./AdminProjectsPage";

const project = { id: "eyes", name: "Eyes.BidBlitz", description: "Face Search", category: "Weitere", icon: "BB", color: "#7c3aed", url: "https://eyes.bidblitz.ae", admin_url: "https://eyes.bidblitz.ae", status: "active", position: 10, revision: 0, sso: true, sso_ready: true, open_mode: "sso", sso_message: "SSO konfiguriert; das Zielprojekt prüft Anmeldung und Rechte." };
const data = { owner: { email: "admin@bidblitz.ae" }, projects: [project] };
const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
let container, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.fetch = jest.fn().mockResolvedValue(response(data));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); jest.restoreAllMocks(); });
// eslint-disable-next-line testing-library/no-unnecessary-act -- Raw ReactDOM createRoot requires act; Testing Library is not used here.
const render = async () => { await act(async () => root.render(<AdminProjectsPage onNavigate={jest.fn()} />)); };
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
  expect(container.textContent).toContain("0 Zugänge eingerichtet · 1 vorbereitet · 0 noch nicht angebunden");
});
