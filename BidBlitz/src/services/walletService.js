/**
 * BidBlitz V2 - Wallet Service
 * Handles wallet operations including top-ups
 * Ready for real payment provider integration
 */

import { 
  generateId, 
  generateReference, 
  PaymentType, 
  PaymentStatus,
  PaymentMethod,
} from '../models';

/**
 * Wallet Service - Manages wallet balance and top-ups
 */
class WalletService {
  constructor() {
    this.config = {
      currency: 'EUR',
      minTopUp: 5,
      maxTopUp: 5000,
      topUpAmountPresets: [10, 25, 50, 100, 250, 500],
    };
  }

  /**
   * Create a top-up request
   * @param {Object} params - Top-up parameters
   * @returns {Promise<Object>} Top-up request
   */
  async createTopUpRequest({
    userId,
    amount,
    paymentMethod = PaymentMethod.CARD,
    currency = 'EUR',
  }) {
    // Validate amount
    const validation = this.validateTopUpAmount(amount);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const request = {
      id: generateId('topup'),
      reference: generateReference(),
      userId,
      amount: Math.abs(amount),
      currency,
      paymentMethod,
      status: PaymentStatus.PENDING,
      createdAt: new Date().toISOString(),
    };

    return {
      success: true,
      request,
    };
  }

  /**
   * Process a top-up request
   * @param {Object} request - Top-up request to process
   * @returns {Promise<Object>} Processing result with transaction
   */
  async processTopUp(request) {
    // Simulate payment processing
    await this._simulateDelay(1500);

    // In production, this would:
    // 1. Create a Stripe PaymentIntent
    // 2. Process the card payment
    // 3. Handle 3D Secure if required
    // 4. Return the result

    // Simulate success (90% success rate for demo)
    const isSuccess = Math.random() > 0.1;

    if (!isSuccess) {
      return {
        success: false,
        request: {
          ...request,
          status: PaymentStatus.FAILED,
          completedAt: new Date().toISOString(),
        },
        error: 'Payment declined. Please try another card.',
      };
    }

    const transaction = {
      id: generateId('txn'),
      reference: request.reference,
      userId: request.userId,
      type: PaymentType.CARD_TOPUP,
      amount: Math.abs(request.amount), // Positive for incoming
      currency: request.currency,
      status: PaymentStatus.SUCCESS,
      createdAt: request.createdAt,
      completedAt: new Date().toISOString(),
      paymentMethod: request.paymentMethod,
      description: `Top-up via ${this._getPaymentMethodLabel(request.paymentMethod)}`,
      merchantName: 'Wallet Top-up',
      category: 'topup',
      icon: 'plus-circle',
    };

    return {
      success: true,
      request: {
        ...request,
        status: PaymentStatus.SUCCESS,
        completedAt: new Date().toISOString(),
        transactionId: transaction.id,
      },
      transaction,
    };
  }

  /**
   * Get available payment methods for top-up
   * @returns {Array} Available payment methods
   */
  getAvailablePaymentMethods() {
    return [
      {
        id: PaymentMethod.CARD,
        label: 'Credit / Debit Card',
        icon: 'credit-card',
        enabled: true,
      },
      {
        id: PaymentMethod.APPLE_PAY,
        label: 'Apple Pay',
        icon: 'apple',
        enabled: true,
      },
      {
        id: PaymentMethod.GOOGLE_PAY,
        label: 'Google Pay',
        icon: 'smartphone',
        enabled: true,
      },
      {
        id: PaymentMethod.BANK_TRANSFER,
        label: 'Bank Transfer',
        icon: 'building',
        enabled: false,
      },
    ];
  }

  /**
   * Get top-up amount presets
   * @returns {Array} Preset amounts
   */
  getTopUpPresets() {
    return this.config.topUpAmountPresets;
  }

  /**
   * Validate top-up amount
   * @param {number} amount - Amount to validate
   * @returns {Object} Validation result
   */
  validateTopUpAmount(amount) {
    if (!amount || isNaN(amount)) {
      return { valid: false, error: 'Please enter an amount' };
    }
    if (amount < this.config.minTopUp) {
      return { valid: false, error: `Minimum top-up is €${this.config.minTopUp}` };
    }
    if (amount > this.config.maxTopUp) {
      return { valid: false, error: `Maximum top-up is €${this.config.maxTopUp}` };
    }
    return { valid: true };
  }

  /**
   * Calculate fees (if any)
   * @param {number} amount - Top-up amount
   * @param {string} paymentMethod - Payment method
   * @returns {Object} Fee calculation
   */
  calculateFees(amount, paymentMethod) {
    // Currently no fees for demo
    // In production, this might include:
    // - Card processing fees
    // - Currency conversion fees
    // - etc.
    return {
      amount,
      fee: 0,
      total: amount,
      feePercentage: 0,
    };
  }

  /**
   * Get payment method label
   * @private
   */
  _getPaymentMethodLabel(method) {
    const labels = {
      [PaymentMethod.CARD]: 'Card',
      [PaymentMethod.APPLE_PAY]: 'Apple Pay',
      [PaymentMethod.GOOGLE_PAY]: 'Google Pay',
      [PaymentMethod.BANK_TRANSFER]: 'Bank Transfer',
    };
    return labels[method] || method;
  }

  /**
   * Simulate network delay
   * @private
   */
  _simulateDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const walletService = new WalletService();
export default walletService;
