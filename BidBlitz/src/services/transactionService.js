/**
 * BidBlitz V2 - Transaction Service
 * Handles transaction queries, filtering, and grouping.
 * Currently uses local data. Replace internals with real API calls later.
 */

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

class TransactionService {
  /**
   * Fetch transactions with optional filters
   * TODO: Replace with real API call → GET /api/transactions?type=&status=&limit=&skip=
   */
  async getTransactions(transactions, { type, status, limit, skip } = {}) {
    await delay(100);
    let result = [...transactions];

    if (type && type !== 'all') {
      result = result.filter((t) => t.type === type);
    }
    if (status && status !== 'all') {
      result = result.filter((t) => t.status === status);
    }

    // Sort newest first
    result.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (skip) result = result.slice(skip);
    if (limit) result = result.slice(0, limit);

    return { success: true, transactions: result, total: result.length };
  }

  /**
   * Get a single transaction by ID
   * TODO: Replace with real API call → GET /api/transactions/:id
   */
  async getTransaction(transactions, id) {
    const tx = transactions.find((t) => t.id === id);
    if (!tx) return { success: false, error: 'Transaction not found' };
    return { success: true, transaction: tx };
  }

  /**
   * Group transactions by date label (Today, Yesterday, etc.)
   */
  groupByDate(transactions) {
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now - 86400000).toDateString();

    const groups = {};
    const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

    for (const tx of sorted) {
      const d = new Date(tx.date).toDateString();
      let label;
      if (d === today) label = 'Today';
      else if (d === yesterday) label = 'Yesterday';
      else label = new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      if (!groups[label]) groups[label] = [];
      groups[label].push(tx);
    }

    return groups;
  }

  /**
   * Calculate wallet statistics from transactions
   */
  calculateStats(transactions, currentBalance) {
    const income = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const spent = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const net = income - spent;
    const pct = spent > 0 ? (((income - spent) / spent) * 100).toFixed(1) : '0.0';

    return {
      totalIncome: income,
      totalSpent: spent,
      netChange: net,
      percentageChange: pct,
      transactionCount: transactions.length,
    };
  }
}

export const transactionService = new TransactionService();
export default transactionService;
