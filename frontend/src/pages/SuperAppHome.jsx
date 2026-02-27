/**
 * BidBlitz Super-App Homepage - Alipay Style
 * One app for everything: Auctions, Pay, Transport, Shopping, Food, Services
 */
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import {
  QrCode, Wallet, Send, Bike, Search, ChevronRight, Star,
  Gavel, Gift, CreditCard, MapPin, Ticket, ShoppingBag,
  Coffee, Plane, Building2, Smartphone, Heart, Trophy,
  Zap, Shield, HelpCircle, Banknote, Globe, Map,
  Clock, Users, Percent, Crown, Bell, ArrowRight, Sparkles
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// ==================== CATEGORY TABS ====================
const CATEGORIES = {
  auktionen: {
    label: 'Auktionen',
    items: [
      { icon: Gavel, label: 'Live-Auktionen', to: '/auctions', color: 'text-cyan-500', bg: 'bg-cyan-50' },
      { icon: Crown, label: 'VIP Auktionen', to: '/vip-auctions', color: 'text-amber-500', bg: 'bg-amber-50' },
      { icon: Trophy, label: 'Leaderboard', to: '/leaderboard', color: 'text-purple-500', bg: 'bg-purple-50' },
      { icon: Gift, label: 'Gutschein-Auktionen', to: '/auctions?scrollTo=gratis', color: 'text-green-500', bg: 'bg-green-50' },
      { icon: Sparkles, label: 'Mystery Box', to: '/mystery-box', color: 'text-pink-500', bg: 'bg-pink-50' },
      { icon: Zap, label: 'Gebote kaufen', to: '/buy-bids', color: 'text-orange-500', bg: 'bg-orange-50' },
      { icon: Clock, label: 'Letzte Chance', to: '/last-chance', color: 'text-red-500', bg: 'bg-red-50' },
      { icon: Users, label: 'Freunde einladen', to: '/invite', color: 'text-blue-500', bg: 'bg-blue-50' },
    ]
  },
  mobility: {
    label: 'Mobility',
    items: [
      { icon: Bike, label: 'E-Scooter', to: '/scooter', color: 'text-emerald-500', bg: 'bg-emerald-50' },
      { icon: Map, label: 'Karte', to: '/scooter', color: 'text-blue-500', bg: 'bg-blue-50' },
      { icon: Crown, label: 'Scooter-Abo', to: '/scooter-abo', color: 'text-amber-500', bg: 'bg-amber-50' },
      { icon: Users, label: 'Gruppen-Fahrt', to: '/gruppen-fahrt', color: 'text-violet-500', bg: 'bg-violet-50' },
      { icon: MapPin, label: 'Händler-Finder', to: '/haendler-finder', color: 'text-orange-500', bg: 'bg-orange-50' },
      { icon: Shield, label: 'Sicher fahren', to: '/scooter-guide', color: 'text-teal-500', bg: 'bg-teal-50' },
      { icon: Star, label: 'Bewertungen', to: '/scooter-bewertungen', color: 'text-yellow-500', bg: 'bg-yellow-50' },
      { icon: Clock, label: 'Fahrt-Verlauf', to: '/dashboard', color: 'text-slate-500', bg: 'bg-slate-50' },
    ]
  },
  essen: {
    label: 'Essen',
    items: [
      { icon: Coffee, label: 'Restaurants', to: '/auctions?scrollTo=restaurant', color: 'text-orange-500', bg: 'bg-orange-50' },
      { icon: Ticket, label: 'Restaurant-Gutscheine', to: '/haendler-gutscheine', color: 'text-red-500', bg: 'bg-red-50' },
      { icon: MapPin, label: 'In der Nähe', to: '/haendler-finder', color: 'text-emerald-500', bg: 'bg-emerald-50' },
      { icon: Star, label: 'Top bewertet', to: '/haendler-finder', color: 'text-amber-500', bg: 'bg-amber-50' },
    ]
  },
  shopping: {
    label: 'Shopping',
    items: [
      { icon: ShoppingBag, label: 'Deals', to: '/deal-radar', color: 'text-pink-500', bg: 'bg-pink-50' },
      { icon: Percent, label: 'Cashback', to: '/features', color: 'text-green-500', bg: 'bg-green-50' },
      { icon: Gift, label: 'Geschenkgutscheine', to: '/gift-cards', color: 'text-purple-500', bg: 'bg-purple-50' },
      { icon: Ticket, label: 'Coupons', to: '/features', color: 'text-blue-500', bg: 'bg-blue-50' },
      { icon: CreditCard, label: 'BidBlitz Pay', to: '/bidblitz-pay-info', color: 'text-emerald-500', bg: 'bg-emerald-50' },
      { icon: Banknote, label: 'Mikrokredite', to: '/loans', color: 'text-teal-500', bg: 'bg-teal-50' },
    ]
  },
  services: {
    label: 'Services',
    items: [
      { icon: Wallet, label: 'Wallet', to: '/pay', color: 'text-blue-500', bg: 'bg-blue-50' },
      { icon: HelpCircle, label: 'Support', to: '/support-tickets', color: 'text-violet-500', bg: 'bg-violet-50' },
      { icon: Globe, label: 'Übersetzer', to: '#', color: 'text-cyan-500', bg: 'bg-cyan-50' },
      { icon: Smartphone, label: 'Handy aufladen', to: '#', color: 'text-pink-500', bg: 'bg-pink-50' },
      { icon: Banknote, label: 'Währungsrechner', to: '#', color: 'text-green-500', bg: 'bg-green-50' },
      { icon: Shield, label: 'Versicherung', to: '#', color: 'text-amber-500', bg: 'bg-amber-50' },
      { icon: Plane, label: 'Reise buchen', to: '#', color: 'text-blue-600', bg: 'bg-blue-50' },
      { icon: Building2, label: 'Für Partner', to: '/partner-landing', color: 'text-slate-500', bg: 'bg-slate-50' },
    ]
  },
};

// ==================== MAIN COMPONENT ====================
export default function SuperAppHome() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('auktionen');
  const [auctions, setAuctions] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    axios.get(`${API}/auctions`).then(r => setAuctions((r.data || []).slice(0, 6))).catch(() => {});
    if (isAuthenticated) {
      axios.get(`${API}/wallet-ledger/balance`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }})
        .then(r => setWalletBalance(r.data.balance_cents || 0)).catch(() => {});
    }
  }, [isAuthenticated]);

  const tabKeys = Object.keys(CATEGORIES);
  const currentItems = CATEGORIES[activeTab]?.items || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-20" data-testid="super-app-home">
      
      {/* ==================== TOP BAR ==================== */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 pt-3 pb-5 text-white">
        <div className="flex items-center justify-between mb-4 max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span className="font-medium text-sm">Dubai</span>
          </div>
          <div className="flex-1 mx-3">
            <div className="flex items-center bg-white/20 rounded-full px-4 py-2 backdrop-blur">
              <Search className="w-4 h-4 text-white/70" />
              <input type="text" placeholder="Suchen..." className="bg-transparent text-white placeholder-white/60 text-sm ml-2 w-full outline-none" />
            </div>
          </div>
          <Link to="/notifications" className="relative">
            <Bell className="w-5 h-5" />
          </Link>
        </div>

        {/* 4 Main Actions */}
        <div className="grid grid-cols-4 gap-3 max-w-lg mx-auto">
          <Link to="/scooter" className="flex flex-col items-center gap-1.5 group" data-testid="action-scan">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:bg-white/30 transition-all backdrop-blur">
              <QrCode className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium">Scannen</span>
          </Link>
          <Link to="/pay" className="flex flex-col items-center gap-1.5 group" data-testid="action-pay">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:bg-white/30 transition-all backdrop-blur">
              <Send className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium">Bezahlen</span>
          </Link>
          <Link to="/scooter" className="flex flex-col items-center gap-1.5 group" data-testid="action-transport">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:bg-white/30 transition-all backdrop-blur">
              <Bike className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium">Transport</span>
          </Link>
          <Link to="/pay" className="flex flex-col items-center gap-1.5 group" data-testid="action-wallet">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:bg-white/30 transition-all backdrop-blur">
              <Wallet className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium">Wallet</span>
          </Link>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4">

        {/* ==================== WALLET QUICK VIEW ==================== */}
        {isAuthenticated && (
          <Link to="/pay" className="block -mt-3 mb-4 bg-white rounded-2xl shadow-lg p-4 border border-slate-100" data-testid="wallet-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Mein Wallet</p>
                  <p className="text-lg font-bold text-slate-800">{'\u20AC'}{(walletBalance / 100).toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-blue-600 font-medium">{user?.bids_balance || 0} Gebote</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          </Link>
        )}

        {/* ==================== CATEGORY TABS ==================== */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-4">
          {/* Tab Bar */}
          <div className="flex border-b border-slate-100 overflow-x-auto scrollbar-hide">
            {tabKeys.map(key => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex-1 min-w-[80px] py-3 text-sm font-medium text-center transition-all whitespace-nowrap ${
                  activeTab === key ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'
                }`}
              >
                {CATEGORIES[key].label}
              </button>
            ))}
          </div>

          {/* Category Items Grid */}
          <div className="p-4">
            <div className="grid grid-cols-4 gap-4">
              {currentItems.map((item, i) => (
                <Link key={i} to={item.to} className="flex flex-col items-center gap-1.5 group" data-testid={`cat-item-${i}`}>
                  <div className={`w-11 h-11 ${item.bg} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <item.icon className={`w-5 h-5 ${item.color}`} />
                  </div>
                  <span className="text-[11px] text-slate-700 text-center leading-tight font-medium">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ==================== SPECIAL OFFERS ==================== */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-800">Angebote</h2>
            <Link to="/auctions" className="text-blue-600 text-sm flex items-center gap-1">Mehr <ChevronRight className="w-4 h-4" /></Link>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
            {auctions.slice(0, 4).map((a, i) => (
              <Link key={a.id} to={`/auctions/${a.id}`}
                className="flex-shrink-0 w-[160px] bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="h-24 bg-slate-100 flex items-center justify-center overflow-hidden">
                  <img src={a.product?.image_url || 'https://via.placeholder.com/160'} alt="" className="w-full h-full object-cover" loading="lazy" />
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-medium text-slate-800 line-clamp-1">{a.title}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm font-bold text-blue-600">{'\u20AC'}{a.current_price?.toFixed(2)}</span>
                    <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">-99%</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ==================== EXPLORE DUBAI ==================== */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-800">Explore Dubai</h2>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/haendler-finder" className="relative h-32 rounded-2xl overflow-hidden shadow-md group">
              <img src="https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=400&q=80" alt="Dubai" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-3 left-3">
                <p className="text-white font-bold text-lg leading-tight">Dubai<br/>Guide</p>
              </div>
            </Link>
            <Link to="/auctions" className="relative h-32 rounded-2xl overflow-hidden shadow-md group">
              <img src="https://images.unsplash.com/photo-1518684079-3c830dcef090?w=400&q=80" alt="Dubai Night" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-3 left-3">
                <p className="text-white font-bold text-lg leading-tight">Dubai<br/>Auktionen</p>
              </div>
            </Link>
          </div>
        </div>

        {/* ==================== QUICK SERVICES ROW ==================== */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-4 mb-4 text-white">
          <p className="font-bold text-sm mb-3">Schnellzugriff</p>
          <div className="grid grid-cols-4 gap-3">
            {[
              { icon: Gavel, label: 'Bieten', to: '/auctions' },
              { icon: Bike, label: 'Scooter', to: '/scooter' },
              { icon: Gift, label: 'Geschenke', to: '/gift-bids' },
              { icon: HelpCircle, label: 'Hilfe', to: '/support-tickets' },
            ].map((s, i) => (
              <Link key={i} to={s.to} className="flex flex-col items-center gap-1">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur">
                  <s.icon className="w-5 h-5" />
                </div>
                <span className="text-[10px]">{s.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* ==================== PARTNER BECOME CTA ==================== */}
        <Link to="/partner-landing" className="block bg-white rounded-2xl border border-slate-100 p-4 mb-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-amber-500" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-slate-800 text-sm">Partner werden</p>
              <p className="text-xs text-slate-500">Verdienen Sie mit BidBlitz</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300" />
          </div>
        </Link>
      </div>
    </div>
  );
}
