/**
 * BidBlitz V2 - Merchant Context
 * Global state management for merchant operations
 */

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { generateId, formatRelativeTime } from '../models';
import { initialMerchant } from '../models/initialData';

// Action types
const MERCHANT_ACTIONS = {
  RECEIVE_PAYMENT: 'RECEIVE_PAYMENT',
  CREATE_PAYMENT_REQUEST: 'CREATE_PAYMENT_REQUEST',
  UPDATE_PAYMENT_REQUEST: 'UPDATE_PAYMENT_REQUEST',
  CANCEL_PAYMENT_REQUEST: 'CANCEL_PAYMENT_REQUEST',
  UPDATE_WEEKLY_DATA: 'UPDATE_WEEKLY_DATA',
  RESET_MERCHANT: 'RESET_MERCHANT',
};

// Initial state
const initialState = {
  ...initialMerchant,
  currentPaymentRequest: null,
  isProcessing: false,
  error: null,
};

// Reducer
function merchantReducer(state, action) {
  switch (action.type) {
    case MERCHANT_ACTIONS.RECEIVE_PAYMENT: {
      const { amount, customerId } = action.payload;
      const payment = {
        id: generateId('pay'),
        customerId: customerId || `Customer #${Math.floor(Math.random() * 9000) + 1000}`,
        amount: Math.abs(amount),
        time: 'Just now',
        date: new Date().toISOString(),
      };

      // Update weekly data for today
      const today = new Date().toLocaleDateString('en-US', { weekday: 'short' });
      const updatedWeeklyData = state.weeklyData.map((day) =>
        day.day === today
          ? { ...day, earnings: day.earnings + Math.abs(amount) }
          : day
      );

      return {
        ...state,
        totalEarnings: state.totalEarnings + Math.abs(amount),
        todayEarnings: state.todayEarnings + Math.abs(amount),
        payments: [payment, ...state.payments.slice(0, 19)], // Keep last 20 payments
        weeklyData: updatedWeeklyData,
        currentPaymentRequest: null,
        isProcessing: false,
        error: null,
      };
    }

    case MERCHANT_ACTIONS.CREATE_PAYMENT_REQUEST: {
      const { amount } = action.payload;
      const paymentRequest = {
        id: generateId('req'),
        amount: Math.abs(amount),
        merchantId: state.id,
        merchantName: state.businessName,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      return {
        ...state,
        currentPaymentRequest: paymentRequest,
        isProcessing: false,
        error: null,
      };
    }

    case MERCHANT_ACTIONS.UPDATE_PAYMENT_REQUEST: {
      const { status, completedAt } = action.payload;
      if (!state.currentPaymentRequest) return state;
      
      return {
        ...state,
        currentPaymentRequest: {
          ...state.currentPaymentRequest,
          status,
          completedAt: completedAt || (status === 'success' || status === 'failed' ? new Date().toISOString() : undefined),
        },
        isProcessing: status === 'processing' || status === 'scanning',
      };
    }

    case MERCHANT_ACTIONS.CANCEL_PAYMENT_REQUEST: {
      return {
        ...state,
        currentPaymentRequest: null,
        isProcessing: false,
        error: null,
      };
    }

    case MERCHANT_ACTIONS.UPDATE_WEEKLY_DATA: {
      return {
        ...state,
        weeklyData: action.payload,
      };
    }

    case MERCHANT_ACTIONS.RESET_MERCHANT: {
      return initialState;
    }

    default:
      return state;
  }
}

// Context
const MerchantContext = createContext(null);

// Provider component
export function MerchantProvider({ children }) {
  const [state, dispatch] = useReducer(merchantReducer, initialState);

  // Action creators
  const receivePayment = useCallback((amount, customerId) => {
    dispatch({
      type: MERCHANT_ACTIONS.RECEIVE_PAYMENT,
      payload: { amount, customerId },
    });
    return { success: true, amount };
  }, []);

  const createPaymentRequest = useCallback((amount) => {
    dispatch({
      type: MERCHANT_ACTIONS.CREATE_PAYMENT_REQUEST,
      payload: { amount },
    });
    return { 
      success: true, 
      requestId: generateId('req'),
    };
  }, []);

  const updatePaymentRequest = useCallback((status) => {
    dispatch({
      type: MERCHANT_ACTIONS.UPDATE_PAYMENT_REQUEST,
      payload: { status },
    });
  }, []);

  const cancelPaymentRequest = useCallback(() => {
    dispatch({ type: MERCHANT_ACTIONS.CANCEL_PAYMENT_REQUEST });
  }, []);

  const resetMerchant = useCallback(() => {
    dispatch({ type: MERCHANT_ACTIONS.RESET_MERCHANT });
  }, []);

  // Update relative times for payments
  const getPaymentsWithRelativeTime = useCallback(() => {
    return state.payments.map((payment) => ({
      ...payment,
      time: formatRelativeTime(payment.date),
    }));
  }, [state.payments]);

  const value = {
    // State
    id: state.id,
    businessName: state.businessName,
    totalEarnings: state.totalEarnings,
    todayEarnings: state.todayEarnings,
    payments: state.payments,
    weeklyData: state.weeklyData,
    currentPaymentRequest: state.currentPaymentRequest,
    isProcessing: state.isProcessing,
    error: state.error,
    
    // Actions
    receivePayment,
    createPaymentRequest,
    updatePaymentRequest,
    cancelPaymentRequest,
    resetMerchant,
    
    // Helpers
    getPaymentsWithRelativeTime,
  };

  return (
    <MerchantContext.Provider value={value}>
      {children}
    </MerchantContext.Provider>
  );
}

// Hook
export function useMerchant() {
  const context = useContext(MerchantContext);
  if (!context) {
    throw new Error('useMerchant must be used within a MerchantProvider');
  }
  return context;
}

export default MerchantContext;
