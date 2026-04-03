/**
 * BidBlitz V2 - Payment Types & Enums
 * Type definitions for payment system
 */

// Payment types
export const PaymentType = {
  WALLET_PAYMENT: 'wallet_payment',      // Pay from wallet to merchant
  CARD_TOPUP: 'card_topup',              // Top-up wallet via card
  BANK_TOPUP: 'bank_topup',              // Top-up wallet via bank
  PEER_TRANSFER: 'peer_transfer',        // Send money to another user
  MERCHANT_PAYMENT: 'merchant_payment',  // Receive payment as merchant
  REFUND: 'refund',                      // Refund transaction
};

// Payment status
export const PaymentStatus = {
  PENDING: 'pending',         // Created but not processed
  PROCESSING: 'processing',   // Currently being processed
  SUCCESS: 'success',         // Successfully completed
  FAILED: 'failed',           // Failed to process
  CANCELLED: 'cancelled',     // Cancelled by user or system
  EXPIRED: 'expired',         // Payment request expired
};

// Payment methods for top-up
export const PaymentMethod = {
  CARD: 'card',               // Credit/Debit card
  BANK_TRANSFER: 'bank_transfer',
  APPLE_PAY: 'apple_pay',
  GOOGLE_PAY: 'google_pay',
  WALLET: 'wallet',           // BidBlitz wallet
};

// Transaction categories
export const TransactionCategory = {
  PAYMENT: 'payment',
  TOPUP: 'topup',
  TRANSFER: 'transfer',
  REFUND: 'refund',
  TRANSPORT: 'transport',
  SHOPPING: 'shopping',
  FOOD: 'food',
  ENTERTAINMENT: 'entertainment',
  OTHER: 'other',
};

// Currency codes
export const Currency = {
  EUR: 'EUR',
  USD: 'USD',
  GBP: 'GBP',
};

// Currency symbols
export const CurrencySymbol = {
  EUR: '€',
  USD: '$',
  GBP: '£',
};

/**
 * @typedef {Object} Transaction
 * @property {string} id - Unique transaction ID (txn_xxxxx)
 * @property {string} reference - Human-readable reference (BLZ-XXXXXX)
 * @property {string} userId - User who initiated the transaction
 * @property {string} [merchantId] - Merchant ID (for payments)
 * @property {string} [recipientId] - Recipient user ID (for transfers)
 * @property {string} type - Transaction type from PaymentType
 * @property {number} amount - Transaction amount (positive = credit, negative = debit)
 * @property {string} currency - Currency code
 * @property {string} status - Status from PaymentStatus
 * @property {string} createdAt - ISO timestamp when created
 * @property {string} [completedAt] - ISO timestamp when completed
 * @property {string} paymentMethod - Method from PaymentMethod
 * @property {string} description - Human-readable description
 * @property {string} [category] - Category from TransactionCategory
 * @property {string} [icon] - Icon name for display
 * @property {string} [failureReason] - Reason if failed
 * @property {Object} [metadata] - Additional data
 */

/**
 * @typedef {Object} PaymentRequest
 * @property {string} id - Unique request ID (req_xxxxx)
 * @property {string} reference - Payment reference for QR code
 * @property {string} merchantId - Merchant who created the request
 * @property {string} merchantName - Merchant display name
 * @property {number} amount - Requested amount
 * @property {string} currency - Currency code
 * @property {string} [description] - Optional description
 * @property {string} status - Status from PaymentStatus
 * @property {string} createdAt - ISO timestamp
 * @property {string} [expiresAt] - ISO timestamp when request expires
 * @property {string} [completedAt] - ISO timestamp when completed
 * @property {string} [transactionId] - Linked transaction ID after payment
 */

/**
 * @typedef {Object} TopUpRequest
 * @property {string} id - Unique request ID
 * @property {string} userId - User requesting top-up
 * @property {number} amount - Top-up amount
 * @property {string} currency - Currency code
 * @property {string} paymentMethod - Selected payment method
 * @property {string} status - Status from PaymentStatus
 * @property {string} createdAt - ISO timestamp
 * @property {string} [completedAt] - ISO timestamp
 * @property {string} [transactionId] - Linked transaction ID
 */

// Generate unique IDs
export const generateId = (prefix = 'txn') => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 6);
  return `${prefix}_${timestamp}${random}`;
};

// Generate human-readable reference
export const generateReference = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let reference = 'BLZ-';
  for (let i = 0; i < 6; i++) {
    reference += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return reference;
};

// Format currency
export const formatCurrency = (amount, currency = 'EUR', showSign = true) => {
  const symbol = CurrencySymbol[currency] || '€';
  const formatted = Math.abs(amount).toFixed(2);
  if (showSign && amount !== 0) {
    const sign = amount >= 0 ? '+' : '-';
    return `${sign}${symbol}${formatted}`;
  }
  return `${symbol}${formatted}`;
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
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
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
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return formatDate(dateString);
};

// Format full date time
export const formatFullDateTime = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    weekday: 'short',
    month: 'short', 
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Get greeting based on time
export const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
};

// Get status color
export const getStatusColor = (status) => {
  switch (status) {
    case PaymentStatus.SUCCESS:
      return '#00D26A';
    case PaymentStatus.FAILED:
    case PaymentStatus.CANCELLED:
      return '#FF4757';
    case PaymentStatus.PENDING:
    case PaymentStatus.PROCESSING:
      return '#00C2FF';
    case PaymentStatus.EXPIRED:
      return '#888';
    default:
      return '#888';
  }
};

// Get status label
export const getStatusLabel = (status) => {
  switch (status) {
    case PaymentStatus.SUCCESS:
      return 'Completed';
    case PaymentStatus.FAILED:
      return 'Failed';
    case PaymentStatus.CANCELLED:
      return 'Cancelled';
    case PaymentStatus.PENDING:
      return 'Pending';
    case PaymentStatus.PROCESSING:
      return 'Processing';
    case PaymentStatus.EXPIRED:
      return 'Expired';
    default:
      return status;
  }
};

// Transaction type icons
export const transactionIcons = {
  [PaymentType.WALLET_PAYMENT]: 'credit-card',
  [PaymentType.CARD_TOPUP]: 'plus-circle',
  [PaymentType.BANK_TOPUP]: 'building',
  [PaymentType.PEER_TRANSFER]: 'send',
  [PaymentType.MERCHANT_PAYMENT]: 'store',
  [PaymentType.REFUND]: 'rotate-ccw',
  transport: 'car',
  shopping: 'shopping-bag',
  entertainment: 'play',
  food: 'coffee',
  transfer: 'arrow-right-left',
};

export default {
  PaymentType,
  PaymentStatus,
  PaymentMethod,
  TransactionCategory,
  Currency,
  CurrencySymbol,
  generateId,
  generateReference,
  formatCurrency,
  formatDate,
  formatTime,
  formatRelativeTime,
  formatFullDateTime,
  getGreeting,
  getStatusColor,
  getStatusLabel,
  transactionIcons,
};
