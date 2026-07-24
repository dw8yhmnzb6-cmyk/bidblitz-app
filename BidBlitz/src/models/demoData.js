const now = new Date();
const day1 = new Date(now.getTime() - 86400000);
const day2 = new Date(now.getTime() - 172800000);
const day3 = new Date(now.getTime() - 345600000);

export const DEMO_BALANCE = 1234.56;
export const DEMO_CURRENCY = "EUR";
export const DEMO_CARD_NUMBER = "4242  ****  ****  7890";
export const DEMO_CARD_EXPIRY = "12/28";
export const DEMO_CARD_HOLDER = "DEMO USER";

export const DEMO_TRANSACTIONS = [
  { id: "demo-1", type: "payment", amount: -24.99, status: "completed", date: now.toISOString(), merchantName: "Coffee House", category: "food", icon: "credit-card", reference: "TX-DEMO-001", description: "Coffee House" },
  { id: "demo-2", type: "topup", amount: 500.0, status: "completed", date: now.toISOString(), merchantName: "Stripe Top-Up", category: "topup", icon: "plus-circle", reference: "TX-DEMO-002", description: "Top-Up via Card" },
  { id: "demo-3", type: "payment", amount: -89.9, status: "completed", date: day1.toISOString(), merchantName: "TechShop Berlin", category: "shopping", icon: "credit-card", reference: "TX-DEMO-003", description: "TechShop Berlin" },
  { id: "demo-4", type: "send", amount: -50.0, status: "completed", date: day1.toISOString(), merchantName: "To: Max M.", category: "transfer", icon: "credit-card", reference: "TX-DEMO-004", description: "Transfer to Max M." },
  { id: "demo-5", type: "payment", amount: -15.5, status: "completed", date: day2.toISOString(), merchantName: "Metro Kiosk", category: "food", icon: "credit-card", reference: "TX-DEMO-005", description: "Metro Kiosk" },
  { id: "demo-6", type: "topup", amount: 200.0, status: "completed", date: day3.toISOString(), merchantName: "Bank Transfer", category: "topup", icon: "plus-circle", reference: "TX-DEMO-006", description: "Bank Transfer" },
];

export const DEMO_MERCHANT = {
  businessName: "Demo Shop",
  todayEarnings: 345.0,
  totalEarnings: 8723.45,
  totalTransactions: 156,
  todayPaymentCount: 8,
  changeFromYesterday: 12.5,
  weeklyData: [
    { day: "Mon", earnings: 420 },
    { day: "Tue", earnings: 580 },
    { day: "Wed", earnings: 310 },
    { day: "Thu", earnings: 690 },
    { day: "Fri", earnings: 520 },
    { day: "Sat", earnings: 780 },
    { day: "Sun", earnings: 345 },
  ],
  recentPayments: [
    { id: "dp-1", customerId: "Anna K.", amount: 45.0, time: "2 min ago", date: now.toISOString() },
    { id: "dp-2", customerId: "Lukas B.", amount: 89.0, time: "18 min ago", date: now.toISOString() },
    { id: "dp-3", customerId: "Sophie T.", amount: 23.5, time: "1 hr ago", date: now.toISOString() },
    { id: "dp-4", customerId: "Jan W.", amount: 112.0, time: "3 hrs ago", date: day1.toISOString() },
  ],
  balance: {
    available: 1842.3,
    pending_payout: 345.0,
    total_paid_out: 6536.15,
    total_fees: 218.05,
    total_earnings: 8723.45,
    gross_earnings: 8941.5,
    min_payout: 5,
    payout_flat_fee: 0.5,
  },
};

export const DEMO_USER = {
  name: "Demo User",
  email: "demo@bidblitz.app",
  role: "user",
  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=DemoUser",
  isPremium: true,
  created_at: "2025-01-15T10:00:00Z",
};
