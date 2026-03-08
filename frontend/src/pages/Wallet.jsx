import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import BottomNav from "../components/BottomNav";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export default function Wallet() {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState({ balance: 0, coins: 0 });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWallet();
  }, []);

  const fetchWallet = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [walletRes, txRes] = await Promise.all([
        axios.get(`${API}/app/wallet/balance`, { headers }),
        axios.get(`${API}/app/wallet/transactions`, { headers }).catch(() => ({ data: [] })),
      ]);

      setWallet({
        balance: walletRes.data.balance || 0,
        coins: walletRes.data.coins || 0,
      });
      setTransactions(txRes.data || []);
    } catch (error) {
      console.log("Wallet error");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white">Lädt...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24">
      <div className="p-5 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-2xl">←</button>
          <h1 className="text-2xl font-bold">Wallet</h1>
        </div>

        {/* Balance Card */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 rounded-2xl">
          <p className="text-sm opacity-80">Gesamtguthaben</p>
          <p className="text-4xl font-bold mt-1">{wallet.balance.toLocaleString()} €</p>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-2xl">🪙</span>
            <span className="text-xl">{wallet.coins.toLocaleString()} Coins</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => navigate("/wallet/deposit")}
            className="bg-green-600 hover:bg-green-700 p-4 rounded-xl font-medium transition"
          >
            + Einzahlen
          </button>
          <button
            onClick={() => navigate("/wallet/withdraw")}
            className="bg-slate-700 hover:bg-slate-600 p-4 rounded-xl font-medium transition"
          >
            Auszahlen
          </button>
        </div>

        {/* Buy Coins */}
        <button
          onClick={() => navigate("/wallet/buy-coins")}
          className="w-full bg-amber-500 hover:bg-amber-600 p-4 rounded-xl font-medium transition"
        >
          🪙 Coins kaufen
        </button>

        {/* Transactions */}
        <div className="bg-slate-800 rounded-2xl p-4">
          <h3 className="font-bold mb-4">Letzte Transaktionen</h3>
          
          {transactions.length === 0 ? (
            <p className="text-slate-400 text-center py-4">Keine Transaktionen</p>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 10).map((tx, idx) => (
                <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-700 last:border-0">
                  <div>
                    <p className="font-medium">{tx.description || "Transaktion"}</p>
                    <p className="text-xs text-slate-400">{tx.date || "Heute"}</p>
                  </div>
                  <p className={`font-bold ${tx.amount >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {tx.amount >= 0 ? "+" : ""}{tx.amount} {tx.type === "coins" ? "🪙" : "€"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      <BottomNav />
    </div>
  );
}
