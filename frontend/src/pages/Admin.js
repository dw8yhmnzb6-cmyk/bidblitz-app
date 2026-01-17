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
  Bot, Play, Target, Calendar, Clock
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Admin() {
  const { token, isAdmin } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
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
    product_id: '', starting_price: '0.01', bid_increment: '0.02', duration_seconds: '300',
    start_time: '', end_time: '', scheduling_mode: 'immediate' // immediate, scheduled, custom
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
        const [statsRes, productsRes, auctionsRes] = await Promise.all([
          axios.get(`${API}/admin/stats`, { headers }),
          axios.get(`${API}/products`),
          axios.get(`${API}/auctions`)
        ]);
        setStats(statsRes.data);
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
      const auctionData = {
        product_id: newAuction.product_id,
        starting_price: parseFloat(newAuction.starting_price),
        bid_increment: parseFloat(newAuction.bid_increment)
      };

      // Handle scheduling modes
      if (newAuction.scheduling_mode === 'immediate') {
        auctionData.duration_seconds = parseInt(newAuction.duration_seconds);
      } else if (newAuction.scheduling_mode === 'scheduled') {
        // Scheduled start with duration
        if (newAuction.start_time) {
          auctionData.start_time = new Date(newAuction.start_time).toISOString();
          auctionData.duration_seconds = parseInt(newAuction.duration_seconds);
        }
      } else if (newAuction.scheduling_mode === 'custom') {
        // Custom start and end times
        if (newAuction.start_time) {
          auctionData.start_time = new Date(newAuction.start_time).toISOString();
        }
        if (newAuction.end_time) {
          auctionData.end_time = new Date(newAuction.end_time).toISOString();
        }
      }

      await axios.post(`${API}/admin/auctions`, auctionData, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Auktion erstellt');
      setNewAuction({ product_id: '', starting_price: '0.01', bid_increment: '0.02', duration_seconds: '300', start_time: '', end_time: '', scheduling_mode: 'immediate' });
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
                      <Label className="text-white">{t('admin.bidIncrement')}</Label>
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

                  {/* Scheduling Options */}
                  <div className="p-4 rounded-lg bg-[#181824] space-y-4">
                    <div className="flex items-center gap-2 text-[#06B6D4]">
                      <Calendar className="w-5 h-5" />
                      <span className="font-medium">Zeiteinstellungen</span>
                    </div>

                    {newAuction.scheduling_mode === 'immediate' && (
                      <div className="space-y-2">
                        <Label className="text-white">{t('admin.duration')}</Label>
                        <Select value={newAuction.duration_seconds} onValueChange={(value) => setNewAuction({...newAuction, duration_seconds: value})}>
                          <SelectTrigger className="bg-[#0F0F16] border-white/10 text-white"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-[#181824] border-white/10">
                            <SelectItem value="60" className="text-white hover:bg-white/10">1 Minute</SelectItem>
                            <SelectItem value="300" className="text-white hover:bg-white/10">5 Minuten</SelectItem>
                            <SelectItem value="600" className="text-white hover:bg-white/10">10 Minuten</SelectItem>
                            <SelectItem value="1800" className="text-white hover:bg-white/10">30 Minuten</SelectItem>
                            <SelectItem value="3600" className="text-white hover:bg-white/10">1 Stunde</SelectItem>
                            <SelectItem value="86400" className="text-white hover:bg-white/10">24 Stunden</SelectItem>
                            <SelectItem value="604800" className="text-white hover:bg-white/10">7 Tage</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-[#94A3B8] text-sm">Die Auktion startet sofort nach dem Erstellen.</p>
                      </div>
                    )}

                    {newAuction.scheduling_mode === 'scheduled' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <div className="space-y-2">
                          <Label className="text-white">{t('admin.duration')}</Label>
                          <Select value={newAuction.duration_seconds} onValueChange={(value) => setNewAuction({...newAuction, duration_seconds: value})}>
                            <SelectTrigger className="bg-[#0F0F16] border-white/10 text-white"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-[#181824] border-white/10">
                              <SelectItem value="60" className="text-white hover:bg-white/10">1 Minute</SelectItem>
                              <SelectItem value="300" className="text-white hover:bg-white/10">5 Minuten</SelectItem>
                              <SelectItem value="600" className="text-white hover:bg-white/10">10 Minuten</SelectItem>
                              <SelectItem value="1800" className="text-white hover:bg-white/10">30 Minuten</SelectItem>
                              <SelectItem value="3600" className="text-white hover:bg-white/10">1 Stunde</SelectItem>
                              <SelectItem value="86400" className="text-white hover:bg-white/10">24 Stunden</SelectItem>
                              <SelectItem value="604800" className="text-white hover:bg-white/10">7 Tage</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <p className="text-[#94A3B8] text-sm md:col-span-2">Die Auktion wird zum angegebenen Zeitpunkt automatisch gestartet.</p>
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
        </main>
      </div>
    </div>
  );
}
