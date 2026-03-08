/**
 * BidBlitz Admin Panel - Neues dunkles Design
 * Kategorisiertes Grid-Layout mit Statistiken und Schnellzugriff
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { 
  Users, Gavel, BarChart3, Package, Ticket, DollarSign,
  Settings, Trophy, Gift, Shield, Bot, Star, Target,
  Bell, X, ChevronRight, Gamepad2, Pickaxe, Eye,
  Mail, Zap, Building2, Wrench, FileText, Database,
  CreditCard, Leaf, Key, Bug, Activity, UserPlus,
  Crown, Store, Bike, MessageSquare, Map, Car, Banknote,
  Euro, Headphones, History, Coins, Award, Clock,
  Truck, Navigation, DollarSign as Tariff, MapPin,
  UserCheck, HeadphonesIcon, BadgeCheck, Briefcase,
  Handshake, ClipboardList, Users2, Sparkles
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Tab-Kategorien für die horizontale Navigation
const TABS = [
  { id: 'overview', label: 'Übersicht', icon: BarChart3 },
  { id: 'users', label: 'Benutzer', icon: Users },
  { id: 'auctions', label: 'Auktionen', icon: Gavel },
  { id: 'vouchers', label: 'Gutscheine', icon: Ticket },
  { id: 'finance', label: 'Finanzen', icon: DollarSign },
  { id: 'marketing', label: 'Marketing', icon: Zap },
  { id: 'system', label: 'System', icon: Settings },
];

// Kategorien für das Grid-Menü
const CATEGORIES = {
  auktionen: {
    title: 'Auktionen',
    color: 'orange',
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
    color: 'pink',
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
    color: 'green',
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
    color: 'gray',
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

// Schnellzugriff-Buttons
const QUICK_ACCESS = [
  { name: 'Auktionen', icon: Gavel, tab: 'auctions', color: 'orange' },
  { name: 'Alle Benutzer', icon: Users, tab: 'users', color: 'blue' },
  { name: 'Push senden', icon: Bell, tab: 'email', color: 'yellow' },
  { name: 'Analytics', icon: BarChart3, tab: 'analytics', color: 'purple' },
];

export default function AdminPanelNew() {
  const { token, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    users: 0,
    revenue: 0,
    games: 0,
    miners: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [token]);

  const fetchStats = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [statsRes, usersRes] = await Promise.all([
        axios.get(`${API}/admin/stats`, { headers }).catch(() => ({ data: {} })),
        axios.get(`${API}/admin/users`, { headers }).catch(() => ({ data: [] }))
      ]);
      
      setStats({
        users: usersRes.data?.length || statsRes.data?.total_users || 0,
        revenue: statsRes.data?.total_revenue || 0,
        games: statsRes.data?.total_games || 0,
        miners: statsRes.data?.active_miners || 0
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
      // Navigiere zur Hauptadmin-Seite mit aktivem Tab
      navigate(`/admin?tab=${tabId}`);
    }
  };

  const handleItemClick = (tab) => {
    navigate(`/admin?tab=${tab}`);
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <div className="text-white text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-bold">Kein Zugriff</h2>
          <p className="text-gray-400 mt-2">Admin-Berechtigung erforderlich</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] pt-16 pb-20" data-testid="admin-panel-new">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-500 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg">Admin Panel</h1>
            <p className="text-white/70 text-sm">BidBlitz Verwaltung</p>
          </div>
        </div>
        <button 
          onClick={() => navigate('/')}
          className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center"
        >
          <X className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="bg-[#252540] px-2 py-2 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-orange-500 text-white'
                    : 'bg-[#353555] text-gray-300 hover:bg-[#404060]'
                }`}
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
      <div className="px-4 py-4 space-y-6">
        {/* Dashboard Stats */}
        <div>
          <h2 className="text-white font-bold text-lg mb-3">Dashboard</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#252540] rounded-xl p-4">
              <Users className="w-8 h-8 text-blue-400 mb-2" />
              <div className="text-2xl font-bold text-white">{stats.users}</div>
              <div className="text-gray-400 text-sm">Benutzer</div>
            </div>
            <div className="bg-[#252540] rounded-xl p-4">
              <CreditCard className="w-8 h-8 text-green-400 mb-2" />
              <div className="text-2xl font-bold text-white">{stats.revenue}€</div>
              <div className="text-gray-400 text-sm">Umsatz</div>
            </div>
            <div className="bg-[#252540] rounded-xl p-4">
              <Gamepad2 className="w-8 h-8 text-purple-400 mb-2" />
              <div className="text-2xl font-bold text-white">{stats.games}</div>
              <div className="text-gray-400 text-sm">Spiele</div>
            </div>
            <div className="bg-[#252540] rounded-xl p-4">
              <Pickaxe className="w-8 h-8 text-yellow-400 mb-2" />
              <div className="text-2xl font-bold text-white">{stats.miners}</div>
              <div className="text-gray-400 text-sm">Miner</div>
            </div>
          </div>
        </div>

        {/* Schnellzugriff */}
        <div>
          <h2 className="text-white font-bold text-lg mb-3">Schnellzugriff</h2>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_ACCESS.map((item) => {
              const Icon = item.icon;
              const colorClasses = {
                orange: 'text-orange-400',
                blue: 'text-blue-400',
                yellow: 'text-yellow-400',
                purple: 'text-purple-400',
              };
              return (
                <button
                  key={item.name}
                  onClick={() => handleItemClick(item.tab)}
                  className="bg-[#252540] rounded-xl p-4 flex items-center gap-3 hover:bg-[#303050] transition-all"
                  data-testid={`quick-${item.tab}`}
                >
                  <Icon className={`w-6 h-6 ${colorClasses[item.color]}`} />
                  <span className="text-white font-medium">{item.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Kategorien */}
        {Object.entries(CATEGORIES).map(([key, category]) => {
          const colorClasses = {
            orange: 'bg-orange-500/10 text-orange-400',
            pink: 'bg-pink-500/10 text-pink-400',
            green: 'bg-green-500/10 text-green-400',
            yellow: 'bg-yellow-500/10 text-yellow-400',
            gray: 'bg-gray-500/10 text-gray-400',
          };
          
          return (
            <div key={key}>
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg mb-3 ${colorClasses[category.color]}`}>
                <span className="font-semibold">{category.title}</span>
                <span className="text-xs opacity-70">({category.count})</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {category.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.name}
                      onClick={() => handleItemClick(item.tab)}
                      className="bg-[#f0f4f8] rounded-xl p-3 flex flex-col items-center justify-center gap-2 hover:bg-white transition-all min-h-[80px]"
                      data-testid={`admin-item-${item.tab}`}
                    >
                      <Icon className="w-5 h-5 text-gray-600" />
                      <span className="text-xs text-gray-700 text-center leading-tight font-medium">
                        {item.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
