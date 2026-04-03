/**
 * BidBlitz V2 - Merchant Service
 * Handles merchant-side payment operations
 */

import { 
  generateId, 
  generateReference, 
  PaymentStatus,
} from '../models';

/**
 * Merchant Service - Manages merchant payment operations
 */
class MerchantService {
  constructor() {
    this.config = {
      paymentRequestExpiry: 5 * 60 * 1000, // 5 minutes
      minPaymentAmount: 0.50,
      maxPaymentAmount: 10000,
    };
  }

  /**
   * Create a payment request (for QR code display)
   * @param {Object} params - Payment request parameters
   * @returns {Promise<Object>} Payment request
   */
  async createPaymentRequest({
    merchantId,
    merchantName,
    amount,
    description,
    currency = 'EUR',
  }) {
    // Validate amount
    const validation = this.validatePaymentAmount(amount);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.paymentRequestExpiry);

    const request = {
      id: generateId('req'),
      reference: generateReference(),
      merchantId,
      merchantName,
      amount: Math.abs(amount),
      currency,
      description: description || '',
      status: PaymentStatus.PENDING,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    // Generate QR code data (in production, this would be a proper QR payload)
    const qrData = this._generateQRPayload(request);

    return {
      success: true,
      request,
      qrData,
    };
  }

  /**
   * Update payment request status
   * @param {string} requestId - Request ID
   * @param {string} status - New status
   * @param {Object} [additionalData] - Additional data to merge
   * @returns {Object} Updated request
   */
  updatePaymentRequestStatus(requestId, status, additionalData = {}) {
    return {
      id: requestId,
      status,
      updatedAt: new Date().toISOString(),
      ...additionalData,
    };
  }

  /**
   * Mark payment request as completed
   * @param {Object} request - Payment request
   * @param {string} transactionId - Linked transaction ID
   * @returns {Object} Completed request
   */
  completePaymentRequest(request, transactionId) {
    return {
      ...request,
      status: PaymentStatus.SUCCESS,
      completedAt: new Date().toISOString(),
      transactionId,
    };
  }

  /**
   * Cancel payment request
   * @param {string} requestId - Request ID to cancel
   * @returns {Object} Cancelled request
   */
  cancelPaymentRequest(requestId) {
    return {
      id: requestId,
      status: PaymentStatus.CANCELLED,
      cancelledAt: new Date().toISOString(),
    };
  }

  /**
   * Check if payment request is expired
   * @param {Object} request - Payment request
   * @returns {boolean} Is expired
   */
  isPaymentRequestExpired(request) {
    if (!request.expiresAt) return false;
    return new Date() > new Date(request.expiresAt);
  }

  /**
   * Record received payment (for merchant dashboard)
   * @param {Object} params - Payment details
   * @returns {Object} Payment record
   */
  recordReceivedPayment({
    merchantId,
    amount,
    customerId,
    transactionId,
    reference,
  }) {
    return {
      id: generateId('pay'),
      merchantId,
      customerId: customerId || `Customer #${Math.floor(Math.random() * 9000) + 1000}`,
      amount: Math.abs(amount),
      transactionId,
      reference,
      time: 'Just now',
      date: new Date().toISOString(),
    };
  }

  /**
   * Calculate merchant statistics
   * @param {Array} payments - Array of merchant payments
   * @returns {Object} Statistics
   */
  calculateStatistics(payments) {
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now - 86400000).toDateString();

    const todayPayments = payments.filter(p => 
      new Date(p.date).toDateString() === today
    );
    const yesterdayPayments = payments.filter(p => 
      new Date(p.date).toDateString() === yesterday
    );

    const todayEarnings = todayPayments.reduce((sum, p) => sum + p.amount, 0);
    const yesterdayEarnings = yesterdayPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalEarnings = payments.reduce((sum, p) => sum + p.amount, 0);

    const changeFromYesterday = yesterdayEarnings > 0 
      ? (((todayEarnings - yesterdayEarnings) / yesterdayEarnings) * 100).toFixed(1)
      : todayEarnings > 0 ? 100 : 0;

    return {
      todayEarnings,
      yesterdayEarnings,
      totalEarnings,
      todayPaymentCount: todayPayments.length,
      changeFromYesterday,
      averagePayment: payments.length > 0 
        ? (totalEarnings / payments.length).toFixed(2) 
        : 0,
    };
  }

  /**
   * Validate payment amount
   * @param {number} amount - Amount to validate
   * @returns {Object} Validation result
   */
  validatePaymentAmount(amount) {
    if (!amount || isNaN(amount)) {
      return { valid: false, error: 'Please enter an amount' };
    }
    if (amount < this.config.minPaymentAmount) {
      return { valid: false, error: `Minimum amount is €${this.config.minPaymentAmount}` };
    }
    if (amount > this.config.maxPaymentAmount) {
      return { valid: false, error: `Maximum amount is €${this.config.maxPaymentAmount}` };
    }
    return { valid: true };
  }

  /**
   * Generate QR code payload
   * @private
   */
  _generateQRPayload(request) {
    // In production, this would be a proper payment URI
    // e.g., "bidblitz://pay?ref=BLZ-ABC123&amount=50.00&merchant=merchant_001"
    return {
      type: 'bidblitz_payment',
      version: '1.0',
      reference: request.reference,
      merchantId: request.merchantId,
      merchantName: request.merchantName,
      amount: request.amount,
      currency: request.currency,
      expiresAt: request.expiresAt,
    };
  }
}

// Export singleton instance
export const merchantService = new MerchantService();
export default merchantService;
