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
  Ban, CheckCircle, Check, DollarSign, Globe, Ticket, Edit, X, Save,
  Bot, Play, Target, Calendar, Clock, TrendingUp, Activity, Menu,
  Mail, Send, Eye, Star, Crown, FileText, RotateCcw, Repeat,
  Gift, Trophy, Moon, Wifi, WifiOff, Building2, Percent, CreditCard,
  Mic, Command, Search
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
  AdminGameConfig,
  AdminQuickActions,
  AdminLiveWidgets,
  AdminGlobalSearch,
  AdminAIChat
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

  // Manager states
  const [managers, setManagers] = useState([]);
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [showManagerDetails, setShowManagerDetails] = useState(false);
  const [selectedManager, setSelectedManager] = useState(null);
  const [managerInfluencers, setManagerInfluencers] = useState([]);
  const [managerActivities, setManagerActivities] = useState([]);
  const [loadingManagerDetails, setLoadingManagerDetails] = useState(false);
  const [managerForm, setManagerForm] = useState({
    name: '',
    email: '',
    password: '',
    cities: '',
    commission_percent: 15
  });

  // Jackpot states
  const [jackpotData, setJackpotData] = useState(null);
  const [jackpotHistory, setJackpotHistory] = useState([]);
  const [jackpotAmount, setJackpotAmount] = useState(500);

  // Promo Codes states
  const [promoCodes, setPromoCodes] = useState([]);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoForm, setPromoForm] = useState({
    code: '',
    name: '',
    reward_type: 'bids',
    reward_amount: 10,
    max_uses: null,
    valid_until: ''
  });

  // Edit states
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  
  // Mobile menu state (must be before any conditional returns)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // New Dashboard Widget States
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);

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
    code: '', type: 'bids', value: '10', max_uses: '1'
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

  // Keyboard Shortcuts for Admin Panel
  useEffect(() => {
    const handleKeyDown = (e) => {
      // "/" for global search
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        setShowGlobalSearch(true);
      }
      // "Escape" to close modals
      if (e.key === 'Escape') {
        setShowGlobalSearch(false);
        setShowAIChat(false);
        setMobileMenuOpen(false);
      }
      // Ctrl+K for search (alternative)
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowGlobalSearch(true);
      }
      // Ctrl+J for AI Chat
      if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
        e.preventDefault();
        setShowAIChat(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
      } else if (activeTab === 'managers') {
        const managersRes = await axios.get(`${API}/manager/admin/list`, { headers });
        setManagers(managersRes.data.managers || []);
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
      } else if (activeTab === 'jackpot') {
        const jpRes = await axios.get(`${API}/excitement/global-jackpot`);
        setJackpotData(jpRes.data);
        setJackpotAmount(jpRes.data.current_amount || 500);
        const histRes = await axios.get(`${API}/excitement/global-jackpot/history`);
        setJackpotHistory(histRes.data.winners || []);
        // Also load users for jackpot award
        const usersRes = await axios.get(`${API}/admin/users`, { headers });
        setUsers(usersRes.data);
      } else if (activeTab === 'promo-codes') {
        const promoRes = await axios.get(`${API}/promo-codes/admin/list`, { headers });
        setPromoCodes(promoRes.data.promo_codes || []);
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

  // Load Manager Details (Influencers and Activities)
  useEffect(() => {
    const loadManagerDetails = async () => {
      if (!selectedManager || !showManagerDetails) return;
      
      setLoadingManagerDetails(true);
      try {
        // Load influencers
        const infRes = await axios.get(
          `${API}/manager/admin/${selectedManager.id}/influencers`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setManagerInfluencers(infRes.data.influencers || []);
        
        // Load activities
        const actRes = await axios.get(
          `${API}/manager/admin/${selectedManager.id}/activities?limit=20`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setManagerActivities(actRes.data.activities || []);
      } catch (error) {
        console.error('Error loading manager details:', error);
        setManagerInfluencers([]);
        setManagerActivities([]);
      } finally {
        setLoadingManagerDetails(false);
      }
    };
    
    loadManagerDetails();
  }, [selectedManager, showManagerDetails, token]);

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
        code: newVoucher.code || null,
        type: newVoucher.type || 'bids',
        value: parseInt(newVoucher.value || newVoucher.bids || 10),
        max_uses: parseInt(newVoucher.max_uses) || 1,
        expires_days: 30
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Gutschein erstellt');
      setNewVoucher({ code: '', type: 'bids', value: '10', max_uses: '1' });
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
    { id: 'managers', label: language === 'en' ? 'Managers' : 'Manager', icon: <Building2 className="w-5 h-5" />, highlight: true },
    { id: 'wholesale', label: language === 'en' ? 'Wholesale' : 'Großkunden', icon: <Building2 className="w-5 h-5" /> },
    { id: 'users', label: at('users'), icon: <Users className="w-5 h-5" /> },
    { id: 'staff', label: language === 'en' ? 'Staff' : 'Mitarbeiter', icon: <UserPlus className="w-5 h-5" /> },
    { id: 'vouchers', label: at('vouchers'), icon: <Ticket className="w-5 h-5" /> },
    { id: 'bots', label: at('bots'), icon: <Bot className="w-5 h-5" /> },
    { id: 'email', label: at('email'), icon: <Mail className="w-5 h-5" /> },
    { id: 'pages', label: at('pages'), icon: <FileText className="w-5 h-5" /> },
    { id: 'payments', label: language === 'en' ? 'Payments' : 'Zahlungen', icon: <DollarSign className="w-5 h-5" /> },
    { id: 'logs', label: language === 'en' ? 'System Logs' : 'Systemlogs', icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'jackpot', label: '🏆 Jackpot', icon: <Trophy className="w-5 h-5" />, highlight: true },
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
          <div className="px-4 mt-8 space-y-3">
            <Button onClick={handleSeedData} variant="outline" className="w-full border-white/10 text-white hover:bg-white/10">
              <Plus className="w-4 h-4 mr-2" />{t('admin.seedData')}
            </Button>
            
            {/* Keyboard Shortcuts Hint */}
            <div className="text-xs text-gray-500 space-y-1 pt-2 border-t border-white/5">
              <p className="font-medium text-gray-400">Tastenkürzel:</p>
              <p><kbd className="px-1 py-0.5 bg-white/10 rounded">/</kbd> Suche</p>
              <p><kbd className="px-1 py-0.5 bg-white/10 rounded">Ctrl</kbd>+<kbd className="px-1 py-0.5 bg-white/10 rounded">J</kbd> KI-Chat</p>
              <p><kbd className="px-1 py-0.5 bg-white/10 rounded">Esc</kbd> Schließen</p>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-64 p-4 lg:p-8 pt-20 lg:pt-8">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-4 lg:space-y-6">
              {/* Header with Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h1 className="text-xl lg:text-2xl font-bold text-white">{t('admin.dashboard')}</h1>
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={() => setShowGlobalSearch(true)} 
                    variant="outline" 
                    className="border-white/10 text-white flex-1 sm:flex-none justify-start"
                    data-testid="global-search-btn"
                  >
                    <Search className="w-4 h-4 mr-2" />
                    <span className="text-gray-400 text-sm">Suchen...</span>
                    <kbd className="hidden sm:inline ml-2 px-1.5 py-0.5 text-xs bg-white/10 rounded">/</kbd>
                  </Button>
                  <Button onClick={fetchData} variant="outline" className="border-white/10 text-white px-3" data-testid="refresh-btn">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
              
              {/* Quick Actions Bar */}
              <AdminQuickActions onRefresh={fetchData} stats={stats} />
              
              {/* Live Widgets */}
              <AdminLiveWidgets stats={stats} detailedStats={detailedStats} />
              
              {/* Summary Stats Cards */}
              {stats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                  <div className="glass-card rounded-xl p-4 lg:p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-[#7C3AED]/20 flex items-center justify-center">
                        <Users className="w-5 h-5 lg:w-6 lg:h-6 text-[#7C3AED]" />
                      </div>
                      <div>
                        <p className="text-[#94A3B8] text-xs lg:text-sm">{t('admin.totalUsers')}</p>
                        <p className="text-xl lg:text-2xl font-bold text-white">{stats.total_users}</p>
                      </div>
                    </div>
                  </div>
                  <div className="glass-card rounded-xl p-4 lg:p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-[#06B6D4]/20 flex items-center justify-center">
                        <Gavel className="w-5 h-5 lg:w-6 lg:h-6 text-[#06B6D4]" />
                      </div>
                      <div>
                        <p className="text-[#94A3B8] text-xs lg:text-sm">{t('admin.activeAuctions')}</p>
                        <p className="text-xl lg:text-2xl font-bold text-white">{stats.active_auctions}</p>
                      </div>
                    </div>
                  </div>
                  <div className="glass-card rounded-xl p-4 lg:p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-[#10B981]/20 flex items-center justify-center">
                        <Package className="w-5 h-5 lg:w-6 lg:h-6 text-[#10B981]" />
                      </div>
                      <div>
                        <p className="text-[#94A3B8] text-xs lg:text-sm">{t('admin.totalProducts')}</p>
                        <p className="text-xl lg:text-2xl font-bold text-white">{stats.total_products}</p>
                      </div>
                    </div>
                  </div>
                  <div className="glass-card rounded-xl p-4 lg:p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-[#F59E0B]/20 flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 lg:w-6 lg:h-6 text-[#F59E0B]" />
                      </div>
                      <div>
                        <p className="text-[#94A3B8] text-xs lg:text-sm">{t('admin.transactions')}</p>
                        <p className="text-xl lg:text-2xl font-bold text-white">{stats.completed_transactions}</p>
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
            <AdminVouchers
              vouchers={vouchers}
              newVoucher={newVoucher}
              setNewVoucher={setNewVoucher}
              handleCreateVoucher={handleCreateVoucher}
              handleToggleVoucher={handleToggleVoucher}
              handleDeleteVoucher={handleDeleteVoucher}
              t={t}
              token={token}
              API={API}
              fetchVouchers={fetchData}
            />
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

          {/* Manager Tab */}
          {activeTab === 'managers' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white">
                  {language === 'en' ? 'Regional Managers' : 'Regionale Manager'}
                </h1>
                <Button 
                  onClick={() => setShowManagerModal(true)}
                  className="bg-[#7C3AED]"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  {language === 'en' ? 'New Manager' : 'Neuer Manager'}
                </Button>
              </div>
              
              <p className="text-[#94A3B8]">
                {language === 'en' 
                  ? 'Managers supervise influencers in their assigned cities and receive 15% of influencer commissions.'
                  : 'Manager verwalten Influencer in ihren zugewiesenen Städten und erhalten 15% der Influencer-Provisionen.'}
              </p>

              {/* Manager List */}
              <div className="bg-[#1A1A2E] rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="text-left text-[#94A3B8] py-3 px-4 text-sm">Name</th>
                      <th className="text-left text-[#94A3B8] py-3 px-4 text-sm">E-Mail</th>
                      <th className="text-left text-[#94A3B8] py-3 px-4 text-sm">{language === 'en' ? 'Cities' : 'Städte'}</th>
                      <th className="text-right text-[#94A3B8] py-3 px-4 text-sm">Influencer</th>
                      <th className="text-right text-[#94A3B8] py-3 px-4 text-sm">{language === 'en' ? 'Inf. Commission' : 'Inf. Provision'}</th>
                      <th className="text-right text-[#94A3B8] py-3 px-4 text-sm">{language === 'en' ? 'Manager 15%' : 'Manager 15%'}</th>
                      <th className="text-center text-[#94A3B8] py-3 px-4 text-sm">Status</th>
                      <th className="text-right text-[#94A3B8] py-3 px-4 text-sm">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {managers.map((mgr) => (
                      <tr key={mgr.id} className="border-t border-white/5 hover:bg-white/5">
                        <td className="py-3 px-4 text-white font-medium">{mgr.name}</td>
                        <td className="py-3 px-4 text-[#94A3B8]">{mgr.email}</td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {mgr.cities?.map((city) => (
                              <span key={city} className="px-2 py-0.5 bg-[#7C3AED]/20 text-[#7C3AED] rounded text-xs">
                                {city}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-white text-right">{mgr.influencer_count || 0}</td>
                        <td className="py-3 px-4 text-[#F59E0B] text-right">€{(mgr.total_influencer_commission || 0).toFixed(2)}</td>
                        <td className="py-3 px-4 text-[#10B981] text-right font-medium">€{(mgr.manager_commission || 0).toFixed(2)}</td>
                        <td className="py-3 px-4 text-center">
                          {mgr.is_active ? (
                            <span className="px-2 py-1 bg-[#10B981]/20 text-[#10B981] rounded text-xs">Aktiv</span>
                          ) : (
                            <span className="px-2 py-1 bg-red-500/20 text-red-500 rounded text-xs">Inaktiv</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setSelectedManager(mgr);
                                setShowManagerDetails(true);
                              }}
                              className="border-[#7C3AED]/30 text-[#7C3AED] hover:bg-[#7C3AED]/10"
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              Details
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={async () => {
                                try {
                                  await axios.delete(`${API}/manager/admin/${mgr.id}`, {
                                    headers: { Authorization: `Bearer ${token}` }
                                  });
                                  toast.success('Manager deaktiviert');
                                  fetchData();
                                } catch (err) {
                                  toast.error('Fehler');
                                }
                              }}
                              className="border-red-500/30 text-red-500 hover:bg-red-500/10"
                            >
                              <Ban className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {managers.length === 0 && (
                      <tr>
                        <td colSpan="8" className="py-8 text-center text-[#94A3B8]">
                          {language === 'en' ? 'No managers yet' : 'Noch keine Manager'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Create Manager Modal */}
              {showManagerModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowManagerModal(false)}>
                  <div className="bg-[#1A1A2E] rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                    <h2 className="text-xl font-bold text-white mb-4">
                      {language === 'en' ? 'Create Manager' : 'Manager erstellen'}
                    </h2>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        await axios.post(`${API}/manager/admin/create`, {
                          ...managerForm,
                          cities: managerForm.cities.split(',').map(c => c.trim()).filter(c => c)
                        }, {
                          headers: { Authorization: `Bearer ${token}` }
                        });
                        toast.success('Manager erstellt!');
                        setShowManagerModal(false);
                        setManagerForm({ name: '', email: '', password: '', cities: '', commission_percent: 15 });
                        fetchData();
                      } catch (err) {
                        toast.error(err.response?.data?.detail || 'Fehler');
                      }
                    }} className="space-y-4">
                      <div>
                        <Label className="text-[#94A3B8]">Name</Label>
                        <Input 
                          value={managerForm.name}
                          onChange={(e) => setManagerForm({...managerForm, name: e.target.value})}
                          className="bg-[#0D0D14] border-white/10 text-white"
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-[#94A3B8]">E-Mail</Label>
                        <Input 
                          type="email"
                          value={managerForm.email}
                          onChange={(e) => setManagerForm({...managerForm, email: e.target.value})}
                          className="bg-[#0D0D14] border-white/10 text-white"
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-[#94A3B8]">{language === 'en' ? 'Password' : 'Passwort'}</Label>
                        <Input 
                          type="password"
                          value={managerForm.password}
                          onChange={(e) => setManagerForm({...managerForm, password: e.target.value})}
                          className="bg-[#0D0D14] border-white/10 text-white"
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-[#94A3B8]">{language === 'en' ? 'Cities (comma separated)' : 'Städte (Komma getrennt)'}</Label>
                        <Input 
                          value={managerForm.cities}
                          onChange={(e) => setManagerForm({...managerForm, cities: e.target.value})}
                          className="bg-[#0D0D14] border-white/10 text-white"
                          placeholder="Berlin, Hamburg, München"
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-[#94A3B8]">{language === 'en' ? 'Commission %' : 'Provision %'}</Label>
                        <Input 
                          type="number"
                          value={managerForm.commission_percent}
                          onChange={(e) => setManagerForm({...managerForm, commission_percent: parseFloat(e.target.value)})}
                          className="bg-[#0D0D14] border-white/10 text-white"
                          min="0"
                          max="50"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={() => setShowManagerModal(false)} className="flex-1 border-white/10 text-white">
                          {language === 'en' ? 'Cancel' : 'Abbrechen'}
                        </Button>
                        <Button type="submit" className="flex-1 bg-[#7C3AED]">
                          {language === 'en' ? 'Create' : 'Erstellen'}
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Manager Details Modal */}
              {showManagerDetails && selectedManager && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                  <div className="bg-[#1A1A2E] rounded-xl border border-white/10 max-w-4xl w-full max-h-[90vh] overflow-hidden">
                    <div className="p-6 border-b border-white/10 flex justify-between items-center">
                      <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                          <Building2 className="w-5 h-5 text-[#7C3AED]" />
                          {selectedManager.name}
                        </h2>
                        <p className="text-[#94A3B8] text-sm">{selectedManager.email}</p>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setShowManagerDetails(false);
                          setSelectedManager(null);
                        }}
                        className="text-[#94A3B8] hover:text-white"
                      >
                        <X className="w-5 h-5" />
                      </Button>
                    </div>
                    
                    <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
                      {/* Manager Stats */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                        <div className="bg-[#0D0D14] rounded-lg p-3 text-center">
                          <Building2 className="w-5 h-5 text-[#7C3AED] mx-auto mb-1" />
                          <p className="text-xl font-bold text-white">{selectedManager.cities?.length || 0}</p>
                          <p className="text-[#94A3B8] text-[10px]">{language === 'en' ? 'Cities' : 'Städte'}</p>
                        </div>
                        <div className="bg-[#0D0D14] rounded-lg p-3 text-center">
                          <Users className="w-5 h-5 text-[#F59E0B] mx-auto mb-1" />
                          <p className="text-xl font-bold text-white">{selectedManager.influencer_count || managerInfluencers.length}</p>
                          <p className="text-[#94A3B8] text-[10px]">Influencer</p>
                        </div>
                        <div className="bg-[#0D0D14] rounded-lg p-3 text-center">
                          <DollarSign className="w-5 h-5 text-[#10B981] mx-auto mb-1" />
                          <p className="text-lg font-bold text-[#10B981]">€{(selectedManager.total_influencer_commission || 0).toFixed(2)}</p>
                          <p className="text-[#94A3B8] text-[10px]">{language === 'en' ? 'Inf. Commission' : 'Inf. Provision'}</p>
                        </div>
                        <div className="bg-[#0D0D14] rounded-lg p-3 text-center">
                          <Crown className="w-5 h-5 text-[#7C3AED] mx-auto mb-1" />
                          <p className="text-lg font-bold text-[#7C3AED]">€{(selectedManager.manager_commission || 0).toFixed(2)}</p>
                          <p className="text-[#94A3B8] text-[10px]">{language === 'en' ? 'Manager 15%' : 'Manager 15%'}</p>
                        </div>
                      </div>

                      {/* Cities */}
                      <div className="mb-6">
                        <h3 className="text-white font-medium mb-2">{language === 'en' ? 'Managed Cities' : 'Verwaltete Städte'}</h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedManager.cities?.map((city) => (
                            <span key={city} className="px-3 py-1 bg-[#7C3AED]/20 text-[#7C3AED] rounded-full text-sm">
                              {city}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Influencer List */}
                      <div>
                        <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                          <Users className="w-4 h-4 text-[#F59E0B]" />
                          {language === 'en' ? 'Managed Influencers' : 'Verwaltete Influencer'}
                        </h3>
                        
                        {loadingManagerDetails ? (
                          <div className="text-center py-8 text-[#94A3B8]">Laden...</div>
                        ) : managerInfluencers.length === 0 ? (
                          <div className="text-center py-8 bg-[#0D0D14] rounded-lg">
                            <Users className="w-12 h-12 text-[#94A3B8] mx-auto mb-2 opacity-50" />
                            <p className="text-[#94A3B8]">{language === 'en' ? 'No influencers yet' : 'Noch keine Influencer'}</p>
                          </div>
                        ) : (
                          <div className="bg-[#0D0D14] rounded-lg overflow-hidden">
                            <table className="w-full">
                              <thead className="bg-white/5">
                                <tr>
                                  <th className="text-left text-[#94A3B8] py-2 px-3 text-xs">Name</th>
                                  <th className="text-left text-[#94A3B8] py-2 px-3 text-xs">Code</th>
                                  <th className="text-left text-[#94A3B8] py-2 px-3 text-xs">{language === 'en' ? 'City' : 'Stadt'}</th>
                                  <th className="text-right text-[#94A3B8] py-2 px-3 text-xs">{language === 'en' ? 'Signups' : 'Anmeldungen'}</th>
                                  <th className="text-right text-[#94A3B8] py-2 px-3 text-xs">{language === 'en' ? 'Commission' : 'Provision'}</th>
                                  <th className="text-center text-[#94A3B8] py-2 px-3 text-xs">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {managerInfluencers.map((inf) => (
                                  <tr key={inf.id} className="border-t border-white/5 hover:bg-white/5">
                                    <td className="py-2 px-3 text-white text-sm">{inf.name || inf.username}</td>
                                    <td className="py-2 px-3">
                                      <span className="px-2 py-0.5 bg-[#F59E0B]/20 text-[#F59E0B] rounded text-xs font-mono">
                                        {inf.code}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-[#94A3B8] text-sm">{inf.city || '-'}</td>
                                    <td className="py-2 px-3 text-white text-right text-sm">{inf.signups || inf.total_signups || 0}</td>
                                    <td className="py-2 px-3 text-[#10B981] text-right text-sm font-medium">
                                      €{(inf.total_earnings || inf.commission || 0).toFixed(2)}
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                      {inf.is_active !== false ? (
                                        <span className="px-2 py-0.5 bg-[#10B981]/20 text-[#10B981] rounded text-xs">Aktiv</span>
                                      ) : (
                                        <span className="px-2 py-0.5 bg-red-500/20 text-red-500 rounded text-xs">Inaktiv</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot className="bg-white/5">
                                <tr>
                                  <td colSpan="3" className="py-2 px-3 text-[#94A3B8] text-sm font-medium">Gesamt</td>
                                  <td className="py-2 px-3 text-white text-right text-sm font-bold">
                                    {managerInfluencers.reduce((sum, inf) => sum + (inf.signups || inf.total_signups || 0), 0)}
                                  </td>
                                  <td className="py-2 px-3 text-[#10B981] text-right text-sm font-bold">
                                    €{managerInfluencers.reduce((sum, inf) => sum + (inf.total_earnings || inf.commission || 0), 0).toFixed(2)}
                                  </td>
                                  <td></td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Credentials Info */}
                      <div className="mt-6 p-4 bg-[#7C3AED]/10 rounded-lg border border-[#7C3AED]/20">
                        <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-[#7C3AED]" />
                          {language === 'en' ? 'Login Credentials' : 'Zugangsdaten'}
                        </h4>
                        <div className="space-y-1 text-sm">
                          <p className="text-[#94A3B8]">
                            <span className="text-white">E-Mail:</span> {selectedManager.email}
                          </p>
                          <p className="text-[#94A3B8]">
                            <span className="text-white">Dashboard:</span> /manager-dashboard
                          </p>
                        </div>
                      </div>

                      {/* Activity Log */}
                      <div className="mt-6">
                        <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[#F59E0B]" />
                          {language === 'en' ? 'Activity Log' : 'Aktivitäts-Protokoll'}
                        </h3>
                        {managerActivities.length === 0 ? (
                          <div className="bg-[#0D0D14] rounded-lg p-4 text-center">
                            <Clock className="w-8 h-8 text-[#94A3B8] mx-auto mb-2 opacity-50" />
                            <p className="text-[#94A3B8] text-sm">{language === 'en' ? 'No activities yet' : 'Noch keine Aktivitäten'}</p>
                          </div>
                        ) : (
                          <div className="bg-[#0D0D14] rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                            {managerActivities.map((activity, i) => (
                              <div key={activity.id || i} className="flex items-start gap-3 p-3 border-b border-white/5 last:border-0">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                  activity.action === 'login' ? 'bg-[#10B981]/20' :
                                  activity.action === 'influencer_approved' ? 'bg-[#7C3AED]/20' :
                                  activity.action === 'influencer_blocked' ? 'bg-red-500/20' :
                                  'bg-[#F59E0B]/20'
                                }`}>
                                  {activity.action === 'login' ? <Users className="w-4 h-4 text-[#10B981]" /> :
                                   activity.action === 'influencer_approved' ? <Check className="w-4 h-4 text-[#7C3AED]" /> :
                                   activity.action === 'influencer_blocked' ? <Ban className="w-4 h-4 text-red-500" /> :
                                   <Clock className="w-4 h-4 text-[#F59E0B]" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-white text-sm">{activity.description}</p>
                                  <p className="text-[#94A3B8] text-xs">
                                    {new Date(activity.created_at).toLocaleString('de-DE')}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
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

          {/* Jackpot Tab */}
          {activeTab === 'jackpot' && (
            <div className="space-y-6">
              <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <Trophy className="w-6 h-6 text-[#FFD700]" />
                Jackpot Verwaltung
              </h1>

              {/* Current Jackpot */}
              <div className="glass-card rounded-xl p-4 sm:p-6 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-yellow-500/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#94A3B8] text-sm">Aktueller Jackpot</p>
                    <p className="text-3xl sm:text-4xl font-black text-[#FFD700]">
                      {jackpotData?.current_amount?.toLocaleString('de-DE') || 0} Gebote
                    </p>
                    <p className="text-white text-lg mt-1">
                      Wert: €{((jackpotData?.current_amount || 0) * 0.50).toFixed(2)}
                    </p>
                  </div>
                  <Trophy className="w-12 h-12 sm:w-16 sm:h-16 text-[#FFD700] opacity-50" />
                </div>
              </div>

              {/* Jackpot On/Off Toggle */}
              <div className="glass-card rounded-xl p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-bold">Jackpot Status</h3>
                    <p className="text-[#94A3B8] text-sm">
                      {jackpotData?.is_active !== false ? 'Jackpot ist aktiv und wird bei Geboten erhöht' : 'Jackpot ist deaktiviert'}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      const newStatus = jackpotData?.is_active === false;
                      try {
                        await axios.post(`${API}/excitement/global-jackpot/toggle`, 
                          { is_active: newStatus },
                          { headers: { Authorization: `Bearer ${token}` } }
                        );
                        toast.success(newStatus ? 'Jackpot aktiviert!' : 'Jackpot deaktiviert!');
                        fetchData();
                      } catch (err) {
                        toast.error('Fehler beim Umschalten');
                      }
                    }}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                      jackpotData?.is_active !== false ? 'bg-[#10B981]' : 'bg-[#374151]'
                    }`}
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                        jackpotData?.is_active !== false ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Jackpot Controls */}
              <div className="glass-card rounded-xl p-4 sm:p-6">
                <h3 className="text-white font-bold mb-4">Jackpot anpassen</h3>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                  <div className="flex-1">
                    <Label className="text-[#94A3B8]">Neuer Jackpot-Betrag (Gebote)</Label>
                    <Input
                      type="number"
                      value={jackpotAmount}
                      onChange={(e) => setJackpotAmount(parseInt(e.target.value) || 0)}
                      className="bg-[#181824] border-white/10 text-white text-lg"
                      min={0}
                    />
                  </div>
                  <Button
                    onClick={async () => {
                      try {
                        await axios.post(`${API}/excitement/global-jackpot/set`, 
                          { amount: jackpotAmount },
                          { headers: { Authorization: `Bearer ${token}` } }
                        );
                        toast.success(`Jackpot auf ${jackpotAmount} Gebote gesetzt!`);
                        fetchData();
                      } catch (err) {
                        toast.error('Fehler beim Setzen');
                      }
                    }}
                    className="bg-[#FFD700] text-black hover:bg-[#FFD700]/80 h-10"
                  >
                    <Save className="w-4 h-4 mr-1" />
                    Setzen
                  </Button>
                </div>
                <p className="text-[#94A3B8] text-xs mt-2">
                  Aktuell: {jackpotData?.current_amount || 0} Gebote = €{((jackpotData?.current_amount || 0) * 0.50).toFixed(2)}
                </p>
              </div>

              {/* Award Jackpot */}
              <div className="glass-card rounded-xl p-4 sm:p-6">
                <h3 className="text-white font-bold mb-4">🏆 Jackpot vergeben</h3>
                <div className="space-y-3">
                  <div>
                    <Label className="text-[#94A3B8]">Benutzer auswählen ({users.length} verfügbar)</Label>
                    <Select onValueChange={async (userId) => {
                      if (!userId) return;
                      if (!window.confirm(`Jackpot von ${jackpotData?.current_amount || 0} Geboten wirklich vergeben?`)) return;
                      try {
                        const res = await axios.post(
                          `${API}/excitement/global-jackpot/award/${userId}`,
                          {},
                          { headers: { Authorization: `Bearer ${token}` } }
                        );
                        toast.success(`🏆 ${res.data.winner} hat ${res.data.amount} Gebote gewonnen!`);
                        fetchData();
                      } catch (err) {
                        toast.error(err.response?.data?.detail || 'Fehler');
                      }
                    }}>
                      <SelectTrigger className="bg-[#181824] border-white/10 text-white">
                        <SelectValue placeholder="Benutzer wählen zum Vergeben..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#181824] border-white/10 max-h-60">
                        {users.length === 0 ? (
                          <SelectItem value="none" disabled className="text-[#94A3B8]">
                            Keine Benutzer geladen
                          </SelectItem>
                        ) : (
                          users.map((user) => (
                            <SelectItem key={user.id} value={user.id} className="text-white">
                              {user.name} ({user.email})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-[#F59E0B] text-sm mt-3 p-2 bg-[#F59E0B]/10 rounded">
                  ⚠️ Der ausgewählte Benutzer erhält sofort <strong>{jackpotData?.current_amount || 0} Gebote</strong> (€{((jackpotData?.current_amount || 0) * 0.50).toFixed(2)})
                </p>
              </div>

              {/* Jackpot History */}
              <div className="glass-card rounded-xl p-6">
                <h3 className="text-white font-bold mb-4">Jackpot-Gewinner Historie</h3>
                {jackpotHistory.length === 0 ? (
                  <p className="text-[#94A3B8] text-center py-4">Noch keine Jackpot-Gewinner</p>
                ) : (
                  <div className="space-y-2">
                    {jackpotHistory.map((winner, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-[#181824] rounded-lg">
                        <div className="flex items-center gap-3">
                          <Trophy className="w-5 h-5 text-[#FFD700]" />
                          <div>
                            <p className="text-white font-medium">{winner.user_name}</p>
                            <p className="text-[#94A3B8] text-xs">
                              {new Date(winner.won_at).toLocaleString('de-DE')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[#FFD700] font-bold">{winner.amount} Gebote</p>
                          <p className="text-[#94A3B8] text-xs">€{(winner.amount * 0.50).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Last Winner Info */}
              {jackpotData?.last_winner && jackpotData?.last_won_amount && (
                <div className="glass-card rounded-xl p-6 border border-[#FFD700]/30">
                  <h3 className="text-white font-bold mb-2">Letzter Gewinner</h3>
                  <div className="flex items-center gap-4">
                    <Trophy className="w-10 h-10 text-[#FFD700]" />
                    <div>
                      <p className="text-xl font-bold text-white">{jackpotData.last_winner}</p>
                      <p className="text-[#94A3B8]">
                        Gewonnen: {jackpotData.last_won_amount || 0} Gebote (€{((jackpotData.last_won_amount || 0) * 0.50).toFixed(2)})
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
      
      {/* Global Search Modal */}
      <AdminGlobalSearch 
        isOpen={showGlobalSearch} 
        onClose={() => setShowGlobalSearch(false)}
        onNavigate={(type, item) => {
          // Navigate to the appropriate tab when selecting a search result
          if (type === 'users') setActiveTab('users');
          else if (type === 'auctions') setActiveTab('auctions');
          else if (type === 'products') setActiveTab('products');
        }}
      />
      
      {/* AI Chat Assistant */}
      <AdminAIChat 
        isOpen={showAIChat} 
        onClose={() => setShowAIChat(false)}
        onToggle={() => setShowAIChat(prev => !prev)}
      />
    </div>
  );
}
