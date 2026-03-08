import React, { useState, useEffect } from "react";
import axios from "axios";
import WalletCard from "../components/WalletCard";
import QuickActions from "../components/QuickActions";
import RideDashboard from "../components/RideDashboard";
import RewardsPanel from "../components/RewardsPanel";
import BottomNav from "../components/BottomNav";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export default function Dashboard() {
  const [wallet, setWallet] = useState({ balance: 0, coins: 0 });
  const [daily, setDaily] = useState({ streak: 0, nextReward: 10, claimed: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [walletRes, dailyRes] = await Promise.all([
        axios.get(`${API}/app/wallet/balance`, { headers }),
        axios.get(`${API}/app/core/daily/status`, { headers }),
      ]);

      setWallet({
        balance: walletRes.data.balance || 0,
        coins: walletRes.data.coins || 0,
      });
      setDaily({
        streak: dailyRes.data.streak || 0,
        nextReward: dailyRes.data.next_reward || 10,
        claimed: dailyRes.data.claimed_today || false,
      });
    } catch (error) {
      console.log("Data fetch error");
    } finally {
      setLoading(false);
    }
  };

  const claimReward = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(`${API}/app/core/daily/claim`, {}, { headers });
      setDaily((prev) => ({ ...prev, claimed: true }));
      fetchData();
    } catch (error) {
      console.log("Claim error");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Lädt...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24">
      <div className="p-5 space-y-5">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">BidBlitz</h1>
            <p className="text-slate-400 text-sm">Willkommen zurück!</p>
          </div>
          <button className="bg-slate-800 p-3 rounded-full">
            🔔
          </button>
        </div>

        {/* Wallet */}
        <WalletCard balance={wallet.balance} coins={wallet.coins} />

        {/* Daily Rewards */}
        <RewardsPanel
          streak={daily.streak}
          nextReward={daily.nextReward}
          claimed={daily.claimed}
          onClaim={claimReward}
        />

        {/* Quick Actions */}
        <QuickActions />

        {/* Ride Services */}
        <RideDashboard />

      </div>

      <BottomNav />
    </div>
  );
}
