/**
 * BidBlitz V2 - Wallet Context
 * Global state management for wallet operations
 */

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { generateId } from '../models';
import { initialWallet } from '../models/initialData';

// Action types
const WALLET_ACTIONS = {
  ADD_MONEY: 'ADD_MONEY',
  PAY: 'PAY',
  SEND_MONEY: 'SEND_MONEY',
  RECEIVE_MONEY: 'RECEIVE_MONEY',
  ADD_TRANSACTION: 'ADD_TRANSACTION',
  UPDATE_TRANSACTION_STATUS: 'UPDATE_TRANSACTION_STATUS',
  RESET_WALLET: 'RESET_WALLET',
};

// Initial state
const initialState = {
  ...initialWallet,
  isLoading: false,
  error: null,
  lastTransaction: null,
};

// Reducer
function walletReducer(state, action) {
  switch (action.type) {
    case WALLET_ACTIONS.ADD_MONEY: {
      const { amount, source = 'Bank Transfer' } = action.payload;
      const transaction = {
        id: generateId('txn'),
        type: 'topup',
        amount: Math.abs(amount),
        status: 'success',
        date: new Date().toISOString(),
        merchantName: source,
        category: 'income',
        icon: 'plus-circle',
      };
      return {
        ...state,
        balance: state.balance + Math.abs(amount),
        transactions: [transaction, ...state.transactions],
        lastTransaction: transaction,
        error: null,
      };
    }

    case WALLET_ACTIONS.PAY: {
      const { amount, merchantName, merchantId } = action.payload;
      const absAmount = Math.abs(amount);
      
      // Check if sufficient balance
      if (state.balance < absAmount) {
        const failedTransaction = {
          id: generateId('txn'),
          type: 'payment',
          amount: -absAmount,
          status: 'failed',
          date: new Date().toISOString(),
          merchantName,
          merchantId,
          category: 'payment',
          icon: 'credit-card',
          failureReason: 'Insufficient balance',
        };
        return {
          ...state,
          transactions: [failedTransaction, ...state.transactions],
          lastTransaction: failedTransaction,
          error: 'Insufficient balance',
        };
      }

      // Successful payment
      const transaction = {
        id: generateId('txn'),
        type: 'payment',
        amount: -absAmount,
        status: 'success',
        date: new Date().toISOString(),
        merchantName,
        merchantId,
        category: 'payment',
        icon: 'credit-card',
      };
      return {
        ...state,
        balance: state.balance - absAmount,
        transactions: [transaction, ...state.transactions],
        lastTransaction: transaction,
        error: null,
      };
    }

    case WALLET_ACTIONS.SEND_MONEY: {
      const { amount, recipientName, recipientId } = action.payload;
      const absAmount = Math.abs(amount);
      
      // Check if sufficient balance
      if (state.balance < absAmount) {
        const failedTransaction = {
          id: generateId('txn'),
          type: 'send',
          amount: -absAmount,
          status: 'failed',
          date: new Date().toISOString(),
          merchantName: `Transfer to ${recipientName}`,
          recipientId,
          category: 'transfer',
          icon: 'send',
          failureReason: 'Insufficient balance',
        };
        return {
          ...state,
          transactions: [failedTransaction, ...state.transactions],
          lastTransaction: failedTransaction,
          error: 'Insufficient balance',
        };
      }

      // Successful transfer
      const transaction = {
        id: generateId('txn'),
        type: 'send',
        amount: -absAmount,
        status: 'success',
        date: new Date().toISOString(),
        merchantName: `Transfer to ${recipientName}`,
        recipientId,
        category: 'transfer',
        icon: 'send',
      };
      return {
        ...state,
        balance: state.balance - absAmount,
        transactions: [transaction, ...state.transactions],
        lastTransaction: transaction,
        error: null,
      };
    }

    case WALLET_ACTIONS.RECEIVE_MONEY: {
      const { amount, senderName, senderId } = action.payload;
      const transaction = {
        id: generateId('txn'),
        type: 'receive',
        amount: Math.abs(amount),
        status: 'success',
        date: new Date().toISOString(),
        merchantName: `From ${senderName}`,
        senderId,
        category: 'transfer',
        icon: 'download',
      };
      return {
        ...state,
        balance: state.balance + Math.abs(amount),
        transactions: [transaction, ...state.transactions],
        lastTransaction: transaction,
        error: null,
      };
    }

    case WALLET_ACTIONS.ADD_TRANSACTION: {
      return {
        ...state,
        transactions: [action.payload, ...state.transactions],
        lastTransaction: action.payload,
      };
    }

    case WALLET_ACTIONS.UPDATE_TRANSACTION_STATUS: {
      const { transactionId, status } = action.payload;
      return {
        ...state,
        transactions: state.transactions.map((txn) =>
          txn.id === transactionId ? { ...txn, status } : txn
        ),
      };
    }

    case WALLET_ACTIONS.RESET_WALLET: {
      return initialState;
    }

    default:
      return state;
  }
}

// Context
const WalletContext = createContext(null);

// Provider component
export function WalletProvider({ children }) {
  const [state, dispatch] = useReducer(walletReducer, initialState);

  // Action creators
  const addMoney = useCallback((amount, source) => {
    dispatch({
      type: WALLET_ACTIONS.ADD_MONEY,
      payload: { amount, source },
    });
    return { success: true, amount };
  }, []);

  const pay = useCallback((amount, merchantName, merchantId) => {
    const canPay = state.balance >= Math.abs(amount);
    dispatch({
      type: WALLET_ACTIONS.PAY,
      payload: { amount, merchantName, merchantId },
    });
    return { 
      success: canPay, 
      amount,
      error: canPay ? null : 'Insufficient balance',
    };
  }, [state.balance]);

  const sendMoney = useCallback((amount, recipientName, recipientId) => {
    const canSend = state.balance >= Math.abs(amount);
    dispatch({
      type: WALLET_ACTIONS.SEND_MONEY,
      payload: { amount, recipientName, recipientId },
    });
    return { 
      success: canSend, 
      amount,
      error: canSend ? null : 'Insufficient balance',
    };
  }, [state.balance]);

  const receiveMoney = useCallback((amount, senderName, senderId) => {
    dispatch({
      type: WALLET_ACTIONS.RECEIVE_MONEY,
      payload: { amount, senderName, senderId },
    });
    return { success: true, amount };
  }, []);

  const canAfford = useCallback((amount) => {
    return state.balance >= Math.abs(amount);
  }, [state.balance]);

  const resetWallet = useCallback(() => {
    dispatch({ type: WALLET_ACTIONS.RESET_WALLET });
  }, []);

  const value = {
    // State
    balance: state.balance,
    currency: state.currency,
    cardNumber: state.cardNumber,
    cardExpiry: state.cardExpiry,
    cardHolder: state.cardHolder,
    transactions: state.transactions,
    lastTransaction: state.lastTransaction,
    error: state.error,
    
    // Actions
    addMoney,
    pay,
    sendMoney,
    receiveMoney,
    canAfford,
    resetWallet,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

// Hook
export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

export default WalletContext;
