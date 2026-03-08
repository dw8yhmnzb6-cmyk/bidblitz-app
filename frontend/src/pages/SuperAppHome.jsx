import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function SuperAppHome() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("auktionen");

  const quickActions = [
    { icon: "📱", name: "Scannen", link: "/scan" },
    { icon: "💸", name: "Bezahlen", link: "/pay" },
    { icon: "🚗", name: "Transport", link: "/transport" },
    { icon: "💳", name: "Wallet", link: "/wallet" },
  ];

  const tabs = [
    { id: "auktionen", name: "Auktionen" },
    { id: "mobility", name: "Mobility" },
    { id: "essen", name: "Essen" },
    { id: "shopping", name: "Shopping" },
    { id: "services", name: "Services" },
  ];

  const auctionItems = [
    { icon: "🔨", name: "Live-Auktionen", color: "bg-cyan-100", link: "/auctions/live" },
    { icon: "👑", name: "VIP Auktionen", color: "bg-amber-100", link: "/auctions/vip" },
    { icon: "🏆", name: "Leaderboard", color: "bg-purple-100", link: "/leaderboard" },
    { icon: "🎁", name: "Gutschein-Auktionen", color: "bg-green-100", link: "/auctions/voucher" },
    { icon: "💎", name: "Mystery Box", color: "bg-pink-100", link: "/mystery-box" },
    { icon: "⚡", name: "Gebote kaufen", color: "bg-orange-100", link: "/buy-bids" },
    { icon: "⏰", name: "Letzte Chance", color: "bg-red-100", link: "/auctions/ending" },
    { icon: "👥", name: "Freunde einladen", color: "bg-blue-100", link: "/referral" },
  ];

  const mobilityItems = [
    { icon: "🚕", name: "Taxi", color: "bg-yellow-100", link: "/ride/taxi" },
    { icon: "🛴", name: "Scooter", color: "bg-green-100", link: "/ride/scooter" },
    { icon: "🚲", name: "Bike", color: "bg-blue-100", link: "/ride/bike" },
    { icon: "🚗", name: "Carsharing", color: "bg-purple-100", link: "/carsharing" },
  ];

  const offers = [
    { title: "Taxi-Gutschein 100 EUR", price: "€25.00", discount: "-99%", image: "🚕" },
    { title: "Taxi-Gutschein 100 EUR", price: "€5.11", discount: "-99%", image: "🚕" },
  ];

  const currentItems = activeTab === "mobility" ? mobilityItems : auctionItems;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-500 to-blue-600">
      {/* Header */}
      <div className="p-4">
        {/* Quick Actions */}
        <div className="flex justify-around mb-4">
          {quickActions.map((action) => (
            <button
              key={action.name}
              onClick={() => navigate(action.link)}
              className="flex flex-col items-center"
            >
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl mb-1">
                {action.icon}
              </div>
              <span className="text-white text-xs">{action.name}</span>
            </button>
          ))}
        </div>

        {/* Wallet Card */}
        <div className="bg-white rounded-2xl p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              💳
            </div>
            <div>
              <p className="text-xs text-slate-500">Mein Wallet</p>
              <p className="text-xl font-bold">€1125.00</p>
            </div>
          </div>
          <button className="text-blue-600 font-medium flex items-center gap-1">
            989 Gebote <span>›</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-t-3xl min-h-screen">
        {/* Tabs */}
        <div className="flex overflow-x-auto p-4 gap-6 border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap pb-2 font-medium transition ${
                activeTab === tab.id
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-slate-400"
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        {/* Items Grid */}
        <div className="p-4 grid grid-cols-4 gap-4">
          {currentItems.map((item) => (
            <button
              key={item.name}
              onClick={() => navigate(item.link)}
              className="flex flex-col items-center"
            >
              <div
                className={`w-14 h-14 ${item.color} rounded-2xl flex items-center justify-center text-2xl mb-2`}
              >
                {item.icon}
              </div>
              <span className="text-xs text-slate-600 text-center leading-tight">
                {item.name}
              </span>
            </button>
          ))}
        </div>

        {/* Offers Section */}
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">Angebote</h2>
            <button className="text-blue-600 font-medium">Mehr ›</button>
          </div>

          <div className="flex gap-4 overflow-x-auto">
            {offers.map((offer, i) => (
              <div key={i} className="min-w-[160px] bg-slate-900 rounded-xl overflow-hidden">
                <div className="bg-gradient-to-r from-amber-400 to-amber-600 p-4 text-center">
                  <p className="text-xs text-amber-900">PREMIUM VOUCHER</p>
                  <p className="text-4xl font-bold text-white">100</p>
                  <p className="text-xs text-white">EUR</p>
                </div>
                <div className="p-3">
                  <p className="text-white text-sm font-medium truncate">{offer.title}</p>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-red-400 font-bold">{offer.price}</span>
                    <span className="bg-red-500 text-white text-xs px-2 py-1 rounded">
                      {offer.discount}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-20"></div>
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-3">
        <button className="flex flex-col items-center text-blue-600">
          <span>📊</span>
          <span className="text-xs">Übersicht</span>
        </button>
        <button className="flex flex-col items-center text-slate-400">
          <span>🔍</span>
          <span className="text-xs">Suchen</span>
        </button>
        <button className="bg-purple-600 text-white w-12 h-12 rounded-full flex items-center justify-center -mt-4 shadow-lg">
          <span className="text-2xl">+</span>
        </button>
        <button className="flex flex-col items-center text-slate-400">
          <span>🔨</span>
          <span className="text-xs">Auktionen</span>
        </button>
        <button className="flex flex-col items-center text-slate-400">
          <span>⚙️</span>
          <span className="text-xs">Mehr</span>
        </button>
      </div>
    </div>
  );
}
