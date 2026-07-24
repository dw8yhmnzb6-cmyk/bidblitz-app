/**
 * BidBlitz V2 - Initial Data
 * Seed data for development and demo purposes
 */

import { generateId } from './index';

// Initial user data
export const initialUser = {
  id: 'user_001',
  name: 'Alex',
  email: 'alex@bidblitz.com',
  avatar: 'https://images.unsplash.com/photo-1737574821698-862e77f044c1?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NjZ8MHwxfHNlYXJjaHwxfHxwb3J0cmFpdCUyMG1vZGVybiUyMHByb2Zlc3Npb25hbHxlbnwwfHx8fDE3NzUxNjE1Nzh8MA&ixlib=rb-4.1.0&q=85',
  isPremium: true,
};

// Initial wallet data
export const initialWallet = {
  balance: 2847.65,
  currency: '€',
  cardNumber: '•••• •••• •••• 4821',
  cardExpiry: '09/28',
  cardHolder: 'ALEX MITCHELL',
  transactions: [
    {
      id: 'txn_001',
      type: 'payment',
      amount: -12.50,
      status: 'success',
      date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      merchantName: 'Uber Trip',
      category: 'transport',
      icon: 'car',
    },
    {
      id: 'txn_002',
      type: 'payment',
      amount: -149.99,
      status: 'success',
      date: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
      merchantName: 'Apple Store',
      category: 'shopping',
      icon: 'shopping-bag',
    },
    {
      id: 'txn_003',
      type: 'topup',
      amount: 3500.00,
      status: 'success',
      date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      merchantName: 'Salary Deposit',
      category: 'income',
      icon: 'wallet',
    },
    {
      id: 'txn_004',
      type: 'payment',
      amount: -15.99,
      status: 'success',
      date: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 2 days ago
      merchantName: 'Netflix',
      category: 'entertainment',
      icon: 'play',
    },
    {
      id: 'txn_005',
      type: 'payment',
      amount: -6.80,
      status: 'success',
      date: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      merchantName: 'Starbucks',
      category: 'food',
      icon: 'coffee',
    },
    {
      id: 'txn_006',
      type: 'send',
      amount: -250.00,
      status: 'success',
      date: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(), // 3 days ago
      merchantName: 'Transfer to Max',
      category: 'transfer',
      icon: 'send',
    },
    {
      id: 'txn_007',
      type: 'payment',
      amount: -4.25,
      status: 'success',
      date: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
      merchantName: 'Lime Scooter',
      category: 'transport',
      icon: 'zap',
    },
    {
      id: 'txn_008',
      type: 'payment',
      amount: -89.99,
      status: 'success',
      date: new Date(Date.now() - 96 * 60 * 60 * 1000).toISOString(), // 4 days ago
      merchantName: 'Amazon',
      category: 'shopping',
      icon: 'package',
    },
  ],
};

// Initial merchant data
export const initialMerchant = {
  id: 'merchant_001',
  businessName: 'Urban Coffee Co.',
  totalEarnings: 15847.92,
  todayEarnings: 1247.50,
  weeklyData: [
    { day: 'Mon', earnings: 890 },
    { day: 'Tue', earnings: 1250 },
    { day: 'Wed', earnings: 1100 },
    { day: 'Thu', earnings: 1450 },
    { day: 'Fri', earnings: 1680 },
    { day: 'Sat', earnings: 2100 },
    { day: 'Sun', earnings: 1247 },
  ],
  payments: [
    { 
      id: 'pay_001', 
      customerId: 'Customer #4821', 
      amount: 24.50, 
      time: '2 min ago',
      date: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    },
    { 
      id: 'pay_002', 
      customerId: 'Customer #3156', 
      amount: 18.75, 
      time: '15 min ago',
      date: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
    { 
      id: 'pay_003', 
      customerId: 'Customer #7892', 
      amount: 42.00, 
      time: '32 min ago',
      date: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
    },
    { 
      id: 'pay_004', 
      customerId: 'Customer #1234', 
      amount: 8.50, 
      time: '1 hr ago',
      date: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    },
    { 
      id: 'pay_005', 
      customerId: 'Customer #5678', 
      amount: 35.25, 
      time: '2 hrs ago',
      date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
  ],
};

// Feature list for homepage
export const features = [
  {
    id: 'wallet',
    title: 'Wallet',
    description: 'Manage your money',
    icon: 'wallet',
    color: '#00C2FF',
    large: true,
  },
  {
    id: 'taxi',
    title: 'Taxi',
    description: 'Book a ride',
    icon: 'car',
    color: '#FFB800',
    image: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=400',
  },
  {
    id: 'scooter',
    title: 'Scooter',
    description: 'Electric rides',
    icon: 'zap',
    color: '#22C55E',
    image: 'https://images.unsplash.com/photo-1762350988150-4fff02852a35?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzV8MHwxfHNlYXJjaHwyfHxtb2Rlcm4lMjBzY29vdGVyJTIwbmlnaHR8ZW58MHx8fHwxNzc1MTYxNTc4fDA&ixlib=rb-4.1.0&q=85',
  },
  {
    id: 'food',
    title: 'Food',
    description: 'Order meals',
    icon: 'utensils',
    color: '#EF4444',
    image: 'https://images.unsplash.com/photo-1761315600943-d8a5bb0c499f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NDh8MHwxfHNlYXJjaHwxfHxyZXN0YXVyYW50JTIwZm9vZCUyMHByZW1pdW0lMjBkYXJrfGVufDB8fHx8MTc3NTE2MTU4OXww&ixlib=rb-4.1.0&q=85',
  },
  {
    id: 'auctions',
    title: 'Auctions',
    description: 'Bid & win',
    icon: 'gavel',
    color: '#A855F7',
  },
];
