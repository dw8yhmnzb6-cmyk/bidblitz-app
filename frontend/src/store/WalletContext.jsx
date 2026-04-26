import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { api } from '../services/api';
import { useUser } from './UserContext';

const ACTIONS = {
  SET_WALLET: 'SET_WALLET',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  ADD_TRANSACTION: 'ADD_TRANSACTION',
  UPDATE_BALANCE: 'UPDATE_BALANCE',
  RESET: 'RESET',
};

const initialState = {
  balance: 0,
  currency: 'EUR',
  cryptoBalanceEur: 0,  // NEW: Crypto balance in EUR
  totalBalanceEur: 0,    // NEW: Total (EUR + Crypto)
  cryptoBreakdown: [],   // NEW: Individual crypto holdings
  cardNumber: '',
  cardExpiry: '',
  cardHolder: '',
  transactions: [],
  isLoading: false,
  error: null,
  lastTransaction: null,
};

function walletReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_LOADING:
      return { ...state, isLoading: action.payload, error: null };
    case ACTIONS.SET_ERROR:
      return { ...state, error: action.payload, isLoading: false };
    case ACTIONS.SET_WALLET: {
      const w = action.payload;
      return {
        ...state,
        balance: w.balance ?? 0,
        cryptoBalanceEur: w.crypto_balance_eur ?? 0,
        totalBalanceEur: w.total_balance_eur ?? w.balance ?? 0,
        cryptoBreakdown: w.crypto_breakdown ?? [],
        currency: w.currency || 'EUR',
        cardNumber: w.card_number || '',
        cardExpiry: w.card_expiry || '',
        cardHolder: w.card_holder || '',
        transactions: (w.transactions || []).map(normalizeTxn),
        isLoading: false,
        error: null,
      };
    }
    case ACTIONS.UPDATE_BALANCE:
      return { ...state, balance: action.payload };
    case ACTIONS.ADD_TRANSACTION:
      return {
        ...state,
        transactions: [normalizeTxn(action.payload), ...state.transactions],
        lastTransaction: normalizeTxn(action.payload),
      };
    case ACTIONS.RESET:
      return initialState;
    default:
      return state;
  }
}

function normalizeTxn(t) {
  return {
    id: t.id,
    type: t.type,
    amount: t.amount,
    status: t.status || 'completed',
    date: t.created_at || t.date || new Date().toISOString(),
    merchantName: t.merchant_name || t.merchantName || t.description || '',
    category: t.category || t.type || 'payment',
    icon: t.icon || (t.type === 'topup' ? 'plus-circle' : 'credit-card'),
    reference: t.reference || '',
    description: t.description || '',
  };
}

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [state, dispatch] = useReducer(walletReducer, initialState);
  const user = useUser();

  // Fetch wallet data when authenticated
  useEffect(() => {
    if (!user.isAuthenticated) {
      dispatch({ type: ACTIONS.RESET });
      return;
    }
    let cancelled = false;
    (async () => {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });
      try {
        const data = await api.getWallet();
        if (!cancelled) dispatch({ type: ACTIONS.SET_WALLET, payload: data });
      } catch (err) {
        if (!cancelled) dispatch({ type: ACTIONS.SET_ERROR, payload: err.message });
      }
    })();
    return () => { cancelled = true; };
  }, [user.isAuthenticated]);

  const refreshWallet = useCallback(async () => {
    try {
      const data = await api.getWallet();
      dispatch({ type: ACTIONS.SET_WALLET, payload: data });
    } catch (err) {
      dispatch({ type: ACTIONS.SET_ERROR, payload: err.message || "Failed to refresh wallet" });
    }
  }, []);

  const addMoney = useCallback(async (amount, paymentMethod = 'card') => {
    try {
      const result = await api.topUp({ amount, payment_method: paymentMethod });
      dispatch({ type: ACTIONS.UPDATE_BALANCE, payload: result.new_balance });
      if (result.transaction) {
        dispatch({ type: ACTIONS.ADD_TRANSACTION, payload: result.transaction });
      }
      return { success: true, newBalance: result.new_balance };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  const pay = useCallback(async (amount, merchantName, merchantId) => {
    try {
      const result = await api.pay({ amount, merchant_id: merchantId || 'default', description: `Payment to ${merchantName}` });
      dispatch({ type: ACTIONS.UPDATE_BALANCE, payload: result.new_balance });
      if (result.transaction) {
        dispatch({ type: ACTIONS.ADD_TRANSACTION, payload: result.transaction });
      }
      // Add cashback reward transaction if promotion applied
      if (result.promotion?.cashback) {
        dispatch({ type: ACTIONS.UPDATE_BALANCE, payload: result.new_balance });
      }
      return { success: true, newBalance: result.new_balance, transaction: result.transaction, promotion: result.promotion || null };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  const sendMoney = useCallback(async (amount, recipientEmail, description) => {
    try {
      const result = await api.send({ amount, recipient_email: recipientEmail, description });
      dispatch({ type: ACTIONS.UPDATE_BALANCE, payload: result.new_balance });
      if (result.transaction) {
        dispatch({ type: ACTIONS.ADD_TRANSACTION, payload: result.transaction });
      }
      return { success: true, newBalance: result.new_balance, promotion: result.promotion || null };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  const canAfford = useCallback((amount) => state.balance >= Math.abs(amount), [state.balance]);

  const value = React.useMemo(() => ({
    balance: state.balance,
    currency: state.currency,
    cardNumber: state.cardNumber,
    cardExpiry: state.cardExpiry,
    cardHolder: state.cardHolder,
    transactions: state.transactions,
    lastTransaction: state.lastTransaction,
    isLoading: state.isLoading,
    error: state.error,
    addMoney,
    pay,
    sendMoney,
    canAfford,
    refreshWallet,
  }), [state, addMoney, pay, sendMoney, canAfford, refreshWallet]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within a WalletProvider');
  return context;
}

export default WalletContext;
