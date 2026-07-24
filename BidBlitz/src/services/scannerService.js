/**
 * BidBlitz V2 - Scanner Service
 * Handles QR/barcode scanning and payment flow
 */

import { PaymentStatus } from '../models';
import { paymentService } from './paymentService';
import { merchantService } from './merchantService';

/**
 * Scanner Service - Manages the scan-to-pay flow
 */
class ScannerService {
  constructor() {
    this.config = {
      scanTimeout: 30000, // 30 seconds
      processingDelay: 1500,
    };
    
    this.currentSession = null;
  }

  /**
   * Start a new scanner session
   * @param {Object} paymentRequest - Payment request from merchant
   * @returns {Object} Scanner session
   */
  startSession(paymentRequest) {
    this.currentSession = {
      id: `scan_${Date.now()}`,
      paymentRequest,
      status: 'ready', // ready | scanning | processing | completed | failed | cancelled
      startedAt: new Date().toISOString(),
      events: [],
    };

    this._logEvent('session_started');
    return this.currentSession;
  }

  /**
   * Activate scanning mode
   * @returns {Object} Updated session
   */
  activateScan() {
    if (!this.currentSession) {
      return { success: false, error: 'No active session' };
    }

    this.currentSession.status = 'scanning';
    this.currentSession.scanStartedAt = new Date().toISOString();
    this._logEvent('scan_activated');

    return {
      success: true,
      session: this.currentSession,
    };
  }

  /**
   * Simulate a successful scan (in production, this would be camera input)
   * @returns {Promise<Object>} Scan result
   */
  async simulateScan() {
    if (!this.currentSession || this.currentSession.status !== 'scanning') {
      return { success: false, error: 'Not in scanning mode' };
    }

    // Simulate scan delay (like reading a QR code)
    await this._simulateDelay(2000);

    this._logEvent('scan_completed');

    // Return the payment request data as if scanned from QR
    return {
      success: true,
      scannedData: {
        type: 'bidblitz_payment',
        reference: this.currentSession.paymentRequest.reference,
        merchantId: this.currentSession.paymentRequest.merchantId,
        merchantName: this.currentSession.paymentRequest.merchantName,
        amount: this.currentSession.paymentRequest.amount,
        currency: this.currentSession.paymentRequest.currency,
      },
    };
  }

  /**
   * Process the scanned payment
   * @param {Object} scannedData - Data from QR code scan
   * @param {number} walletBalance - User's wallet balance
   * @param {string} userId - User making the payment
   * @returns {Promise<Object>} Payment result
   */
  async processScannedPayment(scannedData, walletBalance, userId) {
    if (!this.currentSession) {
      return { success: false, error: 'No active session' };
    }

    this.currentSession.status = 'processing';
    this._logEvent('processing_started');

    // Step 1: Validate the scanned data
    const validationResult = this._validateScannedData(scannedData);
    if (!validationResult.valid) {
      this.currentSession.status = 'failed';
      this._logEvent('validation_failed', { reason: validationResult.error });
      return { 
        success: false, 
        error: validationResult.error,
        session: this.currentSession,
      };
    }

    // Step 2: Check balance
    if (walletBalance < scannedData.amount) {
      this.currentSession.status = 'failed';
      this._logEvent('insufficient_balance');
      return {
        success: false,
        error: 'Insufficient balance',
        session: this.currentSession,
        details: {
          required: scannedData.amount,
          available: walletBalance,
        },
      };
    }

    // Step 3: Create payment transaction
    const paymentResult = await paymentService.createPayment({
      userId,
      merchantId: scannedData.merchantId,
      merchantName: scannedData.merchantName,
      amount: scannedData.amount,
      description: `Payment at ${scannedData.merchantName}`,
      currency: scannedData.currency,
    });

    if (!paymentResult.success) {
      this.currentSession.status = 'failed';
      this._logEvent('payment_creation_failed');
      return {
        success: false,
        error: 'Failed to create payment',
        session: this.currentSession,
      };
    }

    // Step 4: Process payment
    const processResult = await paymentService.processPayment(
      paymentResult.transaction,
      walletBalance
    );

    if (!processResult.success) {
      this.currentSession.status = 'failed';
      this._logEvent('payment_processing_failed', { reason: processResult.error });
      return {
        success: false,
        error: processResult.error,
        transaction: processResult.transaction,
        session: this.currentSession,
      };
    }

    // Step 5: Complete session
    this.currentSession.status = 'completed';
    this.currentSession.completedAt = new Date().toISOString();
    this.currentSession.transaction = processResult.transaction;
    this._logEvent('payment_completed');

    return {
      success: true,
      transaction: processResult.transaction,
      session: this.currentSession,
    };
  }

  /**
   * Cancel the current session
   * @returns {Object} Cancellation result
   */
  cancelSession() {
    if (!this.currentSession) {
      return { success: false, error: 'No active session' };
    }

    this.currentSession.status = 'cancelled';
    this.currentSession.cancelledAt = new Date().toISOString();
    this._logEvent('session_cancelled');

    const session = this.currentSession;
    this.currentSession = null;

    return {
      success: true,
      session,
    };
  }

  /**
   * Get current session
   * @returns {Object|null} Current session
   */
  getCurrentSession() {
    return this.currentSession;
  }

  /**
   * Clear current session
   */
  clearSession() {
    this.currentSession = null;
  }

  /**
   * Validate scanned data
   * @private
   */
  _validateScannedData(data) {
    if (!data) {
      return { valid: false, error: 'Invalid QR code' };
    }
    if (data.type !== 'bidblitz_payment') {
      return { valid: false, error: 'Not a valid BidBlitz payment code' };
    }
    if (!data.reference || !data.merchantId || !data.amount) {
      return { valid: false, error: 'Missing payment information' };
    }
    if (data.amount <= 0) {
      return { valid: false, error: 'Invalid payment amount' };
    }
    return { valid: true };
  }

  /**
   * Log session event
   * @private
   */
  _logEvent(event, data = {}) {
    if (this.currentSession) {
      this.currentSession.events.push({
        event,
        timestamp: new Date().toISOString(),
        ...data,
      });
    }
  }

  /**
   * Simulate delay
   * @private
   */
  _simulateDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const scannerService = new ScannerService();
export default scannerService;
