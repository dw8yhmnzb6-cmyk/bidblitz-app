import React, { act } from "react";
import { createRoot } from "react-dom/client";
import HomePage from "./HomePage";

let mockUser;
jest.mock("../store", () => ({
  useUser: () => mockUser,
  useI18n: () => ({ lang: "de", t: key => key }),
  useWallet: () => ({ balance: 10, currency: "EUR", cryptoBalanceEur: 0, totalBalanceEur: 10, cryptoBreakdown: [], transactions: [], isLoading: false }),
}));
jest.mock("../hooks", () => ({ useWalletStats: () => ({ percentageChange: 0 }) }));
jest.mock("../models", () => ({ getGreeting: () => "Hallo" }));
jest.mock("../models/homeTranslations", () => ({ useGuestTranslations: () => key => key }));
jest.mock("../services/tracker", () => ({ tracker: { guestVisit: jest.fn(), featureClick: jest.fn() } }));
jest.mock("../config/testMode", () => ({ KYC_DISABLED: false, SHOW_KYC_GATE: true, SHOW_LIVE_CHECK_BANNER: false, isTestModeUser: () => false }));
jest.mock("../components/LanguageSwitcher", () => () => <div data-testid="stub-LanguageSwitcher" />);
jest.mock("../components/QuickAccessBar", () => () => <div data-testid="stub-QuickAccessBar" />);
jest.mock("../components/AdBanner", () => () => <div data-testid="stub-AdBanner" />);
jest.mock("../components/HomeRecommendations", () => () => <div data-testid="stub-HomeRecommendations" />);
jest.mock("../components/SmartRecommendations", () => () => <div data-testid="stub-SmartRecommendations" />);
jest.mock("../components/ModeSwitcher", () => () => <div data-testid="stub-ModeSwitcher" />);
jest.mock("../components/PremiumLaunchBanner", () => () => <div data-testid="stub-PremiumLaunchBanner" />);
jest.mock("../components/RecommendAppCard", () => () => <div data-testid="stub-RecommendAppCard" />);
jest.mock("../components/BirthdayBonusBanner", () => () => <div data-testid="stub-BirthdayBonusBanner" />);
jest.mock("../components/QuestsWidget", () => () => <div data-testid="stub-QuestsWidget" />);
jest.mock("../components/SponsoredAdSlot", () => () => <div data-testid="stub-SponsoredAdSlot" />);
jest.mock("../components/KYCBanner", () => () => <div data-testid="stub-KYCBanner" />);
jest.mock("../components/home/P2PHeroSection", () => ({ P2PHeroSection: () => <div data-testid="stub-P2PHeroSection" /> }));
jest.mock("../components/home/HomeVisionSection", () => ({ HomeVisionSection: () => <div data-testid="stub-HomeVisionSection" /> }));
jest.mock("../components/home/HomeWhyNowSection", () => ({ HomeWhyNowSection: () => <div data-testid="stub-HomeWhyNowSection" /> }));
jest.mock("../components/home/HomeInvestorOpportunitySection", () => ({ HomeInvestorOpportunitySection: () => <div data-testid="stub-HomeInvestorOpportunitySection" /> }));
jest.mock("../components/home/HomeWhyBidBlitzSection", () => ({ HomeWhyBidBlitzSection: () => <div data-testid="stub-HomeWhyBidBlitzSection" /> }));
jest.mock("../components/home/HomeMiningTrustPromo", () => ({ HomeMiningTrustPromo: () => <div data-testid="stub-HomeMiningTrustPromo" /> }));

let container, root, media, listener, props;
const find = testid => container.querySelector('[data-testid="' + testid + '"]');
// ReactDOM createRoot updates need act; no Testing Library render is used.
// eslint-disable-next-line testing-library/no-unnecessary-act
const mountHome = updates => act(() => root.render(<HomePage {...props} {...updates} />));
beforeEach(() => {
  mockUser = { name: "User", avatar: "/avatar.png", kyc_status: "approved" };
  props = { isGuest: true, onNavigate: jest.fn(), onLogin: jest.fn(), onRegister: jest.fn() };
  media = { matches: true, addEventListener: jest.fn((event, fn) => { listener = fn; }), removeEventListener: jest.fn() };
  window.matchMedia = jest.fn(() => media);
  localStorage.clear();
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

test("mobile guest gets compact content and desktop marketing returns when the viewport widens", () => {
  mountHome();
  expect(find("mobile-home-intro")).not.toBeNull();
  expect(find("stub-P2PHeroSection")).toBeNull();
  expect(find("stub-HomeVisionSection")).toBeNull();
  expect(find("stub-QuestsWidget")).toBeNull();
  expect(find("header-register-btn")).toBeNull();
  act(() => { media.matches = false; listener(); });
  expect(find("mobile-home-content")).toBeNull();
  expect(find("stub-P2PHeroSection")).not.toBeNull();
  expect(find("stub-HomeVisionSection")).not.toBeNull();
  expect(find("header-register-btn")).not.toBeNull();
});

test("verified mobile customer gets the wallet, four quick actions and recent activity", () => {
  mountHome({ isGuest: false });
  expect(find("hero-balance-card")).not.toBeNull();
  const actions = find("home-quick-actions").querySelectorAll("button");
  expect(actions).toHaveLength(4);
  expect(actions[3].textContent).toBe("Mein QR");
  act(() => actions[3].click());
  expect(props.onNavigate).toHaveBeenLastCalledWith("/receive-money");
  expect(find("mobile-home-activity")).not.toBeNull();
  expect(find("stub-QuestsWidget")).toBeNull();
  expect(find("stub-HomeRecommendations")).toBeNull();
});

test("mobile customer awaiting KYC still sees the existing restriction instead of wallet or services", () => {
  mockUser.kyc_status = "pending";
  mountHome({ isGuest: false });
  expect(find("pre-kyc-home-gate")).not.toBeNull();
  expect(find("hero-balance-card")).toBeNull();
  expect(find("home-quick-actions")).toBeNull();
  expect(find("mobile-home-content")).toBeNull();
  act(() => find("pre-kyc-home-start-button").click());
  expect(props.onNavigate).toHaveBeenLastCalledWith("/kyc");
});


test("desktop authenticated home prioritizes auctions and mining", () => {
  media.matches = false;
  mountHome({ isGuest: false });
  expect(find("home-priority-modules")).not.toBeNull();
  expect(find("home-priority-auctions")).not.toBeNull();
  expect(find("home-priority-mining")).not.toBeNull();
  act(() => find("home-priority-auctions").click());
  expect(props.onNavigate).toHaveBeenLastCalledWith("/auctions");
  act(() => find("home-priority-mining").click());
  expect(props.onNavigate).toHaveBeenLastCalledWith("/mining");
});
