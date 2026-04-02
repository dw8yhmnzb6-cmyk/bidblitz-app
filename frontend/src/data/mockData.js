// BidBlitz V2 - Mock Data

export const userData = {
  name: "Alex",
  avatar: "https://images.unsplash.com/photo-1737574821698-862e77f044c1?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NjZ8MHwxfHNlYXJjaHwxfHxwb3J0cmFpdCUyMG1vZGVybiUyMHByb2Zlc3Npb25hbHxlbnwwfHx8fDE3NzUxNjE1Nzh8MA&ixlib=rb-4.1.0&q=85",
  email: "alex@bidblitz.com"
};

export const walletData = {
  balance: 2847.65,
  currency: "€",
  cardNumber: "•••• •••• •••• 4821",
  cardExpiry: "09/28",
  cardHolder: "ALEX MITCHELL"
};

export const transactions = [
  {
    id: "txn_001",
    merchant: "Uber Trip",
    category: "transport",
    amount: -12.50,
    date: "2025-01-27T14:32:00",
    status: "completed",
    icon: "car"
  },
  {
    id: "txn_002",
    merchant: "Apple Store",
    category: "shopping",
    amount: -149.99,
    date: "2025-01-27T11:15:00",
    status: "completed",
    icon: "shopping-bag"
  },
  {
    id: "txn_003",
    merchant: "Salary Deposit",
    category: "income",
    amount: 3500.00,
    date: "2025-01-26T09:00:00",
    status: "completed",
    icon: "wallet"
  },
  {
    id: "txn_004",
    merchant: "Netflix",
    category: "entertainment",
    amount: -15.99,
    date: "2025-01-25T00:00:00",
    status: "completed",
    icon: "play"
  },
  {
    id: "txn_005",
    merchant: "Starbucks",
    category: "food",
    amount: -6.80,
    date: "2025-01-25T08:45:00",
    status: "completed",
    icon: "coffee"
  },
  {
    id: "txn_006",
    merchant: "Transfer to Max",
    category: "transfer",
    amount: -250.00,
    date: "2025-01-24T16:20:00",
    status: "completed",
    icon: "send"
  },
  {
    id: "txn_007",
    merchant: "Lime Scooter",
    category: "transport",
    amount: -4.25,
    date: "2025-01-24T13:10:00",
    status: "completed",
    icon: "zap"
  },
  {
    id: "txn_008",
    merchant: "Amazon",
    category: "shopping",
    amount: -89.99,
    date: "2025-01-23T18:30:00",
    status: "completed",
    icon: "package"
  }
];

export const merchantData = {
  businessName: "Urban Coffee Co.",
  totalEarnings: 15847.92,
  todayEarnings: 1247.50,
  weeklyData: [
    { day: "Mon", earnings: 890 },
    { day: "Tue", earnings: 1250 },
    { day: "Wed", earnings: 1100 },
    { day: "Thu", earnings: 1450 },
    { day: "Fri", earnings: 1680 },
    { day: "Sat", earnings: 2100 },
    { day: "Sun", earnings: 1247 }
  ],
  recentPayments: [
    { id: "pay_001", customer: "Customer #4821", amount: 24.50, time: "2 min ago" },
    { id: "pay_002", customer: "Customer #3156", amount: 18.75, time: "15 min ago" },
    { id: "pay_003", customer: "Customer #7892", amount: 42.00, time: "32 min ago" },
    { id: "pay_004", customer: "Customer #1234", amount: 8.50, time: "1 hr ago" },
    { id: "pay_005", customer: "Customer #5678", amount: 35.25, time: "2 hrs ago" }
  ]
};

export const features = [
  {
    id: "wallet",
    title: "Wallet",
    description: "Manage your money",
    icon: "wallet",
    color: "#00C2FF",
    large: true
  },
  {
    id: "taxi",
    title: "Taxi",
    description: "Book a ride",
    icon: "car",
    color: "#FFB800",
    image: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=400"
  },
  {
    id: "scooter",
    title: "Scooter",
    description: "Electric rides",
    icon: "zap",
    color: "#22C55E",
    image: "https://images.unsplash.com/photo-1762350988150-4fff02852a35?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzV8MHwxfHNlYXJjaHwyfHxtb2Rlcm4lMjBzY29vdGVyJTIwbmlnaHR8ZW58MHx8fHwxNzc1MTYxNTc4fDA&ixlib=rb-4.1.0&q=85"
  },
  {
    id: "food",
    title: "Food",
    description: "Order meals",
    icon: "utensils",
    color: "#EF4444",
    image: "https://images.unsplash.com/photo-1761315600943-d8a5bb0c499f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NDh8MHwxfHNlYXJjaHwxfHxyZXN0YXVyYW50JTIwZm9vZCUyMHByZW1pdW0lMjBkYXJrfGVufDB8fHx8MTc3NTE2MTU4OXww&ixlib=rb-4.1.0&q=85"
  },
  {
    id: "auctions",
    title: "Auctions",
    description: "Bid & win",
    icon: "gavel",
    color: "#A855F7"
  }
];

export const formatCurrency = (amount, currency = "€") => {
  const formatted = Math.abs(amount).toFixed(2);
  const sign = amount >= 0 ? "+" : "-";
  return `${sign}${currency}${formatted}`;
};

export const formatDate = (dateString) => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  } else if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  } else {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
};

export const formatTime = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
};

export const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
};
