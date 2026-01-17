import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  LayoutDashboard, Package, Gavel, Users, Plus, Trash2, 
  Settings, BarChart3, Zap, RefreshCw, Square, UserPlus,
  Ban, CheckCircle, DollarSign, Globe, Ticket, Edit, X, Save,
  Bot, Play, Target, Calendar, Clock, TrendingUp, Activity
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart
} from 'recharts';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Chart Colors
const CHART_COLORS = {
  primary: '#FFD700',
  secondary: '#FF4D4D',
  tertiary: '#06B6D4',
  success: '#10B981',
  purple: '#7C3AED',
  orange: '#F59E0B'
};

const PIE_COLORS = ['#10B981', '#F59E0B', '#94A3B8'];

export default function Admin() {
  const { token, isAdmin } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [detailedStats, setDetailedStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [users, setUsers] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [bots, setBots] = useState([]);
  const [payments, setPayments] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit states
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingUser, setEditingUser] = useState(null);

  // Form states
  const [newProduct, setNewProduct] = useState({
    name: '', description: '', image_url: '', retail_price: '', category: ''
  });
  const [newAuction, setNewAuction] = useState({
    product_id: '', starting_price: '0.01', bid_increment: '0.01', 
    duration_value: '10', duration_unit: 'minutes', // minutes, hours, days
    start_time: '', end_time: '', scheduling_mode: 'immediate',
    bot_target_price: '' // Minimum price for bots to bid up to
  });
  const [newVoucher, setNewVoucher] = useState({
    code: '', bids: '10', max_uses: '1', expires_at: ''
  });
  const [newBot, setNewBot] = useState({ name: '' });
  const [botBid, setBotBid] = useState({
    auction_id: '', target_price: '', num_bids: '5'
  });

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      if (activeTab === 'dashboard') {
        const [statsRes, detailedRes, productsRes, auctionsRes] = await Promise.all([
          axios.get(`${API}/admin/stats`, { headers }),
          axios.get(`${API}/admin/stats/detailed`, { headers }),
          axios.get(`${API}/products`),
          axios.get(`${API}/auctions`)
        ]);
        setStats(statsRes.data);
        setDetailedStats(detailedRes.data);
        setProducts(productsRes.data);
        setAuctions(auctionsRes.data);
      } else if (activeTab === 'products') {
        const res = await axios.get(`${API}/products`);
        setProducts(res.data);
      } else if (activeTab === 'auctions') {
        const [auctionsRes, productsRes] = await Promise.all([
          axios.get(`${API}/auctions`),
          axios.get(`${API}/products`)
        ]);
        setAuctions(auctionsRes.data);
        setProducts(productsRes.data);
      } else if (activeTab === 'users') {
        const res = await axios.get(`${API}/admin/users`, { headers });
        setUsers(res.data);
      } else if (activeTab === 'vouchers') {
        const res = await axios.get(`${API}/admin/vouchers`, { headers });
        setVouchers(res.data);
      } else if (activeTab === 'bots') {
        const [botsRes, auctionsRes] = await Promise.all([
          axios.get(`${API}/admin/bots`, { headers }),
          axios.get(`${API}/auctions?status=active`)
        ]);
        setBots(botsRes.data);
        setAuctions(auctionsRes.data);
      } else if (activeTab === 'payments') {
        const res = await axios.get(`${API}/admin/payments`, { headers });
        setPayments(res.data);
      } else if (activeTab === 'logs') {
        const res = await axios.get(`${API}/admin/logs`, { headers });
        setLogs(res.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Product handlers
  const handleCreateProduct = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/admin/products`, {
        ...newProduct,
        retail_price: parseFloat(newProduct.retail_price)
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Produkt erstellt');
      setNewProduct({ name: '', description: '', image_url: '', retail_price: '', category: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
    }
  };

  const handleUpdateProduct = async (productId) => {
    try {
      await axios.put(`${API}/admin/products/${productId}`, editingProduct, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Produkt aktualisiert');
      setEditingProduct(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!confirm('Produkt wirklich löschen?')) return;
    try {
      await axios.delete(`${API}/admin/products/${productId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Produkt gelöscht');
      fetchData();
    } catch (error) {
      toast.error('Fehler beim Löschen');
    }
  };

  // Auction handlers
  const handleCreateAuction = async (e) => {
    e.preventDefault();
    try {
      // Calculate duration in seconds based on unit
      let durationSeconds = parseInt(newAuction.duration_value);
      if (newAuction.duration_unit === 'minutes') {
        durationSeconds = durationSeconds * 60;
      } else if (newAuction.duration_unit === 'hours') {
        durationSeconds = durationSeconds * 60 * 60;
      } else if (newAuction.duration_unit === 'days') {
        durationSeconds = durationSeconds * 60 * 60 * 24;
      }

      const auctionData = {
        product_id: newAuction.product_id,
        starting_price: parseFloat(newAuction.starting_price),
        bid_increment: parseFloat(newAuction.bid_increment),
        bot_target_price: newAuction.bot_target_price ? parseFloat(newAuction.bot_target_price) : null
      };

      // Handle scheduling modes
      if (newAuction.scheduling_mode === 'immediate') {
        auctionData.duration_seconds = durationSeconds;
      } else if (newAuction.scheduling_mode === 'scheduled') {
        if (newAuction.start_time) {
          auctionData.start_time = new Date(newAuction.start_time).toISOString();
          auctionData.duration_seconds = durationSeconds;
        }
      } else if (newAuction.scheduling_mode === 'custom') {
        if (newAuction.start_time) {
          auctionData.start_time = new Date(newAuction.start_time).toISOString();
        }
        if (newAuction.end_time) {
          auctionData.end_time = new Date(newAuction.end_time).toISOString();
        }
      }

      const response = await axios.post(`${API}/admin/auctions`, auctionData, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Auktion erstellt');
      
      // If bot target price is set, automatically start bot bidding
      if (newAuction.bot_target_price && parseFloat(newAuction.bot_target_price) > 0) {
        try {
          await axios.post(
            `${API}/admin/bots/bid-to-price?auction_id=${response.data.id}&target_price=${newAuction.bot_target_price}`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
          toast.success(`Bots bieten bis €${newAuction.bot_target_price}`);
        } catch (botError) {
          toast.error('Bot-Bieten fehlgeschlagen - Bots erstellen?');
        }
      }
      
      setNewAuction({ 
        product_id: '', starting_price: '0.01', bid_increment: '0.01', 
        duration_value: '10', duration_unit: 'minutes',
        start_time: '', end_time: '', scheduling_mode: 'immediate',
        bot_target_price: ''
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
    }
  };

  const handleExtendAuction = async (auctionId) => {
    const seconds = prompt('Zeit verlängern um (Sekunden):', '300');
    if (!seconds) return;
    try {
      await axios.put(`${API}/admin/auctions/${auctionId}`, {
        duration_seconds: parseInt(seconds)
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Auktion verlängert');
      fetchData();
    } catch (error) {
      toast.error('Fehler');
    }
  };

  const handleEndAuction = async (auctionId) => {
    try {
      await axios.post(`${API}/admin/auctions/${auctionId}/end`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Auktion beendet');
      fetchData();
    } catch (error) {
      toast.error('Fehler');
    }
  };

  const handleRestartAuction = async (auctionId) => {
    const duration = prompt('Dauer in Minuten:', '10');
    if (!duration) return;
    
    const botPrice = prompt('Bot-Mindestpreis (€) - leer für keine Bots:', '');
    
    try {
      const params = new URLSearchParams();
      params.append('duration_seconds', parseInt(duration) * 60);
      if (botPrice && parseFloat(botPrice) > 0) {
        params.append('bot_target_price', parseFloat(botPrice));
      }
      
      const response = await axios.post(
        `${API}/admin/auctions/${auctionId}/restart?${params.toString()}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.bot_bidding) {
        toast.success(`Auktion neu gestartet! Bots haben ${response.data.bot_bidding.bids_placed} Gebote platziert.`);
      } else {
        toast.success('Auktion neu gestartet!');
      }
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Neustarten');
    }
  };

  const handleDeleteAuction = async (auctionId) => {
    if (!confirm('Auktion wirklich löschen?')) return;
    try {
      await axios.delete(`${API}/admin/auctions/${auctionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Auktion gelöscht');
      fetchData();
    } catch (error) {
      toast.error('Fehler');
    }
  };

  // User handlers
  const handleToggleAdmin = async (userId) => {
    try {
      await axios.put(`${API}/admin/users/${userId}/toggle-admin`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Admin-Status geändert');
      fetchData();
    } catch (error) {
      toast.error('Fehler');
    }
  };

  const handleToggleBlock = async (userId, currentStatus) => {
    try {
      await axios.put(`${API}/admin/users/${userId}/toggle-block`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(currentStatus ? 'Benutzer entsperrt' : 'Benutzer gesperrt');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
    }
  };

  const handleAddBids = async (userId) => {
    const amount = prompt('Anzahl der Gebote hinzufügen:', '10');
    if (!amount) return;
    try {
      await axios.put(`${API}/admin/users/${userId}/add-bids?bids=${amount}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`${amount} Gebote hinzugefügt`);
      fetchData();
    } catch (error) {
      toast.error('Fehler');
    }
  };

  const handleUpdateUser = async (userId) => {
    try {
      await axios.put(`${API}/admin/users/${userId}`, editingUser, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Benutzer aktualisiert');
      setEditingUser(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
    }
  };

  // Voucher handlers
  const handleCreateVoucher = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/admin/vouchers`, {
        code: newVoucher.code,
        bids: parseInt(newVoucher.bids),
        max_uses: parseInt(newVoucher.max_uses),
        expires_at: newVoucher.expires_at || null
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Gutschein erstellt');
      setNewVoucher({ code: '', bids: '10', max_uses: '1', expires_at: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
    }
  };

  const handleToggleVoucher = async (voucherId) => {
    try {
      await axios.put(`${API}/admin/vouchers/${voucherId}/toggle`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Gutschein-Status geändert');
      fetchData();
    } catch (error) {
      toast.error('Fehler');
    }
  };

  const handleDeleteVoucher = async (voucherId) => {
    if (!confirm('Gutschein wirklich löschen?')) return;
    try {
      await axios.delete(`${API}/admin/vouchers/${voucherId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Gutschein gelöscht');
      fetchData();
    } catch (error) {
      toast.error('Fehler');
    }
  };

  // Bot handlers
  const handleCreateBot = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/admin/bots`, newBot, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Bot erstellt');
      setNewBot({ name: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
    }
  };

  const handleSeedBots = async () => {
    try {
      const res = await axios.post(`${API}/admin/bots/seed`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(res.data.message);
      fetchData();
    } catch (error) {
      toast.error('Fehler');
    }
  };

  const handleDeleteBot = async (botId) => {
    if (!confirm('Bot wirklich löschen?')) return;
    try {
      await axios.delete(`${API}/admin/bots/${botId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Bot gelöscht');
      fetchData();
    } catch (error) {
      toast.error('Fehler');
    }
  };

  const handleBotBidToPrice = async () => {
    if (!botBid.auction_id || !botBid.target_price) {
      toast.error('Bitte Auktion und Zielpreis wählen');
      return;
    }
    try {
      const res = await axios.post(
        `${API}/admin/bots/bid-to-price?auction_id=${botBid.auction_id}&target_price=${botBid.target_price}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${res.data.bids_placed} Bot-Gebote platziert! Neuer Preis: €${res.data.final_price.toFixed(2)}`);
      setBotBid({ ...botBid, target_price: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
    }
  };

  const handleBotQuickBids = async (auctionId, numBids) => {
    try {
      const res = await axios.post(
        `${API}/admin/bots/execute-bids?auction_id=${auctionId}&num_bids=${numBids}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${res.data.bids_placed} Bot-Gebote! Neuer Preis: €${res.data.new_price.toFixed(2)}`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
    }
  };

  const handleSeedData = async () => {
    try {
      await axios.post(`${API}/admin/seed`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Testdaten erstellt');
      fetchData();
    } catch (error) {
      toast.error('Fehler');
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">{t('admin.noAccess')}</h2>
          <p className="text-[#94A3B8] mb-4">{t('admin.needAdmin')}</p>
          <Link to="/"><Button className="btn-primary">{t('admin.toHome')}</Button></Link>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'dashboard', label: t('admin.dashboard'), icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'products', label: t('admin.products'), icon: <Package className="w-5 h-5" /> },
    { id: 'auctions', label: t('admin.auctions'), icon: <Gavel className="w-5 h-5" /> },
    { id: 'users', label: t('admin.users'), icon: <Users className="w-5 h-5" /> },
    { id: 'vouchers', label: 'Gutscheine', icon: <Ticket className="w-5 h-5" /> },
    { id: 'bots', label: 'Bots', icon: <Bot className="w-5 h-5" /> },
    { id: 'payments', label: 'Zahlungen', icon: <DollarSign className="w-5 h-5" /> },
    { id: 'logs', label: 'Systemlogs', icon: <BarChart3 className="w-5 h-5" /> }
  ];

  return (
    <div className="min-h-screen pt-20" data-testid="admin-page">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 min-h-screen bg-[#0F0F16] border-r border-white/10 fixed left-0 top-16 pt-6">
          <div className="px-4 mb-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-[#7C3AED]" />
              {t('admin.panel')}
            </h2>
          </div>
          <nav className="space-y-1 px-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[#7C3AED]/20 text-[#7C3AED]'
                    : 'text-[#94A3B8] hover:bg-white/5 hover:text-white'
                }`}
                data-testid={`tab-${tab.id}`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="px-4 mt-8">
            <Button onClick={handleSeedData} variant="outline" className="w-full border-white/10 text-white hover:bg-white/10">
              <Plus className="w-4 h-4 mr-2" />{t('admin.seedData')}
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 ml-64 p-8">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">{t('admin.dashboard')}</h1>
                <Button onClick={fetchData} variant="outline" className="border-white/10 text-white">
                  <RefreshCw className="w-4 h-4 mr-2" />{t('admin.refresh')}
                </Button>
              </div>
              
              {/* Summary Stats Cards */}
              {stats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="glass-card rounded-xl p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-[#7C3AED]/20 flex items-center justify-center">
                        <Users className="w-6 h-6 text-[#7C3AED]" />
                      </div>
                      <div>
                        <p className="text-[#94A3B8] text-sm">{t('admin.totalUsers')}</p>
                        <p className="text-2xl font-bold text-white">{stats.total_users}</p>
                      </div>
                    </div>
                  </div>
                  <div className="glass-card rounded-xl p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-[#06B6D4]/20 flex items-center justify-center">
                        <Gavel className="w-6 h-6 text-[#06B6D4]" />
                      </div>
                      <div>
                        <p className="text-[#94A3B8] text-sm">{t('admin.activeAuctions')}</p>
                        <p className="text-2xl font-bold text-white">{stats.active_auctions}</p>
                      </div>
                    </div>
                  </div>
                  <div className="glass-card rounded-xl p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-[#10B981]/20 flex items-center justify-center">
                        <Package className="w-6 h-6 text-[#10B981]" />
                      </div>
                      <div>
                        <p className="text-[#94A3B8] text-sm">{t('admin.totalProducts')}</p>
                        <p className="text-2xl font-bold text-white">{stats.total_products}</p>
                      </div>
                    </div>
                  </div>
                  <div className="glass-card rounded-xl p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-[#F59E0B]/20 flex items-center justify-center">
                        <BarChart3 className="w-6 h-6 text-[#F59E0B]" />
                      </div>
                      <div>
                        <p className="text-[#94A3B8] text-sm">{t('admin.transactions')}</p>
                        <p className="text-2xl font-bold text-white">{stats.completed_transactions}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Charts Section */}
              {detailedStats && (
                <>
                  {/* Revenue & Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="glass-card rounded-xl p-6 border-l-4 border-[#10B981]">
                      <p className="text-[#94A3B8] text-sm mb-1">Gesamtumsatz</p>
                      <p className="text-3xl font-bold text-[#10B981]">€{detailedStats.summary?.total_revenue?.toFixed(2) || '0.00'}</p>
                    </div>
                    <div className="glass-card rounded-xl p-6 border-l-4 border-[#FFD700]">
                      <p className="text-[#94A3B8] text-sm mb-1">Verkaufte Gebote</p>
                      <p className="text-3xl font-bold text-[#FFD700]">{detailedStats.summary?.total_bids_sold || 0}</p>
                    </div>
                    <div className="glass-card rounded-xl p-6 border-l-4 border-[#06B6D4]">
                      <p className="text-[#94A3B8] text-sm mb-1">Platzierte Gebote</p>
                      <p className="text-3xl font-bold text-[#06B6D4]">{detailedStats.summary?.total_bids_placed || 0}</p>
                    </div>
                    <div className="glass-card rounded-xl p-6 border-l-4 border-[#7C3AED]">
                      <p className="text-[#94A3B8] text-sm mb-1">Ø Gebote/Auktion</p>
                      <p className="text-3xl font-bold text-[#7C3AED]">{detailedStats.summary?.avg_bids_per_auction || 0}</p>
                    </div>
                  </div>

                  {/* Charts Row 1 */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Revenue Chart */}
                    <div className="glass-card rounded-xl p-6">
                      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-[#10B981]" />
                        Umsatz (7 Tage)
                      </h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={detailedStats.charts?.revenue_by_day || []}>
                            <defs>
                              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={CHART_COLORS.success} stopOpacity={0.3}/>
                                <stop offset="95%" stopColor={CHART_COLORS.success} stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="date" stroke="#94A3B8" fontSize={12} />
                            <YAxis stroke="#94A3B8" fontSize={12} tickFormatter={(v) => `€${v}`} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#181824', border: '1px solid #374151', borderRadius: '8px' }}
                              labelStyle={{ color: '#fff' }}
                              formatter={(value) => [`€${value.toFixed(2)}`, 'Umsatz']}
                            />
                            <Area type="monotone" dataKey="revenue" stroke={CHART_COLORS.success} fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Bids Chart */}
                    <div className="glass-card rounded-xl p-6">
                      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-[#FFD700]" />
                        Gebote (7 Tage)
                      </h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={detailedStats.charts?.bids_by_day || []}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="date" stroke="#94A3B8" fontSize={12} />
                            <YAxis stroke="#94A3B8" fontSize={12} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#181824', border: '1px solid #374151', borderRadius: '8px' }}
                              labelStyle={{ color: '#fff' }}
                              formatter={(value) => [value, 'Gebote']}
                            />
                            <Bar dataKey="bids" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Charts Row 2 */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* New Users Chart */}
                    <div className="glass-card rounded-xl p-6">
                      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5 text-[#7C3AED]" />
                        Neue Nutzer (7 Tage)
                      </h3>
                      <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={detailedStats.charts?.users_by_day || []}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} />
                            <YAxis stroke="#94A3B8" fontSize={11} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#181824', border: '1px solid #374151', borderRadius: '8px' }}
                              labelStyle={{ color: '#fff' }}
                              formatter={(value) => [value, 'Nutzer']}
                            />
                            <Line type="monotone" dataKey="users" stroke={CHART_COLORS.purple} strokeWidth={2} dot={{ fill: CHART_COLORS.purple, strokeWidth: 2 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Auction Status Pie Chart */}
                    <div className="glass-card rounded-xl p-6">
                      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Gavel className="w-5 h-5 text-[#06B6D4]" />
                        Auktionsstatus
                      </h3>
                      <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'Aktiv', value: detailedStats.charts?.status_distribution?.active || 0 },
                                { name: 'Geplant', value: detailedStats.charts?.status_distribution?.scheduled || 0 },
                                { name: 'Beendet', value: detailedStats.charts?.status_distribution?.ended || 0 }
                              ]}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={70}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {[0, 1, 2].map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#181824', border: '1px solid #374151', borderRadius: '8px' }}
                              formatter={(value, name) => [value, name]}
                            />
                            <Legend 
                              formatter={(value) => <span className="text-[#94A3B8]">{value}</span>}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Top Products */}
                    <div className="glass-card rounded-xl p-6">
                      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Package className="w-5 h-5 text-[#F59E0B]" />
                        Top Produkte
                      </h3>
                      <div className="space-y-3">
                        {(detailedStats.charts?.top_products || []).map((product, index) => (
                          <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-[#181824]">
                            <div className="flex items-center gap-2">
                              <span className="text-[#FFD700] font-bold text-sm">#{index + 1}</span>
                              <span className="text-white text-sm truncate max-w-[140px]">{product.name}</span>
                            </div>
                            <span className="text-[#06B6D4] font-mono text-sm">{product.bids} Gebote</span>
                          </div>
                        ))}
                        {(!detailedStats.charts?.top_products || detailedStats.charts.top_products.length === 0) && (
                          <p className="text-[#94A3B8] text-center py-4">Noch keine Daten</p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {loading && !stats && (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 text-[#7C3AED] animate-spin" />
                </div>
              )}
            </div>
          )}

          {/* Products Tab */}
          {activeTab === 'products' && (
            <div className="space-y-8">
              <h1 className="text-2xl font-bold text-white">{t('admin.manageProducts')}</h1>
              <div className="glass-card rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">{t('admin.newProduct')}</h3>
                <form onSubmit={handleCreateProduct} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-white">{t('admin.productName')}</Label>
                    <Input value={newProduct.name} onChange={(e) => setNewProduct({...newProduct, name: e.target.value})} required className="bg-[#181824] border-white/10 text-white" placeholder="z.B. iPhone 15 Pro" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">{t('admin.category')}</Label>
                    <Input value={newProduct.category} onChange={(e) => setNewProduct({...newProduct, category: e.target.value})} required className="bg-[#181824] border-white/10 text-white" placeholder="z.B. Elektronik" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">{t('admin.imageUrl')}</Label>
                    <Input value={newProduct.image_url} onChange={(e) => setNewProduct({...newProduct, image_url: e.target.value})} required className="bg-[#181824] border-white/10 text-white" placeholder="https://..." />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">{t('admin.rrp')}</Label>
                    <Input type="number" step="0.01" value={newProduct.retail_price} onChange={(e) => setNewProduct({...newProduct, retail_price: e.target.value})} required className="bg-[#181824] border-white/10 text-white" placeholder="999.00" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-white">{t('admin.description')}</Label>
                    <Input value={newProduct.description} onChange={(e) => setNewProduct({...newProduct, description: e.target.value})} required className="bg-[#181824] border-white/10 text-white" placeholder="Produktbeschreibung..." />
                  </div>
                  <div className="md:col-span-2">
                    <Button type="submit" className="btn-primary"><Plus className="w-4 h-4 mr-2" />{t('admin.createProduct')}</Button>
                  </div>
                </form>
              </div>
              <div className="glass-card rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#181824]">
                      <tr>
                        <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.image')}</th>
                        <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.productName')}</th>
                        <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.category')}</th>
                        <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.rrp')}</th>
                        <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {products.map((product) => (
                        <tr key={product.id} className="hover:bg-white/5">
                          <td className="px-4 py-3"><img src={product.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" /></td>
                          <td className="px-4 py-3">{editingProduct?.id === product.id ? <Input value={editingProduct.name} onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})} className="bg-[#181824] border-white/10 text-white h-8" /> : <span className="text-white">{product.name}</span>}</td>
                          <td className="px-4 py-3">{editingProduct?.id === product.id ? <Input value={editingProduct.category} onChange={(e) => setEditingProduct({...editingProduct, category: e.target.value})} className="bg-[#181824] border-white/10 text-white h-8" /> : <span className="text-[#94A3B8]">{product.category}</span>}</td>
                          <td className="px-4 py-3">{editingProduct?.id === product.id ? <Input type="number" step="0.01" value={editingProduct.retail_price} onChange={(e) => setEditingProduct({...editingProduct, retail_price: parseFloat(e.target.value)})} className="bg-[#181824] border-white/10 text-white h-8 w-24" /> : <span className="text-[#06B6D4] font-mono">€{product.retail_price?.toFixed(2)}</span>}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {editingProduct?.id === product.id ? (
                                <>
                                  <Button size="sm" variant="ghost" className="text-[#10B981] hover:bg-[#10B981]/10" onClick={() => handleUpdateProduct(product.id)}><Save className="w-4 h-4" /></Button>
                                  <Button size="sm" variant="ghost" className="text-[#94A3B8] hover:bg-white/10" onClick={() => setEditingProduct(null)}><X className="w-4 h-4" /></Button>
                                </>
                              ) : (
                                <>
                                  <Button size="sm" variant="ghost" className="text-[#7C3AED] hover:bg-[#7C3AED]/10" onClick={() => setEditingProduct({...product})}><Edit className="w-4 h-4" /></Button>
                                  <Button size="sm" variant="ghost" className="text-[#EF4444] hover:bg-[#EF4444]/10" onClick={() => handleDeleteProduct(product.id)}><Trash2 className="w-4 h-4" /></Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Auctions Tab */}
          {activeTab === 'auctions' && (
            <div className="space-y-8">
              <h1 className="text-2xl font-bold text-white">{t('admin.manageAuctions')}</h1>
              <div className="glass-card rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">{t('admin.newAuction')}</h3>
                <form onSubmit={handleCreateAuction} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-white">{t('admin.product')}</Label>
                      <Select value={newAuction.product_id} onValueChange={(value) => setNewAuction({...newAuction, product_id: value})}>
                        <SelectTrigger className="bg-[#181824] border-white/10 text-white"><SelectValue placeholder={t('admin.selectProduct')} /></SelectTrigger>
                        <SelectContent className="bg-[#181824] border-white/10">
                          {products.map((product) => (<SelectItem key={product.id} value={product.id} className="text-white hover:bg-white/10">{product.name} (€{product.retail_price})</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white">{t('admin.startPrice')}</Label>
                      <Input type="number" step="0.01" value={newAuction.starting_price} onChange={(e) => setNewAuction({...newAuction, starting_price: e.target.value})} required className="bg-[#181824] border-white/10 text-white" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white">{t('admin.bidIncrement')} (Standard: €0.01)</Label>
                      <Input type="number" step="0.01" value={newAuction.bid_increment} onChange={(e) => setNewAuction({...newAuction, bid_increment: e.target.value})} required className="bg-[#181824] border-white/10 text-white" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white">Zeitplanung</Label>
                      <Select value={newAuction.scheduling_mode} onValueChange={(value) => setNewAuction({...newAuction, scheduling_mode: value})}>
                        <SelectTrigger className="bg-[#181824] border-white/10 text-white"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-[#181824] border-white/10">
                          <SelectItem value="immediate" className="text-white hover:bg-white/10">Sofort starten</SelectItem>
                          <SelectItem value="scheduled" className="text-white hover:bg-white/10">Geplanter Start</SelectItem>
                          <SelectItem value="custom" className="text-white hover:bg-white/10">Benutzerdefiniert (Start & Ende)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Duration Settings */}
                  <div className="p-4 rounded-lg bg-[#181824] space-y-4">
                    <div className="flex items-center gap-2 text-[#06B6D4]">
                      <Calendar className="w-5 h-5" />
                      <span className="font-medium">Zeiteinstellungen</span>
                    </div>

                    {(newAuction.scheduling_mode === 'immediate' || newAuction.scheduling_mode === 'scheduled') && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {newAuction.scheduling_mode === 'scheduled' && (
                          <div className="space-y-2">
                            <Label className="text-white flex items-center gap-2">
                              <Clock className="w-4 h-4" /> Startzeit
                            </Label>
                            <Input 
                              type="datetime-local" 
                              value={newAuction.start_time} 
                              onChange={(e) => setNewAuction({...newAuction, start_time: e.target.value})} 
                              required
                              className="bg-[#0F0F16] border-white/10 text-white" 
                            />
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label className="text-white">{t('admin.duration')}</Label>
                          <div className="flex gap-2">
                            <Input 
                              type="number" 
                              min="1" 
                              value={newAuction.duration_value} 
                              onChange={(e) => setNewAuction({...newAuction, duration_value: e.target.value})} 
                              required 
                              className="bg-[#0F0F16] border-white/10 text-white w-24" 
                            />
                            <Select value={newAuction.duration_unit} onValueChange={(value) => setNewAuction({...newAuction, duration_unit: value})}>
                              <SelectTrigger className="bg-[#0F0F16] border-white/10 text-white flex-1"><SelectValue /></SelectTrigger>
                              <SelectContent className="bg-[#181824] border-white/10">
                                <SelectItem value="minutes" className="text-white hover:bg-white/10">Minuten</SelectItem>
                                <SelectItem value="hours" className="text-white hover:bg-white/10">Stunden</SelectItem>
                                <SelectItem value="days" className="text-white hover:bg-white/10">Tage</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <p className="text-[#94A3B8] text-sm">
                            {newAuction.scheduling_mode === 'immediate' ? 'Die Auktion startet sofort.' : 'Die Auktion startet zur angegebenen Zeit.'}
                          </p>
                        </div>
                      </div>
                    )}

                    {newAuction.scheduling_mode === 'custom' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-white flex items-center gap-2">
                            <Clock className="w-4 h-4" /> Startzeit
                          </Label>
                          <Input 
                            type="datetime-local" 
                            value={newAuction.start_time} 
                            onChange={(e) => setNewAuction({...newAuction, start_time: e.target.value})} 
                            className="bg-[#0F0F16] border-white/10 text-white" 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-white flex items-center gap-2">
                            <Clock className="w-4 h-4" /> Endzeit
                          </Label>
                          <Input 
                            type="datetime-local" 
                            value={newAuction.end_time} 
                            onChange={(e) => setNewAuction({...newAuction, end_time: e.target.value})} 
                            required
                            className="bg-[#0F0F16] border-white/10 text-white" 
                          />
                        </div>
                        <p className="text-[#94A3B8] text-sm md:col-span-2">Legen Sie Start- und Endzeit manuell fest. Ohne Startzeit beginnt die Auktion sofort.</p>
                      </div>
                    )}
                  </div>

                  {/* Bot Settings */}
                  <div className="p-4 rounded-lg bg-[#181824] space-y-4">
                    <div className="flex items-center gap-2 text-[#FFD700]">
                      <Bot className="w-5 h-5" />
                      <span className="font-medium">Bot-Einstellungen</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-white">Bot-Mindestpreis (€)</Label>
                        <Input 
                          type="number" 
                          step="0.10" 
                          min="0"
                          placeholder="z.B. 2.50"
                          value={newAuction.bot_target_price} 
                          onChange={(e) => setNewAuction({...newAuction, bot_target_price: e.target.value})} 
                          className="bg-[#0F0F16] border-white/10 text-white" 
                        />
                        <p className="text-[#94A3B8] text-sm">Bots bieten automatisch bis zu diesem Preis. Leer lassen = keine Bots.</p>
                      </div>
                      <div className="flex items-center gap-3 p-4 rounded-lg bg-[#0F0F16]">
                        <Zap className="w-8 h-8 text-[#FFD700]" />
                        <div>
                          <p className="text-white font-medium">Gebots-Inkrement: €{newAuction.bid_increment}</p>
                          <p className="text-[#94A3B8] text-sm">Kunden zahlen €0.50 pro Gebot</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Button type="submit" className="btn-primary"><Plus className="w-4 h-4 mr-2" />{t('admin.createAuction')}</Button>
                  </div>
                </form>
              </div>
              <div className="glass-card rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#181824]">
                      <tr>
                        <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.product')}</th>
                        <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.price')}</th>
                        <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.bids')}</th>
                        <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">Zeit</th>
                        <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.status')}</th>
                        <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {auctions.map((auction) => (
                        <tr key={auction.id} className="hover:bg-white/5">
                          <td className="px-4 py-3 text-white">{auction.product?.name || 'N/A'}</td>
                          <td className="px-4 py-3 text-[#06B6D4] font-mono">€{auction.current_price?.toFixed(2)}</td>
                          <td className="px-4 py-3 text-white">{auction.total_bids}</td>
                          <td className="px-4 py-3 text-[#94A3B8] text-sm">
                            {auction.start_time && (
                              <div className="flex items-center gap-1">
                                <span className="text-[#7C3AED]">Start:</span>
                                <span>{new Date(auction.start_time).toLocaleString('de-DE', {dateStyle: 'short', timeStyle: 'short'})}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <span className="text-[#EF4444]">Ende:</span>
                              <span>{new Date(auction.end_time).toLocaleString('de-DE', {dateStyle: 'short', timeStyle: 'short'})}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                              auction.status === 'active' ? 'bg-[#10B981]/20 text-[#10B981]' : 
                              auction.status === 'scheduled' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' : 
                              'bg-[#EF4444]/20 text-[#EF4444]'
                            }`}>
                              {auction.status === 'active' ? t('admin.active') : 
                               auction.status === 'scheduled' ? 'Geplant' : 
                               t('admin.ended')}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {(auction.status === 'active' || auction.status === 'scheduled') && (
                                <>
                                  <Button size="sm" variant="ghost" className="text-[#06B6D4] hover:bg-[#06B6D4]/10" onClick={() => handleExtendAuction(auction.id)} title="Zeit verlängern"><RefreshCw className="w-4 h-4" /></Button>
                                  <Button size="sm" variant="ghost" className="text-[#F59E0B] hover:bg-[#F59E0B]/10" onClick={() => handleEndAuction(auction.id)} title="Beenden"><Square className="w-4 h-4" /></Button>
                                </>
                              )}
                              {auction.status === 'ended' && (
                                <Button size="sm" variant="ghost" className="text-[#10B981] hover:bg-[#10B981]/10" onClick={() => handleRestartAuction(auction.id)} title="Neu starten"><Play className="w-4 h-4" /></Button>
                              )}
                              <Button size="sm" variant="ghost" className="text-[#EF4444] hover:bg-[#EF4444]/10" onClick={() => handleDeleteAuction(auction.id)}><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="space-y-8">
              <h1 className="text-2xl font-bold text-white">{t('admin.manageUsers')}</h1>
              <div className="glass-card rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#181824]">
                      <tr>
                        <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('dashboard.name')}</th>
                        <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('dashboard.email')}</th>
                        <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.bids')}</th>
                        <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.deposits')}</th>
                        <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.status')}</th>
                        <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.isAdmin')}</th>
                        <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {users.map((user) => (
                        <tr key={user.id} className={`hover:bg-white/5 ${user.is_blocked ? 'opacity-50' : ''}`}>
                          <td className="px-4 py-3">{editingUser?.id === user.id ? <Input value={editingUser.name} onChange={(e) => setEditingUser({...editingUser, name: e.target.value})} className="bg-[#181824] border-white/10 text-white h-8 w-32" /> : <span className="text-white">{user.name}</span>}</td>
                          <td className="px-4 py-3">{editingUser?.id === user.id ? <Input value={editingUser.email} onChange={(e) => setEditingUser({...editingUser, email: e.target.value})} className="bg-[#181824] border-white/10 text-white h-8" /> : <span className="text-[#94A3B8]">{user.email}</span>}</td>
                          <td className="px-4 py-3">{editingUser?.id === user.id ? <Input type="number" value={editingUser.bids_balance} onChange={(e) => setEditingUser({...editingUser, bids_balance: parseInt(e.target.value)})} className="bg-[#181824] border-white/10 text-white h-8 w-20" /> : <span className="flex items-center gap-1 text-[#06B6D4]"><Zap className="w-4 h-4" />{user.bids_balance}</span>}</td>
                          <td className="px-4 py-3"><span className="flex items-center gap-1 text-[#10B981]"><DollarSign className="w-4 h-4" />€{(user.total_deposits || 0).toFixed(2)}</span></td>
                          <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${user.is_blocked ? 'bg-[#EF4444]/20 text-[#EF4444]' : 'bg-[#10B981]/20 text-[#10B981]'}`}>{user.is_blocked ? t('admin.blocked') : t('admin.active')}</span></td>
                          <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${user.is_admin ? 'bg-[#F59E0B]/20 text-[#F59E0B]' : 'bg-white/10 text-[#94A3B8]'}`}>{user.is_admin ? t('admin.yes') : t('admin.no')}</span></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {editingUser?.id === user.id ? (
                                <>
                                  <Button size="sm" variant="ghost" className="text-[#10B981] hover:bg-[#10B981]/10" onClick={() => handleUpdateUser(user.id)}><Save className="w-4 h-4" /></Button>
                                  <Button size="sm" variant="ghost" className="text-[#94A3B8] hover:bg-white/10" onClick={() => setEditingUser(null)}><X className="w-4 h-4" /></Button>
                                </>
                              ) : (
                                <>
                                  <Button size="sm" variant="ghost" className="text-[#7C3AED] hover:bg-[#7C3AED]/10" onClick={() => setEditingUser({...user})} title="Bearbeiten"><Edit className="w-4 h-4" /></Button>
                                  <Button size="sm" variant="ghost" className={user.is_blocked ? "text-[#10B981] hover:bg-[#10B981]/10" : "text-[#EF4444] hover:bg-[#EF4444]/10"} onClick={() => handleToggleBlock(user.id, user.is_blocked)}>{user.is_blocked ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}</Button>
                                  <Button size="sm" variant="ghost" className="text-[#F59E0B] hover:bg-[#F59E0B]/10" onClick={() => handleToggleAdmin(user.id)}><UserPlus className="w-4 h-4" /></Button>
                                  <Button size="sm" variant="ghost" className="text-[#06B6D4] hover:bg-[#06B6D4]/10" onClick={() => handleAddBids(user.id)}><Plus className="w-4 h-4" /></Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Vouchers Tab */}
          {activeTab === 'vouchers' && (
            <div className="space-y-8">
              <h1 className="text-2xl font-bold text-white">Gutscheine verwalten</h1>
              <div className="glass-card rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Neuer Gutschein</h3>
                <form onSubmit={handleCreateVoucher} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-white">Code</Label>
                    <Input value={newVoucher.code} onChange={(e) => setNewVoucher({...newVoucher, code: e.target.value.toUpperCase()})} required className="bg-[#181824] border-white/10 text-white uppercase" placeholder="WELCOME10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">Gebote</Label>
                    <Input type="number" value={newVoucher.bids} onChange={(e) => setNewVoucher({...newVoucher, bids: e.target.value})} required className="bg-[#181824] border-white/10 text-white" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">Max. Verwendungen</Label>
                    <Input type="number" value={newVoucher.max_uses} onChange={(e) => setNewVoucher({...newVoucher, max_uses: e.target.value})} required className="bg-[#181824] border-white/10 text-white" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">Gültig bis</Label>
                    <Input type="datetime-local" value={newVoucher.expires_at} onChange={(e) => setNewVoucher({...newVoucher, expires_at: e.target.value})} className="bg-[#181824] border-white/10 text-white" />
                  </div>
                  <div className="md:col-span-4">
                    <Button type="submit" className="btn-primary"><Plus className="w-4 h-4 mr-2" />Gutschein erstellen</Button>
                  </div>
                </form>
              </div>
              <div className="glass-card rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#181824]">
                      <tr>
                        <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">Code</th>
                        <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">Gebote</th>
                        <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">Verwendet</th>
                        <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">Gültig bis</th>
                        <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">Status</th>
                        <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {vouchers.map((voucher) => (
                        <tr key={voucher.id} className={`hover:bg-white/5 ${!voucher.is_active ? 'opacity-50' : ''}`}>
                          <td className="px-4 py-3"><span className="font-mono font-bold text-[#7C3AED] bg-[#7C3AED]/10 px-2 py-1 rounded">{voucher.code}</span></td>
                          <td className="px-4 py-3"><span className="flex items-center gap-1 text-[#06B6D4]"><Zap className="w-4 h-4" />{voucher.bids}</span></td>
                          <td className="px-4 py-3 text-white">{voucher.times_used} / {voucher.max_uses}</td>
                          <td className="px-4 py-3 text-[#94A3B8]">{voucher.expires_at ? new Date(voucher.expires_at).toLocaleDateString('de-DE') : 'Unbegrenzt'}</td>
                          <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${voucher.is_active ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#EF4444]/20 text-[#EF4444]'}`}>{voucher.is_active ? 'Aktiv' : 'Inaktiv'}</span></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="ghost" className={voucher.is_active ? "text-[#F59E0B] hover:bg-[#F59E0B]/10" : "text-[#10B981] hover:bg-[#10B981]/10"} onClick={() => handleToggleVoucher(voucher.id)}>{voucher.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}</Button>
                              <Button size="sm" variant="ghost" className="text-[#EF4444] hover:bg-[#EF4444]/10" onClick={() => handleDeleteVoucher(voucher.id)}><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {vouchers.length === 0 && (<tr><td colSpan={6} className="px-4 py-8 text-center text-[#94A3B8]">Noch keine Gutscheine erstellt</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Bots Tab */}
          {activeTab === 'bots' && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Bot className="w-8 h-8 text-[#7C3AED]" />
                  Bot-System (Preis erhöhen)
                </h1>
                <Button onClick={handleSeedBots} variant="outline" className="border-[#7C3AED]/50 text-[#7C3AED] hover:bg-[#7C3AED]/10">
                  <Plus className="w-4 h-4 mr-2" />20 Standard-Bots erstellen
                </Button>
              </div>

              {/* Quick Bot Actions */}
              <div className="glass-card rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-[#06B6D4]" />
                  Preis automatisch erhöhen
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-white">Auktion wählen</Label>
                    <Select value={botBid.auction_id} onValueChange={(value) => setBotBid({...botBid, auction_id: value})}>
                      <SelectTrigger className="bg-[#181824] border-white/10 text-white">
                        <SelectValue placeholder="Auktion wählen..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#181824] border-white/10">
                        {auctions.filter(a => a.status === 'active').map((auction) => (
                          <SelectItem key={auction.id} value={auction.id} className="text-white hover:bg-white/10">
                            {auction.product?.name} (€{auction.current_price?.toFixed(2)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">Zielpreis (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={botBid.target_price}
                      onChange={(e) => setBotBid({...botBid, target_price: e.target.value})}
                      placeholder="z.B. 5.00"
                      className="bg-[#181824] border-white/10 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">&nbsp;</Label>
                    <Button onClick={handleBotBidToPrice} className="w-full bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] hover:opacity-90">
                      <Play className="w-4 h-4 mr-2" />
                      Preis erhöhen
                    </Button>
                  </div>
                </div>
              </div>

              {/* Active Auctions with Quick Bot Actions */}
              <div className="glass-card rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Aktive Auktionen - Schnellaktionen</h3>
                <div className="space-y-4">
                  {auctions.filter(a => a.status === 'active').map((auction) => (
                    <div key={auction.id} className="flex items-center justify-between p-4 rounded-lg bg-[#181824]">
                      <div className="flex items-center gap-4">
                        <img src={auction.product?.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                        <div>
                          <p className="text-white font-medium">{auction.product?.name}</p>
                          <p className="text-[#06B6D4] font-mono">€{auction.current_price?.toFixed(2)} • {auction.total_bids} Gebote</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => handleBotQuickBids(auction.id, 1)} className="bg-[#181824] border border-white/10 hover:bg-white/10 text-white">+1</Button>
                        <Button size="sm" onClick={() => handleBotQuickBids(auction.id, 5)} className="bg-[#181824] border border-white/10 hover:bg-white/10 text-white">+5</Button>
                        <Button size="sm" onClick={() => handleBotQuickBids(auction.id, 10)} className="bg-[#181824] border border-white/10 hover:bg-white/10 text-white">+10</Button>
                        <Button size="sm" onClick={() => handleBotQuickBids(auction.id, 50)} className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white">+50</Button>
                      </div>
                    </div>
                  ))}
                  {auctions.filter(a => a.status === 'active').length === 0 && (
                    <p className="text-center text-[#94A3B8] py-8">Keine aktiven Auktionen</p>
                  )}
                </div>
              </div>

              {/* Bot List */}
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">Verfügbare Bots ({bots.length})</h3>
                  <form onSubmit={handleCreateBot} className="flex gap-2">
                    <Input
                      value={newBot.name}
                      onChange={(e) => setNewBot({name: e.target.value})}
                      placeholder="Bot-Name (z.B. Maria K.)"
                      className="bg-[#181824] border-white/10 text-white w-48"
                    />
                    <Button type="submit" size="sm" className="bg-[#7C3AED] hover:bg-[#6D28D9]">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </form>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {bots.map((bot) => (
                    <div key={bot.id} className="flex items-center justify-between p-3 rounded-lg bg-[#181824] group">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#06B6D4] flex items-center justify-center text-white text-xs font-bold">
                          {bot.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{bot.name}</p>
                          <p className="text-[#94A3B8] text-xs">{bot.total_bids_placed} Gebote</p>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 text-[#EF4444] hover:bg-[#EF4444]/10" onClick={() => handleDeleteBot(bot.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                {bots.length === 0 && (
                  <p className="text-center text-[#94A3B8] py-8">Keine Bots erstellt. Klicken Sie oben auf "20 Standard-Bots erstellen"</p>
                )}
              </div>
            </div>
          )}

          {/* Payments Tab */}
          {activeTab === 'payments' && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-white">Zahlungsübersicht</h1>
                  <p className="text-[#94A3B8]">Alle Transaktionen im Überblick</p>
                </div>
                <Button onClick={fetchData} variant="outline" className="border-white/10 text-white">
                  <RefreshCw className="w-4 h-4 mr-2" />Aktualisieren
                </Button>
              </div>

              {/* Payment Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="glass-card rounded-xl p-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#10B981]/20 flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-[#10B981]" />
                    </div>
                    <div>
                      <p className="text-[#94A3B8] text-sm">Umsatz gesamt</p>
                      <p className="text-2xl font-bold text-white">€{payments.reduce((sum, p) => sum + (p.amount || 0), 0).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
                <div className="glass-card rounded-xl p-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#7C3AED]/20 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-[#7C3AED]" />
                    </div>
                    <div>
                      <p className="text-[#94A3B8] text-sm">Transaktionen</p>
                      <p className="text-2xl font-bold text-white">{payments.length}</p>
                    </div>
                  </div>
                </div>
                <div className="glass-card rounded-xl p-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#FFD700]/20 flex items-center justify-center">
                      <Zap className="w-6 h-6 text-[#FFD700]" />
                    </div>
                    <div>
                      <p className="text-[#94A3B8] text-sm">Gebote verkauft</p>
                      <p className="text-2xl font-bold text-white">{payments.reduce((sum, p) => sum + (p.bids || 0), 0)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payments Table */}
              <div className="glass-card rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#181824]">
                      <tr>
                        <th className="px-6 py-4 text-left text-[#94A3B8] font-medium">Datum</th>
                        <th className="px-6 py-4 text-left text-[#94A3B8] font-medium">Kunde</th>
                        <th className="px-6 py-4 text-left text-[#94A3B8] font-medium">Paket</th>
                        <th className="px-6 py-4 text-left text-[#94A3B8] font-medium">Gebote</th>
                        <th className="px-6 py-4 text-left text-[#94A3B8] font-medium">Betrag</th>
                        <th className="px-6 py-4 text-left text-[#94A3B8] font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {payments.map((payment, index) => (
                        <tr key={index} className="hover:bg-white/5">
                          <td className="px-6 py-4 text-white">
                            {new Date(payment.created_at).toLocaleString('de-DE', {dateStyle: 'short', timeStyle: 'short'})}
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-white">{payment.user_name || 'N/A'}</p>
                            <p className="text-[#94A3B8] text-sm">{payment.user_email}</p>
                          </td>
                          <td className="px-6 py-4 text-white">{payment.package_name}</td>
                          <td className="px-6 py-4 text-[#FFD700] font-bold">{payment.bids}</td>
                          <td className="px-6 py-4 text-[#10B981] font-mono font-bold">€{payment.amount?.toFixed(2)}</td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              payment.status === 'paid' ? 'bg-[#10B981]/20 text-[#10B981]' :
                              payment.status === 'pending' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' :
                              'bg-[#EF4444]/20 text-[#EF4444]'
                            }`}>
                              {payment.status === 'paid' ? 'Bezahlt' : payment.status === 'pending' ? 'Ausstehend' : 'Fehlgeschlagen'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {payments.length === 0 && (
                  <p className="text-center text-[#94A3B8] py-12">Noch keine Zahlungen erfasst</p>
                )}
              </div>
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-white">Systemlogs</h1>
                  <p className="text-[#94A3B8]">Aktivitäten und Ereignisse</p>
                </div>
                <Button onClick={fetchData} variant="outline" className="border-white/10 text-white">
                  <RefreshCw className="w-4 h-4 mr-2" />Aktualisieren
                </Button>
              </div>

              {/* Log Entries */}
              <div className="glass-card rounded-xl overflow-hidden">
                <div className="divide-y divide-white/10 max-h-[600px] overflow-y-auto">
                  {logs.map((log, index) => (
                    <div key={index} className="p-4 hover:bg-white/5 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          log.type === 'bid' ? 'bg-[#FFD700]/20' :
                          log.type === 'payment' ? 'bg-[#10B981]/20' :
                          log.type === 'user' ? 'bg-[#7C3AED]/20' :
                          log.type === 'auction' ? 'bg-[#06B6D4]/20' :
                          log.type === 'error' ? 'bg-[#EF4444]/20' :
                          'bg-white/10'
                        }`}>
                          {log.type === 'bid' && <Zap className="w-5 h-5 text-[#FFD700]" />}
                          {log.type === 'payment' && <DollarSign className="w-5 h-5 text-[#10B981]" />}
                          {log.type === 'user' && <Users className="w-5 h-5 text-[#7C3AED]" />}
                          {log.type === 'auction' && <Gavel className="w-5 h-5 text-[#06B6D4]" />}
                          {log.type === 'error' && <Ban className="w-5 h-5 text-[#EF4444]" />}
                          {!['bid', 'payment', 'user', 'auction', 'error'].includes(log.type) && <BarChart3 className="w-5 h-5 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium">{log.message}</p>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="text-[#94A3B8] text-sm">
                              {new Date(log.timestamp).toLocaleString('de-DE', {dateStyle: 'short', timeStyle: 'medium'})}
                            </span>
                            {log.user_email && (
                              <span className="text-[#7C3AED] text-sm">{log.user_email}</span>
                            )}
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          log.type === 'error' ? 'bg-[#EF4444]/20 text-[#EF4444]' :
                          'bg-white/10 text-[#94A3B8]'
                        }`}>
                          {log.type?.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {logs.length === 0 && (
                  <p className="text-center text-[#94A3B8] py-12">Keine Logs vorhanden</p>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
