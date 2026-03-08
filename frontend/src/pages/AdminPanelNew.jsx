/**
 * BidBlitz Admin Panel - Premium Dark Design
 * Mit Animationen, Schatten, Suchleiste und erweiterten Features
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { 
  Users, Gavel, BarChart3, Package, Ticket, DollarSign,
  Settings, Trophy, Gift, Shield, Bot, Star, Target,
  Bell, X, Gamepad2, Pickaxe, Eye, Search,
  Mail, Zap, Building2, Wrench, FileText, Database,
  CreditCard, Leaf, Key, Bug, Activity, UserPlus,
  Crown, Store, Bike, MessageSquare, Map, Car, Banknote,
  Euro, Headphones, TrendingUp, ShoppingCart, Clock,
  Award, Navigation, BadgeCheck, Briefcase, Handshake,
  ClipboardList, Coins, MapPin, UserCheck, AlertCircle,
  CheckCircle, XCircle, RefreshCw
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Tab-Kategorien für die horizontale Navigation
const TABS = [
  { id: 'overview', label: 'Übersicht', icon: BarChart3 },
  { id: 'users', label: 'Benutzer', icon: Users },
  { id: 'auctions', label: 'Auktionen', icon: Gavel },
  { id: 'games', label: 'Spiele', icon: Gamepad2 },
  { id: 'mobility', label: 'Mobility', icon: Car },
  { id: 'vouchers', label: 'Gutscheine', icon: Ticket },
  { id: 'finance', label: 'Finanzen', icon: DollarSign },
  { id: 'marketing', label: 'Marketing', icon: Zap },
  { id: 'system', label: 'System', icon: Settings },
];

// Kategorien für das Grid-Menü mit neuen Farben
const CATEGORIES = {
  spiele: {
    title: 'Spiele & Gaming',
    color: 'violet',
    gradient: 'from-violet-500 to-purple-600',
    count: 6,
    items: [
      { name: 'Spiel-Statistiken', icon: BarChart3, tab: 'game-stats' },
      { name: 'Coin-Verwaltung', icon: Coins, tab: 'coin-management' },
      { name: 'Miner-Dashboard', icon: Pickaxe, tab: 'miner-admin' },
      { name: 'Belohnungen', icon: Award, tab: 'rewards-config' },
      { name: 'Leaderboard', icon: Trophy, tab: 'leaderboard-admin' },
      { name: 'Daily Bonus', icon: Clock, tab: 'daily-bonus-config' },
    ]
  },
  mobility: {
    title: 'Mobility',
    color: 'teal',
    gradient: 'from-teal-400 to-cyan-500',
    count: 5,
    items: [
      { name: 'Fahrten-Übersicht', icon: Navigation, tab: 'rides-overview' },
      { name: 'Fahrzeug-Verwaltung', icon: Car, tab: 'fleet' },
      { name: 'Fahrer-Management', icon: UserCheck, tab: 'drivers' },
      { name: 'Tarife & Preise', icon: DollarSign, tab: 'ride-pricing' },
      { name: 'Ride-Statistiken', icon: MapPin, tab: 'mobility-dashboard' },
    ]
  },
  kunden: {
    title: 'Kunden & Personal',
    color: 'sky',
    gradient: 'from-sky-400 to-blue-500',
    count: 7,
    items: [
      { name: 'Alle Benutzer', icon: Users, tab: 'users' },
      { name: 'Support-Tickets', icon: Headphones, tab: 'support' },
      { name: 'KYC-Freischaltung', icon: BadgeCheck, tab: 'kyc-management' },
      { name: 'Mitarbeiter', icon: Briefcase, tab: 'staff' },
      { name: 'Manager', icon: UserPlus, tab: 'managers' },
      { name: 'Influencer', icon: Star, tab: 'influencers' },
      { name: 'Großkunden', icon: Building2, tab: 'wholesale' },
    ]
  },
  partner: {
    title: 'Partner & Händler',
    color: 'amber',
    gradient: 'from-amber-400 to-orange-500',
    count: 4,
    items: [
      { name: 'Partner Portal', icon: Handshake, tab: 'partner-portal' },
      { name: 'Händler-Bewerbungen', icon: ClipboardList, tab: 'restaurant-applications' },
      { name: 'Restaurant-Partner', icon: Store, tab: 'restaurant-vouchers' },
      { name: 'Auto-Werbung', icon: Car, tab: 'car-advertising' },
    ]
  },
  auktionen: {
    title: 'Auktionen',
    color: 'rose',
    gradient: 'from-rose-400 to-red-500',
    count: 9,
    items: [
      { name: 'Produkte', icon: Package, tab: 'products' },
      { name: 'Standard-Auktionen', icon: Gavel, tab: 'auctions' },
      { name: 'VIP-Auktionen', icon: Crown, tab: 'vip-auctions' },
      { name: 'Gutschein-Auktionen', icon: Ticket, tab: 'restaurant-auctions' },
      { name: 'Bot-System', icon: Bot, tab: 'bots' },
      { name: 'Gewinner-Kontrolle', icon: Target, tab: 'winner-control' },
      { name: 'Produkt-Analyse', icon: BarChart3, tab: 'product-analytics' },
      { name: 'Benutzer-Analyse', icon: Users, tab: 'user-analytics' },
      { name: 'Umsatz-Analyse', icon: Euro, tab: 'revenue-analytics' },
    ]
  },
  gutscheine: {
    title: 'Gutscheine & Codes',
    color: 'fuchsia',
    gradient: 'from-fuchsia-400 to-pink-500',
    count: 5,
    items: [
      { name: 'Händler-Gutscheine', icon: Ticket, tab: 'merchant-vouchers' },
      { name: 'Bieter-Gutscheine', icon: Ticket, tab: 'vouchers' },
      { name: 'Partner-Gutscheine', icon: Ticket, tab: 'restaurant-vouchers' },
      { name: 'Rabatt-Coupons', icon: Ticket, tab: 'coupons' },
      { name: 'Promo-Codes', icon: Gift, tab: 'promo-codes' },
    ]
  },
  finanzen: {
    title: 'Finanzen',
    color: 'emerald',
    gradient: 'from-emerald-400 to-green-500',
    count: 7,
    items: [
      { name: 'Zahlungen', icon: DollarSign, tab: 'payments' },
      { name: 'Wallet Aufladen', icon: DollarSign, tab: 'wallet-topup' },
      { name: 'Wise Auszahlungen', icon: CreditCard, tab: 'wise-payouts' },
      { name: 'Kredit-Verwaltung', icon: CreditCard, tab: 'credit-management' },
      { name: 'Digital API', icon: Key, tab: 'digital-api' },
      { name: 'Großhändler', icon: Building2, tab: 'enterprise' },
      { name: 'SEPA-Auszahlungen', icon: Banknote, tab: 'sepa-payouts' },
    ]
  },
  marketing: {
    title: 'Marketing',
    color: 'yellow',
    gradient: 'from-yellow-400 to-amber-500',
    count: 7,
    items: [
      { name: 'Flash Sales', icon: Zap, tab: 'flash-sales' },
      { name: 'Werbebanner', icon: Eye, tab: 'banners' },
      { name: 'E-Mail Marketing', icon: Mail, tab: 'email' },
      { name: 'Jackpot', icon: Trophy, tab: 'jackpot' },
      { name: 'Challenges', icon: Trophy, tab: 'weekly-challenges' },
      { name: 'Mystery Box', icon: Gift, tab: 'mystery-box' },
      { name: 'Umfragen', icon: Star, tab: 'surveys' },
    ]
  },
  system: {
    title: 'System',
    color: 'slate',
    gradient: 'from-slate-400 to-gray-500',
    count: 10,
    items: [
      { name: 'Wartung', icon: Wrench, tab: 'maintenance' },
      { name: 'Seiten (CMS)', icon: FileText, tab: 'pages' },
      { name: 'Spiel-Einstellungen', icon: Settings, tab: 'game-config' },
      { name: 'Nachhaltigkeit', icon: Leaf, tab: 'sustainability' },
      { name: 'Passwörter', icon: Key, tab: 'passwords' },
      { name: 'Systemlogs', icon: BarChart3, tab: 'logs' },
      { name: 'Sprachbefehle', icon: MessageSquare, tab: 'voice' },
      { name: 'Debug Reports', icon: Bug, tab: 'debug-reports' },
      { name: 'System Health', icon: Activity, tab: 'system-health' },
      { name: 'Daten-Backup', icon: Database, tab: 'backup' },
    ]
  }
};

// Erweiterte Schnellzugriff-Buttons
const QUICK_ACCESS = [
  { name: 'Auktionen', icon: Gavel, tab: 'auctions', gradient: 'from-rose-500 to-red-600' },
  { name: 'Alle Benutzer', icon: Users, tab: 'users', gradient: 'from-sky-500 to-blue-600' },
  { name: 'Push senden', icon: Bell, tab: 'email', gradient: 'from-yellow-500 to-amber-600' },
  { name: 'Analytics', icon: BarChart3, tab: 'analytics', gradient: 'from-violet-500 to-purple-600' },
  { name: 'Zahlungen', icon: CreditCard, tab: 'payments', gradient: 'from-emerald-500 to-green-600' },
  { name: 'Support', icon: Headphones, tab: 'support', gradient: 'from-pink-500 to-rose-600' },
];

// Benachrichtigungen (Mock-Daten)
const MOCK_NOTIFICATIONS = [
  { id: 1, type: 'success', message: 'Neue Bestellung eingegangen', time: '2 Min' },
  { id: 2, type: 'warning', message: 'KYC-Antrag wartet auf Prüfung', time: '15 Min' },
  { id: 3, type: 'info', message: '3 neue Benutzer registriert', time: '1 Std' },
];

export default function AdminPanelNew() {
  const { token, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [stats, setStats] = useState({
    users: 0,
    revenue: 0,
    games: 0,
    miners: 0,
    orders: 0,
    activeAuctions: 0,
    pendingKYC: 0,
    todayRevenue: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [token]);

  const fetchStats = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [statsRes, usersRes, auctionsRes] = await Promise.all([
        axios.get(`${API}/admin/stats`, { headers }).catch(() => ({ data: {} })),
        axios.get(`${API}/admin/users`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/auctions`).catch(() => ({ data: [] }))
      ]);
      
      const activeAuctions = auctionsRes.data?.filter(a => a.status === 'active')?.length || 0;
      
      setStats({
        users: usersRes.data?.length || statsRes.data?.total_users || 0,
        revenue: statsRes.data?.total_revenue || 0,
        games: statsRes.data?.total_games || 0,
        miners: statsRes.data?.active_miners || 0,
        orders: statsRes.data?.total_orders || 0,
        activeAuctions: activeAuctions,
        pendingKYC: statsRes.data?.pending_kyc || 0,
        todayRevenue: statsRes.data?.today_revenue || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabClick = (tabId) => {
    if (tabId === 'overview') {
      setActiveTab('overview');
    } else {
      navigate(`/admin?tab=${tabId}`);
    }
  };

  const handleItemClick = (tab) => {
    navigate(`/admin?tab=${tab}`);
  };

  // Filter categories based on search
  const filteredCategories = Object.entries(CATEGORIES).reduce((acc, [key, category]) => {
    if (searchQuery) {
      const filteredItems = category.items.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (filteredItems.length > 0) {
        acc[key] = { ...category, items: filteredItems, count: filteredItems.length };
      }
    } else {
      acc[key] = category;
    }
    return acc;
  }, {});

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f0f1a] to-[#1a1a2e] flex items-center justify-center">
        <div className="text-white text-center animate-fade-in">
          <Shield className="w-20 h-20 mx-auto mb-4 text-red-500 animate-pulse" />
          <h2 className="text-2xl font-bold">Kein Zugriff</h2>
          <p className="text-gray-400 mt-2">Admin-Berechtigung erforderlich</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f1a] via-[#1a1a2e] to-[#0f0f1a] pt-16 pb-24" data-testid="admin-panel-new">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Header with Gradient */}
      <div className="relative bg-gradient-to-r from-red-600 via-rose-500 to-pink-500 px-4 py-5 shadow-2xl">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-xl tracking-tight">Admin Panel</h1>
              <p className="text-white/80 text-sm">BidBlitz Verwaltung</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Notifications */}
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative w-11 h-11 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg hover:bg-white/30 transition-all transform hover:scale-105"
            >
              <Bell className="w-5 h-5 text-white" />
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full text-xs font-bold text-black flex items-center justify-center animate-bounce">
                3
              </span>
            </button>
            {/* Close */}
            <button 
              onClick={() => navigate('/')}
              className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg hover:bg-white/30 transition-all transform hover:scale-105"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Notifications Dropdown */}
        {showNotifications && (
          <div className="absolute top-full right-4 mt-2 w-80 bg-[#252540] rounded-2xl shadow-2xl border border-white/10 overflow-hidden z-50 animate-slide-down">
            <div className="p-4 border-b border-white/10">
              <h3 className="text-white font-semibold">Benachrichtigungen</h3>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {MOCK_NOTIFICATIONS.map((notif) => (
                <div key={notif.id} className="p-4 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer">
                  <div className="flex items-start gap-3">
                    {notif.type === 'success' && <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />}
                    {notif.type === 'warning' && <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />}
                    {notif.type === 'info' && <Bell className="w-5 h-5 text-blue-400 flex-shrink-0" />}
                    <div className="flex-1">
                      <p className="text-white text-sm">{notif.message}</p>
                      <p className="text-gray-500 text-xs mt-1">{notif.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 bg-white/5">
              <button className="w-full text-center text-sm text-purple-400 hover:text-purple-300 transition-colors">
                Alle anzeigen
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="px-4 py-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Suche nach Funktionen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#252540]/80 backdrop-blur-sm border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all shadow-lg"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
            >
              <XCircle className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-4 pb-2 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 min-w-max pb-2">
          {TABS.map((tab, index) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-medium transition-all transform hover:scale-105 shadow-lg ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-orange-500/25'
                    : 'bg-[#252540]/80 backdrop-blur-sm text-gray-300 hover:bg-[#303050] border border-white/5'
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
                data-testid={`admin-tab-${tab.id}`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="relative px-4 py-4 space-y-8">
        {/* Dashboard Stats - Extended */}
        <div className="animate-fade-in">
          <h2 className="text-white font-bold text-xl mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-400" />
            Dashboard
            <button onClick={fetchStats} className="ml-auto text-gray-400 hover:text-white transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {/* Main Stats */}
            <div className="bg-gradient-to-br from-[#252540] to-[#1f1f35] rounded-2xl p-5 shadow-xl border border-white/5 transform hover:scale-[1.02] transition-all">
              <Users className="w-10 h-10 text-blue-400 mb-3" />
              <div className="text-3xl font-bold text-white">{stats.users}</div>
              <div className="text-gray-400 text-sm">Benutzer</div>
              <div className="mt-2 text-xs text-green-400 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> +12% diese Woche
              </div>
            </div>
            <div className="bg-gradient-to-br from-[#252540] to-[#1f1f35] rounded-2xl p-5 shadow-xl border border-white/5 transform hover:scale-[1.02] transition-all">
              <Euro className="w-10 h-10 text-emerald-400 mb-3" />
              <div className="text-3xl font-bold text-white">{stats.revenue}€</div>
              <div className="text-gray-400 text-sm">Gesamtumsatz</div>
              <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Heute: {stats.todayRevenue}€
              </div>
            </div>
            <div className="bg-gradient-to-br from-[#252540] to-[#1f1f35] rounded-2xl p-5 shadow-xl border border-white/5 transform hover:scale-[1.02] transition-all">
              <Gamepad2 className="w-10 h-10 text-purple-400 mb-3" />
              <div className="text-3xl font-bold text-white">{stats.games}</div>
              <div className="text-gray-400 text-sm">Gespielte Spiele</div>
            </div>
            <div className="bg-gradient-to-br from-[#252540] to-[#1f1f35] rounded-2xl p-5 shadow-xl border border-white/5 transform hover:scale-[1.02] transition-all">
              <Pickaxe className="w-10 h-10 text-yellow-400 mb-3" />
              <div className="text-3xl font-bold text-white">{stats.miners}</div>
              <div className="text-gray-400 text-sm">Aktive Miner</div>
            </div>
            {/* Additional Stats */}
            <div className="bg-gradient-to-br from-[#252540] to-[#1f1f35] rounded-2xl p-5 shadow-xl border border-white/5 transform hover:scale-[1.02] transition-all">
              <Gavel className="w-10 h-10 text-rose-400 mb-3" />
              <div className="text-3xl font-bold text-white">{stats.activeAuctions}</div>
              <div className="text-gray-400 text-sm">Aktive Auktionen</div>
            </div>
            <div className="bg-gradient-to-br from-[#252540] to-[#1f1f35] rounded-2xl p-5 shadow-xl border border-white/5 transform hover:scale-[1.02] transition-all">
              <ShoppingCart className="w-10 h-10 text-cyan-400 mb-3" />
              <div className="text-3xl font-bold text-white">{stats.orders}</div>
              <div className="text-gray-400 text-sm">Bestellungen</div>
            </div>
          </div>
        </div>

        {/* Schnellzugriff - Extended */}
        <div className="animate-fade-in" style={{ animationDelay: '100ms' }}>
          <h2 className="text-white font-bold text-xl mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Schnellzugriff
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_ACCESS.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.name}
                  onClick={() => handleItemClick(item.tab)}
                  className={`bg-gradient-to-r ${item.gradient} rounded-2xl p-4 flex items-center gap-3 shadow-xl transform hover:scale-[1.03] transition-all hover:shadow-2xl`}
                  style={{ animationDelay: `${index * 50}ms` }}
                  data-testid={`quick-${item.tab}`}
                >
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-white font-semibold">{item.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Kategorien mit verbesserten Farben und Animationen */}
        {Object.entries(filteredCategories).map(([key, category], catIndex) => {
          const colorClasses = {
            violet: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
            teal: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
            sky: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
            amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
            rose: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
            fuchsia: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30',
            emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
            yellow: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
            slate: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
          };
          
          return (
            <div 
              key={key} 
              className="animate-fade-in"
              style={{ animationDelay: `${(catIndex + 2) * 100}ms` }}
            >
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl mb-4 border ${colorClasses[category.color]} shadow-lg`}>
                <span className="font-bold">{category.title}</span>
                <span className="text-xs opacity-70 bg-white/10 px-2 py-0.5 rounded-full">({category.count})</span>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {category.items.map((item, itemIndex) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.name}
                      onClick={() => handleItemClick(item.tab)}
                      className="group bg-gradient-to-br from-white to-gray-100 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all min-h-[90px] border border-gray-200"
                      style={{ animationDelay: `${itemIndex * 30}ms` }}
                      data-testid={`admin-item-${item.tab}`}
                    >
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${category.gradient} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-xs text-gray-700 text-center leading-tight font-semibold group-hover:text-gray-900 transition-colors">
                        {item.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* No Results */}
        {searchQuery && Object.keys(filteredCategories).length === 0 && (
          <div className="text-center py-12 animate-fade-in">
            <Search className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">Keine Ergebnisse für "{searchQuery}"</p>
            <button 
              onClick={() => setSearchQuery('')}
              className="mt-4 text-purple-400 hover:text-purple-300 transition-colors"
            >
              Suche zurücksetzen
            </button>
          </div>
        )}
      </div>

      {/* Custom Animations */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-down {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
        }
        .animate-slide-down {
          animation: slide-down 0.3s ease-out forwards;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
