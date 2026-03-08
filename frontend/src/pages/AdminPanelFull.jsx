import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AdminPanelFull() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const sections = [
    {
      title: "Auktionen",
      count: 9,
      color: "bg-blue-100",
      items: [
        { icon: "📦", name: "Produkte", link: "/admin/products" },
        { icon: "🔨", name: "Standard-Auktionen", link: "/admin/auctions" },
        { icon: "👑", name: "VIP-Auktionen", link: "/admin/vip-auctions" },
        { icon: "🎫", name: "Gutschein-Auktionen", link: "/admin/voucher-auctions" },
        { icon: "🤖", name: "Bot-System", link: "/admin/bot-system" },
        { icon: "🎯", name: "Gewinner-Kontrolle", link: "/admin/winners" },
        { icon: "📊", name: "Produkt-Analyse", link: "/admin/product-analytics" },
        { icon: "👥", name: "Benutzer-Analyse", link: "/admin/user-analytics" },
        { icon: "💶", name: "Umsatz-Analyse", link: "/admin/revenue" },
      ],
    },
    {
      title: "Gutscheine & Codes",
      count: 5,
      color: "bg-purple-100",
      items: [
        { icon: "🏪", name: "Händler-Gutscheine", link: "/admin/merchant-vouchers" },
        { icon: "🎟️", name: "Bieter-Gutscheine", link: "/admin/bidder-vouchers" },
        { icon: "🤝", name: "Partner-Gutscheine", link: "/admin/partner-vouchers" },
        { icon: "🏷️", name: "Rabatt-Coupons", link: "/admin/discount-coupons" },
        { icon: "🎁", name: "Promo-Codes", link: "/admin/promo-codes" },
      ],
    },
    {
      title: "Marketing",
      count: 7,
      color: "bg-orange-100",
      items: [
        { icon: "⚡", name: "Flash Sales", link: "/admin/flash-sales" },
        { icon: "🖼️", name: "Werbebanner", link: "/admin/banners" },
        { icon: "📧", name: "E-Mail Marketing", link: "/admin/email-marketing" },
        { icon: "🎰", name: "Jackpot", link: "/admin/jackpot" },
        { icon: "🏆", name: "Challenges", link: "/admin/challenges" },
        { icon: "📦", name: "Mystery Box", link: "/admin/mystery-box" },
        { icon: "📋", name: "Umfragen", link: "/admin/surveys" },
      ],
    },
    {
      title: "System",
      count: 10,
      color: "bg-slate-200",
      items: [
        { icon: "🔧", name: "Wartung", link: "/admin/maintenance" },
        { icon: "📄", name: "Seiten (CMS)", link: "/admin/cms" },
        { icon: "🎮", name: "Spiel-Einstellungen", link: "/admin/game-settings" },
        { icon: "🌱", name: "Nachhaltigkeit", link: "/admin/sustainability" },
        { icon: "🔐", name: "Passwörter", link: "/admin/passwords" },
        { icon: "📜", name: "Systemlogs", link: "/admin/logs" },
        { icon: "🗣️", name: "Sprachbefehle", link: "/admin/voice-commands" },
        { icon: "🐛", name: "Debug Reports", link: "/admin/debug" },
        { icon: "📈", name: "System Status", link: "/admin/status" },
        { icon: "💾", name: "Daten-Backup", link: "/admin/backup" },
      ],
    },
    {
      title: "Benutzer",
      count: 6,
      color: "bg-green-100",
      items: [
        { icon: "👥", name: "Alle Benutzer", link: "/admin/users" },
        { icon: "👑", name: "VIP Benutzer", link: "/admin/vip-users" },
        { icon: "🚫", name: "Gesperrte", link: "/admin/banned" },
        { icon: "📊", name: "Statistiken", link: "/admin/user-stats" },
        { icon: "💰", name: "Coins verwalten", link: "/admin/coins" },
        { icon: "⛏️", name: "Miner verwalten", link: "/admin/miners" },
      ],
    },
    {
      title: "Finanzen",
      count: 5,
      color: "bg-emerald-100",
      items: [
        { icon: "💳", name: "Zahlungen", link: "/admin/payments" },
        { icon: "🏦", name: "Auszahlungen", link: "/admin/withdrawals" },
        { icon: "📊", name: "Umsatz", link: "/admin/revenue" },
        { icon: "🧾", name: "Rechnungen", link: "/admin/invoices" },
        { icon: "💹", name: "Finanz-Report", link: "/admin/finance-report" },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-white">
      {/* Header */}
      <div className="bg-white p-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚙️</span>
          <h1 className="text-xl font-bold">Admin Panel</h1>
        </div>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition ${
            menuOpen ? "bg-slate-800 text-white" : "bg-white border"
          }`}
        >
          {menuOpen ? "✕" : "☰"} Menü
        </button>
      </div>

      {/* Quick Stats */}
      <div className="p-4 grid grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-xl text-center shadow-sm">
          <p className="text-2xl font-bold text-blue-600">1,247</p>
          <p className="text-xs text-slate-500">Benutzer</p>
        </div>
        <div className="bg-white p-3 rounded-xl text-center shadow-sm">
          <p className="text-2xl font-bold text-green-600">€52K</p>
          <p className="text-xs text-slate-500">Umsatz</p>
        </div>
        <div className="bg-white p-3 rounded-xl text-center shadow-sm">
          <p className="text-2xl font-bold text-purple-600">89</p>
          <p className="text-xs text-slate-500">Auktionen</p>
        </div>
        <div className="bg-white p-3 rounded-xl text-center shadow-sm">
          <p className="text-2xl font-bold text-orange-600">24</p>
          <p className="text-xs text-slate-500">Live</p>
        </div>
      </div>

      {/* Sections */}
      <div className="p-4 space-y-6">
        {sections.map((section) => (
          <div key={section.title}>
            {/* Section Header */}
            <div className={`${section.color} px-4 py-2 rounded-lg mb-3`}>
              <span className="font-bold text-slate-700">{section.title}</span>
              <span className="ml-2 text-slate-500">({section.count})</span>
            </div>

            {/* Items Grid */}
            <div className="grid grid-cols-4 gap-3">
              {section.items.map((item) => (
                <button
                  key={item.name}
                  onClick={() => navigate(item.link)}
                  className="bg-white p-4 rounded-xl text-center hover:shadow-md transition flex flex-col items-center"
                >
                  <span className="text-2xl mb-2">{item.icon}</span>
                  <span className="text-xs text-slate-600 leading-tight">
                    {item.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
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

      <div className="h-20"></div>
    </div>
  );
}
