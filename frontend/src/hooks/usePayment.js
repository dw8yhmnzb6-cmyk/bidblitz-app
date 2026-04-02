/**
 * BidBlitz V2 - Custom Hooks
 * Reusable hooks for common functionality
 */

import { useState, useCallback, useEffect } from 'react';
import { useWallet } from '../store/WalletContext';
import { useMerchant } from '../store/MerchantContext';

/**
 * Hook for handling payment flow
 * Manages the complete payment process from request to completion
 */
export function usePaymentFlow() {
  const wallet = useWallet();
  const merchant = useMerchant();
  
  const [paymentState, setPaymentState] = useState({
    status: 'idle', // idle | input | scanning | processing | success | failed
    amount: 0,
    error: null,
  });

  const resetPayment = useCallback(() => {
    setPaymentState({
      status: 'idle',
      amount: 0,
      error: null,
    });
    merchant.cancelPaymentRequest();
  }, [merchant]);

  const startPayment = useCallback((amount) => {
    if (!amount || amount <= 0) {
      setPaymentState((prev) => ({
        ...prev,
        error: 'Invalid amount',
      }));
      return false;
    }

    setPaymentState({
      status: 'input',
      amount: parseFloat(amount),
      error: null,
    });
    
    // Create payment request on merchant side
    merchant.createPaymentRequest(amount);
    return true;
  }, [merchant]);

  const activateScan = useCallback(() => {
    setPaymentState((prev) => ({
      ...prev,
      status: 'scanning',
    }));
    merchant.updatePaymentRequest('scanning');
  }, [merchant]);

  const processPayment = useCallback(async () => {
    setPaymentState((prev) => ({
      ...prev,
      status: 'processing',
    }));
    merchant.updatePaymentRequest('processing');

    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Attempt payment
    const result = wallet.pay(
      paymentState.amount,
      merchant.businessName,
      merchant.id
    );

    if (result.success) {
      // Update merchant earnings
      merchant.receivePayment(paymentState.amount);
      merchant.updatePaymentRequest('success');
      
      setPaymentState((prev) => ({
        ...prev,
        status: 'success',
        error: null,
      }));
    } else {
      merchant.updatePaymentRequest('failed');
      setPaymentState((prev) => ({
        ...prev,
        status: 'failed',
        error: result.error || 'Payment failed',
      }));
    }

    return result;
  }, [paymentState.amount, wallet, merchant]);

  // Auto-process after scanning (simulates QR code scan)
  useEffect(() => {
    if (paymentState.status === 'scanning') {
      const timer = setTimeout(() => {
        processPayment();
      }, 3000); // 3 second scan simulation
      
      return () => clearTimeout(timer);
    }
  }, [paymentState.status, processPayment]);

  return {
    status: paymentState.status,
    amount: paymentState.amount,
    error: paymentState.error,
    canAfford: wallet.canAfford(paymentState.amount),
    
    // Actions
    startPayment,
    activateScan,
    processPayment,
    resetPayment,
  };
}

/**
 * Hook for transaction grouping by date
 */
export function useGroupedTransactions() {
  const { transactions } = useWallet();
  
  const groupedTransactions = transactions.reduce((groups, transaction) => {
    const date = new Date(transaction.date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let dateKey;
    if (date.toDateString() === today.toDateString()) {
      dateKey = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      dateKey = 'Yesterday';
    } else {
      dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(transaction);
    
    return groups;
  }, {});

  return groupedTransactions;
}

/**
 * Hook for wallet statistics
 */
export function useWalletStats() {
  const { transactions, balance } = useWallet();
  
  const stats = transactions.reduce(
    (acc, txn) => {
      if (txn.status !== 'success') return acc;
      
      if (txn.amount > 0) {
        acc.totalIncome += txn.amount;
        acc.incomeCount += 1;
      } else {
        acc.totalSpent += Math.abs(txn.amount);
        acc.spentCount += 1;
      }
      
      return acc;
    },
    { totalIncome: 0, totalSpent: 0, incomeCount: 0, spentCount: 0 }
  );

  // Calculate this month's change (simplified)
  const thisMonthTransactions = transactions.filter((txn) => {
    const txnDate = new Date(txn.date);
    const now = new Date();
    return txnDate.getMonth() === now.getMonth() && txnDate.getFullYear() === now.getFullYear();
  });

  const monthlyChange = thisMonthTransactions.reduce((sum, txn) => {
    return txn.status === 'success' ? sum + txn.amount : sum;
  }, 0);

  const percentageChange = balance > 0 ? ((monthlyChange / (balance - monthlyChange)) * 100).toFixed(1) : 0;

  return {
    ...stats,
    balance,
    monthlyChange,
    percentageChange,
    transactionCount: transactions.length,
  };
}

/**
 * Hook for merchant statistics
 */
export function useMerchantStats() {
  const merchant = useMerchant();
  
  const todayPayments = merchant.payments.filter((payment) => {
    const paymentDate = new Date(payment.date);
    const today = new Date();
    return paymentDate.toDateString() === today.toDateString();
  });

  const yesterdayPayments = merchant.payments.filter((payment) => {
    const paymentDate = new Date(payment.date);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return paymentDate.toDateString() === yesterday.toDateString();
  });

  const yesterdayEarnings = yesterdayPayments.reduce((sum, p) => sum + p.amount, 0);
  const changeFromYesterday = yesterdayEarnings > 0 
    ? (((merchant.todayEarnings - yesterdayEarnings) / yesterdayEarnings) * 100).toFixed(1)
    : 100;

  return {
    totalEarnings: merchant.totalEarnings,
    todayEarnings: merchant.todayEarnings,
    todayPaymentCount: todayPayments.length,
    changeFromYesterday,
    weeklyData: merchant.weeklyData,
    averageTransactionValue: merchant.payments.length > 0
      ? (merchant.payments.reduce((sum, p) => sum + p.amount, 0) / merchant.payments.length).toFixed(2)
      : 0,
  };
}

export default {
  usePaymentFlow,
  useGroupedTransactions,
  useWalletStats,
  useMerchantStats,
};
