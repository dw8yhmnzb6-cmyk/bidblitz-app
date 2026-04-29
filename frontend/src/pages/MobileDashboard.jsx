import React, { useEffect } from 'react';
import { Bell, TrendingUp, Wallet, ShoppingBag, Zap, Home, ScanLine, Activity, User } from 'lucide-react';

export default function MobileDashboard() {
  useEffect(() => {
    document.body.style.overflow = 'auto';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);
  const quickActions = [
    { icon: TrendingUp, label: 'Auctions', color: '#00AEEF' },
    { icon: Wallet, label: 'Pay', color: '#7B2CFF' },
    { icon: ShoppingBag, label: 'Market', color: '#00AEEF' },
    { icon: Zap, label: 'Scooter', color: '#7B2CFF' },
  ];

  const activities = [
    { type: 'Auction Bid', amount: '-€0.50', time: '2 min ago', color: 'text-red-400' },
    { type: 'Wallet Top Up', amount: '+€50.00', time: '1 hour ago', color: 'text-green-400' },
    { type: 'QR Payment', amount: '-€12.40', time: '3 hours ago', color: 'text-red-400' },
  ];

  const navItems = [
    { icon: Home, label: 'Home', active: true },
    { icon: Wallet, label: 'Wallet' },
    { icon: ScanLine, label: 'Scan' },
    { icon: Activity, label: 'Activity' },
    { icon: User, label: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-[#0B0B0F] text-white pb-20">
      {/* Header */}
      <div className="px-6 pt-8 pb-6 flex justify-between items-center">
        <div>
          <p className="text-gray-400 text-sm">Hello,</p>
          <h1 className="text-2xl font-bold">Afrim</h1>
        </div>
        <button className="w-10 h-10 rounded-full bg-[#121218] flex items-center justify-center relative">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-[#00AEEF] rounded-full"></span>
        </button>
      </div>

      {/* Wallet Card */}
      <div className="mx-6 mb-6 bg-gradient-to-br from-[#00AEEF] to-[#7B2CFF] rounded-3xl p-6 shadow-2xl">
        <p className="text-white/80 text-sm mb-2">Total Balance</p>
        <h2 className="text-4xl font-bold mb-4">€1,240.50</h2>
        <button className="bg-white text-[#7B2CFF] px-6 py-2.5 rounded-full font-semibold text-sm hover:bg-gray-100 transition">
          Top Up
        </button>
      </div>

      {/* Quick Actions */}
      <div className="px-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-4 gap-3">
          {quickActions.map((action, idx) => (
            <button
              key={idx}
              className="flex flex-col items-center gap-2 bg-[#121218] rounded-2xl p-4 hover:bg-[#1a1a22] transition"
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${action.color}20` }}
              >
                <action.icon size={24} style={{ color: action.color }} />
              </div>
              <span className="text-xs text-gray-300">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="px-6">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <div className="bg-[#121218] rounded-2xl overflow-hidden">
          {activities.map((item, idx) => (
            <div
              key={idx}
              className={`flex justify-between items-center p-4 ${
                idx !== activities.length - 1 ? 'border-b border-white/5' : ''
              }`}
            >
              <div>
                <p className="font-medium text-sm">{item.type}</p>
                <p className="text-xs text-gray-500">{item.time}</p>
              </div>
              <p className={`font-bold ${item.color}`}>{item.amount}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#121218] border-t border-white/5 px-6 py-3">
        <div className="flex justify-between items-center max-w-md mx-auto">
          {navItems.map((item, idx) => (
            <button
              key={idx}
              className={`flex flex-col items-center gap-1 ${
                item.active ? 'text-[#00AEEF]' : 'text-gray-500'
              }`}
            >
              <item.icon size={22} />
              <span className="text-xs">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
