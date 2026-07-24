/**
 * BidBlitz V2 - Services Index
 * All service singletons exported from one place.
 * Each service currently uses mock/local logic.
 * To switch to real backend: replace internals, keep the same interface.
 */

export { authService } from './authService';
export { paymentService } from './paymentService';
export { walletService } from './walletService';
export { merchantService } from './merchantService';
export { scannerService } from './scannerService';
export { transactionService } from './transactionService';
export { api } from './api';
