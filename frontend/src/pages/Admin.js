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
  Ban, CheckCircle, Check, DollarSign, Globe, Ticket, Edit, Edit2, X, Save,
  Bot, Play, Target, Calendar, Clock, TrendingUp, Activity, Menu,
  Mail, Send, Eye, Star, Crown, FileText, RotateCcw, Repeat,
  Gift, Trophy, Moon, Wifi, WifiOff, Building2, Percent, CreditCard,
  Mic, Command, Search, Bug, Wrench, Leaf
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
  AdminRestaurantVouchers,
  AdminRestaurantApplications,
  AdminRestaurantAuctions,
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
  AdminDebugReports,
  AdminQuickActions,
  AdminLiveWidgets,
  AdminGlobalSearch,
  AdminAIChat,
  AdminAnalytics,
  AdminStaff,
  AdminSurveys,
  AdminMaintenance,
  AdminMobileNav
} from '../components/admin';

// Import Winner Control
import AdminWinnerControl from '../components/admin/AdminWinnerControl';

// Import Weekly Challenges
import AdminWeeklyChallenges from '../components/admin/AdminWeeklyChallenges';

// Import Coupons
import AdminCoupons from '../components/admin/AdminCoupons';

// Import Sustainability
import AdminSustainability from '../components/admin/AdminSustainability';

// Import Mystery Box
import AdminMysteryBox from '../components/admin/AdminMysteryBox';

// Import Voice Debug Assistant
import VoiceDebugAssistant from '../components/VoiceDebugAssistant';

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
  
  // Voice Debug Assistant state
  const [showVoiceDebug, setShowVoiceDebug] = useState(false);

  // Manager states
  const [managers, setManagers] = useState([]);
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [showManagerDetails, setShowManagerDetails] = useState(false);
  const [showEditManagerModal, setShowEditManagerModal] = useState(false);
  const [selectedManager, setSelectedManager] = useState(null);
  const [managerInfluencers, setManagerInfluencers] = useState([]);
  const [managerActivities, setManagerActivities] = useState([]);
  const [loadingManagerDetails, setLoadingManagerDetails] = useState(false);
  const [managerForm, setManagerForm] = useState({
    name: '',
    email: '',
    password: '',
    cities: '',
    commission_percent: 15,
    company_commission_percent: 5
  });
  const [editManagerForm, setEditManagerForm] = useState({
    name: '',
    cities: '',
    commission_percent: 15,
    company_commission_percent: 5,
    is_active: true
  });

  // Jackpot states
  const [jackpotData, setJackpotData] = useState(null);
  const [jackpotHistory, setJackpotHistory] = useState([]);
  const [jackpotAmount, setJackpotAmount] = useState(500);
  
  // Happy Hour & Lucky Bid states
  const [happyHourConfig, setHappyHourConfig] = useState(null);
  const [luckyConfig, setLuckyConfig] = useState(null);

  // Promo Codes states
  const [promoCodes, setPromoCodes] = useState([]);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoForm, setPromoForm] = useState({
    code: '',
    name: '',
    reward_type: 'bids',
    reward_amount: 10,
    max_uses: null,
    valid_until: '',
    one_per_user: true  // Default: Jeder Kunde kann nur 1x einlösen
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
        const [jpRes, histRes, usersRes, happyHourRes, luckyRes] = await Promise.all([
          axios.get(`${API}/excitement/global-jackpot`),
          axios.get(`${API}/excitement/global-jackpot/history`),
          axios.get(`${API}/admin/users`, { headers }),
          axios.get(`${API}/gamification/happy-hour`).catch(() => ({ data: { config: {} } })),
          axios.get(`${API}/excitement/lucky-bid/status`).catch(() => ({ data: {} }))
        ]);
        setJackpotData(jpRes.data);
        setJackpotAmount(jpRes.data.current_amount || 500);
        setJackpotHistory(histRes.data.winners || []);
        setUsers(usersRes.data);
        setHappyHourConfig(happyHourRes.data.config || happyHourRes.data);
        setLuckyConfig(luckyRes.data);
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
      toast.success(at('settingsSaved'));
    } catch (error) {
      toast.error(at('errorSavingSettings'));
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
      toast.success(at('productCreated'));
      setNewProduct({ name: '', description: '', image_url: '', retail_price: '', category: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || at('error'));
    }
  };

  const handleUpdateProduct = async (productId) => {
    try {
      await axios.put(`${API}/admin/products/${productId}`, editingProduct, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(at('productUpdated'));
      setEditingProduct(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || at('error'));
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!confirm(at('confirmDeleteProduct'))) return;
    try {
      await axios.delete(`${API}/admin/products/${productId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(at('productDeleted'));
      fetchData();
    } catch (error) {
      toast.error(at('errorDeleting'));
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
      toast.success(at('auctionCreated'));
      
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
          toast.success(at('autoRestartEnabled'));
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
          toast.success(`${at('botsWillBidTo')} €${newAuction.bot_target_price}`);
        } catch (botError) {
          toast.error(at('botBidFailed'));
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
      toast.error(error.response?.data?.detail || at('error'));
    }
  };

  const handleExtendAuction = async (auctionId) => {
    const seconds = prompt(at('promptExtendTime'), '300');
    if (!seconds) return;
    try {
      await axios.put(`${API}/admin/auctions/${auctionId}`, {
        duration_seconds: parseInt(seconds)
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(at('auctionExtended'));
      fetchData();
    } catch (error) {
      toast.error(at('error'));
    }
  };

  const handleEndAuction = async (auctionId) => {
    try {
      await axios.post(`${API}/admin/auctions/${auctionId}/end`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(at('auctionEnded'));
      fetchData();
    } catch (error) {
      toast.error(at('error'));
    }
  };

  const handleRestartAuction = async (auctionId) => {
    const duration = prompt(at('promptDurationMinutes'), '10');
    if (!duration) return;
    
    const botPrice = prompt(at('promptBotTargetDesc'), '');
    
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
        toast.success(`${at('auctionRestarted')} Bots: ${response.data.bot_bidding.bids_placed} Gebote`);
      } else {
        toast.success(at('auctionRestarted'));
      }
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || at('errorRestarting'));
    }
  };

  const handleDeleteAuction = async (auctionId) => {
    if (!confirm(at('confirmDeleteAuction'))) return;
    try {
      await axios.delete(`${API}/admin/auctions/${auctionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(at('auctionDeleted'));
      fetchData();
    } catch (error) {
      toast.error(at('error'));
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
      toast.error(error.response?.data?.detail || at('error'));
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
      toast.success(currentFeatured ? at('vipStatusRemoved') : at('markedAsVip'));
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || at('error'));
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
      toast.success(isVipOnly ? at('vipOnlyRemoved') : at('markedAsVipOnly'));
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || at('error'));
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
      toast.success(at('setAsAotd'));
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || at('error'));
    }
  };

  // ==================== INFLUENCER HANDLERS ====================
  
  const handleCreateInfluencer = async () => {
    try {
      await axios.post(`${API}/influencer/admin/create`, influencerForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(at('influencerCreated'));
      setShowInfluencerModal(false);
      setInfluencerForm({ name: '', code: '', commission_percent: 10, email: '', instagram: '', youtube: '', tiktok: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || at('errorCreatingInfluencer'));
    }
  };

  const handleDeleteInfluencer = async (influencerId) => {
    if (!window.confirm(at('confirmDeleteInfluencer'))) return;
    try {
      await axios.delete(`${API}/influencer/admin/${influencerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(at('influencerDeleted'));
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || at('error'));
    }
  };

  const handleToggleInfluencer = async (influencerId, currentStatus) => {
    try {
      await axios.put(`${API}/influencer/admin/${influencerId}`, 
        { is_active: !currentStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(currentStatus ? at('influencerDeactivated') : at('influencerActivated'));
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || at('error'));
    }
  };

  // Wholesale/B2B handlers
  const handleApproveWholesale = async (applicationId) => {
    try {
      await axios.post(`${API}/admin/wholesale/approve/${applicationId}`, wholesaleForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(at('wholesaleApproved'));
      setShowWholesaleModal(false);
      setSelectedWholesale(null);
      setWholesaleForm({ discount_percent: 10, credit_limit: 0, payment_terms: 'prepaid', notes: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || at('errorApproving'));
    }
  };

  const handleRejectWholesale = async (applicationId) => {
    if (!window.confirm(at('confirmRejectApplication'))) return;
    try {
      await axios.post(`${API}/admin/wholesale/reject/${applicationId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(at('wholesaleRejected'));
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || at('error'));
    }
  };

  const handleUpdateWholesale = async (wholesaleId) => {
    try {
      await axios.put(`${API}/admin/wholesale/${wholesaleId}`, wholesaleForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(at('wholesaleUpdated'));
      setShowWholesaleModal(false);
      setSelectedWholesale(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || at('error'));
    }
  };

  const handleDeleteWholesale = async (wholesaleId) => {
    if (!window.confirm(at('confirmRemoveWholesale'))) return;
    try {
      await axios.delete(`${API}/admin/wholesale/${wholesaleId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(at('wholesaleRemoved'));
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || at('error'));
    }
  };

  // User handlers
  const handleToggleAdmin = async (userId) => {
    try {
      await axios.put(`${API}/admin/users/${userId}/toggle-admin`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(at('adminStatusChanged'));
      fetchData();
    } catch (error) {
      toast.error(at('error'));
    }
  };

  const handleToggleBlock = async (userId, currentStatus) => {
    try {
      await axios.put(`${API}/admin/users/${userId}/block`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(currentStatus ? at('userUnblocked') : at('userBlocked'));
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || at('error'));
    }
  };

  const handleToggleGuaranteedWinner = async (userId, currentStatus) => {
    try {
      await axios.put(`${API}/admin/users/${userId}/guaranteed-winner`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(currentStatus ? at('guaranteedWinnerDisabled') : at('guaranteedWinnerEnabled'));
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || at('error'));
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
      toast.error(error.response?.data?.detail || at('error'));
    }
  };

  const handleAddBids = async (userId) => {
    const amount = prompt(at('enterBidsAmount'), '10');
    if (!amount) return;
    try {
      await axios.put(`${API}/admin/users/${userId}/add-bids?bids=${amount}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`${amount} ${at('bidsAdded')}`);
      fetchData();
    } catch (error) {
      toast.error(at('error'));
    }
  };

  const handleUpdateUser = async (userId) => {
    try {
      await axios.put(`${API}/admin/users/${userId}`, editingUser, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(at('userUpdated'));
      setEditingUser(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || at('error'));
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
      toast.success(at('voucherCreated'));
      setNewVoucher({ code: '', type: 'bids', value: '10', max_uses: '1' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || at('error'));
    }
  };

  const handleToggleVoucher = async (voucherId) => {
    try {
      await axios.put(`${API}/admin/vouchers/${voucherId}/toggle`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(at('voucherStatusChanged'));
      fetchData();
    } catch (error) {
      toast.error(at('error'));
    }
  };

  const handleDeleteVoucher = async (voucherId) => {
    if (!confirm(at('confirmDeleteVoucher'))) return;
    try {
      await axios.delete(`${API}/admin/vouchers/${voucherId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(at('voucherDeleted'));
      fetchData();
    } catch (error) {
      toast.error(at('error'));
    }
  };

  // Bot handlers
  const handleCreateBot = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/admin/bots`, newBot, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(at('botCreated'));
      setNewBot({ name: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || at('error'));
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
      toast.error(at('error'));
    }
  };

  const handleDeleteBot = async (botId) => {
    if (!confirm(at('confirmDeleteBot'))) return;
    try {
      await axios.delete(`${API}/admin/bots/${botId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(at('botDeleted'));
      fetchData();
    } catch (error) {
      toast.error(at('error'));
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
      toast.success(at('testDataCreated'));
      fetchData();
    } catch (error) {
      toast.error(at('error'));
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
      toast.success(at('pageSaved'));
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || at('errorSavingPage'));
    }
  };

  const handleResetPage = async () => {
    if (!selectedPage) return;
    if (!confirm(`${at('confirmResetPage')} "${selectedPage.title}"?`)) return;
    try {
      await axios.post(`${API}/admin/pages/${selectedPage.page_id}/reset`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(at('pageReset'));
      setSelectedPage(null);
      setPageContent('');
      setPageTitle('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || at('errorResettingPage'));
    }
  };

  // Auto-restart auction handler
  const handleSetAutoRestart = async (auctionId, currentAutoRestart) => {
    const duration = prompt(at('promptAutoRestartDuration'), currentAutoRestart || '10');
    if (duration === null) return;
    
    const botPrice = prompt(at('promptBotTargetAutoRestart'), '');
    
    try {
      await axios.put(
        `${API}/admin/auctions/${auctionId}/auto-restart?duration_minutes=${parseInt(duration) || 0}&bot_target_price=${parseFloat(botPrice) || 0}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(parseInt(duration) > 0 ? `${at('autoRestartEnabled')} (${duration} Min)` : at('autoRestartEnabled'));
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || at('error'));
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
          <h2 className="text-2xl font-bold text-gray-800 mb-4">{t('admin.noAccess')}</h2>
          <p className="text-gray-500 mb-4">{t('admin.needAdmin')}</p>
          <Link to="/"><Button className="btn-primary">{t('admin.toHome')}</Button></Link>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'dashboard', label: at('dashboard'), icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'maintenance', label: language === 'en' ? 'Maintenance' : 'Wartung', icon: <Wrench className="w-5 h-5" />, highlight: true },
    { id: 'voice', label: language === 'en' ? 'Voice Commands' : 'Sprachbefehle', icon: <Mic className="w-5 h-5" />, highlight: true },
    { id: 'debug-reports', label: language === 'en' ? 'Debug Reports' : 'Debug Reports', icon: <Bug className="w-5 h-5" />, highlight: true },
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
    { id: 'restaurant-vouchers', label: '🍽️ Restaurant-Gutscheine', icon: <Ticket className="w-5 h-5" />, highlight: true },
    { id: 'restaurant-auctions', label: '🎯 Gutschein-Auktionen', icon: <Gavel className="w-5 h-5" />, highlight: true },
    { id: 'restaurant-applications', label: '📋 Partner-Bewerbungen', icon: <Building2 className="w-5 h-5" />, highlight: true },
    { id: 'bots', label: at('bots'), icon: <Bot className="w-5 h-5" /> },
    { id: 'email', label: at('email'), icon: <Mail className="w-5 h-5" /> },
    { id: 'pages', label: at('pages'), icon: <FileText className="w-5 h-5" /> },
    { id: 'payments', label: language === 'en' ? 'Payments' : 'Zahlungen', icon: <DollarSign className="w-5 h-5" /> },
    { id: 'analytics', label: language === 'en' ? 'Analytics' : 'Analytics', icon: <BarChart3 className="w-5 h-5" />, highlight: true },
    { id: 'surveys', label: language === 'en' ? 'Surveys' : 'Umfragen', icon: <Star className="w-5 h-5" />, highlight: true },
    { id: 'logs', label: language === 'en' ? 'System Logs' : 'Systemlogs', icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'jackpot', label: '🏆 Jackpot', icon: <Trophy className="w-5 h-5" />, highlight: true },
    { id: 'winner-control', label: '🎯 Gewinner', icon: <Target className="w-5 h-5" />, highlight: true },
    { id: 'weekly-challenges', label: '🏅 Challenges', icon: <Trophy className="w-5 h-5" />, highlight: true },
    { id: 'coupons', label: '🎟️ Gutscheine', icon: <Ticket className="w-5 h-5" />, highlight: true },
    { id: 'mystery-box', label: '🎁 Mystery Box', icon: <Gift className="w-5 h-5" />, highlight: true },
    { id: 'sustainability', label: '🌿 Nachhaltigkeit', icon: <Leaf className="w-5 h-5" />, highlight: true },
    { id: 'promo-codes', label: '🎫 Gutschein-Codes', icon: <Gift className="w-5 h-5" />, highlight: true },
    { id: 'game-config', label: at('gameSettings'), icon: <Settings className="w-5 h-5" /> }
  ];

  return (
    <div className="min-h-screen pt-36 lg:pt-0" data-testid="admin-page">
      {/* Mobile/Tablet Tab Bar - visible on screens smaller than lg (1024px) */}
      <div className="lg:hidden fixed top-28 left-0 right-0 z-40 bg-gradient-to-b from-cyan-50 to-cyan-100 border-b border-gray-200 shadow-md safe-area-inset">
        <div className="flex items-center justify-between px-3 py-2">
          <h2 className="text-sm sm:text-base font-bold text-gray-800 flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#7C3AED]" />
            <span className="hidden xs:inline">Admin Panel</span>
            <span className="xs:hidden">Admin</span>
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 hidden sm:inline">
              {tabs.find(t => t.id === activeTab)?.label}
            </span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-gray-800 border-gray-300 px-2 py-1"
              data-testid="admin-mobile-menu-btn"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              <span className="ml-1 text-xs hidden xs:inline">Menü</span>
            </Button>
          </div>
        </div>
        
        {/* Mobile/Tablet Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="px-2 pb-3 bg-gradient-to-b from-cyan-50 to-cyan-100 border-b border-gray-200 max-h-[70vh] overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 py-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all ${
                    activeTab === tab.id
                      ? 'bg-[#7C3AED] text-white shadow-lg scale-105'
                      : 'bg-white text-gray-600 hover:bg-gray-50 shadow-sm'
                  }`}
                >
                  <span className={activeTab === tab.id ? 'text-white' : 'text-gray-500'}>
                    {tab.icon}
                  </span>
                  <span className="text-[9px] xs:text-[10px] font-medium text-center leading-tight line-clamp-2">
                    {tab.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex">
        {/* Desktop Sidebar - visible on lg (1024px) and up */}
        <aside className="hidden lg:block w-56 lg:w-64 min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 border-r border-gray-200 fixed left-0 top-16 pt-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 64px)', WebkitOverflowScrolling: 'touch' }}>
          <div className="px-3 lg:px-4 mb-6">
            <h2 className="text-base lg:text-lg font-bold text-gray-800 flex items-center gap-2">
              <Settings className="w-4 h-4 lg:w-5 lg:h-5 text-[#7C3AED]" />
              {t('admin.panel')}
            </h2>
          </div>
          <nav className="space-y-1 px-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-2 lg:py-3 rounded-lg transition-colors text-sm lg:text-base ${
                  activeTab === tab.id
                    ? 'bg-[#7C3AED]/20 text-[#7C3AED]'
                    : 'text-gray-500 hover:bg-white/5 hover:text-gray-800'
                }`}
                data-testid={`tab-${tab.id}`}
              >
                <span className="flex-shrink-0">{tab.icon}</span>
                <span className="truncate">{tab.label}</span>
              </button>
            ))}
          </nav>
          <div className="px-3 lg:px-4 mt-8 space-y-3">
            <Button onClick={handleSeedData} variant="outline" className="w-full border-gray-200 text-gray-800 hover:bg-white/10">
              <Plus className="w-4 h-4 mr-2" />{t('admin.seedData')}
            </Button>
            
            {/* Keyboard Shortcuts Hint */}
            <div className="text-xs text-gray-500 space-y-1 pt-2 border-t border-white/5">
              <p className="font-medium text-gray-500">Tastenkürzel:</p>
              <p><kbd className="px-1 py-0.5 bg-white/10 rounded">/</kbd> Suche</p>
              <p><kbd className="px-1 py-0.5 bg-white/10 rounded">Ctrl</kbd>+<kbd className="px-1 py-0.5 bg-white/10 rounded">J</kbd> KI-Chat</p>
              <p><kbd className="px-1 py-0.5 bg-white/10 rounded">Esc</kbd> Schließen</p>
            </div>
          </div>
        </aside>

        {/* Main Content - adjusted for desktop sidebar */}
        <main className="flex-1 lg:ml-56 xl:ml-64 p-4 lg:p-8 pt-20 lg:pt-8" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <AdminDashboard 
              stats={stats}
              detailedStats={detailedStats}
              loading={loading}
              fetchData={fetchData}
              setShowGlobalSearch={setShowGlobalSearch}
              t={t}
            />
          )}

          {/* Voice Commands Tab */}
          {activeTab === 'voice' && (
            <AdminVoiceCommand />
          )}

          {/* Debug Reports Tab */}
          {activeTab === 'debug-reports' && (
            <AdminDebugReports token={token} />
          )}

          {/* Products Tab */}
          {activeTab === 'products' && (
            <AdminProducts 
              products={products}
              newProduct={newProduct}
              setNewProduct={setNewProduct}
              editingProduct={editingProduct}
              setEditingProduct={setEditingProduct}
              handleCreateProduct={handleCreateProduct}
              handleUpdateProduct={handleUpdateProduct}
              handleDeleteProduct={handleDeleteProduct}
              t={t}
            />
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
            <AdminUsers 
              users={users}
              editingUser={editingUser}
              setEditingUser={setEditingUser}
              handleUpdateUser={handleUpdateUser}
              handleToggleBlock={handleToggleBlock}
              handleToggleVIP={handleToggleVIP}
              handleToggleGuaranteedWinner={handleToggleGuaranteedWinner}
              handleAddBids={handleAddBids}
              t={t}
            />
          )}

          {/* Staff Tab */}
          {activeTab === 'staff' && (
            <AdminStaff
              token={token}
              staff={staff}
              roles={roles}
              permissions={permissions}
              fetchData={fetchData}
            />
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

          {/* Restaurant Vouchers Tab */}
          {activeTab === 'restaurant-vouchers' && (
            <AdminRestaurantVouchers
              token={token}
              API={API}
            />
          )}

          {/* Restaurant Voucher Auctions Tab */}
          {activeTab === 'restaurant-auctions' && (
            <AdminRestaurantAuctions
              token={token}
              API={API}
            />
          )}

          {/* Restaurant Partner Applications Tab */}
          {activeTab === 'restaurant-applications' && (
            <AdminRestaurantApplications />
          )}

          {/* Bots Tab */}
          {activeTab === 'bots' && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                  <Bot className="w-8 h-8 text-[#7C3AED]" />
                  Bot-System (Preis erhöhen)
                </h1>
                <Button onClick={handleSeedBots} variant="outline" className="border-[#7C3AED]/50 text-[#7C3AED] hover:bg-[#7C3AED]/10">
                  <Plus className="w-4 h-4 mr-2" />20 Standard-Bots erstellen
                </Button>
              </div>

              {/* Quick Bot Actions */}
              <div className="glass-card rounded-xl p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-[#06B6D4]" />
                  Preis automatisch erhöhen
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-800">Auktion wählen</Label>
                    <Select value={botBid.auction_id} onValueChange={(value) => setBotBid({...botBid, auction_id: value})}>
                      <SelectTrigger className="bg-white border-gray-200 text-gray-800">
                        <SelectValue placeholder="Auktion wählen..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
                        {(auctions || []).filter(a => a.status === 'active').map((auction) => (
                          <SelectItem key={auction.id} value={auction.id} className="text-gray-800 hover:bg-white/10">
                            {auction.product?.name} (€{auction.current_price?.toFixed(2)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-800">Zielpreis (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={botBid.target_price}
                      onChange={(e) => setBotBid({...botBid, target_price: e.target.value})}
                      placeholder="z.B. 5.00"
                      className="bg-white border-gray-200 text-gray-800"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-800">&nbsp;</Label>
                    <Button onClick={handleBotBidToPrice} className="w-full bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] hover:opacity-90">
                      <Play className="w-4 h-4 mr-2" />
                      Preis erhöhen
                    </Button>
                  </div>
                </div>
              </div>

              {/* Active Auctions with Quick Bot Actions */}
              <div className="glass-card rounded-xl p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Aktive Auktionen - Schnellaktionen</h3>
                <div className="space-y-4">
                  {(auctions || []).filter(a => a.status === 'active').map((auction) => (
                    <div key={auction.id} className="flex items-center justify-between p-4 rounded-lg bg-white">
                      <div className="flex items-center gap-4">
                        <img src={auction.product?.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                        <div>
                          <p className="text-gray-800 font-medium">{auction.product?.name}</p>
                          <p className="text-[#06B6D4] font-mono">€{auction.current_price?.toFixed(2)} • {auction.total_bids} Gebote</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => handleBotQuickBids(auction.id, 1)} className="bg-white border border-gray-200 hover:bg-white/10 text-gray-800">+1</Button>
                        <Button size="sm" onClick={() => handleBotQuickBids(auction.id, 5)} className="bg-white border border-gray-200 hover:bg-white/10 text-gray-800">+5</Button>
                        <Button size="sm" onClick={() => handleBotQuickBids(auction.id, 10)} className="bg-white border border-gray-200 hover:bg-white/10 text-gray-800">+10</Button>
                        <Button size="sm" onClick={() => handleBotQuickBids(auction.id, 50)} className="bg-[#7C3AED] hover:bg-[#6D28D9] text-gray-800">+50</Button>
                      </div>
                    </div>
                  ))}
                  {(auctions || []).filter(a => a.status === 'active').length === 0 && (
                    <p className="text-center text-gray-500 py-8">Keine aktiven Auktionen</p>
                  )}
                </div>
              </div>

              {/* Bot List */}
              <div className="glass-card rounded-xl p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <h3 className="text-lg font-bold text-gray-800">Verfügbare Bots ({(bots || []).length})</h3>
                  
                  {/* Bot Creation Form - More Prominent */}
                  <form onSubmit={handleCreateBot} className="flex gap-2 w-full md:w-auto">
                    <Input
                      value={newBot.name}
                      onChange={(e) => setNewBot({name: e.target.value})}
                      placeholder="Neuer Bot-Name (z.B. Bardh K.)"
                      className="bg-white border-gray-200 text-gray-800 flex-1 md:w-64"
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
                    <div key={bot.id} className="flex items-center justify-between p-3 rounded-lg bg-white group">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#06B6D4] flex items-center justify-center text-gray-800 text-xs font-bold">
                          {bot.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-gray-800 text-sm font-medium">{bot.name}</p>
                          <p className="text-gray-500 text-xs">{bot.total_bids_placed} Gebote</p>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 text-[#EF4444] hover:bg-[#EF4444]/10" onClick={() => handleDeleteBot(bot.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                {(bots || []).length === 0 && (
                  <p className="text-center text-gray-500 py-8">Keine Bots erstellt. Klicken Sie oben auf "20 Standard-Bots erstellen"</p>
                )}
              </div>
            </div>
          )}

          {/* Payments Tab */}
          {activeTab === 'payments' && (
            <AdminPayments payments={payments} fetchData={fetchData} />
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <AdminAnalytics token={token} />
          )}

          {/* Surveys Tab */}
          {activeTab === 'surveys' && (
            <AdminSurveys token={token} />
          )}

          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">Systemlogs</h1>
                  <p className="text-gray-500">Aktivitäten und Ereignisse</p>
                </div>
                <Button onClick={fetchData} variant="outline" className="border-gray-200 text-gray-800">
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
                          {!['bid', 'payment', 'user', 'auction', 'error'].includes(log.type) && <BarChart3 className="w-5 h-5 text-gray-800" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-800 font-medium">{log.message}</p>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="text-gray-500 text-sm">
                              {new Date(log.timestamp).toLocaleString('de-DE', {dateStyle: 'short', timeStyle: 'medium'})}
                            </span>
                            {log.user_email && (
                              <span className="text-[#7C3AED] text-sm">{log.user_email}</span>
                            )}
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          log.type === 'error' ? 'bg-[#EF4444]/20 text-[#EF4444]' :
                          'bg-white/10 text-gray-500'
                        }`}>
                          {log.type?.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {(logs || []).length === 0 && (
                  <p className="text-center text-gray-500 py-12">Keine Logs vorhanden</p>
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
                <h1 className="text-2xl font-bold text-gray-800">
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
              
              <p className="text-gray-500">
                {language === 'en' 
                  ? 'Managers supervise influencers in their assigned cities and receive a configurable percentage of influencer commissions.'
                  : 'Manager verwalten Influencer in ihren zugewiesenen Städten und erhalten einen einstellbaren Prozentsatz der Influencer-Provisionen.'}
              </p>

              {/* Manager List - Mobile Card View */}
              <div className="md:hidden space-y-3">
                {managers.map((mgr) => (
                  <div key={mgr.id} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                    {/* Header with name and status */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{mgr.name}</p>
                        <p className="text-slate-400 text-xs truncate">{mgr.email}</p>
                      </div>
                      {mgr.is_active ? (
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold flex-shrink-0">Aktiv</span>
                      ) : (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold flex-shrink-0">Inaktiv</span>
                      )}
                    </div>
                    
                    {/* Cities */}
                    <div className="mb-3">
                      <p className="text-xs text-slate-400 mb-1">{language === 'en' ? 'Cities' : 'Städte'}</p>
                      <div className="flex flex-wrap gap-1">
                        {mgr.cities?.slice(0, 3).map((city) => (
                          <span key={city} className="px-2 py-0.5 bg-violet-100 text-violet-600 rounded text-xs">
                            {city}
                          </span>
                        ))}
                        {(mgr.cities?.length || 0) > 3 && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-xs">
                            +{mgr.cities.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="bg-slate-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-slate-400">Influencer</p>
                        <p className="text-lg font-bold text-slate-700">{mgr.influencer_count || 0}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-slate-400">{language === 'en' ? 'Inf. Comm.' : 'Inf. Prov.'}</p>
                        <p className="text-sm font-bold text-amber-600">€{(mgr.total_influencer_commission || 0).toFixed(0)}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-slate-400">Manager {mgr.commission_percent || 15}%</p>
                        <p className="text-sm font-bold text-emerald-600">€{(mgr.manager_commission || 0).toFixed(0)}</p>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setSelectedManager(mgr);
                          setShowManagerDetails(true);
                        }}
                        className="flex-1 border-violet-300 text-violet-600"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Details
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setSelectedManager(mgr);
                          setEditManagerForm({
                            name: mgr.name || '',
                            cities: mgr.cities?.join(', ') || '',
                            commission_percent: mgr.commission_percent || 15,
                            is_active: mgr.is_active !== false
                          });
                          setShowEditManagerModal(true);
                        }}
                        className="border-blue-300 text-blue-600 px-3"
                      >
                        <Edit2 className="w-4 h-4" />
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
                        className="border-red-300 text-red-500 px-3"
                      >
                        <Ban className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {managers.length === 0 && (
                  <p className="text-center text-slate-400 py-8">
                    {language === 'en' ? 'No managers yet' : 'Noch keine Manager'}
                  </p>
                )}
              </div>

              {/* Manager List - Desktop Table View */}
              <div className="hidden md:block bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="text-left text-slate-600 py-3 px-4 text-sm font-medium">Name</th>
                        <th className="text-left text-slate-600 py-3 px-4 text-sm font-medium">E-Mail</th>
                        <th className="text-left text-slate-600 py-3 px-4 text-sm font-medium">{language === 'en' ? 'Cities' : 'Städte'}</th>
                        <th className="text-right text-slate-600 py-3 px-4 text-sm font-medium">Influencer</th>
                        <th className="text-right text-slate-600 py-3 px-4 text-sm font-medium">{language === 'en' ? 'Inf. Commission' : 'Inf. Provision'}</th>
                        <th className="text-right text-slate-600 py-3 px-4 text-sm font-medium">{language === 'en' ? 'Manager %' : 'Manager %'}</th>
                        <th className="text-center text-slate-600 py-3 px-4 text-sm font-medium">Status</th>
                        <th className="text-right text-slate-600 py-3 px-4 text-sm font-medium">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {managers.map((mgr) => (
                        <tr key={mgr.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 text-slate-800 font-medium">{mgr.name}</td>
                          <td className="py-3 px-4 text-slate-500 truncate max-w-[180px]">{mgr.email}</td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {mgr.cities?.map((city) => (
                                <span key={city} className="px-2 py-0.5 bg-violet-100 text-violet-600 rounded text-xs">
                                  {city}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-800 text-right">{mgr.influencer_count || 0}</td>
                          <td className="py-3 px-4 text-amber-600 text-right font-medium">€{(mgr.total_influencer_commission || 0).toFixed(2)}</td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-emerald-600 font-bold">€{(mgr.manager_commission || 0).toFixed(2)}</span>
                            <span className="text-slate-400 text-xs ml-1">({mgr.commission_percent || 15}%)</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {mgr.is_active ? (
                              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">Aktiv</span>
                            ) : (
                              <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">Inaktiv</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex justify-end gap-2">
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => {
                                  setSelectedManager(mgr);
                                  setShowManagerDetails(true);
                                }}
                                className="text-violet-600 hover:bg-violet-50"
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Details
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => {
                                  setSelectedManager(mgr);
                                  setEditManagerForm({
                                    name: mgr.name || '',
                                    cities: mgr.cities?.join(', ') || '',
                                    commission_percent: mgr.commission_percent || 15,
                                    is_active: mgr.is_active !== false
                                  });
                                  setShowEditManagerModal(true);
                                }}
                                className="text-blue-600 hover:bg-blue-50"
                              >
                                <Edit2 className="w-4 h-4 mr-1" />
                                {language === 'en' ? 'Edit' : 'Bearbeiten'}
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
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
                                className="text-red-500 hover:bg-red-50"
                              >
                                <Ban className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {managers.length === 0 && (
                  <p className="text-center text-slate-400 py-8">
                    {language === 'en' ? 'No managers yet' : 'Noch keine Manager'}
                  </p>
                )}
              </div>

              {/* Create Manager Modal */}
              {showManagerModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowManagerModal(false)}>
                  <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                    <h2 className="text-xl font-bold text-slate-800 mb-4">
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
                        setManagerForm({ name: '', email: '', password: '', cities: '', commission_percent: 15, company_commission_percent: 5 });
                        fetchData();
                      } catch (err) {
                        toast.error(err.response?.data?.detail || 'Fehler');
                      }
                    }} className="space-y-4">
                      <div>
                        <Label className="text-slate-700 font-medium">Name</Label>
                        <Input 
                          value={managerForm.name}
                          onChange={(e) => setManagerForm({...managerForm, name: e.target.value})}
                          className="bg-slate-50 border-slate-200 text-slate-800"
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-slate-700 font-medium">E-Mail</Label>
                        <Input 
                          type="email"
                          value={managerForm.email}
                          onChange={(e) => setManagerForm({...managerForm, email: e.target.value})}
                          className="bg-slate-50 border-slate-200 text-slate-800"
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-slate-700 font-medium">{language === 'en' ? 'Password' : 'Passwort'}</Label>
                        <Input 
                          type="password"
                          value={managerForm.password}
                          onChange={(e) => setManagerForm({...managerForm, password: e.target.value})}
                          className="bg-slate-50 border-slate-200 text-slate-800"
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-slate-700 font-medium">{language === 'en' ? 'Cities (comma separated)' : 'Städte (Komma getrennt)'}</Label>
                        <Input 
                          value={managerForm.cities}
                          onChange={(e) => setManagerForm({...managerForm, cities: e.target.value})}
                          className="bg-slate-50 border-slate-200 text-slate-800"
                          placeholder="Berlin, Hamburg, München"
                          required
                        />
                      </div>
                      
                      {/* Provision Settings */}
                      <div className="bg-violet-50 rounded-lg p-4 space-y-3">
                        <p className="text-sm font-bold text-violet-800 flex items-center gap-2">
                          <Percent className="w-4 h-4" />
                          {language === 'en' ? 'Commission Settings' : 'Provisions-Einstellungen'}
                        </p>
                        <div>
                          <Label className="text-slate-700 text-sm">
                            {language === 'en' ? 'From Influencer Earnings (%)' : 'Von Influencer-Einnahmen (%)'}
                          </Label>
                          <Input 
                            type="number"
                            value={managerForm.commission_percent}
                            onChange={(e) => setManagerForm({...managerForm, commission_percent: parseFloat(e.target.value) || 0})}
                            className="bg-white border-slate-200 text-slate-800"
                            min="0"
                            max="100"
                            step="0.1"
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            Manager erhält diesen % von den Provisionen seiner Influencer
                          </p>
                        </div>
                        <div>
                          <Label className="text-slate-700 text-sm">
                            {language === 'en' ? 'From BidBlitz/Company (%)' : 'Von BidBlitz/Firma (%)'}
                          </Label>
                          <Input 
                            type="number"
                            value={managerForm.company_commission_percent}
                            onChange={(e) => setManagerForm({...managerForm, company_commission_percent: parseFloat(e.target.value) || 0})}
                            className="bg-white border-slate-200 text-slate-800"
                            min="0"
                            max="100"
                            step="0.1"
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            Zusätzlicher % direkt von BidBlitz
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => setShowManagerModal(false)} className="flex-1 border-slate-200 text-slate-600">
                          {language === 'en' ? 'Cancel' : 'Abbrechen'}
                        </Button>
                        <Button type="submit" className="flex-1 bg-violet-600 hover:bg-violet-500 text-white">
                          {language === 'en' ? 'Create' : 'Erstellen'}
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Edit Manager Modal */}
              {showEditManagerModal && selectedManager && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowEditManagerModal(false)}>
                  <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                    <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Edit2 className="w-5 h-5 text-blue-500" />
                      {language === 'en' ? 'Edit Manager' : 'Manager bearbeiten'}
                    </h2>
                    <p className="text-slate-500 text-sm mb-4">{selectedManager.email}</p>
                    
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        await axios.put(`${API}/manager/admin/${selectedManager.id}`, {
                          name: editManagerForm.name,
                          cities: editManagerForm.cities.split(',').map(c => c.trim()).filter(c => c),
                          commission_percent: editManagerForm.commission_percent,
                          company_commission_percent: editManagerForm.company_commission_percent,
                          is_active: editManagerForm.is_active
                        }, {
                          headers: { Authorization: `Bearer ${token}` }
                        });
                        toast.success(language === 'en' ? 'Manager updated!' : 'Manager aktualisiert!');
                        setShowEditManagerModal(false);
                        fetchData();
                      } catch (err) {
                        toast.error(err.response?.data?.detail || 'Fehler');
                      }
                    }} className="space-y-4">
                      <div>
                        <Label className="text-slate-700 font-medium">Name</Label>
                        <Input 
                          value={editManagerForm.name}
                          onChange={(e) => setEditManagerForm({...editManagerForm, name: e.target.value})}
                          className="bg-slate-50 border-slate-200 text-slate-800"
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-slate-700 font-medium">{language === 'en' ? 'Cities (comma separated)' : 'Städte (Komma getrennt)'}</Label>
                        <Input 
                          value={editManagerForm.cities}
                          onChange={(e) => setEditManagerForm({...editManagerForm, cities: e.target.value})}
                          className="bg-slate-50 border-slate-200 text-slate-800"
                          placeholder="Berlin, Hamburg, München"
                          required
                        />
                      </div>
                      
                      {/* Provision Settings */}
                      <div className="bg-violet-50 rounded-lg p-4 space-y-3">
                        <p className="text-sm font-bold text-violet-800 flex items-center gap-2">
                          <Percent className="w-4 h-4" />
                          {language === 'en' ? 'Commission Settings' : 'Provisions-Einstellungen'}
                        </p>
                        <div>
                          <Label className="text-slate-700 text-sm">
                            {language === 'en' ? 'From Influencer Earnings (%)' : 'Von Influencer-Einnahmen (%)'}
                          </Label>
                          <Input 
                            type="number"
                            value={editManagerForm.commission_percent}
                            onChange={(e) => setEditManagerForm({...editManagerForm, commission_percent: parseFloat(e.target.value) || 0})}
                            className="bg-white border-slate-200 text-slate-800"
                            min="0"
                            max="100"
                            step="0.1"
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            Manager erhält diesen % von den Provisionen seiner Influencer
                          </p>
                        </div>
                        <div>
                          <Label className="text-slate-700 text-sm">
                            {language === 'en' ? 'From BidBlitz/Company (%)' : 'Von BidBlitz/Firma (%)'}
                          </Label>
                          <Input 
                            type="number"
                            value={editManagerForm.company_commission_percent}
                            onChange={(e) => setEditManagerForm({...editManagerForm, company_commission_percent: parseFloat(e.target.value) || 0})}
                            className="bg-white border-slate-200 text-slate-800"
                            min="0"
                            max="100"
                            step="0.1"
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            Zusätzlicher % direkt von BidBlitz
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                        <input
                          type="checkbox"
                          id="manager-active"
                          checked={editManagerForm.is_active}
                          onChange={(e) => setEditManagerForm({...editManagerForm, is_active: e.target.checked})}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                        />
                        <Label htmlFor="manager-active" className="text-slate-700 cursor-pointer">
                          {language === 'en' ? 'Active' : 'Aktiv'}
                        </Label>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setShowEditManagerModal(false)} 
                          className="flex-1 border-slate-200 text-slate-600"
                        >
                          {language === 'en' ? 'Cancel' : 'Abbrechen'}
                        </Button>
                        <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white">
                          {language === 'en' ? 'Save' : 'Speichern'}
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Manager Details Modal */}
              {showManagerDetails && selectedManager && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-2 sm:p-4">
                  <div className="bg-[#1A1A2E] rounded-xl border border-gray-200 max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
                    <div className="p-4 sm:p-6 border-b border-gray-200 flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2 truncate">
                          <Building2 className="w-5 h-5 text-[#7C3AED] flex-shrink-0" />
                          <span className="truncate">{selectedManager.name}</span>
                        </h2>
                        <p className="text-gray-500 text-xs sm:text-sm truncate">{selectedManager.email}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowManagerDetails(false);
                          setSelectedManager(null);
                        }}
                        className="text-gray-500 hover:text-gray-800 flex-shrink-0"
                      >
                        <X className="w-5 h-5" />
                      </Button>
                    </div>
                    
                    <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(95vh-80px)] sm:max-h-[calc(90vh-100px)]">
                      {/* Manager Stats */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
                        <div className="bg-gradient-to-b from-cyan-50 to-cyan-100 rounded-lg p-3 text-center">
                          <Building2 className="w-5 h-5 text-[#7C3AED] mx-auto mb-1" />
                          <p className="text-xl font-bold text-gray-800">{selectedManager.cities?.length || 0}</p>
                          <p className="text-gray-500 text-[10px]">{language === 'en' ? 'Cities' : 'Städte'}</p>
                        </div>
                        <div className="bg-gradient-to-b from-cyan-50 to-cyan-100 rounded-lg p-3 text-center">
                          <Users className="w-5 h-5 text-[#F59E0B] mx-auto mb-1" />
                          <p className="text-xl font-bold text-gray-800">{selectedManager.influencer_count || managerInfluencers.length}</p>
                          <p className="text-gray-500 text-[10px]">Influencer</p>
                        </div>
                        <div className="bg-gradient-to-b from-cyan-50 to-cyan-100 rounded-lg p-3 text-center">
                          <DollarSign className="w-5 h-5 text-[#10B981] mx-auto mb-1" />
                          <p className="text-lg font-bold text-[#10B981]">€{(selectedManager.total_influencer_commission || 0).toFixed(2)}</p>
                          <p className="text-gray-500 text-[10px]">{language === 'en' ? 'Inf. Commission' : 'Inf. Provision'}</p>
                        </div>
                        <div className="bg-gradient-to-b from-cyan-50 to-cyan-100 rounded-lg p-3 text-center">
                          <Crown className="w-5 h-5 text-[#7C3AED] mx-auto mb-1" />
                          <p className="text-lg font-bold text-[#7C3AED]">€{(selectedManager.manager_commission || 0).toFixed(2)}</p>
                          <p className="text-gray-500 text-[10px]">{language === 'en' ? 'Manager 15%' : 'Manager 15%'}</p>
                        </div>
                      </div>

                      {/* Cities */}
                      <div className="mb-6">
                        <h3 className="text-gray-800 font-medium mb-2">{language === 'en' ? 'Managed Cities' : 'Verwaltete Städte'}</h3>
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
                        <h3 className="text-gray-800 font-medium mb-3 flex items-center gap-2">
                          <Users className="w-4 h-4 text-[#F59E0B]" />
                          {language === 'en' ? 'Managed Influencers' : 'Verwaltete Influencer'}
                        </h3>
                        
                        {loadingManagerDetails ? (
                          <div className="text-center py-8 text-gray-500">Laden...</div>
                        ) : managerInfluencers.length === 0 ? (
                          <div className="text-center py-8 bg-gradient-to-b from-cyan-50 to-cyan-100 rounded-lg">
                            <Users className="w-12 h-12 text-gray-500 mx-auto mb-2 opacity-50" />
                            <p className="text-gray-500">{language === 'en' ? 'No influencers yet' : 'Noch keine Influencer'}</p>
                          </div>
                        ) : (
                          <>
                            {/* Mobile Card View */}
                            <div className="md:hidden space-y-2">
                              {managerInfluencers.map((inf) => (
                                <div key={inf.id} className="bg-white rounded-lg p-3 border border-slate-100">
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-slate-800 text-sm truncate">{inf.name || inf.username}</p>
                                      <span className="px-2 py-0.5 bg-amber-100 text-amber-600 rounded text-xs font-mono">
                                        {inf.code}
                                      </span>
                                    </div>
                                    {inf.is_active !== false ? (
                                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded text-xs flex-shrink-0">Aktiv</span>
                                    ) : (
                                      <span className="px-2 py-0.5 bg-red-100 text-red-500 rounded text-xs flex-shrink-0">Inaktiv</span>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="bg-slate-50 rounded p-1.5">
                                      <p className="text-[10px] text-slate-400">{language === 'en' ? 'City' : 'Stadt'}</p>
                                      <p className="text-xs font-medium text-slate-700 truncate">{inf.city || '-'}</p>
                                    </div>
                                    <div className="bg-slate-50 rounded p-1.5">
                                      <p className="text-[10px] text-slate-400">{language === 'en' ? 'Signups' : 'Anmeld.'}</p>
                                      <p className="text-xs font-bold text-slate-700">{inf.signups || inf.total_signups || 0}</p>
                                    </div>
                                    <div className="bg-slate-50 rounded p-1.5">
                                      <p className="text-[10px] text-slate-400">{language === 'en' ? 'Comm.' : 'Prov.'}</p>
                                      <p className="text-xs font-bold text-emerald-600">€{(inf.total_earnings || inf.commission || 0).toFixed(0)}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {/* Mobile Totals */}
                              <div className="bg-violet-50 rounded-lg p-3 border border-violet-100">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-medium text-violet-700">Gesamt</span>
                                  <div className="flex gap-4">
                                    <span className="text-sm font-bold text-slate-700">
                                      {managerInfluencers.reduce((sum, inf) => sum + (inf.signups || inf.total_signups || 0), 0)} Anm.
                                    </span>
                                    <span className="text-sm font-bold text-emerald-600">
                                      €{managerInfluencers.reduce((sum, inf) => sum + (inf.total_earnings || inf.commission || 0), 0).toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Desktop Table View */}
                            <div className="hidden md:block bg-gradient-to-b from-cyan-50 to-cyan-100 rounded-lg overflow-hidden">
                              <table className="w-full">
                                <thead className="bg-white/5">
                                  <tr>
                                    <th className="text-left text-gray-500 py-2 px-3 text-xs">Name</th>
                                    <th className="text-left text-gray-500 py-2 px-3 text-xs">Code</th>
                                    <th className="text-left text-gray-500 py-2 px-3 text-xs">{language === 'en' ? 'City' : 'Stadt'}</th>
                                    <th className="text-right text-gray-500 py-2 px-3 text-xs">{language === 'en' ? 'Signups' : 'Anmeldungen'}</th>
                                    <th className="text-right text-gray-500 py-2 px-3 text-xs">{language === 'en' ? 'Commission' : 'Provision'}</th>
                                    <th className="text-center text-gray-500 py-2 px-3 text-xs">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {managerInfluencers.map((inf) => (
                                    <tr key={inf.id} className="border-t border-white/5 hover:bg-white/5">
                                      <td className="py-2 px-3 text-gray-800 text-sm">{inf.name || inf.username}</td>
                                      <td className="py-2 px-3">
                                        <span className="px-2 py-0.5 bg-[#F59E0B]/20 text-[#F59E0B] rounded text-xs font-mono">
                                          {inf.code}
                                        </span>
                                      </td>
                                      <td className="py-2 px-3 text-gray-500 text-sm">{inf.city || '-'}</td>
                                      <td className="py-2 px-3 text-gray-800 text-right text-sm">{inf.signups || inf.total_signups || 0}</td>
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
                                    <td colSpan="3" className="py-2 px-3 text-gray-500 text-sm font-medium">Gesamt</td>
                                    <td className="py-2 px-3 text-gray-800 text-right text-sm font-bold">
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
                          </>
                        )}
                      </div>

                      {/* Credentials Info */}
                      <div className="mt-6 p-4 bg-[#7C3AED]/10 rounded-lg border border-[#7C3AED]/20">
                        <h4 className="text-gray-800 font-medium mb-2 flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-[#7C3AED]" />
                          {language === 'en' ? 'Login Credentials' : 'Zugangsdaten'}
                        </h4>
                        <div className="space-y-1 text-sm">
                          <p className="text-gray-500">
                            <span className="text-gray-800">E-Mail:</span> {selectedManager.email}
                          </p>
                          <p className="text-gray-500">
                            <span className="text-gray-800">Dashboard:</span> /manager-dashboard
                          </p>
                        </div>
                      </div>

                      {/* Activity Log */}
                      <div className="mt-6">
                        <h3 className="text-gray-800 font-medium mb-3 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[#F59E0B]" />
                          {language === 'en' ? 'Activity Log' : 'Aktivitäts-Protokoll'}
                        </h3>
                        {managerActivities.length === 0 ? (
                          <div className="bg-gradient-to-b from-cyan-50 to-cyan-100 rounded-lg p-4 text-center">
                            <Clock className="w-8 h-8 text-gray-500 mx-auto mb-2 opacity-50" />
                            <p className="text-gray-500 text-sm">{language === 'en' ? 'No activities yet' : 'Noch keine Aktivitäten'}</p>
                          </div>
                        ) : (
                          <div className="bg-gradient-to-b from-cyan-50 to-cyan-100 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
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
                                  <p className="text-gray-800 text-sm">{activity.description}</p>
                                  <p className="text-gray-500 text-xs">
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

          {/* Maintenance Tab */}
          {activeTab === 'maintenance' && (
            <AdminMaintenance token={token} />
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
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Trophy className="w-6 h-6 text-[#FFD700]" />
                Jackpot Verwaltung
              </h1>

              {/* Current Jackpot */}
              <div className="glass-card rounded-xl p-4 sm:p-6 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-yellow-500/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">Aktueller Jackpot</p>
                    <p className="text-3xl sm:text-4xl font-black text-[#FFD700]">
                      {jackpotData?.current_amount?.toLocaleString('de-DE') || 0} Gebote
                    </p>
                    <p className="text-gray-800 text-lg mt-1">
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
                    <h3 className="text-gray-800 font-bold">Jackpot Status</h3>
                    <p className="text-gray-500 text-sm">
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
                <h3 className="text-gray-800 font-bold mb-4">Jackpot anpassen</h3>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                  <div className="flex-1">
                    <Label className="text-gray-500">Neuer Jackpot-Betrag (Gebote)</Label>
                    <Input
                      type="number"
                      value={jackpotAmount}
                      onChange={(e) => setJackpotAmount(parseInt(e.target.value) || 0)}
                      className="bg-white border-gray-200 text-gray-800 text-lg"
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
                <p className="text-gray-500 text-xs mt-2">
                  Aktuell: {jackpotData?.current_amount || 0} Gebote = €{((jackpotData?.current_amount || 0) * 0.50).toFixed(2)}
                </p>
              </div>

              {/* Award Jackpot */}
              <div className="glass-card rounded-xl p-4 sm:p-6">
                <h3 className="text-gray-800 font-bold mb-4">🏆 Jackpot vergeben</h3>
                <div className="space-y-3">
                  <div>
                    <Label className="text-gray-500">Benutzer auswählen ({users.length} verfügbar)</Label>
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
                      <SelectTrigger className="bg-white border-gray-200 text-gray-800">
                        <SelectValue placeholder="Benutzer wählen zum Vergeben..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200 max-h-60">
                        {users.length === 0 ? (
                          <SelectItem value="none" disabled className="text-gray-500">
                            Keine Benutzer geladen
                          </SelectItem>
                        ) : (
                          users.map((user) => (
                            <SelectItem key={user.id} value={user.id} className="text-gray-800">
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
                <h3 className="text-gray-800 font-bold mb-4">Jackpot-Gewinner Historie</h3>
                {jackpotHistory.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Noch keine Jackpot-Gewinner</p>
                ) : (
                  <div className="space-y-2">
                    {jackpotHistory.map((winner, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-white rounded-lg">
                        <div className="flex items-center gap-3">
                          <Trophy className="w-5 h-5 text-[#FFD700]" />
                          <div>
                            <p className="text-gray-800 font-medium">{winner.user_name}</p>
                            <p className="text-gray-500 text-xs">
                              {new Date(winner.won_at).toLocaleString('de-DE')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[#FFD700] font-bold">{winner.amount} Gebote</p>
                          <p className="text-gray-500 text-xs">€{(winner.amount * 0.50).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Last Winner Info */}
              {jackpotData?.last_winner && jackpotData?.last_won_amount && (
                <div className="glass-card rounded-xl p-6 border border-[#FFD700]/30">
                  <h3 className="text-gray-800 font-bold mb-2">Letzter Gewinner</h3>
                  <div className="flex items-center gap-4">
                    <Trophy className="w-10 h-10 text-[#FFD700]" />
                    <div>
                      <p className="text-xl font-bold text-gray-800">{jackpotData.last_winner}</p>
                      <p className="text-gray-500">
                        Gewonnen: {jackpotData.last_won_amount || 0} Gebote (€{((jackpotData.last_won_amount || 0) * 0.50).toFixed(2)})
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* ==================== HAPPY HOUR SETTINGS ==================== */}
              <div className="glass-card rounded-xl p-4 sm:p-6 border border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-yellow-500/10">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="text-2xl">⚡</span> Happy Hour Einstellungen
                </h3>
                <p className="text-gray-500 text-sm mb-4">
                  Während der Happy Hour erhalten Kunden Bonus-Gebote bei jedem Kauf!
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label className="text-gray-500">Status</Label>
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        onClick={async () => {
                          try {
                            await axios.put(`${API}/gamification/happy-hour/config?enabled=${!happyHourConfig?.enabled}`, {}, {
                              headers: { Authorization: `Bearer ${token}` }
                            });
                            toast.success(happyHourConfig?.enabled ? 'Happy Hour deaktiviert' : 'Happy Hour aktiviert');
                            fetchData();
                          } catch (err) {
                            toast.error('Fehler');
                          }
                        }}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                          happyHourConfig?.enabled ? 'bg-[#F59E0B]' : 'bg-[#374151]'
                        }`}
                      >
                        <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                          happyHourConfig?.enabled ? 'translate-x-7' : 'translate-x-1'
                        }`} />
                      </button>
                      <span className={happyHourConfig?.enabled ? 'text-[#F59E0B] font-bold' : 'text-gray-500'}>
                        {happyHourConfig?.enabled ? 'AKTIV' : 'Inaktiv'}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-gray-500">Bonus-Multiplikator</Label>
                    <Select 
                      value={String(happyHourConfig?.multiplier || 2)}
                      onValueChange={async (val) => {
                        try {
                          await axios.put(`${API}/gamification/happy-hour/config?multiplier=${val}`, {}, {
                            headers: { Authorization: `Bearer ${token}` }
                          });
                          toast.success(`Multiplikator auf ${val}x gesetzt`);
                          fetchData();
                        } catch (err) {
                          toast.error('Fehler');
                        }
                      }}
                    >
                      <SelectTrigger className="bg-white border-gray-200 text-gray-800 mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
                        <SelectItem value="1.5" className="text-gray-800">1.5x Gebote</SelectItem>
                        <SelectItem value="2" className="text-gray-800">2x Gebote (Standard)</SelectItem>
                        <SelectItem value="2.5" className="text-gray-800">2.5x Gebote</SelectItem>
                        <SelectItem value="3" className="text-gray-800">3x Gebote</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label className="text-gray-500">Startzeit (Uhr)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={happyHourConfig?.start_hour || 18}
                      onChange={async (e) => {
                        const val = parseInt(e.target.value);
                        if (val >= 0 && val <= 23) {
                          try {
                            await axios.put(`${API}/gamification/happy-hour/config?start_hour=${val}`, {}, {
                              headers: { Authorization: `Bearer ${token}` }
                            });
                            fetchData();
                          } catch (err) {}
                        }
                      }}
                      className="bg-white border-gray-200 text-gray-800"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-500">Endzeit (Uhr)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={24}
                      value={happyHourConfig?.end_hour || 20}
                      onChange={async (e) => {
                        const val = parseInt(e.target.value);
                        if (val >= 1 && val <= 24) {
                          try {
                            await axios.put(`${API}/gamification/happy-hour/config?end_hour=${val}`, {}, {
                              headers: { Authorization: `Bearer ${token}` }
                            });
                            fetchData();
                          } catch (err) {}
                        }
                      }}
                      className="bg-white border-gray-200 text-gray-800"
                    />
                  </div>
                </div>
                
                <p className="text-[#F59E0B] text-sm p-2 bg-[#F59E0B]/10 rounded">
                  ⚡ Happy Hour: Täglich von <strong>{happyHourConfig?.start_hour || 18}:00</strong> bis <strong>{happyHourConfig?.end_hour || 20}:00</strong> Uhr - Kunden erhalten <strong>{happyHourConfig?.multiplier || 2}x</strong> Gebote!
                </p>
              </div>
              
              {/* ==================== LUCKY IN 50 SETTINGS ==================== */}
              <div className="glass-card rounded-xl p-4 sm:p-6 border border-green-500/30 bg-gradient-to-r from-green-500/10 to-emerald-500/10">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="text-2xl">🎁</span> Lucky in 50 Einstellungen
                </h3>
                <p className="text-gray-500 text-sm mb-4">
                  Jedes X. Gebot gewinnt automatisch Bonus-Gebote! Ermutigt Benutzer mehr zu bieten.
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label className="text-gray-500">Gewinn-Intervall</Label>
                    <Select 
                      value={String(luckyConfig?.interval || 50)}
                      onValueChange={async (val) => {
                        try {
                          await axios.put(`${API}/excitement/lucky-bid/config`, 
                            { interval: parseInt(val) },
                            { headers: { Authorization: `Bearer ${token}` } }
                          );
                          toast.success(`Jedes ${val}. Gebot gewinnt!`);
                          fetchData();
                        } catch (err) {
                          toast.error('Fehler');
                        }
                      }}
                    >
                      <SelectTrigger className="bg-white border-gray-200 text-gray-800 mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
                        <SelectItem value="25" className="text-gray-800">Jedes 25. Gebot</SelectItem>
                        <SelectItem value="50" className="text-gray-800">Jedes 50. Gebot (Standard)</SelectItem>
                        <SelectItem value="100" className="text-gray-800">Jedes 100. Gebot</SelectItem>
                        <SelectItem value="200" className="text-gray-800">Jedes 200. Gebot</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-gray-500">Gewinn (Gratis-Gebote)</Label>
                    <Select 
                      value={String(luckyConfig?.reward || 10)}
                      onValueChange={async (val) => {
                        try {
                          await axios.put(`${API}/excitement/lucky-bid/config`, 
                            { reward: parseInt(val) },
                            { headers: { Authorization: `Bearer ${token}` } }
                          );
                          toast.success(`Gewinn auf ${val} Gebote gesetzt`);
                          fetchData();
                        } catch (err) {
                          toast.error('Fehler');
                        }
                      }}
                    >
                      <SelectTrigger className="bg-white border-gray-200 text-gray-800 mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
                        <SelectItem value="5" className="text-gray-800">5 Gratis-Gebote</SelectItem>
                        <SelectItem value="10" className="text-gray-800">10 Gratis-Gebote (Standard)</SelectItem>
                        <SelectItem value="15" className="text-gray-800">15 Gratis-Gebote</SelectItem>
                        <SelectItem value="25" className="text-gray-800">25 Gratis-Gebote</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-sm">Gebote bis zum nächsten Lucky Bid:</p>
                      <p className="text-2xl font-bold text-[#10B981]">{luckyConfig?.bids_until_lucky || 50}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-500 text-sm">Gesamte Gebote heute:</p>
                      <p className="text-xl font-bold text-gray-800">{luckyConfig?.total_bids_today || 0}</p>
                    </div>
                  </div>
                </div>
                
                <p className="text-[#10B981] text-sm p-2 bg-[#10B981]/10 rounded mt-4">
                  🎁 Jedes <strong>{luckyConfig?.interval || 50}.</strong> Gebot gewinnt automatisch <strong>{luckyConfig?.reward || 10} Gratis-Gebote</strong>!
                </p>
              </div>
            </div>
          )}

          {/* Winner Control Tab */}
          {activeTab === 'winner-control' && (
            <AdminWinnerControl />
          )}

          {/* Weekly Challenges Tab */}
          {activeTab === 'weekly-challenges' && (
            <AdminWeeklyChallenges />
          )}

          {/* Coupons Tab */}
          {activeTab === 'coupons' && (
            <AdminCoupons />
          )}

          {/* Sustainability Tab */}
          {activeTab === 'sustainability' && (
            <AdminSustainability />
          )}

          {/* Mystery Box Tab */}
          {activeTab === 'mystery-box' && (
            <AdminMysteryBox />
          )}

          {/* Promo Codes Tab */}
          {activeTab === 'promo-codes' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h2 className="text-lg sm:text-xl font-bold text-gray-800">🎫 Gutschein-Codes</h2>
                <Button
                  onClick={() => setShowPromoModal(true)}
                  className="btn-primary w-full sm:w-auto"
                >
                  + Neuen Code erstellen
                </Button>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {promoCodes.map(promo => (
                  <div key={promo.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    {/* Header: Code + Status */}
                    <div className="flex items-start justify-between mb-3">
                      <span className="font-mono text-[#FFD700] bg-[#FFD700]/10 px-2 py-1 rounded text-sm font-bold">
                        {promo.code}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs ${promo.is_active ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-red-500/20 text-red-500'}`}>
                        {promo.is_active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </div>
                    
                    {/* Name */}
                    <p className="text-gray-800 font-medium mb-3">{promo.name}</p>
                    
                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-gray-400">Belohnung</p>
                        <p className="text-sm font-bold text-[#10B981]">
                          {promo.reward_amount} {promo.reward_type === 'bids' ? 'Gebote' : promo.reward_type === 'vip_days' ? 'VIP' : '%'}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-gray-400">Einlösungen</p>
                        <p className="text-sm font-bold text-gray-800">
                          {promo.current_uses || 0}
                          {promo.max_uses && <span className="text-gray-400 font-normal">/{promo.max_uses}</span>}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-gray-400">Limit</p>
                        <p className="text-sm font-bold">
                          {promo.one_per_user !== false ? (
                            <span className="text-blue-500">1x/Kunde</span>
                          ) : (
                            <span className="text-purple-500">Mehrfach</span>
                          )}
                        </p>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          try {
                            await axios.put(`${API}/promo-codes/admin/${promo.id}/toggle`, {}, {
                              headers: { Authorization: `Bearer ${token}` }
                            });
                            toast.success(promo.is_active ? 'Code deaktiviert' : 'Code aktiviert');
                            fetchData();
                          } catch (err) {
                            toast.error('Fehler');
                          }
                        }}
                        className={`flex-1 px-3 py-2 rounded text-sm font-medium ${promo.is_active ? 'bg-red-100 text-red-600' : 'bg-[#10B981]/20 text-[#10B981]'}`}
                      >
                        {promo.is_active ? 'Deaktivieren' : 'Aktivieren'}
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm('Code wirklich löschen?')) {
                            try {
                              await axios.delete(`${API}/promo-codes/admin/${promo.id}`, {
                                headers: { Authorization: `Bearer ${token}` }
                              });
                              toast.success('Code gelöscht');
                              fetchData();
                            } catch (err) {
                              toast.error('Fehler beim Löschen');
                            }
                          }
                        }}
                        className="px-4 py-2 rounded text-sm bg-red-100 text-red-600"
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                ))}
                {promoCodes.length === 0 && (
                  <p className="text-center text-gray-500 py-8">Keine Gutschein-Codes vorhanden</p>
                )}
              </div>

              {/* Promo Codes List - Desktop Table */}
              <div className="glass-card rounded-xl overflow-hidden hidden md:block">
                <div className="overflow-x-auto">
                  <table className="w-full">
                  <thead className="bg-white">
                    <tr>
                      <th className="text-left text-gray-500 font-medium p-4">Code</th>
                      <th className="text-left text-gray-500 font-medium p-4">Name</th>
                      <th className="text-left text-gray-500 font-medium p-4">Belohnung</th>
                      <th className="text-left text-gray-500 font-medium p-4">Einlösungen</th>
                      <th className="text-left text-gray-500 font-medium p-4">Limit</th>
                      <th className="text-left text-gray-500 font-medium p-4">Status</th>
                      <th className="text-left text-gray-500 font-medium p-4">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {promoCodes.map(promo => (
                      <tr key={promo.id} className="border-t border-white/5">
                        <td className="p-4">
                          <span className="font-mono text-[#FFD700] bg-[#FFD700]/10 px-2 py-1 rounded">
                            {promo.code}
                          </span>
                        </td>
                        <td className="p-4 text-gray-800">{promo.name}</td>
                        <td className="p-4">
                          <span className="text-[#10B981]">
                            {promo.reward_amount} {promo.reward_type === 'bids' ? 'Gebote' : promo.reward_type === 'vip_days' ? 'VIP Tage' : '%'}
                          </span>
                        </td>
                        <td className="p-4 text-gray-800">
                          {promo.current_uses || 0}
                          {promo.max_uses && <span className="text-gray-500"> / {promo.max_uses}</span>}
                        </td>
                        <td className="p-4">
                          {promo.one_per_user !== false ? (
                            <span className="px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-400" title="Jeder Kunde nur 1x">
                              1x/Kunde
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded text-xs bg-purple-500/20 text-purple-400" title="Mehrfach nutzbar">
                              Mehrfach
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs ${promo.is_active ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-red-500/20 text-red-500'}`}>
                            {promo.is_active ? 'Aktiv' : 'Inaktiv'}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                try {
                                  await axios.put(`${API}/promo-codes/admin/${promo.id}/toggle`, {}, {
                                    headers: { Authorization: `Bearer ${token}` }
                                  });
                                  toast.success(promo.is_active ? 'Code deaktiviert' : 'Code aktiviert');
                                  fetchData();
                                } catch (err) {
                                  toast.error('Fehler');
                                }
                              }}
                              className={`px-3 py-1 rounded text-sm ${promo.is_active ? 'bg-red-500/20 text-red-400' : 'bg-[#10B981]/20 text-[#10B981]'}`}
                            >
                              {promo.is_active ? 'Deaktivieren' : 'Aktivieren'}
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm('Code wirklich löschen?')) {
                                  try {
                                    await axios.delete(`${API}/promo-codes/admin/${promo.id}`, {
                                      headers: { Authorization: `Bearer ${token}` }
                                    });
                                    toast.success('Code gelöscht');
                                    fetchData();
                                  } catch (err) {
                                    toast.error('Fehler beim Löschen');
                                  }
                                }
                              }}
                              className="px-3 py-1 rounded text-sm bg-red-500/20 text-red-400"
                            >
                              Löschen
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {promoCodes.length === 0 && (
                      <tr>
                        <td colSpan="7" className="p-8 text-center text-gray-500">
                          Keine Gutschein-Codes vorhanden
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                </div>
              </div>

              {/* Create Promo Modal */}
              {showPromoModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-xl border border-gray-200 max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Neuen Gutschein-Code erstellen</h3>
                    
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        await axios.post(`${API}/promo-codes/admin/create`, {
                          ...promoForm,
                          max_uses: promoForm.max_uses || null,
                          valid_until: promoForm.valid_until || null
                        }, {
                          headers: { Authorization: `Bearer ${token}` }
                        });
                        toast.success('Gutschein-Code erstellt!');
                        setShowPromoModal(false);
                        setPromoForm({ code: '', name: '', reward_type: 'bids', reward_amount: 10, max_uses: null, valid_until: '', one_per_user: true });
                        fetchData();
                      } catch (err) {
                        toast.error(err.response?.data?.detail || 'Fehler beim Erstellen');
                      }
                    }} className="space-y-4">
                      <div>
                        <label className="text-gray-800 text-sm">Code (z.B. WEIHNACHTEN2026)</label>
                        <input
                          type="text"
                          value={promoForm.code}
                          onChange={(e) => setPromoForm({...promoForm, code: e.target.value.toUpperCase()})}
                          className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2 text-gray-800 font-mono"
                          placeholder="WILLKOMMEN"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="text-gray-800 text-sm">Name/Beschreibung</label>
                        <input
                          type="text"
                          value={promoForm.name}
                          onChange={(e) => setPromoForm({...promoForm, name: e.target.value})}
                          className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2 text-gray-800"
                          placeholder="Willkommensbonus für neue Nutzer"
                          required
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-gray-800 text-sm">Belohnungsart</label>
                          <select
                            value={promoForm.reward_type}
                            onChange={(e) => setPromoForm({...promoForm, reward_type: e.target.value})}
                            className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2 text-gray-800"
                          >
                            <option value="bids">Gratis-Gebote</option>
                            <option value="vip_days">VIP-Tage</option>
                            <option value="discount_percent">Rabatt %</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-gray-800 text-sm">Menge</label>
                          <input
                            type="number"
                            min="1"
                            value={promoForm.reward_amount}
                            onChange={(e) => setPromoForm({...promoForm, reward_amount: parseInt(e.target.value)})}
                            className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2 text-gray-800"
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-gray-800 text-sm">Max. Einlösungen (leer = unbegrenzt)</label>
                          <input
                            type="number"
                            min="1"
                            value={promoForm.max_uses || ''}
                            onChange={(e) => setPromoForm({...promoForm, max_uses: e.target.value ? parseInt(e.target.value) : null})}
                            className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2 text-gray-800"
                            placeholder="Unbegrenzt"
                          />
                        </div>
                        <div>
                          <label className="text-gray-800 text-sm">Gültig bis (optional)</label>
                          <input
                            type="date"
                            value={promoForm.valid_until}
                            onChange={(e) => setPromoForm({...promoForm, valid_until: e.target.value})}
                            className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2 text-gray-800"
                          />
                        </div>
                      </div>
                      
                      {/* Einmal pro Kunde Option */}
                      <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                        <input
                          type="checkbox"
                          id="one_per_user"
                          checked={promoForm.one_per_user}
                          onChange={(e) => setPromoForm({...promoForm, one_per_user: e.target.checked})}
                          className="w-5 h-5 rounded bg-[#252540] border-gray-300 text-[#FFD700] focus:ring-[#FFD700]"
                        />
                        <label htmlFor="one_per_user" className="text-gray-800 cursor-pointer">
                          <span className="font-medium">Nur einmal pro Kunde</span>
                          <span className="text-gray-500 text-sm block">Jeder Kunde kann diesen Code nur 1x einlösen</span>
                        </label>
                      </div>
                      
                      <div className="flex gap-2 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowPromoModal(false)}
                          className="flex-1"
                        >
                          Abbrechen
                        </Button>
                        <Button type="submit" className="flex-1 btn-primary">
                          Erstellen
                        </Button>
                      </div>
                    </form>
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
      
      {/* Voice Debug Assistant */}
      <VoiceDebugAssistant 
        isOpen={showVoiceDebug} 
        onClose={() => setShowVoiceDebug(false)}
      />
      
      {/* Voice Debug Floating Button */}
      <button
        onClick={() => setShowVoiceDebug(true)}
        className="fixed bottom-6 left-64 w-14 h-14 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center z-40 group hidden md:flex"
        title="Sprach-Debug-Assistent"
        data-testid="voice-debug-btn"
      >
        <Bug className="w-6 h-6 group-hover:scale-110 transition-transform" />
        <span className="absolute -top-10 left-0 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          Hey BidBlitz 🎤
        </span>
      </button>
      
      {/* Mobile Bottom Navigation */}
      <AdminMobileNav 
        activeTab={activeTab}
        onTabChange={setActiveTab}
        users={users}
        onUserSelect={(user) => {
          setEditingUser(user);
          setActiveTab('users');
        }}
      />
    </div>
  );
}
