/**
 * BidBlitz V2 - Data Models
 * Type definitions for the application
 */

/**
 * @typedef {Object} Transaction
 * @property {string} id - Unique transaction ID
 * @property {'payment' | 'topup' | 'send' | 'receive'} type - Transaction type
 * @property {number} amount - Transaction amount (positive for incoming, negative for outgoing)
 * @property {'success' | 'failed' | 'pending'} status - Transaction status
 * @property {string} date - ISO date string
 * @property {string} merchantName - Merchant or recipient name
 * @property {string} [category] - Optional category
 * @property {string} [icon] - Optional icon name
 */

/**
 * @typedef {Object} Wallet
 * @property {number} balance - Current wallet balance
 * @property {string} currency - Currency symbol
 * @property {string} cardNumber - Masked card number
 * @property {string} cardExpiry - Card expiry date
 * @property {string} cardHolder - Card holder name
 * @property {Transaction[]} transactions - Transaction history
 */

/**
 * @typedef {Object} PaymentRequest
 * @property {string} id - Unique payment request ID
 * @property {number} amount - Requested payment amount
 * @property {string} merchantId - Merchant ID
 * @property {string} merchantName - Merchant display name
 * @property {'pending' | 'scanning' | 'processing' | 'success' | 'failed' | 'cancelled'} status
 * @property {string} createdAt - ISO date string
 * @property {string} [completedAt] - ISO date string when completed
 */

/**
 * @typedef {Object} MerchantPayment
 * @property {string} id - Payment ID
 * @property {string} customerId - Customer identifier
 * @property {number} amount - Payment amount
 * @property {string} time - Relative time string
 * @property {string} date - ISO date string
 */

/**
 * @typedef {Object} Merchant
 * @property {string} id - Merchant ID
 * @property {string} businessName - Business display name
 * @property {number} totalEarnings - All time earnings
 * @property {number} todayEarnings - Today's earnings
 * @property {MerchantPayment[]} payments - Recent payments received
 * @property {Array<{day: string, earnings: number}>} weeklyData - Weekly earnings data
 */

/**
 * @typedef {Object} User
 * @property {string} id - User ID
 * @property {string} name - User display name
 * @property {string} email - User email
 * @property {string} avatar - Avatar URL
 * @property {boolean} isPremium - Premium status
 */

// Generate unique IDs
export const generateId = (prefix = 'txn') => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Format currency
export const formatCurrency = (amount, currency = '€', showSign = true) => {
  const formatted = Math.abs(amount).toFixed(2);
  if (showSign) {
    const sign = amount >= 0 ? '+' : '-';
    return `${sign}${currency}${formatted}`;
  }
  return `${currency}${formatted}`;
};

// Format date
export const formatDate = (dateString) => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
};

// Format time
export const formatTime = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
};

// Format relative time
export const formatRelativeTime = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
};

// Get greeting based on time
export const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
};

// Transaction type to icon mapping
export const transactionIcons = {
  payment: 'credit-card',
  topup: 'plus-circle',
  send: 'send',
  receive: 'download',
  transport: 'car',
  shopping: 'shopping-bag',
  entertainment: 'play',
  food: 'coffee',
  transfer: 'arrow-right-left',
};

// Transaction type to color mapping
export const transactionColors = {
  payment: '#FF4757',
  topup: '#00D26A',
  send: '#00C2FF',
  receive: '#00D26A',
  transport: '#FFB800',
  shopping: '#A855F7',
  entertainment: '#FF6B6B',
  food: '#FF6B6B',
  transfer: '#00C2FF',
};

export default {
  generateId,
  formatCurrency,
  formatDate,
  formatTime,
  formatRelativeTime,
  getGreeting,
  transactionIcons,
  transactionColors,
};
