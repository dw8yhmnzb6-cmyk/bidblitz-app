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
  Mic, Command, Search, Bug, Wrench, Leaf, Store, Key, Car, Banknote, Euro, Database, Shield,
  Headphones, History, Bike, MessageSquare, Map
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
  AdminPartnerApplications,
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
  AdminCarAdvertising,
  AdminPartnerCredit,
  AdminWholesale,
  AdminGameConfig,
  AdminDebugReports,
  AdminSupportManagement,
  AdminSystemHealth,
  AdminProductAnalytics,
  AdminUserAnalytics,
  AdminRevenueAnalytics,
  AdminBackupSystem,
  AdminQuickActions,
  AdminLiveWidgets,
  AdminGlobalSearch,
  AdminAIChat,
  AdminAnalytics,
  AdminStaff,
  AdminSurveys,
  AdminMaintenance,
  AdminMobileNav,
  AdminPromoCodes,
  AdminManagers,
  AdminJackpot
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

// Import Admin Wallet Top-up
import AdminWalletTopup from '../components/admin/AdminWalletTopup';

// Import KYC Management
import KYCManagement from '../components/admin/KYCManagement';

// Import Admin Wise Payouts
import AdminWisePayouts from '../components/admin/AdminWisePayouts';

// Import Admin Merchant Vouchers
import AdminMerchantVouchers from '../components/admin/AdminMerchantVouchers';

// Import Admin Credit Management
import AdminCreditManagement from '../components/admin/AdminCreditManagement';

// Import Admin Password Manager
import AdminPasswordManager from '../components/admin/AdminPasswordManager';

// Import Admin Digital Payment API
import AdminDigitalPayments from '../components/admin/AdminDigitalPayments';

// Import Enterprise Management
import AdminEnterpriseManagement from '../components/admin/AdminEnterpriseManagement';
import AdminPayouts from '../components/admin/AdminPayouts';
import AdminFlashSales from '../components/admin/AdminFlashSales';
import AdminDevices from '../components/admin/AdminDevices';
import AdminTickets from '../components/admin/AdminTickets';
import AdminLoans from '../components/admin/AdminLoans';
import AdminOrganizations from '../components/admin/AdminOrganizations';
import AdminMobilityDashboard from '../components/admin/AdminMobilityDashboard';
import AdminFleetManagement from '../components/admin/AdminFleetManagement';


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

  // Jackpot states
  const [jackpotData, setJackpotData] = useState(null);
  const [jackpotHistory, setJackpotHistory] = useState([]);
  const [jackpotAmount, setJackpotAmount] = useState(500);
  
  // Happy Hour & Lucky Bid states
  const [happyHourConfig, setHappyHourConfig] = useState(null);
  const [luckyConfig, setLuckyConfig] = useState(null);

  // Promo Codes states
  const [promoCodes, setPromoCodes] = useState([]);

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

  // Direct fetch function that can be called with a specific tab
  const fetchDataForTab = async (tabId) => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      if (tabId === 'users') {
        const res = await axios.get(`${API}/admin/users`, { headers });
        setUsers(res.data);
      } else if (tabId === 'auctions') {
        const [auctionsRes, productsRes] = await Promise.all([
          axios.get(`${API}/auctions`),
          axios.get(`${API}/products`)
        ]);
        setAuctions(auctionsRes.data);
        setProducts(productsRes.data);
      }
    } catch (error) {
      console.error('Error fetching data for tab:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    console.log('fetchData called with activeTab:', activeTab, 'isAdmin:', isAdmin);
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
        console.log('Fetching users from:', `${API}/admin/users`);
        const res = await axios.get(`${API}/admin/users`, { headers });
        console.log('Users response:', res.data?.length, 'users');
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
<h1 style="color:#fff;margin:0;font-size:28px;">🎉 Willkommen bei BidBlitz.ae!</h1>
</td></tr>
<tr><td style="padding:30px;">
<p style="font-size:18px;color:#333;">Hallo <strong>{name}</strong>,</p>
<p style="color:#555;line-height:1.6;">Vielen Dank für Ihre Registrierung! Als Willkommensgeschenk haben wir Ihnen <strong>10 kostenlose Gebote</strong> gutgeschrieben.</p>
<p style="text-align:center;margin:30px 0;"><a href="https://BidBlitz.ae/auctions" style="background:#7C3AED;color:#fff;padding:15px 30px;text-decoration:none;border-radius:8px;font-weight:bold;">Jetzt mitbieten</a></p>
<p style="color:#888;font-size:14px;">Viel Erfolg beim Bieten!<br>Ihr BidBlitz.ae Team</p>
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
<p style="text-align:center;margin:30px 0;"><a href="https://BidBlitz.ae/auctions" style="background:#FFD700;color:#111;padding:15px 30px;text-decoration:none;border-radius:8px;font-weight:bold;">Zur Auktion</a></p>
<p style="color:#888;font-size:14px;">Viel Erfolg beim Bieten!<br>Ihr BidBlitz.ae Team</p>
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
<p style="text-align:center;margin:30px 0;"><a href="https://BidBlitz.ae/buy-bids" style="background:#10B981;color:#fff;padding:15px 30px;text-decoration:none;border-radius:8px;font-weight:bold;">Jetzt sichern</a></p>
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
<p style="text-align:center;margin:30px 0;"><a href="https://BidBlitz.ae/auctions" style="background:#F59E0B;color:#fff;padding:15px 30px;text-decoration:none;border-radius:8px;font-weight:bold;">Jetzt zurückkommen</a></p>
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

  // Kategorisierte Tabs mit Farben und klarer Organisation
  const tabCategories = [
    {
      category: 'Übersicht',
      color: 'emerald',
      bgColor: 'bg-emerald-500/10',
      textColor: 'text-emerald-600',
      borderColor: 'border-emerald-500/30',
      tabs: [
        { id: 'dashboard', label: at('dashboard'), icon: <LayoutDashboard className="w-5 h-5" /> },
        { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-5 h-5" /> },
      ]
    },
    {
      category: 'Kunden & Personal',
      color: 'blue',
      bgColor: 'bg-blue-500/10',
      textColor: 'text-blue-600',
      borderColor: 'border-blue-500/30',
      tabs: [
        { id: 'users', label: 'Kunden', icon: <Users className="w-5 h-5" /> },
        { id: 'support', label: 'Support', icon: <Headphones className="w-5 h-5" /> },
        { id: 'kyc-management', label: 'KYC-Freischaltung', icon: <Shield className="w-5 h-5" /> },
        { id: 'managers', label: 'Manager', icon: <Building2 className="w-5 h-5" /> },
        { id: 'staff', label: 'Mitarbeiter', icon: <UserPlus className="w-5 h-5" /> },
        { id: 'wholesale', label: 'Großkunden', icon: <Building2 className="w-5 h-5" /> },
        { id: 'influencers', label: 'Influencer', icon: <Star className="w-5 h-5" /> },
        { id: 'car-advertising', label: 'Auto-Werbung', icon: <Car className="w-5 h-5" /> },
        { id: 'partner-credit', label: 'Partner-Freibetrag', icon: <CreditCard className="w-5 h-5" /> },
      ]
    },
    {
      category: 'Partner & Händler',
      color: 'amber',
      bgColor: 'bg-amber-500/10',
      textColor: 'text-amber-600',
      borderColor: 'border-amber-500/30',
      tabs: [
        { id: 'partner-portal', label: 'Partner Portal', icon: <Store className="w-5 h-5" /> },
        { id: 'restaurant-applications', label: 'Alte Bewerbungen', icon: <Building2 className="w-5 h-5" /> },
      ]
    },
    {
      category: 'Auktionen',
      color: 'purple',
      bgColor: 'bg-purple-500/10',
      textColor: 'text-purple-600',
      borderColor: 'border-purple-500/30',
      tabs: [
        { id: 'products', label: at('products'), icon: <Package className="w-5 h-5" /> },
        { id: 'auctions', label: 'Standard-Auktionen', icon: <Gavel className="w-5 h-5" /> },
        { id: 'vip-auctions', label: 'VIP-Auktionen', icon: <Crown className="w-5 h-5" /> },
        { id: 'restaurant-auctions', label: 'Gutschein-Auktionen', icon: <Gavel className="w-5 h-5" /> },
        { id: 'bots', label: 'Bot-System', icon: <Bot className="w-5 h-5" /> },
        { id: 'winner-control', label: 'Gewinner-Kontrolle', icon: <Target className="w-5 h-5" /> },
        { id: 'product-analytics', label: 'Produkt-Analyse', icon: <BarChart3 className="w-5 h-5" /> },
        { id: 'user-analytics', label: 'Benutzer-Analyse', icon: <Users className="w-5 h-5" /> },
        { id: 'revenue-analytics', label: 'Umsatz-Analyse', icon: <Euro className="w-5 h-5" /> },
      ]
    },
    {
      category: 'Gutscheine & Codes',
      color: 'pink',
      bgColor: 'bg-pink-500/10',
      textColor: 'text-pink-600',
      borderColor: 'border-pink-500/30',
      tabs: [
        { id: 'merchant-vouchers', label: 'Händler-Gutscheine', icon: <Ticket className="w-5 h-5" /> },
        { id: 'vouchers', label: 'Bieter-Gutscheine', icon: <Ticket className="w-5 h-5" /> },
        { id: 'restaurant-vouchers', label: 'Partner-Gutscheine', icon: <Ticket className="w-5 h-5" /> },
        { id: 'coupons', label: 'Rabatt-Coupons', icon: <Ticket className="w-5 h-5" /> },
        { id: 'promo-codes', label: 'Promo-Codes', icon: <Gift className="w-5 h-5" /> },
      ]
    },
    {
      category: 'Finanzen',
      color: 'green',
      bgColor: 'bg-green-500/10',
      textColor: 'text-green-600',
      borderColor: 'border-green-500/30',
      tabs: [
        { id: 'payments', label: 'Zahlungen', icon: <DollarSign className="w-5 h-5" /> },
        { id: 'wallet-topup', label: 'Wallet Aufladen', icon: <DollarSign className="w-5 h-5" /> },
        { id: 'wise-payouts', label: 'Wise Auszahlungen', icon: <CreditCard className="w-5 h-5" /> },
        { id: 'credit-management', label: 'Kredit-Verwaltung', icon: <CreditCard className="w-5 h-5" /> },
        { id: 'digital-api', label: 'Digital API', icon: <Key className="w-5 h-5" /> },
        { id: 'enterprise', label: 'Großhändler', icon: <Building2 className="w-5 h-5" /> },
        { id: 'sepa-payouts', label: 'SEPA-Auszahlungen', icon: <Banknote className="w-5 h-5" /> },
      ]
    },
    {
      category: 'Marketing',
      color: 'orange',
      bgColor: 'bg-orange-500/10',
      textColor: 'text-orange-600',
      borderColor: 'border-orange-500/30',
      tabs: [
        { id: 'flash-sales', label: 'Flash Sales', icon: <Zap className="w-5 h-5" /> },
        { id: 'banners', label: 'Werbebanner', icon: <Eye className="w-5 h-5" /> },
        { id: 'email', label: 'E-Mail Marketing', icon: <Mail className="w-5 h-5" /> },
        { id: 'jackpot', label: 'Jackpot', icon: <Trophy className="w-5 h-5" /> },
        { id: 'weekly-challenges', label: 'Challenges', icon: <Trophy className="w-5 h-5" /> },
        { id: 'mystery-box', label: 'Mystery Box', icon: <Gift className="w-5 h-5" /> },
        { id: 'surveys', label: 'Umfragen', icon: <Star className="w-5 h-5" /> },
      ]
    },
    {
      category: 'Mobility',
      color: 'cyan',
      bgColor: 'bg-cyan-500/10',
      textColor: 'text-cyan-600',
      borderColor: 'border-cyan-500/30',
      tabs: [
        { id: 'mobility-dashboard', label: 'Mobility Dashboard', icon: <Bike className="w-5 h-5" /> },
        { id: 'organizations', label: 'Organisationen', icon: <Building2 className="w-5 h-5" /> },
        { id: 'fleet', label: 'Flottenmanagement', icon: <Map className="w-5 h-5" /> },
        { id: 'devices', label: 'Geräte', icon: <Bike className="w-5 h-5" /> },
        { id: 'tickets', label: 'Support-Tickets', icon: <MessageSquare className="w-5 h-5" /> },
        { id: 'loans', label: 'Mikrokredite', icon: <DollarSign className="w-5 h-5" /> },
      ]
    },
    {
      category: 'System',
      color: 'slate',
      bgColor: 'bg-slate-500/10',
      textColor: 'text-slate-600',
      borderColor: 'border-slate-500/30',
      tabs: [
        { id: 'maintenance', label: 'Wartung', icon: <Wrench className="w-5 h-5" /> },
        { id: 'pages', label: 'Seiten (CMS)', icon: <FileText className="w-5 h-5" /> },
        { id: 'game-config', label: 'Spiel-Einstellungen', icon: <Settings className="w-5 h-5" /> },
        { id: 'sustainability', label: 'Nachhaltigkeit', icon: <Leaf className="w-5 h-5" /> },
        { id: 'passwords', label: 'Passwörter', icon: <Key className="w-5 h-5" /> },
        { id: 'logs', label: 'Systemlogs', icon: <BarChart3 className="w-5 h-5" /> },
        { id: 'voice', label: 'Sprachbefehle', icon: <Mic className="w-5 h-5" /> },
        { id: 'debug-reports', label: 'Debug Reports', icon: <Bug className="w-5 h-5" /> },
        { id: 'system-health', label: 'System Health', icon: <Activity className="w-5 h-5" /> },
        { id: 'backup', label: 'Daten-Backup', icon: <Database className="w-5 h-5" /> },
      ]
    },
  ];

  // Flache Tab-Liste für Kompatibilität
  const tabs = tabCategories.flatMap(cat => cat.tabs);

  // Finde die Kategorie für den aktiven Tab
  const getTabCategory = (tabId) => {
    return tabCategories.find(cat => cat.tabs.some(t => t.id === tabId));
  };

  return (
    <div className="min-h-screen pt-28 sm:pt-32 lg:pt-0" data-testid="admin-page">
      {/* Mobile/Tablet Tab Bar - visible on screens smaller than lg (1024px) */}
      <div className="lg:hidden fixed top-20 sm:top-24 left-0 right-0 z-40 bg-gradient-to-b from-cyan-50 to-cyan-100 border-b border-gray-200 shadow-md safe-area-inset">
        <div className="flex items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2">
          <h2 className="text-xs sm:text-sm font-bold text-gray-800 flex items-center gap-1.5">
            <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#7C3AED]" />
            <span>Admin Panel</span>
          </h2>
          <Button 
            variant="outline" 
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setMobileMenuOpen(!mobileMenuOpen);
            }}
            className="text-gray-800 border-gray-300 px-2 py-1 min-h-[36px] sm:min-h-[40px] active:bg-gray-100 text-xs sm:text-sm select-none"
            style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', userSelect: 'none' }}
            data-testid="admin-mobile-menu-btn"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            <span className="ml-1.5">Menü</span>
          </Button>
        </div>
        
        {/* Mobile/Tablet Menu Dropdown - Kategorisiert */}
        {mobileMenuOpen && (
          <div 
            className="px-2 pb-3 bg-gradient-to-b from-cyan-50 to-cyan-100 border-b border-gray-200 max-h-[70vh] overflow-y-auto" 
            style={{ WebkitOverflowScrolling: 'touch' }}
            onClick={(e) => e.stopPropagation()}
          >
            {tabCategories.map((category) => (
              <div key={category.category} className="mb-4">
                {/* Kategorie-Header */}
                <div className={`flex items-center gap-2 px-2 py-1.5 mb-2 rounded-lg ${category.bgColor}`}>
                  <span className={`text-xs font-bold ${category.textColor}`}>{category.category}</span>
                  <span className={`text-[10px] ${category.textColor} opacity-70`}>({category.tabs.length})</span>
                </div>
                {/* Tabs Grid */}
                <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                  {category.tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={async (e) => {
                        e.stopPropagation();
                        setMobileMenuOpen(false);
                        setActiveTab(tab.id);
                        // Directly fetch users data
                        if (tab.id === 'users') {
                          try {
                            const headers = { Authorization: `Bearer ${token}` };
                            const res = await axios.get(`${API}/admin/users`, { headers });
                            setUsers(res.data);
                            console.log('Users loaded:', res.data.length);
                          } catch (error) {
                            console.error('Error fetching users:', error);
                          }
                        }
                      }}
                      className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl transition-all border min-h-[70px] select-none ${
                        activeTab === tab.id
                          ? `${category.bgColor} ${category.textColor} ${category.borderColor} shadow-md scale-105`
                          : 'bg-white text-gray-600 hover:bg-gray-50 active:bg-gray-100 border-gray-100 shadow-sm'
                      }`}
                      style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', userSelect: 'none' }}
                      data-testid={`mobile-tab-${tab.id}`}
                    >
                      <span className={`${activeTab === tab.id ? category.textColor : 'text-gray-500'}`}>
                        {tab.icon}
                      </span>
                      <span className="text-[10px] xs:text-[11px] font-medium text-center leading-tight line-clamp-2">
                        {tab.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex">
        {/* Desktop Sidebar - visible on lg (1024px) and up - Kategorisiert */}
        <aside className="hidden lg:block w-56 lg:w-64 min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 border-r border-gray-200 fixed left-0 top-16 pt-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 64px)', WebkitOverflowScrolling: 'touch' }}>
          <div className="px-3 lg:px-4 mb-6">
            <h2 className="text-base lg:text-lg font-bold text-gray-800 flex items-center gap-2">
              <Settings className="w-4 h-4 lg:w-5 lg:h-5 text-[#7C3AED]" />
              {t('admin.panel')}
            </h2>
          </div>
          
          {/* Kategorisierte Navigation */}
          <nav className="px-2 space-y-4">
            {tabCategories.map((category) => (
              <div key={category.category}>
                {/* Kategorie-Header */}
                <div className={`flex items-center gap-2 px-3 py-2 mb-1 rounded-lg ${category.bgColor}`}>
                  <span className={`text-xs font-bold ${category.textColor}`}>{category.category}</span>
                </div>
                {/* Tabs Liste */}
                <div className="space-y-0.5">
                  {category.tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={async () => {
                        setActiveTab(tab.id);
                        // Directly fetch users data when clicking users tab
                        if (tab.id === 'users') {
                          try {
                            const headers = { Authorization: `Bearer ${token}` };
                            const res = await axios.get(`${API}/admin/users`, { headers });
                            setUsers(res.data);
                            console.log('Sidebar: Users loaded:', res.data.length);
                          } catch (error) {
                            console.error('Error fetching users:', error);
                          }
                        }
                      }}
                      onTouchEnd={async (e) => {
                        e.preventDefault();
                        setActiveTab(tab.id);
                        if (tab.id === 'users') {
                          try {
                            const headers = { Authorization: `Bearer ${token}` };
                            const res = await axios.get(`${API}/admin/users`, { headers });
                            setUsers(res.data);
                            console.log('TouchEnd: Users loaded:', res.data.length);
                          } catch (error) {
                            console.error('Error fetching users:', error);
                          }
                        }
                      }}
                      className={`w-full flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-2 rounded-lg transition-colors text-sm touch-manipulation ${
                        activeTab === tab.id
                          ? `${category.bgColor} ${category.textColor} font-medium`
                          : 'text-gray-500 hover:bg-white/50 hover:text-gray-800 active:bg-white/70'
                      }`}
                      style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                      data-testid={`tab-${tab.id}`}
                    >
                      <span className={`flex-shrink-0 ${activeTab === tab.id ? category.textColor : ''}`}>
                        {tab.icon}
                      </span>
                      <span className="truncate">{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>
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
        <main className="flex-1 lg:ml-56 xl:ml-64 p-2 sm:p-4 lg:p-8 pt-4 sm:pt-6 lg:pt-8 overflow-x-hidden max-w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
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

          {/* System Health Tab */}
          {activeTab === 'system-health' && (
            <AdminSystemHealth token={token} />
          )}

          {/* Backup System Tab */}
          {activeTab === 'backup' && (
            <AdminBackupSystem token={token} />
          )}

          {/* Product Analytics Tab */}
          {activeTab === 'product-analytics' && (
            <AdminProductAnalytics token={token} />
          )}

          {/* User Analytics Tab */}
          {activeTab === 'user-analytics' && (
            <AdminUserAnalytics token={token} />
          )}

          {/* Revenue Analytics Tab */}
          {activeTab === 'revenue-analytics' && (
            <AdminRevenueAnalytics token={token} />
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

          {/* KYC Management Tab */}
          {activeTab === 'kyc-management' && (
            <KYCManagement token={token} />
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

          {/* Partner Portal Tab (NEW) */}
          {activeTab === 'partner-portal' && (
            <AdminPartnerApplications />
          )}

          {/* Bots Tab */}
          {activeTab === 'bots' && (
            <AdminBots
              bots={bots}
              auctions={auctions}
              newBot={newBot}
              setNewBot={setNewBot}
              botBid={botBid}
              setBotBid={setBotBid}
              handleCreateBot={handleCreateBot}
              handleSeedBots={handleSeedBots}
              handleDeleteBot={handleDeleteBot}
              handleBotBidToPrice={handleBotBidToPrice}
              handleBotQuickBids={handleBotQuickBids}
              t={t}
            />
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
            <AdminLogs logs={logs} fetchData={fetchData} />
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

          {/* Car Advertising Tab */}
          {activeTab === 'car-advertising' && (
            <AdminCarAdvertising language={language} />
          )}

          {/* Partner Credit Tab */}
          {activeTab === 'partner-credit' && (
            <AdminPartnerCredit language={language} />
          )}

          {/* Manager Tab */}
          {activeTab === 'managers' && (
            <AdminManagers token={token} language={language} />
          )}

          {/* Support Management Tab */}
          {activeTab === 'support' && (
            <AdminSupportManagement token={token} />
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
            <AdminJackpot 
              token={token}
              jackpotData={jackpotData}
              jackpotAmount={jackpotAmount}
              setJackpotAmount={setJackpotAmount}
              jackpotHistory={jackpotHistory}
              happyHourConfig={happyHourConfig}
              luckyIn50Config={luckyConfig}
              users={users}
              fetchData={fetchData}
            />
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
          {/* Flash Sales Tab */}
          {activeTab === 'flash-sales' && (
            <AdminFlashSales />
          )}

          {activeTab === 'mystery-box' && (
            <AdminMysteryBox />
          )}

          {/* Promo Codes Tab */}
          {activeTab === 'promo-codes' && (
            <AdminPromoCodes 
              token={token}
              promoCodes={promoCodes}
              fetchData={fetchData}
              language={language}
            />
          )}

          {/* Wallet Top-up Tab */}
          {activeTab === 'wallet-topup' && (
            <AdminWalletTopup token={token} t={t} />
          )}

          {/* Wise Payouts Tab */}
          {activeTab === 'wise-payouts' && (
            <AdminWisePayouts token={token} />
          )}

          {/* Credit Management Tab */}
          {activeTab === 'credit-management' && (
            <AdminCreditManagement />
          )}

          {/* Digital Payment API Tab */}
          {activeTab === 'digital-api' && (
            <AdminDigitalPayments />
          )}

          {/* Enterprise Management Tab (Großhändler) */}
          {activeTab === 'enterprise' && (
            <AdminEnterpriseManagement />
          )}

          {/* SEPA Payouts Tab */}
          {activeTab === 'sepa-payouts' && (
            <AdminPayouts />
          )}

          {/* Merchant Vouchers Tab */}
          {activeTab === 'merchant-vouchers' && (
            <AdminMerchantVouchers />
          )}

          {/* Passwords Tab */}
          {activeTab === 'passwords' && (
            <AdminPasswordManager token={token} />
          )}

          {/* Mobility Tabs */}
          {activeTab === 'mobility-dashboard' && (
            <AdminMobilityDashboard token={token} />
          )}
          {activeTab === 'organizations' && (
            <AdminOrganizations token={token} />
          )}
          {activeTab === 'fleet' && (
            <AdminFleetManagement token={token} />
          )}
          {activeTab === 'devices' && (
            <AdminDevices token={token} />
          )}
          {activeTab === 'tickets' && (
            <AdminTickets token={token} />
          )}
          {activeTab === 'loans' && (
            <AdminLoans token={token} />
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
          Hey BidBlitz.ae 🎤
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
