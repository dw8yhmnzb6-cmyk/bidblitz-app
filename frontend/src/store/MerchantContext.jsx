import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { api } from '../services/api';
import { useUser } from './UserContext';
import { formatRelativeTime, generateId } from '../models';

const ACTIONS = {
  SET_DASHBOARD: 'SET_DASHBOARD',
  SET_LOADING: 'SET_LOADING',
  RECEIVE_PAYMENT: 'RECEIVE_PAYMENT',
  CREATE_PAYMENT_REQUEST: 'CREATE_PAYMENT_REQUEST',
  UPDATE_PAYMENT_REQUEST: 'UPDATE_PAYMENT_REQUEST',
  CANCEL_PAYMENT_REQUEST: 'CANCEL_PAYMENT_REQUEST',
  RESET: 'RESET',
};

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function defaultWeeklyData() {
  return daysOfWeek.map((day) => ({ day, earnings: 0 }));
}

const initialState = {
  id: '',
  businessName: '',
  totalEarnings: 0,
  todayEarnings: 0,
  totalTransactions: 0,
  todayTransactions: 0,
  payments: [],
  weeklyData: defaultWeeklyData(),
  currentPaymentRequest: null,
  isProcessing: false,
  isLoading: false,
  error: null,
};

function merchantReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_LOADING:
      return { ...state, isLoading: action.payload };
    case ACTIONS.SET_DASHBOARD: {
      const d = action.payload;
      return {
        ...state,
        id: d.merchant_id || '',
        businessName: d.business_name || '',
        totalEarnings: d.total_earnings || 0,
        todayEarnings: d.today_earnings || 0,
        totalTransactions: d.total_transactions || 0,
        todayTransactions: d.today_transactions || 0,
        payments: (d.recent_payments || []).map((p) => ({
          id: p.id || generateId('pay'),
          customerId: p.merchant_name || p.description || `Customer`,
          amount: Math.abs(p.amount || 0),
          time: formatRelativeTime(p.created_at || new Date().toISOString()),
          date: p.created_at || new Date().toISOString(),
        })),
        isLoading: false,
        error: null,
      };
    }
    case ACTIONS.RECEIVE_PAYMENT: {
      const { amount, customerId } = action.payload;
      const payment = {
        id: generateId('pay'),
        customerId: customerId || `Customer #${Math.floor(Math.random() * 9000) + 1000}`,
        amount: Math.abs(amount),
        time: 'Just now',
        date: new Date().toISOString(),
      };
      const today = new Date().toLocaleDateString('en-US', { weekday: 'short' });
      const updatedWeeklyData = state.weeklyData.map((day) =>
        day.day === today ? { ...day, earnings: day.earnings + Math.abs(amount) } : day
      );
      return {
        ...state,
        totalEarnings: state.totalEarnings + Math.abs(amount),
        todayEarnings: state.todayEarnings + Math.abs(amount),
        payments: [payment, ...state.payments.slice(0, 19)],
        weeklyData: updatedWeeklyData,
        currentPaymentRequest: null,
        isProcessing: false,
      };
    }
    case ACTIONS.CREATE_PAYMENT_REQUEST: {
      const { amount } = action.payload;
      return {
        ...state,
        currentPaymentRequest: {
          id: generateId('req'),
          amount: Math.abs(amount),
          merchantId: state.id,
          merchantName: state.businessName,
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
        isProcessing: false,
        error: null,
      };
    }
    case ACTIONS.UPDATE_PAYMENT_REQUEST: {
      if (!state.currentPaymentRequest) return state;
      return {
        ...state,
        currentPaymentRequest: { ...state.currentPaymentRequest, status: action.payload.status },
        isProcessing: action.payload.status === 'processing' || action.payload.status === 'scanning',
      };
    }
    case ACTIONS.CANCEL_PAYMENT_REQUEST:
      return { ...state, currentPaymentRequest: null, isProcessing: false, error: null };
    case ACTIONS.RESET:
      return initialState;
    default:
      return state;
  }
}

const MerchantContext = createContext(null);

export function MerchantProvider({ children }) {
  const [state, dispatch] = useReducer(merchantReducer, initialState);
  const user = useUser();

  // Fetch merchant dashboard when authenticated
  useEffect(() => {
    if (!user.isAuthenticated) {
      dispatch({ type: ACTIONS.RESET });
      return;
    }
    let cancelled = false;
    (async () => {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });
      try {
        const data = await api.getMerchantDashboard();
        if (!cancelled) dispatch({ type: ACTIONS.SET_DASHBOARD, payload: data });
      } catch {
        if (!cancelled) dispatch({ type: ACTIONS.SET_LOADING, payload: false });
      }
    })();
    return () => { cancelled = true; };
  }, [user.isAuthenticated]);

  const refreshDashboard = useCallback(async () => {
    try {
      const data = await api.getMerchantDashboard();
      dispatch({ type: ACTIONS.SET_DASHBOARD, payload: data });
    } catch {}
  }, []);

  const receivePayment = useCallback((amount, customerId) => {
    dispatch({ type: ACTIONS.RECEIVE_PAYMENT, payload: { amount, customerId } });
    return { success: true, amount };
  }, []);

  const createPaymentRequest = useCallback((amount) => {
    dispatch({ type: ACTIONS.CREATE_PAYMENT_REQUEST, payload: { amount } });
  }, []);

  const updatePaymentRequest = useCallback((status) => {
    dispatch({ type: ACTIONS.UPDATE_PAYMENT_REQUEST, payload: { status } });
  }, []);

  const cancelPaymentRequest = useCallback(() => {
    dispatch({ type: ACTIONS.CANCEL_PAYMENT_REQUEST });
  }, []);

  const getPaymentsWithRelativeTime = useCallback(() => {
    return state.payments.map((p) => ({ ...p, time: formatRelativeTime(p.date) }));
  }, [state.payments]);

  const value = {
    id: state.id,
    businessName: state.businessName,
    totalEarnings: state.totalEarnings,
    todayEarnings: state.todayEarnings,
    totalTransactions: state.totalTransactions,
    todayTransactions: state.todayTransactions,
    payments: state.payments,
    weeklyData: state.weeklyData,
    currentPaymentRequest: state.currentPaymentRequest,
    isProcessing: state.isProcessing,
    isLoading: state.isLoading,
    error: state.error,
    receivePayment,
    createPaymentRequest,
    updatePaymentRequest,
    cancelPaymentRequest,
    getPaymentsWithRelativeTime,
    refreshDashboard,
  };

  return <MerchantContext.Provider value={value}>{children}</MerchantContext.Provider>;
}

export function useMerchant() {
  const context = useContext(MerchantContext);
  if (!context) throw new Error('useMerchant must be used within a MerchantProvider');
  return context;
}

export default MerchantContext;
