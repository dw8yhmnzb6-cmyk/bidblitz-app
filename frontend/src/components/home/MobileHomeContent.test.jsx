import React, { act } from "react";
import { createRoot } from "react-dom/client";
import MobileHomeContent from "./MobileHomeContent";
import { getMobileHomeCopy } from "../../models/mobileHomeCopy";

let mockWallet;
let mockLanguage;
jest.mock("../../store", () => ({
  useI18n: () => ({ lang: mockLanguage, t: key => key }),
  useWallet: () => mockWallet,
}));

let container;
let root;
let props;
// ReactDOM createRoot is used directly; its updates require act (no Testing Library render).
// eslint-disable-next-line testing-library/no-unnecessary-act
const renderComponent = updates => act(() => root.render(<MobileHomeContent {...props} {...updates} />));
beforeEach(() => {
  mockLanguage = "de";
  mockWallet = { transactions: [], currency: "EUR", isLoading: false, error: null };
  props = { isGuest: true, onNavigate: jest.fn(), onRegister: jest.fn(), onLogin: jest.fn(), gt: key => key };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  global.IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete global.IS_REACT_ACT_ENVIRONMENT;
});

test("guest can sign in or register without seeing a wallet history or demo balances", () => {
  mockWallet.transactions = [{ id: "private", amount: 999, merchantName: "PRIVATE DATA" }];
  renderComponent();
  expect(container.querySelector('[data-testid="mobile-home-activity"]')).toBeNull();
  expect(container.textContent).not.toContain("PRIVATE DATA");
  const buttons = [...container.querySelectorAll("button")];
  act(() => buttons.find(b => b.textContent === "auth.register").click());
  act(() => buttons.find(b => b.textContent === "auth.signin").click());
  expect(props.onRegister).toHaveBeenCalledTimes(1);
  expect(props.onLogin).toHaveBeenCalledTimes(1);
});

test("existing service and information destinations remain reachable", () => {
  renderComponent();
  const destinations = [
    ["mobile-service-mobility-center", "/mobility-center"],
    ["mobile-service-marketplace", "/marketplace"],
    ["mobile-service-loyalty", "/loyalty"],
    ["mobile-service-all-services", "/all-services"],
  ];
  for (const [testid, path] of destinations) {
    const button = container.querySelector('[data-testid="' + testid + '"]');
    act(() => button.click());
    expect(props.onNavigate).toHaveBeenLastCalledWith(path);
  }
  for (const [label, path] of [["Über BidBlitz", "/about-bidblitz"], ["Investoren", "/investieren"], ["more.support", "/support"]]) {
    const button = [...container.querySelectorAll("button")].find(b => b.textContent === label);
    act(() => button.click());
    expect(props.onNavigate).toHaveBeenLastCalledWith(path);
  }
});

test("shows only the three latest real transactions without mutating wallet state", () => {
  const transactions = [1, 5, 2, 4, 3].map(n => ({ id: String(n), date: "2026-09-0" + n, amount: n, merchantName: "Merchant " + n }));
  mockWallet.transactions = transactions;
  renderComponent({ isGuest: false });
  const rows = [...container.querySelectorAll('[data-testid="mobile-recent-transaction"]')];
  expect(rows).toHaveLength(3);
  expect(rows.map(r => r.textContent)).toEqual([expect.stringContaining("Merchant 5"), expect.stringContaining("Merchant 4"), expect.stringContaining("Merchant 3")]);
  expect(transactions.map(t => t.id)).toEqual(["1", "5", "2", "4", "3"]);
  act(() => rows[0].click());
  expect(props.onNavigate).toHaveBeenLastCalledWith("/wallet");
});

test("hidden balance also hides recent transaction amounts", () => {
  mockWallet.transactions = [{ id: "1", date: "2026-09-17", amount: 1234.56, merchantName: "Shop" }];
  renderComponent({ isGuest: false, balanceHidden: true });
  expect(container.textContent).toContain("••••");
  expect(container.textContent).not.toContain("1.234");
  renderComponent({ isGuest: false, balanceHidden: false });
  expect(container.textContent).toContain("1.234,56");
});

test("loading or failed wallet requests do not claim an empty history", () => {
  mockWallet.isLoading = true;
  renderComponent({ isGuest: false });
  expect(container.textContent).not.toContain("Noch keine Aktivitäten");
  mockWallet.isLoading = false;
  mockWallet.error = "unavailable";
  renderComponent({ isGuest: false });
  expect(container.textContent).not.toContain("Noch keine Aktivitäten");
  mockWallet.error = null;
  renderComponent({ isGuest: false });
  expect(container.textContent).toContain("Noch keine Aktivitäten");
});

test("copy supports all existing languages and regional variants", () => {
  for (const lang of ["de","en","en-US","sq","sq-XK","tr","fr","es","it","pt","nl","pl","ru","ar","ar-AE"]) {
    expect(Object.values(getMobileHomeCopy(lang)).every(text => typeof text === "string" && text.length > 0)).toBe(true);
  }
  expect(getMobileHomeCopy("sq-XK")).toEqual(getMobileHomeCopy("sq"));
  expect(getMobileHomeCopy("ar-AE")).toEqual(getMobileHomeCopy("ar"));
});
