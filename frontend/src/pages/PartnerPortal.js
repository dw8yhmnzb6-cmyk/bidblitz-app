/**
 * Partner Portal - Multi-Business Registration, QR Scanner & Voucher Management
 * Supports: Restaurants, Bars, Gas Stations, Cinemas, Retail, Wellness, Fitness, etc.
 * Features: Statistics with Charts, Wise Bank Transfer Payouts, Document Verification, Staff Management
 */
import { useState, useEffect, useRef } from 'react';
import { 
  QrCode, Scan, Check, X, Euro, History, LogOut, Camera, Loader2, 
  AlertCircle, CheckCircle, Building2, MapPin, Phone, Mail, Globe,
  FileText, CreditCard, User, Plus, Ticket, BarChart3, Clock,
  ChevronRight, Upload, Store, TrendingUp, Shield, ExternalLink,
  PieChart, Trash2, Eye, Download, Users, Languages, Pencil, Share2,
  Wallet, Hash
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { Html5Qrcode } from 'html5-qrcode';
import axios from 'axios';

// Import refactored components
import PartnerPayouts from '../components/partner/PartnerPayouts';
import PartnerScanner from '../components/partner/PartnerScanner';
import PartnerStaff from '../components/partner/PartnerStaff';
import PartnerVouchers from '../components/partner/PartnerVouchers';
import PartnerStatistics from '../components/partner/PartnerStatistics';
import PartnerProfile from '../components/partner/PartnerProfile';
import PartnerVerification from '../components/partner/PartnerVerification';
import PartnerBudget from '../components/partner/PartnerBudget';
import PartnerDashboardExpanded from '../components/partner/PartnerDashboardExpanded';

// Import marketing components
import { 
  PartnerReferral, 
  PartnerQRCodes, 
  PartnerFlashSales, 
  PartnerSocialSharing,
  PartnerRatingsOverview 
} from '../components/partner/PartnerMarketing';
import { PartnerTransfer } from '../components/partner/PartnerTransfer';

// Import centralized translations
import { translations as partnerTranslations, getLangKey } from '../components/partner/partnerTranslations';

const API = process.env.REACT_APP_BACKEND_URL;

// Business Types
const BUSINESS_TYPES = [
  { id: 'restaurant', name: 'Restaurant', icon: '🍕' },
  { id: 'bar', name: 'Bar & Club', icon: '🍺' },
  { id: 'cafe', name: 'Café', icon: '☕' },
  { id: 'gas_station', name: 'Tankstelle', icon: '⛽' },
  { id: 'cinema', name: 'Kino', icon: '🎬' },
  { id: 'retail', name: 'Einzelhandel', icon: '🛒' },
  { id: 'wellness', name: 'Wellness & Spa', icon: '💆' },
  { id: 'fitness', name: 'Fitness-Studio', icon: '🏋️' },
  { id: 'beauty', name: 'Friseur & Beauty', icon: '💇' },
  { id: 'hotel', name: 'Hotel & Unterkunft', icon: '🏨' },
  { id: 'entertainment', name: 'Unterhaltung', icon: '🎯' },
  { id: 'supermarket', name: 'Supermarkt', icon: '🛍️' },
  { id: 'pharmacy', name: 'Apotheke', icon: '💊' },
  { id: 'other', name: 'Sonstiges', icon: '🏪' },
];

export default function PartnerPortal() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState('');
  const [partner, setPartner] = useState(null);
  const [view, setView] = useState('login'); // login, register, scanner, vouchers, dashboard, create-voucher, statistics, payouts, profile, verification, staff, marketing
  const [userRole, setUserRole] = useState('admin'); // 'admin' or 'counter'
  const [isStaff, setIsStaff] = useState(false);
  const [language, setLanguage] = useState(() => localStorage.getItem('partner_language') || 'de');
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('partner_remember') === 'true');
  const [marketingTab, setMarketingTab] = useState('referral'); // referral, qr, flash, social, ratings
  
  // Available languages - 19 languages
  const languages = [
    { code: 'ae', name: 'الإمارات', flag: '🇦🇪' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'sq', name: 'Shqip', flag: '🇦🇱' },
    { code: 'xk', name: 'Kosovë', flag: '🇽🇰' },
    { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'us', name: 'English (US)', flag: '🇺🇸' },
    { code: 'pt', name: 'Português', flag: '🇵🇹' },
    { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
    { code: 'pl', name: 'Polski', flag: '🇵🇱' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'ko', name: '한국어', flag: '🇰🇷' },
    { code: 'el', name: 'Ελληνικά', flag: '🇬🇷' },
  ];
  
  // Map language codes to translation keys
  const getLangKey = (code) => {
    const map = { ae: 'ar', us: 'en', xk: 'sq' };
    return map[code] || code;
  };
  
  
  // Translations - Use centralized partnerTranslations
  const t = (key) => {
    const langKey = getLangKey(language);
    return partnerTranslations[langKey]?.[key] || partnerTranslations.de?.[key] || key;
  };
  // Login state
  const [email, setEmail] = useState(() => localStorage.getItem('partner_saved_email') || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginMode, setLoginMode] = useState('admin'); // 'admin' or 'staff'
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  
  // Registration state - extended
  const [regStep, setRegStep] = useState(1); // 1: Business Type, 2: Basic Info, 3: Details
  const [regData, setRegData] = useState({
    business_type: '',
    business_name: '',
    email: '',
    password: '',
    password_confirm: '',
    phone: '',
    address: '',
    city: '',
    postal_code: '',
    country: 'Deutschland',
    description: '',
    website: '',
    tax_id: '',
    iban: '',
    contact_person: '',
    logo_url: ''
  });
  
  // Scanner state
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [redeeming, setRedeeming] = useState(false);
  const html5QrCodeRef = useRef(null);
  
  // Dashboard state
  const [dashboardData, setDashboardData] = useState(null);
  const [vouchers, setVouchers] = useState([]);
  
  // Statistics state
  const [statistics, setStatistics] = useState(null);
  
  // Wise Payout state (Stripe removed - only Wise)
  const [payoutHistory, setPayoutHistory] = useState([]);
  const [wiseStatus, setWiseStatus] = useState(null);
  const [wiseSetupForm, setWiseSetupForm] = useState({ account_holder_name: '', iban: '' });
  const [showWiseSetup, setShowWiseSetup] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState(''); // Custom payout amount
  
  // Verification state
  const [documents, setDocuments] = useState([]);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [documentTypes, setDocumentTypes] = useState([]);
  
  // Create voucher state
  const [newVoucher, setNewVoucher] = useState({
    name: '',
    description: '',
    value: '',
    price: '',
    quantity: 1,
    valid_until: '',
    terms: ''
  });

  // Check for saved session
  useEffect(() => {
    const savedToken = localStorage.getItem('partner_token');
    const savedPartner = localStorage.getItem('partner_data');
    const savedRole = localStorage.getItem('partner_role');
    const savedIsStaff = localStorage.getItem('partner_is_staff');
    if (savedToken && savedPartner) {
      setToken(savedToken);
      setPartner(JSON.parse(savedPartner));
      setIsLoggedIn(true);
      setUserRole(savedRole || 'admin');
      setIsStaff(savedIsStaff === 'true');
      setView('dashboard');
    }
  }, []);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);
  
  // Save language preference
  useEffect(() => {
    localStorage.setItem('partner_language', language);
  }, [language]);
  
  // Auto-login from saved credentials
  useEffect(() => {
    const savedToken = localStorage.getItem('partner_token');
    const savedPartner = localStorage.getItem('partner_data');
    const savedRole = localStorage.getItem('partner_role');
    const savedIsStaff = localStorage.getItem('partner_is_staff');
    const shouldRemember = localStorage.getItem('partner_remember') === 'true';
    
    if (shouldRemember && savedToken && savedPartner) {
      try {
        const partnerData = JSON.parse(savedPartner);
        setToken(savedToken);
        setPartner(partnerData);
        setUserRole(savedRole || 'admin');
        setIsStaff(savedIsStaff === 'true');
        setIsLoggedIn(true);
        setView(savedRole === 'counter' ? 'scanner' : 'dashboard');
      } catch (e) {
        // Invalid saved data, clear it
        localStorage.removeItem('partner_token');
        localStorage.removeItem('partner_data');
        localStorage.removeItem('partner_role');
        localStorage.removeItem('partner_is_staff');
      }
    }
  }, []);

  // ==================== AUTH ====================
  
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const endpoint = loginMode === 'staff' 
        ? `${API}/api/partner-portal/staff/login`
        : `${API}/api/partner-portal/login`;
      
      // Staff login uses staff_number, admin uses email
      const payload = loginMode === 'staff'
        ? { staff_number: email, password }
        : { email, password };
        
      const response = await axios.post(endpoint, payload);
      const data = response.data;
      
      setToken(data.token);
      setPartner(data.partner);
      setIsLoggedIn(true);
      
      // Set role based on login type
      const role = data.role || data.partner?.role || 'admin';
      setUserRole(role);
      setIsStaff(data.is_staff || false);
      
      // Counter staff goes directly to scanner/pay view
      if (role === 'counter') {
        setView('scanner');
      } else {
        setView('dashboard');
      }
      
      // Save to localStorage (always save for session, remember for persistence)
      localStorage.setItem('partner_token', data.token);
      localStorage.setItem('partner_data', JSON.stringify(data.partner));
      localStorage.setItem('partner_role', role);
      localStorage.setItem('partner_is_staff', String(data.is_staff || false));
      localStorage.setItem('partner_remember', String(rememberMe));
      
      // Also save credentials if remember me is checked
      if (rememberMe) {
        localStorage.setItem('partner_saved_email', email);
      } else {
        localStorage.removeItem('partner_saved_email');
      }
      
      const welcomeName = data.staff?.name || data.partner.name;
      toast.success(language === 'en' ? `Welcome, ${welcomeName}!` : `Willkommen, ${welcomeName}!`);
      
      if (role !== 'counter') {
        fetchDashboard(data.token);
      }
    } catch (err) {
      // Handle axios error response
      const errorMessage = err.response?.data?.detail || 
        (language === 'en' ? 'Invalid credentials' : 'Ungültige Anmeldedaten');
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  const handleLogout = () => {
    setIsLoggedIn(false);
    setToken('');
    setPartner(null);
    setView('login');
    setUserRole('admin');
    setIsStaff(false);
    
    // Clear localStorage but keep remember preference and email
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_data');
    localStorage.removeItem('partner_role');
    localStorage.removeItem('partner_is_staff');
    if (!rememberMe) {
      localStorage.removeItem('partner_saved_email');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    
    // Validation
    if (regData.password !== regData.password_confirm) {
      toast.error('Passwörter stimmen nicht überein');
      return;
    }
    
    if (regData.password.length < 6) {
      toast.error('Passwort muss mindestens 6 Zeichen haben');
      return;
    }
    
    setLoading(true);
    
    try {
      await axios.post(`${API}/api/partner-portal/apply`, {
        business_type: regData.business_type,
        business_name: regData.business_name,
        email: regData.email,
        password: regData.password,
        phone: regData.phone,
        address: regData.address,
        city: regData.city,
        postal_code: regData.postal_code,
        country: regData.country,
        description: regData.description,
        website: regData.website,
        tax_id: regData.tax_id,
        iban: regData.iban,
        contact_person: regData.contact_person,
        logo_url: regData.logo_url
      });
      
      toast.success('Bewerbung erfolgreich eingereicht! Sie erhalten eine E-Mail nach der Prüfung.');
      setView('login');
      setRegStep(1);
      setRegData({
        business_type: '',
        business_name: '',
        email: '',
        password: '',
        password_confirm: '',
        phone: '',
        address: '',
        city: '',
        postal_code: '',
        country: 'Deutschland',
        description: '',
        website: '',
        tax_id: '',
        iban: '',
        contact_person: '',
        logo_url: ''
      });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registrierung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  // Staff management state
  const [staffList, setStaffList] = useState([]);
  const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '', role: 'counter' });
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [editStaffData, setEditStaffData] = useState({ name: '', email: '', role: 'counter' });
  
  const fetchStaff = async () => {
    if (!token) return;
    setLoadingStaff(true);
    try {
      const response = await axios.get(`${API}/api/partner-portal/staff?token=${token}`);
      setStaffList(response.data.staff || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setLoadingStaff(false);
    }
  };
  
  const createStaff = async (e) => {
    e.preventDefault();
    if (!newStaff.name || !newStaff.email || !newStaff.password) {
      toast.error(language === 'en' ? 'Please fill all fields' : 'Bitte alle Felder ausfüllen');
      return;
    }
    
    try {
      await axios.post(`${API}/api/partner-portal/staff/create?token=${token}`, newStaff);
      toast.success(language === 'en' ? 'Staff account created' : 'Mitarbeiter-Konto erstellt');
      setNewStaff({ name: '', email: '', password: '', role: 'counter' });
      fetchStaff();
    } catch (error) {
      toast.error(error.response?.data?.detail || error.message);
    }
  };
  
  const updateStaff = async (staffId) => {
    try {
      await axios.put(`${API}/api/partner-portal/staff/${staffId}?token=${token}`, editStaffData);
      toast.success(language === 'en' ? 'Staff updated' : 'Mitarbeiter aktualisiert');
      setEditingStaff(null);
      fetchStaff();
    } catch (error) {
      toast.error(error.response?.data?.detail || error.message);
    }
  };
  
  const deleteStaff = async (staffId) => {
    if (!confirm(language === 'en' ? 'Delete this staff account?' : 'Mitarbeiter-Konto löschen?')) return;
    
    try {
      await axios.delete(`${API}/api/partner-portal/staff/${staffId}?token=${token}`);
      toast.success(language === 'en' ? 'Staff deleted' : 'Mitarbeiter gelöscht');
      fetchStaff();
    } catch (error) {
      toast.error(error.response?.data?.detail || error.message);
    }
  };

  // ==================== SCANNER ====================
  
  const startScanner = async () => {
    try {
      setScanning(true);
      setScanResult(null);
      
      const html5QrCode = new Html5Qrcode("qr-reader");
      html5QrCodeRef.current = html5QrCode;
      
      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleQRScan(decodedText);
          html5QrCode.stop().catch(() => {});
          setScanning(false);
        },
        () => {}
      );
    } catch (err) {
      setScanning(false);
      toast.error('Kamera-Zugriff verweigert');
    }
  };

  const stopScanner = () => {
    if (html5QrCodeRef.current) {
      html5QrCodeRef.current.stop().catch(() => {});
    }
    setScanning(false);
  };

  const handleQRScan = async (qrData) => {
    const parts = qrData.split(':');
    let code = qrData;
    if (parts[0] === 'BIDBLITZ' && parts.length >= 2) {
      code = parts[1];
    }
    await validateVoucher(code);
  };

  const validateVoucher = async (code) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/api/partner-portal/validate/${code}?token=${token}`);
      setScanResult(response.data);
      if (response.data.valid) {
        toast.success(`Gültiger Gutschein: €${response.data.value}`);
      } else {
        toast.error(response.data.error || 'Ungültiger Gutschein');
      }
    } catch (err) {
      toast.error('Validierung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const handleManualValidate = async (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    await validateVoucher(manualCode.trim());
  };

  const handleRedeem = async () => {
    if (!scanResult?.valid) return;
    setRedeeming(true);
    try {
      const response = await axios.post(`${API}/api/partner-portal/redeem?token=${token}`, { voucher_code: scanResult.code });
      
      toast.success(`✅ Gutschein eingelöst! €${response.data.payout_amount.toFixed(2)} gutgeschrieben.`);
      setScanResult(null);
      setManualCode('');
      fetchDashboard(token);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Einlösung fehlgeschlagen');
    } finally {
      setRedeeming(false);
    }
  };

  // ==================== DASHBOARD ====================
  
  const fetchDashboard = async (authToken = token) => {
    try {
      const response = await axios.get(`${API}/api/partner-portal/dashboard?token=${authToken}`);
      setDashboardData(response.data);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    }
  };

  const fetchVouchers = async () => {
    try {
      const response = await axios.get(`${API}/api/partner-portal/vouchers?token=${token}`);
      setVouchers(response.data.vouchers || []);
    } catch (err) {
      console.error('Vouchers fetch error:', err);
    }
  };

  // ==================== CREATE VOUCHER ====================
  
  const handleCreateVoucher = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await axios.post(`${API}/api/partner-portal/vouchers/create?token=${token}`, {
        name: newVoucher.name,
        description: newVoucher.description,
        value: parseFloat(newVoucher.value),
        price: parseFloat(newVoucher.price),
        quantity: parseInt(newVoucher.quantity),
        valid_until: newVoucher.valid_until || null,
        terms: newVoucher.terms
      });
      
      toast.success(response.data.message);
      setNewVoucher({ name: '', description: '', value: '', price: '', quantity: 1, valid_until: '', terms: '' });
      setView('vouchers');
      fetchVouchers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler beim Erstellen');
    } finally {
      setLoading(false);
    }
  };

  // ==================== STATISTICS ====================
  
  const fetchStatistics = async () => {
    try {
      const response = await axios.get(`${API}/api/partner-portal/statistics?token=${token}`);
      setStatistics(response.data);
    } catch (err) {
      console.error('Statistics fetch error:', err);
    }
  };

  // ==================== WISE PAYOUTS (Sole payout method) ====================
  
  const fetchWiseStatus = async () => {
    try {
      const response = await axios.get(`${API}/api/wise-payouts/account-status?token=${token}`);
      setWiseStatus(response.data);
    } catch (err) {
      console.error('Wise status error:', err);
    }
  };

  const fetchWisePayoutHistory = async () => {
    try {
      const response = await axios.get(`${API}/api/wise-payouts/payout-history?token=${token}`);
      setPayoutHistory(response.data.payouts || []);
    } catch (err) {
      console.error('Wise payout history error:', err);
    }
  };

  const setupWiseAccount = async () => {
    if (!wiseSetupForm.account_holder_name || !wiseSetupForm.iban) {
      toast.error('Bitte füllen Sie alle Felder aus');
      return;
    }
    
    try {
      setLoading(true);
      const response = await axios.post(`${API}/api/wise-payouts/setup-bank-account?token=${token}`, wiseSetupForm);
      
      toast.success(response.data.message || 'Bankkonto erfolgreich verbunden');
      setShowWiseSetup(false);
      fetchWiseStatus();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler beim Verbinden des Bankkontos');
    } finally {
      setLoading(false);
    }
  };

  const requestWisePayout = async (customAmount = null) => {
    const maxAmount = dashboardData?.stats?.pending_payout || 0;
    const amount = customAmount !== null ? parseFloat(customAmount) : maxAmount;
    
    if (isNaN(amount) || amount < 10) {
      toast.error('Mindestbetrag für Auszahlung: €10');
      return;
    }
    
    if (amount > maxAmount) {
      toast.error(`Maximaler Betrag: €${maxAmount.toFixed(2)}`);
      return;
    }
    
    if (!confirm(`Möchten Sie €${amount.toFixed(2)} auf Ihr Bankkonto überweisen?`)) return;
    
    try {
      setLoading(true);
      const response = await axios.post(`${API}/api/wise-payouts/request-payout?token=${token}`, {
        amount: amount,
        reference: `BidBlitz Auszahlung - ${partner?.business_name || 'Partner'}`
      });
      
      toast.success(response.data.message || 'Auszahlung wird verarbeitet');
      setPayoutAmount(''); // Reset input
      fetchDashboard();
      fetchWisePayoutHistory();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler bei der Auszahlung');
    } finally {
      setLoading(false);
    }
  };

  const disconnectWise = async () => {
    if (!confirm('Möchten Sie Ihr Bankkonto wirklich trennen?')) return;
    
    try {
      setLoading(true);
      await axios.delete(`${API}/api/wise-payouts/disconnect?token=${token}`);
      toast.success('Bankkonto getrennt');
      setWiseStatus(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler beim Trennen');
    } finally {
      setLoading(false);
    }
  };

  // ==================== VERIFICATION ====================
  
  const fetchVerificationStatus = async () => {
    try {
      const [statusRes, docsRes, typesRes] = await Promise.all([
        axios.get(`${API}/api/partner-verification/verification-status?token=${token}`),
        axios.get(`${API}/api/partner-verification/my-documents?token=${token}`),
        axios.get(`${API}/api/partner-verification/document-types`)
      ]);
      
      setVerificationStatus(statusRes.data);
      setDocuments(docsRes.data.documents || []);
      setDocumentTypes(typesRes.data);
    } catch (err) {
      console.error('Verification fetch error:', err);
    }
  };

  const uploadDocument = async (file, docType) => {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('document_type', docType);
    
    try {
      setLoading(true);
      const response = await axios.post(`${API}/api/partner-verification/upload-document?token=${token}`, formData);
      
      toast.success(response.data.message);
      fetchVerificationStatus();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn && view === 'dashboard') {
      fetchDashboard();
    } else if (isLoggedIn && view === 'vouchers') {
      fetchVouchers();
    } else if (isLoggedIn && view === 'statistics') {
      fetchStatistics();
    } else if (isLoggedIn && view === 'payouts') {
      fetchWiseStatus();
      fetchWisePayoutHistory();
      fetchDashboard();
    } else if (isLoggedIn && view === 'verification') {
      fetchVerificationStatus();
    }
  }, [view, isLoggedIn]);

  // ==================== RENDER ====================

  // Login View
  if (!isLoggedIn && view === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Language Selector */}
            <div className="flex justify-end mb-4 relative">
              <button
                onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border hover:border-amber-300"
              >
                <span>{languages.find(l => l.code === language)?.flag}</span>
                <span>{languages.find(l => l.code === language)?.name}</span>
                <Languages className="w-4 h-4" />
              </button>
              
              {showLanguageMenu && (
                <div className="absolute top-full right-0 mt-1 bg-white border rounded-lg shadow-lg py-1 z-50 min-w-[150px]">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code);
                        setShowLanguageMenu(false);
                        localStorage.setItem('partner_language', lang.code);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-amber-50 ${
                        language === lang.code ? 'bg-amber-50 text-amber-600' : 'text-gray-700'
                      }`}
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Logo */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Store className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800">Partner Portal</h1>
              <p className="text-gray-500 text-sm">BidBlitz {t('voucherSystem')}</p>
            </div>
            
            {/* Login Mode Toggle */}
            <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setLoginMode('admin')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                  loginMode === 'admin' 
                    ? 'bg-white shadow text-amber-600' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <User className="w-4 h-4 inline mr-1" />
                {t('adminLogin')}
              </button>
              <button
                onClick={() => setLoginMode('staff')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                  loginMode === 'staff' 
                    ? 'bg-white shadow text-amber-600' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Users className="w-4 h-4 inline mr-1" />
                {t('staffLogin')}
              </button>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {loginMode === 'staff' 
                    ? (language === 'en' ? 'Staff Number' : 'Kundennummer')
                    : t('email')
                  }
                </label>
                <div className="relative">
                  {loginMode === 'staff' ? (
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  ) : (
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  )}
                  <Input
                    type={loginMode === 'staff' ? 'text' : 'email'}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={loginMode === 'staff' ? 'z.B. PR-001-001' : 'partner@example.de'}
                    className="pl-10 font-mono"
                    required
                  />
                </div>
                {loginMode === 'staff' && (
                  <p className="text-xs text-gray-500 mt-1">
                    {language === 'en' 
                      ? 'Enter the staff number provided by your employer'
                      : 'Geben Sie die Kundennummer ein, die Sie von Ihrem Arbeitgeber erhalten haben'}
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('password')}</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              
              {/* Remember Me Checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="remember-me"
                  checked={rememberMe}
                  onChange={(e) => {
                    setRememberMe(e.target.checked);
                    localStorage.setItem('partner_remember', String(e.target.checked));
                  }}
                  className="w-4 h-4 text-amber-500 border-gray-300 rounded focus:ring-amber-500"
                />
                <label htmlFor="remember-me" className="text-sm text-gray-600">
                  {t('rememberMe')}
                </label>
              </div>
              
              <Button 
                type="submit" 
                disabled={loading}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('login')}
              </Button>
            </form>
            
            {loginMode === 'admin' && (
              <div className="mt-6 text-center">
                <p className="text-gray-500 text-sm">{t('notPartner')}</p>
                <button 
                  onClick={() => setView('register')}
                  className="text-amber-600 font-medium hover:underline"
                >
                  {t('applyNow')}
                </button>
              </div>
            )}
            
            {loginMode === 'staff' && (
              <div className="mt-6 p-3 bg-blue-50 rounded-lg">
                <p className="text-blue-700 text-xs text-center">
                  {t('counterInfo')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Registration View - Multi-Step
  if (!isLoggedIn && view === 'register') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800">Partner werden</h1>
              <p className="text-gray-500">Verkaufen Sie Ihre Gutscheine auf BidBlitz</p>
            </div>
            
            {/* Progress Steps */}
            <div className="flex items-center justify-center gap-2 mb-8">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    regStep >= step 
                      ? 'bg-amber-500 text-white' 
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {step}
                  </div>
                  {step < 3 && (
                    <div className={`w-12 h-1 ${regStep > step ? 'bg-amber-500' : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>
            
            <form onSubmit={regStep === 3 ? handleRegister : (e) => { e.preventDefault(); setRegStep(regStep + 1); }}>
              {/* Step 1: Business Type */}
              {regStep === 1 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-bold text-gray-800 mb-4">Geschäftstyp wählen</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {BUSINESS_TYPES.map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setRegData({ ...regData, business_type: type.id })}
                        className={`p-4 rounded-xl border-2 text-center transition-all ${
                          regData.business_type === type.id
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-gray-200 hover:border-amber-300'
                        }`}
                      >
                        <span className="text-3xl block mb-1">{type.icon}</span>
                        <span className="text-sm font-medium text-gray-700">{type.name}</span>
                      </button>
                    ))}
                  </div>
                  
                  <Button 
                    type="submit"
                    disabled={!regData.business_type}
                    className="w-full mt-6 bg-amber-500 hover:bg-amber-600"
                  >
                    Weiter <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}
              
              {/* Step 2: Basic Info */}
              {regStep === 2 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-bold text-gray-800 mb-4">Grunddaten</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Firmenname *
                      </label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input
                          value={regData.business_name}
                          onChange={(e) => setRegData({ ...regData, business_name: e.target.value })}
                          placeholder="z.B. Pizzeria Roma"
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail *</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input
                          type="email"
                          value={regData.email}
                          onChange={(e) => setRegData({ ...regData, email: e.target.value })}
                          placeholder="info@firma.de"
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Telefon *</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input
                          type="tel"
                          value={regData.phone}
                          onChange={(e) => setRegData({ ...regData, phone: e.target.value })}
                          placeholder="+49 30 12345678"
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Passwort *</label>
                      <Input
                        type="password"
                        value={regData.password}
                        onChange={(e) => setRegData({ ...regData, password: e.target.value })}
                        placeholder="Min. 6 Zeichen"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Passwort bestätigen *</label>
                      <Input
                        type="password"
                        value={regData.password_confirm}
                        onChange={(e) => setRegData({ ...regData, password_confirm: e.target.value })}
                        placeholder="Passwort wiederholen"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-3 mt-6">
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={() => setRegStep(1)}
                      className="flex-1"
                    >
                      Zurück
                    </Button>
                    <Button 
                      type="submit"
                      disabled={!regData.business_name || !regData.email || !regData.phone || !regData.password}
                      className="flex-1 bg-amber-500 hover:bg-amber-600"
                    >
                      Weiter <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Step 3: Details & Submit */}
              {regStep === 3 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-bold text-gray-800 mb-4">Details & Adresse</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Adresse *</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input
                          value={regData.address}
                          onChange={(e) => setRegData({ ...regData, address: e.target.value })}
                          placeholder="Straße und Hausnummer"
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">PLZ *</label>
                      <Input
                        value={regData.postal_code}
                        onChange={(e) => setRegData({ ...regData, postal_code: e.target.value })}
                        placeholder="12345"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Stadt *</label>
                      <Input
                        value={regData.city}
                        onChange={(e) => setRegData({ ...regData, city: e.target.value })}
                        placeholder="Berlin"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input
                          type="url"
                          value={regData.website}
                          onChange={(e) => setRegData({ ...regData, website: e.target.value })}
                          placeholder="https://www.example.de"
                          className="pl-10"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ansprechpartner</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input
                          value={regData.contact_person}
                          onChange={(e) => setRegData({ ...regData, contact_person: e.target.value })}
                          placeholder="Max Mustermann"
                          className="pl-10"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Steuernummer</label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input
                          value={regData.tax_id}
                          onChange={(e) => setRegData({ ...regData, tax_id: e.target.value })}
                          placeholder="DE123456789"
                          className="pl-10"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">IBAN (für Auszahlungen)</label>
                      <div className="relative">
                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input
                          value={regData.iban}
                          onChange={(e) => setRegData({ ...regData, iban: e.target.value })}
                          placeholder="DE89 3704 0044 0532 0130 00"
                          className="pl-10"
                        />
                      </div>
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                      <textarea
                        value={regData.description}
                        onChange={(e) => setRegData({ ...regData, description: e.target.value })}
                        placeholder="Kurze Beschreibung Ihres Geschäfts..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                  
                  {/* Commission Info */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4">
                    <h3 className="font-bold text-amber-800 mb-2">💰 Provision</h3>
                    <p className="text-amber-700 text-sm">
                      BidBlitz behält eine Provision von 8-12% (je nach Geschäftstyp) auf verkaufte Gutscheine. 
                      Der Rest wird Ihnen nach der Einlösung gutgeschrieben.
                    </p>
                  </div>
                  
                  <div className="flex gap-3 mt-6">
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={() => setRegStep(2)}
                      className="flex-1"
                    >
                      Zurück
                    </Button>
                    <Button 
                      type="submit"
                      disabled={loading || !regData.address || !regData.city || !regData.postal_code}
                      className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Bewerbung absenden'}
                    </Button>
                  </div>
                </div>
              )}
            </form>
            
            {/* Back to Login */}
            <div className="mt-6 text-center">
              <button 
                onClick={() => { setView('login'); setRegStep(1); }}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                ← Zurück zum Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Logged In Views
  if (isLoggedIn) {
    const businessTypeInfo = BUSINESS_TYPES.find(bt => bt.id === partner?.business_type) || BUSINESS_TYPES[0];
    
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center text-xl">
                {businessTypeInfo.icon}
              </div>
              <div>
                <p className="font-bold text-gray-800">{partner?.name}</p>
                <p className="text-xs text-gray-500">{businessTypeInfo.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Language Selector in Dashboard */}
              <div className="relative">
                <button
                  onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100"
                >
                  <span>{languages.find(l => l.code === language)?.flag}</span>
                  <Languages className="w-4 h-4" />
                </button>
                
                {showLanguageMenu && (
                  <div className="absolute top-full right-0 mt-1 bg-white border rounded-lg shadow-lg py-1 z-50 min-w-[140px]">
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code);
                          setShowLanguageMenu(false);
                          localStorage.setItem('partner_language', lang.code);
                        }}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-amber-50 flex items-center gap-2 ${
                          language === lang.code ? 'bg-amber-50 text-amber-700' : 'text-gray-700'
                        }`}
                      >
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={handleLogout} className="text-gray-500 hover:text-red-500">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>
        
        {/* Navigation */}
        <nav className="bg-white border-b sticky top-14 z-10">
          <div className="max-w-4xl mx-auto px-4 flex gap-1 overflow-x-auto">
            {[
              // Admin-only tabs
              ...(userRole === 'admin' ? [{ id: 'dashboard', label: t('dashboard'), icon: BarChart3 }] : []),
              // Both roles
              { id: 'scanner', label: t('scanner'), icon: Scan },
              { id: 'bidblitz-pay', label: t('pay'), icon: CreditCard },
              // Admin-only tabs
              ...(userRole === 'admin' ? [
                { id: 'vouchers', label: t('vouchers'), icon: Ticket },
                { id: 'budget', label: 'Guthaben', icon: Wallet },
                { id: 'statistics', label: t('statistics'), icon: TrendingUp },
                { id: 'payouts', label: t('payouts'), icon: Euro },
                { id: 'marketing', label: 'Marketing', icon: Share2 },
                { id: 'verification', label: t('verification'), icon: Shield },
                { id: 'profile', label: t('profile'), icon: User },
                { id: 'staff', label: t('staff'), icon: Users },
              ] : []),
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'staff') fetchStaff();
                  setView(item.id);
                }}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  view === item.id
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </div>
        </nav>
        
        {/* Content */}
        <main className="max-w-4xl mx-auto px-4 py-6">
          {/* Dashboard View - Admin Only - Using Expanded Component */}
          {view === 'dashboard' && userRole === 'admin' && dashboardData && (
            <PartnerDashboardExpanded
              token={token}
              partner={partner}
              dashboardData={dashboardData}
              fetchDashboard={fetchDashboard}
              setView={setView}
              language={language}
            />
          )}
          
          {/* Scanner View */}
          {/* Scanner View - Using PartnerScanner Component */}
          {view === 'scanner' && (
            <PartnerScanner 
              token={token}
              fetchDashboard={fetchDashboard}
              t={t}
            />
          )}

          {/* BidBlitz Pay View - Payment Scanner for Customer QR Codes */}
          {view === 'bidblitz-pay' && (
            <BidBlitzPayPartner token={token} partnerId={partner?.id} partnerName={partner?.name} commissionRate={partner?.commission_rate || 10} />
          )}
          
          {/* Vouchers View - Using PartnerVouchers Component */}
          {(view === 'vouchers' || view === 'create-voucher') && (
            <PartnerVouchers 
              token={token}
              partner={partner}
              fetchDashboard={fetchDashboard}
              t={t}
            />
          )}

          {/* Statistics View - Using PartnerStatistics Component */}
          {view === 'statistics' && (
            <PartnerStatistics 
              token={token}
              partner={partner}
              t={t}
            />
          )}

          {/* Payouts View - Using PartnerPayouts Component */}
          {view === 'payouts' && (
            <PartnerPayouts 
              token={token}
              partner={partner}
              dashboardData={dashboardData}
              fetchDashboard={fetchDashboard}
              t={t}
            />
          )}

          {/* Budget View - Voucher Budget & Earnings */}
          {view === 'budget' && (
            <PartnerBudget 
              token={token}
              language={language}
            />
          )}

          {/* Marketing View - New Marketing Features */}
          {view === 'marketing' && (
            <div className="space-y-8">
              {/* Marketing Sub-Navigation */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { id: 'referral', label: 'Empfehlungen', icon: '👥' },
                  { id: 'qr', label: 'QR-Codes', icon: '📱' },
                  { id: 'flash', label: 'Flash Sales', icon: '⚡' },
                  { id: 'social', label: 'Social Media', icon: '📣' },
                  { id: 'ratings', label: 'Bewertungen', icon: '⭐' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setMarketingTab(tab.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      marketingTab === tab.id
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              {/* Marketing Content */}
              {marketingTab === 'referral' && (
                <PartnerReferral token={token} t={t} />
              )}
              {marketingTab === 'qr' && (
                <PartnerQRCodes token={token} partner={partner} t={t} />
              )}
              {marketingTab === 'flash' && (
                <PartnerFlashSales token={token} t={t} />
              )}
              {marketingTab === 'social' && (
                <PartnerSocialSharing token={token} t={t} />
              )}
              {marketingTab === 'ratings' && (
                <PartnerRatingsOverview token={token} partnerId={partner?.id} t={t} />
              )}
            </div>
          )}

          {/* Verification View - Using PartnerVerification Component */}
          {view === 'verification' && (
            <PartnerVerification 
              token={token}
              t={t}
            />
          )}

          {/* Profile View - Using PartnerProfile Component */}
          {view === 'profile' && (
            <PartnerProfile 
              token={token}
              partner={partner}
              setPartner={setPartner}
              t={t}
            />
          )}
          
          {/* Staff Management View - Admin Only */}
          {/* Staff View - Using PartnerStaff Component */}
          {view === 'staff' && userRole === 'admin' && (
            <PartnerStaff 
              token={token}
              language={language}
              t={t}
            />
          )}
        </main>
      </div>
    );
  }

  return null;
}

// BidBlitz Pay Partner Component - Payment Scanner
function BidBlitzPayPartner({ token, partnerId, partnerName, commissionRate }) {
  const [step, setStep] = useState('amount'); // 'amount' -> 'scan' -> 'confirm'
  const [scanning, setScanning] = useState(false);
  const [customerData, setCustomerData] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [manualQR, setManualQR] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(null);
  const html5QrCodeRef = useRef(null);
  const scannerStarted = useRef(false);

  const startScanner = async () => {
    if (scannerStarted.current) return;
    scannerStarted.current = true;
    setScanning(true);
    setCustomerData(null);
    
    try {
      // Small delay to ensure DOM element is ready
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const html5QrCode = new Html5Qrcode("bidblitz-pay-scanner");
      html5QrCodeRef.current = html5QrCode;
      
      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        async (decodedText) => {
          await html5QrCode.stop();
          scannerStarted.current = false;
          setScanning(false);
          handleQRScanned(decodedText);
        },
        () => {}
      );
    } catch (err) {
      console.error("Scanner error:", err);
      scannerStarted.current = false;
      setScanning(false);
      toast.error("Kamera-Zugriff nicht möglich. Bitte QR-Code manuell eingeben.");
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
      } catch {}
    }
    scannerStarted.current = false;
    setScanning(false);
  };

  // Auto-start camera when moving to scan step
  useEffect(() => {
    if (step === 'scan' && !scanning && !scannerStarted.current) {
      startScanner();
    }
    return () => {
      if (step !== 'scan') {
        stopScanner();
      }
    };
  }, [step]);

  const handleQRScanned = async (qrData) => {
    try {
      const response = await axios.get(
        `${API}/api/bidblitz-pay/scan-customer?qr_data=${encodeURIComponent(qrData)}&token=${token}`
      );
      
      setCustomerData(response.data);
      setStep('confirm');
      toast.success(`Kunde gefunden: ${response.data.customer.name}`);
    } catch (error) {
      console.error("Scan error:", error);
      toast.error(error.response?.data?.detail || "Ungültiger QR-Code");
    }
  };

  const handleManualInput = async (e) => {
    e.preventDefault();
    if (!manualQR.trim()) return;
    handleQRScanned(manualQR.trim());
    setManualQR('');
  };

  const proceedToScan = () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error("Bitte gültigen Betrag eingeben");
      return;
    }
    setStep('scan');
  };

  const processPayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error("Bitte gültigen Betrag eingeben");
      return;
    }
    
    if (amount > (customerData?.available_balance?.total || 0)) {
      toast.error("Nicht genug Guthaben beim Kunden");
      return;
    }
    
    setProcessing(true);
    
    try {
      const response = await axios.post(
        `${API}/api/bidblitz-pay/process-payment?token=${token}&payment_token=${customerData.payment_token}&amount=${amount}&use_partner_vouchers=true&use_universal=true`
      );
      
      setPaymentSuccess(response.data);
      setCustomerData(null);
      setPaymentAmount('');
      setStep('amount');
      toast.success(`Zahlung von €${amount.toFixed(2)} erfolgreich!`);
    } catch (error) {
      console.error("Payment error:", error);
      toast.error(error.response?.data?.detail || "Zahlung fehlgeschlagen");
    } finally {
      setProcessing(false);
    }
  };

  const resetFlow = () => {
    setStep('amount');
    setPaymentAmount('');
    setCustomerData(null);
    setPaymentSuccess(null);
    stopScanner();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
          <CreditCard className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="font-bold text-gray-800 text-xl">BidBlitz Pay</h2>
          <p className="text-sm text-gray-500">Kunden-Zahlungen akzeptieren</p>
        </div>
      </div>

      {/* Success Message */}
      {paymentSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-green-700 mb-2">Zahlung erfolgreich!</h3>
          <p className="text-3xl font-bold text-green-600 mb-4">€{paymentSuccess.amount.toFixed(2)}</p>
          <div className="bg-white rounded-lg p-4 text-left space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Transaktions-ID:</span>
              <span className="font-mono">{paymentSuccess.transaction_id}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Sie erhalten:</span>
              <span className="font-bold text-green-600">€{paymentSuccess.partner_receives.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Provision ({commissionRate}%):</span>
              <span className="text-gray-600">€{paymentSuccess.commission.toFixed(2)}</span>
            </div>
          </div>
          <Button 
            onClick={resetFlow}
            className="mt-4 bg-green-500 hover:bg-green-600"
          >
            Weitere Zahlung
          </Button>
        </div>
      )}

      {/* Step 1: Enter Amount FIRST */}
      {!paymentSuccess && step === 'amount' && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Euro className="w-5 h-5 text-amber-500" />
            1. Zahlungsbetrag eingeben
          </h3>
          
          <div className="space-y-4">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xl">€</span>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                className="pl-10 text-3xl h-16 font-bold text-center"
                step="0.01"
                min="0.01"
                autoFocus
              />
            </div>
            
            {/* Quick Amounts */}
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 20, 50].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setPaymentAmount(String(amt))}
                  className={`py-3 rounded-lg border text-lg font-medium transition-all ${
                    parseFloat(paymentAmount) === amt
                      ? 'border-amber-500 bg-amber-50 text-amber-700'
                      : 'border-gray-200 hover:border-amber-300'
                  }`}
                >
                  €{amt}
                </button>
              ))}
            </div>
            
            <Button 
              onClick={proceedToScan}
              className="w-full h-14 bg-amber-500 hover:bg-amber-600 text-lg"
              disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
            >
              <QrCode className="w-5 h-5 mr-2" />
              Weiter zum Scannen
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Scan QR (Camera auto-starts) */}
      {!paymentSuccess && step === 'scan' && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Camera className="w-5 h-5 text-amber-500" />
              2. Kunden-QR scannen
            </h3>
            <div className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm font-medium">
              €{parseFloat(paymentAmount).toFixed(2)}
            </div>
          </div>
          
          <div id="bidblitz-pay-scanner" className="w-full max-w-sm mx-auto rounded-lg overflow-hidden bg-black min-h-[250px]" />
          
          {scanning && (
            <p className="text-center text-sm text-gray-500 mt-2 animate-pulse">
              Scannen aktiv - bitte Kunden-QR zeigen...
            </p>
          )}
          
          <div className="flex gap-2 mt-4">
            <Button onClick={() => setStep('amount')} variant="outline" className="flex-1">
              Zurück
            </Button>
            <Button onClick={stopScanner} variant="outline" className="flex-1">
              <X className="w-4 h-4 mr-2" />
              Scanner beenden
            </Button>
          </div>
          
          {/* Manual Input */}
          <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-gray-500 mb-3">Oder QR-Code manuell eingeben:</p>
            <form onSubmit={handleManualInput} className="flex gap-2">
              <Input
                value={manualQR}
                onChange={(e) => setManualQR(e.target.value)}
                placeholder="BIDBLITZ-PAY:xxxxx"
                className="flex-1"
              />
              <Button type="submit">Prüfen</Button>
            </form>
          </div>
        </div>
      )}

      {/* Step 3: Customer Found - Confirm Payment */}
      {!paymentSuccess && step === 'confirm' && customerData && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            3. Zahlung bestätigen
          </h3>
          
          <div className="flex items-center gap-3 mb-6 pb-4 border-b">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="font-bold text-gray-800">{customerData.customer.name}</p>
              <p className="text-sm text-gray-500">{customerData.customer.email}</p>
            </div>
            <CheckCircle className="w-6 h-6 text-green-500 ml-auto" />
          </div>

          {/* Available Balance */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-700 mb-2">Verfügbares Guthaben:</p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-500">Partner</p>
                <p className="font-bold text-lg text-amber-600">
                  €{customerData.available_balance.partner_specific.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Universal</p>
                <p className="font-bold text-lg text-purple-600">
                  €{customerData.available_balance.universal.toFixed(2)}
                </p>
              </div>
              <div className="bg-white rounded-lg p-2">
                <p className="text-xs text-gray-500">Gesamt</p>
                <p className="font-bold text-xl text-green-600">
                  €{customerData.available_balance.total.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Payment Amount - already entered */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-center">
            <p className="text-sm text-green-700 mb-1">Zahlungsbetrag:</p>
            <p className="text-4xl font-bold text-green-600">€{parseFloat(paymentAmount).toFixed(2)}</p>
            {parseFloat(paymentAmount) > customerData.available_balance.total && (
              <p className="text-red-500 text-sm mt-2">
                ⚠️ Betrag übersteigt verfügbares Guthaben
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={resetFlow}
              className="flex-1"
            >
              Abbrechen
            </Button>
            <Button 
              onClick={processPayment}
              disabled={processing || parseFloat(paymentAmount) > customerData.available_balance.total}
              className="flex-1 bg-green-500 hover:bg-green-600 h-14"
            >
              {processing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Zahlung bestätigen
                </>
              )}
            </Button>
          </div>

          {/* Info */}
          <div className="mt-6 pt-4 border-t text-sm text-gray-500">
            <p>Sie erhalten: <span className="font-bold text-green-600">
              €{((parseFloat(paymentAmount) || 0) * (1 - commissionRate / 100)).toFixed(2)}
            </span> (nach {commissionRate}% Provision)</p>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">So funktioniert BidBlitz Pay:</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-700">
              <li>Kunde zeigt QR-Code aus seiner BidBlitz App</li>
              <li>Sie scannen den QR-Code</li>
              <li>Geben Sie den Zahlungsbetrag ein</li>
              <li>Betrag wird vom Kundenguthaben abgezogen</li>
              <li>Sie erhalten Gutschrift (abzgl. {commissionRate}% Provision)</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
