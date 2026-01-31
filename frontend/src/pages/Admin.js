import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getAdminText } from '../i18n/adminTranslations';
import { useAuctionWebSocket } from '../hooks/useAuctionWebSocket';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  LayoutDashboard, Package, Gavel, Users, Plus, Trash2, 
  Settings, BarChart3, Zap, RefreshCw, Square, UserPlus,
  Ban, CheckCircle, DollarSign, Globe, Ticket, Edit, X, Save,
  Bot, Play, Target, Calendar, Clock, TrendingUp, Activity, Menu,
  Mail, Send, Eye, Star, Crown, FileText, RotateCcw, Repeat,
  Gift, Trophy, Moon, Wifi, WifiOff, Building2, Percent, CreditCard,
  Mic, Command
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart
} from 'recharts';

// Import refactored admin components
import { 
  AdminDashboard, 
  AdminProducts, 
  AdminUsers, 
  AdminBots, 
  AdminVouchers,
  AdminPayments,
  AdminLogs,
  AdminAuctions,
  AdminVIPAuctions,
  AdminVoiceCommand,
  AdminEmail,
  AdminPages,
  AdminBanners,
  AdminInfluencers,
  AdminWholesale,
  AdminGameConfig
} from '../components/admin';

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
  const { language, t } = useLanguage();
  
  // Helper function for admin translations
  const at = (key) => getAdminText(language, key);
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [detailedStats, setDetailedStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [vipAuctions, setVipAuctions] = useState([]);
  const [users, setUsers] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [bots, setBots] = useState([]);
  const [banners, setBanners] = useState([]);
  const [editingBanner, setEditingBanner] = useState(null);
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [payments, setPayments] = useState([]);
  const [logs, setLogs] = useState([]);
  const [staff, setStaff] = useState([]);
  const [roles, setRoles] = useState({});
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState(null);
  const [pageContent, setPageContent] = useState('');
  const [pageTitle, setPageTitle] = useState('');
  
  // Influencer states
  const [influencers, setInfluencers] = useState([]);
  const [showInfluencerModal, setShowInfluencerModal] = useState(false);
  const [influencerForm, setInfluencerForm] = useState({
    name: '',
    code: '',
    commission_percent: 10,
    email: '',
    instagram: '',
    youtube: '',
    tiktok: ''
  });
  const [selectedInfluencer, setSelectedInfluencer] = useState(null);

  // Wholesale/B2B states
  const [wholesaleApplications, setWholesaleApplications] = useState([]);
  const [wholesaleCustomers, setWholesaleCustomers] = useState([]);
  const [showWholesaleModal, setShowWholesaleModal] = useState(false);
  const [selectedWholesale, setSelectedWholesale] = useState(null);
  const [wholesaleForm, setWholesaleForm] = useState({
    discount_percent: 10,
    credit_limit: 0,
    payment_terms: 'prepaid',
    notes: ''
  });

  // Edit states
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  
  // Mobile menu state (must be before any conditional returns)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Form states
  const [newProduct, setNewProduct] = useState({
    name: '', description: '', image_url: '', retail_price: '', category: ''
  });
  const [newAuction, setNewAuction] = useState({
    product_id: '', starting_price: '0.01', bid_increment: '0.01', 
    duration_value: '10', duration_unit: 'minutes', // minutes, hours, days
    start_time: '', end_time: '', scheduling_mode: 'immediate',
    bot_target_price: '', // Maximum price for bots to bid up to
    auto_restart: false, // Enable auto-restart when auction ends
    auto_restart_duration: '10', // Duration in minutes for auto-restart
    auction_type: 'day', // day, night, vip
    is_vip_only: false
  });
  const [newVoucher, setNewVoucher] = useState({
    code: '', bids: '10', max_uses: '1', expires_at: ''
  });
  const [newBot, setNewBot] = useState({ name: '' });
  const [botBid, setBotBid] = useState({
    auction_id: '', target_price: '', num_bids: '5'
  });
  const [newStaff, setNewStaff] = useState({
    email: '', password: '', name: '', role: 'editor'
  });

  // Email Marketing states
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [emailUserStats, setEmailUserStats] = useState(null);
  const [emailCampaigns, setEmailCampaigns] = useState([]);
  const [emailForm, setEmailForm] = useState({
    subject: '',
    html_content: '',
    target_group: 'all',
    test_email: ''
  });
  const [sendingEmail, setSendingEmail] = useState(false);
  
  // Game Config State
  const [gameConfig, setGameConfig] = useState(null);
  const [savingConfig, setSavingConfig] = useState(false);

  // WebSocket for real-time auction updates
  const { isConnected, auctionData } = useAuctionWebSocket(null);

  // Update auctions from WebSocket in real-time
  useEffect(() => {
    if (auctionData && auctionData.auction_id) {
      setAuctions(prev => prev.map(auction => 
        auction.id === auctionData.auction_id
          ? {
              ...auction,
              current_price: auctionData.current_price ?? auction.current_price,
              end_time: auctionData.end_time ?? auction.end_time,
              last_bidder_name: auctionData.last_bidder_name ?? auction.last_bidder_name,
              total_bids: auctionData.total_bids ?? auction.total_bids
            }
          : auction
      ));
    }
  }, [auctionData]);

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
      } else if (activeTab === 'vip-auctions') {
        const [vipRes, productsRes, allAuctionsRes] = await Promise.all([
          axios.get(`${API}/auctions/vip-only`),
          axios.get(`${API}/products`),
          axios.get(`${API}/auctions`)
        ]);
        setVipAuctions(vipRes.data);
        setProducts(productsRes.data);
        setAuctions(allAuctionsRes.data);
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
      } else if (activeTab === 'email') {
        const [templatesRes, statsRes, campaignsRes] = await Promise.all([
          axios.get(`${API}/admin/email/templates`, { headers }),
          axios.get(`${API}/admin/email/user-stats`, { headers }),
          axios.get(`${API}/admin/email/campaigns`, { headers })
        ]);
        setEmailTemplates(templatesRes.data);
        setEmailUserStats(statsRes.data);
        setEmailCampaigns(campaignsRes.data);
      } else if (activeTab === 'staff') {
        const [staffRes, rolesRes, permsRes] = await Promise.all([
          axios.get(`${API}/admin/staff`, { headers }),
          axios.get(`${API}/admin/staff/roles`, { headers }),
          axios.get(`${API}/admin/staff/permissions`, { headers })
        ]);
        setStaff(staffRes.data);
        setRoles(rolesRes.data);
        setPermissions(permsRes.data);
      } else if (activeTab === 'pages') {
        const res = await axios.get(`${API}/pages`);
        setPages(res.data);
      } else if (activeTab === 'banners') {
        const bannersRes = await axios.get(`${API}/admin/banners`, { headers });
        setBanners(bannersRes.data);
      } else if (activeTab === 'influencers') {
        const influencersRes = await axios.get(`${API}/influencer/admin/list`, { headers });
        setInfluencers(influencersRes.data);
      } else if (activeTab === 'wholesale') {
        const [appsRes, customersRes] = await Promise.all([
          axios.get(`${API}/admin/wholesale/applications`, { headers }),
          axios.get(`${API}/admin/wholesale/customers`, { headers })
        ]);
        setWholesaleApplications(appsRes.data);
        setWholesaleCustomers(customersRes.data);
      } else if (activeTab === 'game-config') {
        const res = await axios.get(`${API}/admin/config/game`, { headers });
        setGameConfig(res.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Save Game Config
  const handleSaveGameConfig = async () => {
    setSavingConfig(true);
    try {
      await axios.put(`${API}/admin/config/game`, gameConfig, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Einstellungen gespeichert!');
    } catch (error) {
      toast.error('Fehler beim Speichern');
    } finally {
      setSavingConfig(false);
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
        bot_target_price: newAuction.bot_target_price ? parseFloat(newAuction.bot_target_price) : null,
        is_night_auction: newAuction.auction_type === 'night',
        is_vip_only: newAuction.auction_type === 'vip' || newAuction.is_vip_only
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
      
      // Set day/night mode based on auction type
      if (newAuction.auction_type === 'night') {
        try {
          await axios.post(
            `${API}/admin/auctions/${response.data.id}/set-day-night?is_night=true`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (e) {
          console.error('Failed to set night mode:', e);
        }
      }
      
      // Set auto-restart if enabled
      if (newAuction.auto_restart) {
        try {
          await axios.put(
            `${API}/admin/auctions/${response.data.id}/auto-restart?duration_minutes=${parseInt(newAuction.auto_restart_duration) || 10}&bot_target_price=${newAuction.bot_target_price ? parseFloat(newAuction.bot_target_price) : 0}`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
          toast.success('Auto-Neustart aktiviert');
        } catch (autoRestartError) {
          console.error('Auto-restart setup failed:', autoRestartError);
        }
      }
      
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
        bot_target_price: '', auto_restart: false, auto_restart_duration: '10',
        auction_type: 'day', is_vip_only: false
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
    
    const botPrice = prompt('Bots bieten bis (€):\n\nBots werden kontinuierlich bieten bis dieser Preis erreicht ist.\nLeer lassen = Standard €2-3:', '');
    
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

  // Update bot target price for an auction
  const handleUpdateBotTarget = async (auctionId, currentTarget) => {
    const newTarget = prompt(
      `Bots bieten bis (€):\n\n` +
      `• Bots bieten kontinuierlich bis zu diesem Preis\n` +
      `• Sobald erreicht, hören die Bots auf\n` +
      `• 0 = Standard €2-3\n\n` +
      `Neuer Zielpreis (€):`,
      currentTarget || '0'
    );
    
    if (newTarget === null) return;
    
    const targetPrice = parseFloat(newTarget) || 0;
    
    try {
      const res = await axios.put(
        `${API}/admin/bots/target-price/${auctionId}?target_price=${targetPrice}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(res.data.message);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Aktualisieren');
    }
  };

  // Set auction as featured/VIP
  const handleSetFeatured = async (auctionId, currentFeatured) => {
    try {
      await axios.put(
        `${API}/admin/auctions/${auctionId}/featured?is_featured=${!currentFeatured}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(currentFeatured ? 'VIP-Status entfernt' : 'Als VIP-Auktion markiert');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
    }
  };

  // Set auction as VIP-only
  const handleSetVipOnly = async (auctionId, isVipOnly) => {
    try {
      await axios.put(
        `${API}/admin/auctions/${auctionId}/vip-only?is_vip_only=${!isVipOnly}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(isVipOnly ? 'VIP-Only Status entfernt' : 'Als VIP-Only markiert');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
    }
  };

  // Set auction as "Auction of the Day"
  const handleSetAuctionOfTheDay = async (auctionId) => {
    try {
      await axios.post(
        `${API}/admin/auction-of-the-day/${auctionId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('🏆 Als Auktion des Tages gesetzt!');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
    }
  };

  // ==================== INFLUENCER HANDLERS ====================
  
  const handleCreateInfluencer = async () => {
    try {
      await axios.post(`${API}/influencer/admin/create`, influencerForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('🌟 Influencer erstellt!');
      setShowInfluencerModal(false);
      setInfluencerForm({ name: '', code: '', commission_percent: 10, email: '', instagram: '', youtube: '', tiktok: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Erstellen');
    }
  };

  const handleDeleteInfluencer = async (influencerId) => {
    if (!window.confirm('Influencer wirklich löschen?')) return;
    try {
      await axios.delete(`${API}/influencer/admin/${influencerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Influencer gelöscht');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
    }
  };

  const handleToggleInfluencer = async (influencerId, currentStatus) => {
    try {
      await axios.put(`${API}/influencer/admin/${influencerId}`, 
        { is_active: !currentStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(currentStatus ? 'Influencer deaktiviert' : 'Influencer aktiviert');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
    }
  };

  // Wholesale/B2B handlers
  const handleApproveWholesale = async (applicationId) => {
    try {
      await axios.post(`${API}/admin/wholesale/approve/${applicationId}`, wholesaleForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Großkunde freigeschaltet!');
      setShowWholesaleModal(false);
      setSelectedWholesale(null);
      setWholesaleForm({ discount_percent: 10, credit_limit: 0, payment_terms: 'prepaid', notes: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Freischalten');
    }
  };

  const handleRejectWholesale = async (applicationId) => {
    if (!window.confirm('Bewerbung wirklich ablehnen?')) return;
    try {
      await axios.post(`${API}/admin/wholesale/reject/${applicationId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Bewerbung abgelehnt');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
    }
  };

  const handleUpdateWholesale = async (wholesaleId) => {
    try {
      await axios.put(`${API}/admin/wholesale/${wholesaleId}`, wholesaleForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Großkunde aktualisiert');
      setShowWholesaleModal(false);
      setSelectedWholesale(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
    }
  };

  const handleDeleteWholesale = async (wholesaleId) => {
    if (!window.confirm('Großkundenstatus wirklich entfernen?')) return;
    try {
      await axios.delete(`${API}/admin/wholesale/${wholesaleId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Großkundenstatus entfernt');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
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
      await axios.put(`${API}/admin/users/${userId}/block`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(currentStatus ? 'Benutzer entsperrt' : 'Benutzer gesperrt');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
    }
  };

  const handleToggleGuaranteedWinner = async (userId, currentStatus) => {
    try {
      await axios.put(`${API}/admin/users/${userId}/guaranteed-winner`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(currentStatus ? 'Garantierter Gewinner deaktiviert' : 'Garantierter Gewinner aktiviert 🏆');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
    }
  };

  const handleToggleVIP = async (userId, currentVipStatus) => {
    try {
      const response = await axios.put(`${API}/admin/users/${userId}/toggle-vip`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(response.data.message);
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

  // Page content handlers
  const handleSelectPage = async (page) => {
    setSelectedPage(page);
    setPageTitle(page.title);
    setPageContent(page.content);
  };

  const handleSavePage = async () => {
    if (!selectedPage) return;
    try {
      await axios.put(`${API}/admin/pages/${selectedPage.page_id}`, {
        title: pageTitle,
        content: pageContent
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Seite gespeichert');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Speichern');
    }
  };

  const handleResetPage = async () => {
    if (!selectedPage) return;
    if (!confirm(`Seite "${selectedPage.title}" auf Standardinhalt zurücksetzen?`)) return;
    try {
      await axios.post(`${API}/admin/pages/${selectedPage.page_id}/reset`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Seite zurückgesetzt');
      setSelectedPage(null);
      setPageContent('');
      setPageTitle('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Zurücksetzen');
    }
  };

  // Auto-restart auction handler
  const handleSetAutoRestart = async (auctionId, currentAutoRestart) => {
    const duration = prompt('Auto-Neustart Dauer in Minuten (0 = deaktiviert):', currentAutoRestart || '10');
    if (duration === null) return;
    
    const botPrice = prompt('Bots bieten bis (€) für Auto-Neustart:\n\nBots bieten kontinuierlich bis zu diesem Preis.\nLeer = Standard €2-3:', '');
    
    try {
      await axios.put(
        `${API}/admin/auctions/${auctionId}/auto-restart?duration_minutes=${parseInt(duration) || 0}&bot_target_price=${parseFloat(botPrice) || 0}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(parseInt(duration) > 0 ? `Auto-Neustart aktiviert (${duration} Min)` : 'Auto-Neustart deaktiviert');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
    }
  };

  // Email template HTML generator
  const getTemplateHtml = (templateId) => {
    const templates = {
      welcome: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f4;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;">
<tr><td style="background:linear-gradient(135deg,#7C3AED,#EC4899);padding:30px;text-align:center;">
<h1 style="color:#fff;margin:0;font-size:28px;">🎉 Willkommen bei BidBlitz!</h1>
</td></tr>
<tr><td style="padding:30px;">
<p style="font-size:18px;color:#333;">Hallo <strong>{name}</strong>,</p>
<p style="color:#555;line-height:1.6;">Vielen Dank für Ihre Registrierung! Als Willkommensgeschenk haben wir Ihnen <strong>10 kostenlose Gebote</strong> gutgeschrieben.</p>
<p style="text-align:center;margin:30px 0;"><a href="https://bidblitz.de/auctions" style="background:#7C3AED;color:#fff;padding:15px 30px;text-decoration:none;border-radius:8px;font-weight:bold;">Jetzt mitbieten</a></p>
<p style="color:#888;font-size:14px;">Viel Erfolg beim Bieten!<br>Ihr BidBlitz Team</p>
</td></tr>
</table>
</body>
</html>`,
      new_auction: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f4;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;">
<tr><td style="background:linear-gradient(135deg,#FFD700,#FF4D4D);padding:30px;text-align:center;">
<h1 style="color:#111;margin:0;font-size:28px;">🔥 Neue Auktion gestartet!</h1>
</td></tr>
<tr><td style="padding:30px;">
<p style="font-size:18px;color:#333;">Hallo <strong>{name}</strong>,</p>
<p style="color:#555;line-height:1.6;">Eine neue spannende Auktion wurde soeben gestartet! Verpassen Sie nicht Ihre Chance auf ein tolles Schnäppchen.</p>
<p style="text-align:center;margin:30px 0;"><a href="https://bidblitz.de/auctions" style="background:#FFD700;color:#111;padding:15px 30px;text-decoration:none;border-radius:8px;font-weight:bold;">Zur Auktion</a></p>
<p style="color:#888;font-size:14px;">Viel Erfolg beim Bieten!<br>Ihr BidBlitz Team</p>
</td></tr>
</table>
</body>
</html>`,
      special_offer: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f4;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;">
<tr><td style="background:linear-gradient(135deg,#10B981,#06B6D4);padding:30px;text-align:center;">
<h1 style="color:#fff;margin:0;font-size:28px;">💰 Exklusives Angebot!</h1>
</td></tr>
<tr><td style="padding:30px;">
<p style="font-size:18px;color:#333;">Hallo <strong>{name}</strong>,</p>
<p style="color:#555;line-height:1.6;">Nur für kurze Zeit: Kaufen Sie jetzt ein Gebotspaket und erhalten Sie <strong>50% mehr Gebote</strong> gratis dazu!</p>
<div style="background:#f9f9f9;border-radius:10px;padding:20px;margin:20px 0;text-align:center;">
<p style="margin:0;font-size:24px;color:#10B981;font-weight:bold;">100 Gebote + 50 GRATIS</p>
<p style="margin:10px 0 0;color:#888;">Nur €29,99 statt €44,99</p>
</div>
<p style="text-align:center;margin:30px 0;"><a href="https://bidblitz.de/buy-bids" style="background:#10B981;color:#fff;padding:15px 30px;text-decoration:none;border-radius:8px;font-weight:bold;">Jetzt sichern</a></p>
</td></tr>
</table>
</body>
</html>`,
      reactivation: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f4;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;">
<tr><td style="background:linear-gradient(135deg,#F59E0B,#EF4444);padding:30px;text-align:center;">
<h1 style="color:#fff;margin:0;font-size:28px;">😢 Wir vermissen Sie!</h1>
</td></tr>
<tr><td style="padding:30px;">
<p style="font-size:18px;color:#333;">Hallo <strong>{name}</strong>,</p>
<p style="color:#555;line-height:1.6;">Es ist schon eine Weile her, seit Sie das letzte Mal bei uns waren. Kommen Sie zurück und sichern Sie sich tolle Schnäppchen!</p>
<p style="color:#555;line-height:1.6;">Als kleines Willkommensgeschenk haben wir Ihnen <strong>5 kostenlose Gebote</strong> gutgeschrieben.</p>
<p style="text-align:center;margin:30px 0;"><a href="https://bidblitz.de/auctions" style="background:#F59E0B;color:#fff;padding:15px 30px;text-decoration:none;border-radius:8px;font-weight:bold;">Jetzt zurückkommen</a></p>
</td></tr>
</table>
</body>
</html>`
    };
    return templates[templateId] || '';
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
    { id: 'dashboard', label: at('dashboard'), icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'voice', label: language === 'en' ? 'Voice Commands' : 'Sprachbefehle', icon: <Mic className="w-5 h-5" />, highlight: true },
    { id: 'products', label: at('products'), icon: <Package className="w-5 h-5" /> },
    { id: 'auctions', label: at('auctions'), icon: <Gavel className="w-5 h-5" /> },
    { id: 'vip-auctions', label: at('vipAuctions'), icon: <Crown className="w-5 h-5" /> },
    { id: 'banners', label: at('banners'), icon: <Eye className="w-5 h-5" /> },
    { id: 'influencers', label: language === 'en' ? 'Influencers' : 'Influencer', icon: <Star className="w-5 h-5" /> },
    { id: 'wholesale', label: language === 'en' ? 'Wholesale' : 'Großkunden', icon: <Building2 className="w-5 h-5" /> },
    { id: 'users', label: at('users'), icon: <Users className="w-5 h-5" /> },
    { id: 'staff', label: language === 'en' ? 'Staff' : 'Mitarbeiter', icon: <UserPlus className="w-5 h-5" /> },
    { id: 'vouchers', label: at('vouchers'), icon: <Ticket className="w-5 h-5" /> },
    { id: 'bots', label: at('bots'), icon: <Bot className="w-5 h-5" /> },
    { id: 'email', label: at('email'), icon: <Mail className="w-5 h-5" /> },
    { id: 'pages', label: at('pages'), icon: <FileText className="w-5 h-5" /> },
    { id: 'payments', label: language === 'en' ? 'Payments' : 'Zahlungen', icon: <DollarSign className="w-5 h-5" /> },
    { id: 'logs', label: language === 'en' ? 'System Logs' : 'Systemlogs', icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'game-config', label: at('gameSettings'), icon: <Settings className="w-5 h-5" /> }
  ];

  return (
    <div className="min-h-screen pt-20" data-testid="admin-page">
      {/* Mobile Tab Bar */}
      <div className="lg:hidden fixed top-16 left-0 right-0 z-30 bg-[#0F0F16] border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#7C3AED]" />
            Admin
          </h2>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-white"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
        
        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="px-2 pb-3 bg-[#0F0F16] border-b border-white/10">
            <div className="grid grid-cols-4 gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-[#7C3AED]/20 text-[#7C3AED]'
                      : 'text-[#94A3B8] hover:bg-white/5'
                  }`}
                >
                  {tab.icon}
                  <span className="text-[10px]">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-64 min-h-screen bg-[#0F0F16] border-r border-white/10 fixed left-0 top-16 pt-6">
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
        <main className="flex-1 lg:ml-64 p-4 lg:p-8 pt-20 lg:pt-8">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 lg:space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="text-xl lg:text-2xl font-bold text-white">{t('admin.dashboard')}</h1>
                <Button onClick={fetchData} variant="outline" className="border-white/10 text-white w-full sm:w-auto">
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

          {/* Voice Commands Tab */}
          {activeTab === 'voice' && (
            <AdminVoiceCommand />
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
                      {(products || []).map((product) => (
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
            <AdminAuctions 
              token={token} 
              t={t} 
              auctions={auctions} 
              products={products} 
              fetchData={fetchData} 
            />
          )}


          {/* VIP Auctions Tab */}
          {activeTab === 'vip-auctions' && (
            <AdminVIPAuctions 
              token={token} 
              vipAuctions={vipAuctions} 
              auctions={auctions} 
              fetchData={fetchData} 
            />
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
                        <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {(users || []).map((user) => (
                        <tr key={user.id} className={`hover:bg-white/5 ${user.is_blocked ? 'opacity-50' : ''}`}>
                          <td className="px-4 py-3">
                            {editingUser?.id === user.id ? (
                              <Input value={editingUser.name} onChange={(e) => setEditingUser({...editingUser, name: e.target.value})} className="bg-[#181824] border-white/10 text-white h-8 w-32" />
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-white">{user.name}</span>
                                {user.is_vip && (
                                  <span className="px-1.5 py-0.5 rounded bg-[#F59E0B]/20 text-[#F59E0B] text-xs font-bold">VIP</span>
                                )}
                                {user.is_guaranteed_winner && (
                                  <span className="px-1.5 py-0.5 rounded bg-[#FFD700]/20 text-[#FFD700] text-xs font-bold">🏆</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">{editingUser?.id === user.id ? <Input value={editingUser.email} onChange={(e) => setEditingUser({...editingUser, email: e.target.value})} className="bg-[#181824] border-white/10 text-white h-8" /> : <span className="text-[#94A3B8]">{user.email}</span>}</td>
                          <td className="px-4 py-3">{editingUser?.id === user.id ? <Input type="number" value={editingUser.bids_balance} onChange={(e) => setEditingUser({...editingUser, bids_balance: parseInt(e.target.value)})} className="bg-[#181824] border-white/10 text-white h-8 w-20" /> : <span className="flex items-center gap-1 text-[#06B6D4]"><Zap className="w-4 h-4" />{user.bids_balance}</span>}</td>
                          <td className="px-4 py-3"><span className="flex items-center gap-1 text-[#10B981]"><DollarSign className="w-4 h-4" />€{(user.total_deposits || 0).toFixed(2)}</span></td>
                          <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${user.is_blocked ? 'bg-[#EF4444]/20 text-[#EF4444]' : 'bg-[#10B981]/20 text-[#10B981]'}`}>{user.is_blocked ? t('admin.blocked') : t('admin.active')}</span></td>
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
                                  <Button size="sm" variant="ghost" className={user.is_blocked ? "text-[#10B981] hover:bg-[#10B981]/10" : "text-[#EF4444] hover:bg-[#EF4444]/10"} onClick={() => handleToggleBlock(user.id, user.is_blocked)} title={user.is_blocked ? 'Entsperren' : 'Sperren'}>{user.is_blocked ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}</Button>
                                  <Button size="sm" variant="ghost" className={user.is_vip ? "text-[#F59E0B] hover:bg-[#F59E0B]/10" : "text-[#94A3B8] hover:bg-white/10"} onClick={() => handleToggleVIP(user.id, user.is_vip)} title={user.is_vip ? 'VIP entfernen' : 'VIP aktivieren'}><Crown className="w-4 h-4" /></Button>
                                  <Button size="sm" variant="ghost" className={user.is_guaranteed_winner ? "text-[#FFD700] hover:bg-[#FFD700]/10" : "text-[#94A3B8] hover:bg-white/10"} onClick={() => handleToggleGuaranteedWinner(user.id, user.is_guaranteed_winner)} title={user.is_guaranteed_winner ? 'Garantierter Gewinner deaktivieren' : 'Als Garantierter Gewinner markieren'}><Trophy className="w-4 h-4" /></Button>
                                  <Button size="sm" variant="ghost" className="text-[#06B6D4] hover:bg-[#06B6D4]/10" onClick={() => handleAddBids(user.id)} title="Gebote hinzufügen"><Plus className="w-4 h-4" /></Button>
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

          {/* Staff Tab */}
          {activeTab === 'staff' && (
            <div className="space-y-8">
              <h1 className="text-2xl font-bold text-white">Mitarbeiter verwalten</h1>
              
              {/* Add Staff Form */}
              <div className="glass-card rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Neuer Mitarbeiter</h3>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await axios.post(`${API}/admin/staff`, newStaff, { headers: { Authorization: `Bearer ${token}` } });
                    toast.success('Mitarbeiter erstellt');
                    setNewStaff({ email: '', password: '', name: '', role: 'editor' });
                    fetchData();
                  } catch (error) {
                    toast.error(error.response?.data?.detail || 'Fehler beim Erstellen');
                  }
                }} className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <Label className="text-white">Name</Label>
                    <Input value={newStaff.name} onChange={(e) => setNewStaff({...newStaff, name: e.target.value})} required className="bg-[#181824] border-white/10 text-white" placeholder="Max Mustermann" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">E-Mail</Label>
                    <Input type="email" value={newStaff.email} onChange={(e) => setNewStaff({...newStaff, email: e.target.value})} required className="bg-[#181824] border-white/10 text-white" placeholder="mitarbeiter@bidblitz.de" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">Passwort</Label>
                    <Input type="password" value={newStaff.password} onChange={(e) => setNewStaff({...newStaff, password: e.target.value})} required className="bg-[#181824] border-white/10 text-white" placeholder="••••••••" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">Rolle</Label>
                    <Select value={newStaff.role} onValueChange={(v) => setNewStaff({...newStaff, role: v})}>
                      <SelectTrigger className="bg-[#181824] border-white/10 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roles && Object.entries(roles).map(([id, role]) => (
                          <SelectItem key={id} value={id}>{role.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white">
                      <Plus className="w-4 h-4 mr-2" /> Erstellen
                    </Button>
                  </div>
                </form>
              </div>

              {/* Roles Overview */}
              <div className="glass-card rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Verfügbare Rollen</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {roles && Object.entries(roles).map(([id, role]) => (
                    <div key={id} className="bg-[#181824] rounded-lg p-4 border border-white/10">
                      <h4 className="font-bold text-white mb-1">{role.name}</h4>
                      <p className="text-[#94A3B8] text-xs mb-2">{role.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {role.permissions?.map(perm => (
                          <span key={perm} className="px-2 py-0.5 bg-[#7C3AED]/20 text-[#A78BFA] text-[10px] rounded">
                            {permissions?.[perm]?.name || perm}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Staff List */}
              <div className="glass-card rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Mitarbeiterliste ({staff?.length || 0})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 text-[#94A3B8] font-medium">Name</th>
                        <th className="text-left py-3 text-[#94A3B8] font-medium">E-Mail</th>
                        <th className="text-left py-3 text-[#94A3B8] font-medium">Rolle</th>
                        <th className="text-left py-3 text-[#94A3B8] font-medium">Berechtigungen</th>
                        <th className="text-left py-3 text-[#94A3B8] font-medium">Status</th>
                        <th className="text-left py-3 text-[#94A3B8] font-medium">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staff?.map((member) => (
                        <tr key={member.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-3 text-white font-medium">{member.name}</td>
                          <td className="py-3 text-[#94A3B8]">{member.email}</td>
                          <td className="py-3">
                            <span className="px-2 py-1 bg-[#7C3AED]/20 text-[#A78BFA] text-xs rounded">
                              {member.role_name}
                            </span>
                          </td>
                          <td className="py-3">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {member.permissions?.slice(0, 3).map(perm => (
                                <span key={perm} className="px-1.5 py-0.5 bg-[#06B6D4]/20 text-[#06B6D4] text-[10px] rounded">
                                  {permissions?.[perm]?.name || perm}
                                </span>
                              ))}
                              {member.permissions?.length > 3 && (
                                <span className="px-1.5 py-0.5 bg-white/10 text-white/60 text-[10px] rounded">
                                  +{member.permissions.length - 3}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3">
                            <span className={`px-2 py-1 text-xs rounded ${member.is_active ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#EF4444]/20 text-[#EF4444]'}`}>
                              {member.is_active ? 'Aktiv' : 'Inaktiv'}
                            </span>
                          </td>
                          <td className="py-3">
                            <div className="flex gap-2">
                              <Button size="sm" variant="ghost" className={member.is_active ? "text-[#EF4444]" : "text-[#10B981]"} onClick={async () => {
                                try {
                                  await axios.put(`${API}/admin/staff/${member.id}`, { is_active: !member.is_active }, { headers: { Authorization: `Bearer ${token}` } });
                                  toast.success(member.is_active ? 'Deaktiviert' : 'Aktiviert');
                                  fetchData();
                                } catch (e) { toast.error('Fehler'); }
                              }}>
                                {member.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                              </Button>
                              <Button size="sm" variant="ghost" className="text-[#EF4444]" onClick={async () => {
                                if (window.confirm('Mitarbeiter wirklich löschen?')) {
                                  try {
                                    await axios.delete(`${API}/admin/staff/${member.id}`, { headers: { Authorization: `Bearer ${token}` } });
                                    toast.success('Gelöscht');
                                    fetchData();
                                  } catch (e) { toast.error('Fehler'); }
                                }
                              }}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {(!staff || staff.length === 0) && (
                        <tr>
                          <td colSpan="6" className="py-8 text-center text-[#94A3B8]">
                            Keine Mitarbeiter vorhanden. Erstellen Sie den ersten Mitarbeiter oben.
                          </td>
                        </tr>
                      )}
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
                      {(vouchers || []).map((voucher) => (
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
                      {(vouchers || []).length === 0 && (<tr><td colSpan={6} className="px-4 py-8 text-center text-[#94A3B8]">Noch keine Gutscheine erstellt</td></tr>)}
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
                        {(auctions || []).filter(a => a.status === 'active').map((auction) => (
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
                  {(auctions || []).filter(a => a.status === 'active').map((auction) => (
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
                  {(auctions || []).filter(a => a.status === 'active').length === 0 && (
                    <p className="text-center text-[#94A3B8] py-8">Keine aktiven Auktionen</p>
                  )}
                </div>
              </div>

              {/* Bot List */}
              <div className="glass-card rounded-xl p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <h3 className="text-lg font-bold text-white">Verfügbare Bots ({(bots || []).length})</h3>
                  
                  {/* Bot Creation Form - More Prominent */}
                  <form onSubmit={handleCreateBot} className="flex gap-2 w-full md:w-auto">
                    <Input
                      value={newBot.name}
                      onChange={(e) => setNewBot({name: e.target.value})}
                      placeholder="Neuer Bot-Name (z.B. Bardh K.)"
                      className="bg-[#181824] border-white/10 text-white flex-1 md:w-64"
                      required
                    />
                    <Button type="submit" className="bg-gradient-to-r from-[#7C3AED] to-[#EC4899] hover:opacity-90 whitespace-nowrap">
                      <Plus className="w-4 h-4 mr-1" />
                      Bot erstellen
                    </Button>
                  </form>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {(bots || []).map((bot) => (
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
                {(bots || []).length === 0 && (
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
                      <p className="text-2xl font-bold text-white">{(payments || []).length}</p>
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
                      {(payments || []).map((payment, index) => (
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
                {(payments || []).length === 0 && (
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
                  {(logs || []).map((log, index) => (
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
                {(logs || []).length === 0 && (
                  <p className="text-center text-[#94A3B8] py-12">Keine Logs vorhanden</p>
                )}
              </div>
            </div>
          )}

          {/* Email Marketing Tab */}
          {activeTab === 'email' && (
            <AdminEmail
              token={token}
              emailTemplates={emailTemplates}
              emailUserStats={emailUserStats}
              emailCampaigns={emailCampaigns}
              fetchData={fetchData}
              getTemplateHtml={getTemplateHtml}
            />
          )}

          {/* Pages Content Tab */}
          {activeTab === 'pages' && (
            <AdminPages
              token={token}
              pages={pages}
              fetchData={fetchData}
            />
          )}

          {/* Banners Tab */}
          {activeTab === 'banners' && (
            <AdminBanners
              token={token}
              banners={banners}
              setBanners={setBanners}
            />
          )}

          {/* Influencers Tab */}
          {activeTab === 'influencers' && (
            <AdminInfluencers
              token={token}
              influencers={influencers}
              setInfluencers={setInfluencers}
              fetchData={fetchData}
            />
          )}

          {/* Wholesale/B2B Tab */}
          {activeTab === 'wholesale' && (
            <AdminWholesale
              token={token}
              wholesaleApplications={wholesaleApplications}
              wholesaleCustomers={wholesaleCustomers}
              setWholesaleApplications={setWholesaleApplications}
              setWholesaleCustomers={setWholesaleCustomers}
              fetchData={fetchData}
            />
          )}

          {/* Game Config Tab */}
          {activeTab === 'game-config' && (
            <AdminGameConfig
              token={token}
              gameConfig={gameConfig}
              setGameConfig={setGameConfig}
              isConnected={isConnected}
            />
          )}
        </main>
      </div>
    </div>
  );
}
