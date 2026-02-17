/**
 * Partner Portal - Multi-Business Registration, QR Scanner & Voucher Management
 * Supports: Restaurants, Bars, Gas Stations, Cinemas, Retail, Wellness, Fitness, etc.
 * Features: Statistics with Charts, Stripe Connect Payouts, Document Verification
 */
import { useState, useEffect, useRef } from 'react';
import { 
  QrCode, Scan, Check, X, Euro, History, LogOut, Camera, Loader2, 
  AlertCircle, CheckCircle, Building2, MapPin, Phone, Mail, Globe,
  FileText, CreditCard, User, Plus, Ticket, BarChart3, Clock,
  ChevronRight, Upload, Store, TrendingUp, Shield, ExternalLink,
  PieChart, Trash2, Eye, Download
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { Html5Qrcode } from 'html5-qrcode';

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
  const [view, setView] = useState('login'); // login, register, scanner, vouchers, dashboard, create-voucher, statistics, payouts, profile, verification
  
  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
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
  
  // Stripe Connect state
  const [stripeStatus, setStripeStatus] = useState(null);
  const [payoutHistory, setPayoutHistory] = useState([]);
  
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
    if (savedToken && savedPartner) {
      setToken(savedToken);
      setPartner(JSON.parse(savedPartner));
      setIsLoggedIn(true);
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

  // ==================== AUTH ====================
  
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch(`${API}/api/partner-portal/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Login fehlgeschlagen');
      }
      
      setToken(data.token);
      setPartner(data.partner);
      setIsLoggedIn(true);
      setView('dashboard');
      
      localStorage.setItem('partner_token', data.token);
      localStorage.setItem('partner_data', JSON.stringify(data.partner));
      
      toast.success(`Willkommen, ${data.partner.name}!`);
      fetchDashboard(data.token);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
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
      const response = await fetch(`${API}/api/partner-portal/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Registrierung fehlgeschlagen');
      }
      
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
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken('');
    setPartner(null);
    setIsLoggedIn(false);
    setView('login');
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_data');
    toast.success('Abgemeldet');
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
      const response = await fetch(`${API}/api/partner-portal/validate/${code}?token=${token}`);
      const data = await response.json();
      setScanResult(data);
      if (data.valid) {
        toast.success(`Gültiger Gutschein: €${data.value}`);
      } else {
        toast.error(data.error || 'Ungültiger Gutschein');
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
      const response = await fetch(`${API}/api/partner-portal/redeem?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voucher_code: scanResult.code })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Einlösung fehlgeschlagen');
      
      toast.success(`✅ Gutschein eingelöst! €${data.payout_amount.toFixed(2)} gutgeschrieben.`);
      setScanResult(null);
      setManualCode('');
      fetchDashboard(token);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRedeeming(false);
    }
  };

  // ==================== DASHBOARD ====================
  
  const fetchDashboard = async (authToken = token) => {
    try {
      const response = await fetch(`${API}/api/partner-portal/dashboard?token=${authToken}`);
      const data = await response.json();
      setDashboardData(data);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    }
  };

  const fetchVouchers = async () => {
    try {
      const response = await fetch(`${API}/api/partner-portal/vouchers?token=${token}`);
      const data = await response.json();
      setVouchers(data.vouchers || []);
    } catch (err) {
      console.error('Vouchers fetch error:', err);
    }
  };

  // ==================== CREATE VOUCHER ====================
  
  const handleCreateVoucher = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch(`${API}/api/partner-portal/vouchers/create?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newVoucher.name,
          description: newVoucher.description,
          value: parseFloat(newVoucher.value),
          price: parseFloat(newVoucher.price),
          quantity: parseInt(newVoucher.quantity),
          valid_until: newVoucher.valid_until || null,
          terms: newVoucher.terms
        })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Fehler beim Erstellen');
      
      toast.success(data.message);
      setNewVoucher({ name: '', description: '', value: '', price: '', quantity: 1, valid_until: '', terms: '' });
      setView('vouchers');
      fetchVouchers();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ==================== STATISTICS ====================
  
  const fetchStatistics = async () => {
    try {
      const response = await fetch(`${API}/api/partner-portal/statistics?token=${token}`);
      const data = await response.json();
      setStatistics(data);
    } catch (err) {
      console.error('Statistics fetch error:', err);
    }
  };

  // ==================== STRIPE CONNECT ====================
  
  const fetchStripeStatus = async () => {
    try {
      const response = await fetch(`${API}/api/partner-stripe/account-status?token=${token}`);
      const data = await response.json();
      setStripeStatus(data);
    } catch (err) {
      console.error('Stripe status error:', err);
    }
  };

  const fetchPayoutHistory = async () => {
    try {
      const response = await fetch(`${API}/api/partner-stripe/payout-history?token=${token}`);
      const data = await response.json();
      setPayoutHistory(data.payouts || []);
    } catch (err) {
      console.error('Payout history error:', err);
    }
  };

  const connectStripe = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/api/partner-stripe/create-connect-account?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          return_url: `${window.location.origin}/partner-portal?stripe=success`,
          refresh_url: `${window.location.origin}/partner-portal?stripe=refresh`
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail);
      
      // Redirect to Stripe onboarding
      window.location.href = data.url;
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const requestStripePayout = async () => {
    if (!confirm(`Möchten Sie €${(dashboardData?.stats?.pending_payout || 0).toFixed(2)} via Stripe auszahlen?`)) return;
    
    try {
      setLoading(true);
      const response = await fetch(`${API}/api/partner-stripe/request-payout?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail);
      
      toast.success(data.message);
      fetchDashboard();
      fetchPayoutHistory();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ==================== VERIFICATION ====================
  
  const fetchVerificationStatus = async () => {
    try {
      const [statusRes, docsRes, typesRes] = await Promise.all([
        fetch(`${API}/api/partner-verification/verification-status?token=${token}`),
        fetch(`${API}/api/partner-verification/my-documents?token=${token}`),
        fetch(`${API}/api/partner-verification/document-types`)
      ]);
      
      const status = await statusRes.json();
      const docs = await docsRes.json();
      const types = await typesRes.json();
      
      setVerificationStatus(status);
      setDocuments(docs.documents || []);
      setDocumentTypes(types);
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
      const response = await fetch(`${API}/api/partner-verification/upload-document?token=${token}`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail);
      
      toast.success(data.message);
      fetchVerificationStatus();
    } catch (err) {
      toast.error(err.message);
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
      fetchStripeStatus();
      fetchPayoutHistory();
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
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Store className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800">Partner Portal</h1>
              <p className="text-gray-500 text-sm">BidBlitz Gutschein-System</p>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="partner@example.de"
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              
              <Button 
                type="submit" 
                disabled={loading}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Anmelden'}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-gray-500 text-sm">Noch kein Partner?</p>
              <button 
                onClick={() => setView('register')}
                className="text-amber-600 font-medium hover:underline"
              >
                Jetzt bewerben
              </button>
            </div>
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
            <button onClick={handleLogout} className="text-gray-500 hover:text-red-500">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>
        
        {/* Navigation */}
        <nav className="bg-white border-b sticky top-14 z-10">
          <div className="max-w-4xl mx-auto px-4 flex gap-1 overflow-x-auto">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { id: 'scanner', label: 'Scanner', icon: Scan },
              { id: 'vouchers', label: 'Gutscheine', icon: Ticket },
              { id: 'statistics', label: 'Statistiken', icon: BarChart3 },
              { id: 'payouts', label: 'Auszahlungen', icon: Euro },
              { id: 'profile', label: 'Profil', icon: User },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
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
          {/* Dashboard View */}
          {view === 'dashboard' && dashboardData && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <p className="text-gray-500 text-sm">Ausstehend</p>
                  <p className="text-2xl font-bold text-green-600">€{dashboardData.stats.pending_payout?.toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <p className="text-gray-500 text-sm">Eingelöst</p>
                  <p className="text-2xl font-bold text-amber-600">{dashboardData.stats.total_redeemed}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <p className="text-gray-500 text-sm">Verkauft</p>
                  <p className="text-2xl font-bold text-blue-600">{dashboardData.vouchers.sold}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <p className="text-gray-500 text-sm">Provision</p>
                  <p className="text-2xl font-bold text-gray-600">{partner?.commission_rate}%</p>
                </div>
              </div>
              
              {/* Recent Redemptions */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b flex items-center justify-between">
                  <h2 className="font-bold text-gray-800">Letzte Einlösungen</h2>
                  <History className="w-5 h-5 text-gray-400" />
                </div>
                <div className="divide-y">
                  {dashboardData.recent_redemptions?.length > 0 ? (
                    dashboardData.recent_redemptions.map((r, i) => (
                      <div key={i} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-800">{r.voucher_code}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(r.redeemed_at).toLocaleDateString('de-DE')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">+€{r.payout_amount?.toFixed(2)}</p>
                          <p className="text-xs text-gray-400">Wert: €{r.value}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-gray-400">
                      <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Noch keine Einlösungen</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Scanner View */}
          {view === 'scanner' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Scan className="w-5 h-5 text-amber-500" />
                  Gutschein scannen
                </h2>
                
                {/* QR Scanner */}
                <div id="qr-reader" className={`w-full max-w-sm mx-auto rounded-xl overflow-hidden ${scanning ? '' : 'hidden'}`} />
                
                {!scanning && !scanResult && (
                  <div className="text-center py-8">
                    <Button onClick={startScanner} className="bg-amber-500 hover:bg-amber-600">
                      <Camera className="w-5 h-5 mr-2" />
                      Kamera starten
                    </Button>
                  </div>
                )}
                
                {scanning && (
                  <div className="text-center mt-4">
                    <Button onClick={stopScanner} variant="outline">
                      <X className="w-4 h-4 mr-2" />
                      Abbrechen
                    </Button>
                  </div>
                )}
                
                {/* Manual Input */}
                <div className="mt-6 pt-6 border-t">
                  <p className="text-sm text-gray-500 mb-3">Oder Code manuell eingeben:</p>
                  <form onSubmit={handleManualValidate} className="flex gap-2">
                    <Input
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                      placeholder="BLZ-XXXXXXXX"
                      className="flex-1 uppercase"
                    />
                    <Button type="submit" disabled={loading}>
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Prüfen'}
                    </Button>
                  </form>
                </div>
                
                {/* Scan Result */}
                {scanResult && (
                  <div className={`mt-6 p-4 rounded-xl ${scanResult.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    {scanResult.valid ? (
                      <>
                        <div className="flex items-center gap-2 mb-3">
                          <CheckCircle className="w-6 h-6 text-green-500" />
                          <span className="font-bold text-green-700">Gültiger Gutschein</span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <p><span className="text-gray-500">Code:</span> {scanResult.code}</p>
                          <p><span className="text-gray-500">Wert:</span> <span className="font-bold text-2xl text-green-600">€{scanResult.value}</span></p>
                          {scanResult.name && <p><span className="text-gray-500">Name:</span> {scanResult.name}</p>}
                        </div>
                        <Button 
                          onClick={handleRedeem}
                          disabled={redeeming}
                          className="w-full mt-4 bg-green-500 hover:bg-green-600"
                        >
                          {redeeming ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                            <>
                              <Check className="w-4 h-4 mr-2" />
                              Jetzt einlösen
                            </>
                          )}
                        </Button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-6 h-6 text-red-500" />
                        <span className="font-bold text-red-700">{scanResult.error}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Vouchers View */}
          {view === 'vouchers' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-800">Ihre Gutscheine</h2>
                <Button onClick={() => setView('create-voucher')} className="bg-amber-500 hover:bg-amber-600">
                  <Plus className="w-4 h-4 mr-2" />
                  Neuer Gutschein
                </Button>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                {vouchers.length > 0 ? (
                  <div className="divide-y">
                    {vouchers.map((v) => (
                      <div key={v.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-800">{v.name}</p>
                          <p className="text-sm text-gray-500">{v.code}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-800">€{v.value}</p>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            v.is_redeemed ? 'bg-gray-100 text-gray-600' :
                            v.is_sold ? 'bg-blue-100 text-blue-600' :
                            'bg-green-100 text-green-600'
                          }`}>
                            {v.is_redeemed ? 'Eingelöst' : v.is_sold ? 'Verkauft' : 'Verfügbar'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-400">
                    <Ticket className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Noch keine Gutscheine erstellt</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Create Voucher View */}
          {view === 'create-voucher' && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-500" />
                Neuen Gutschein erstellen
              </h2>
              
              <form onSubmit={handleCreateVoucher} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <Input
                      value={newVoucher.name}
                      onChange={(e) => setNewVoucher({ ...newVoucher, name: e.target.value })}
                      placeholder="z.B. 20€ Essensgutschein"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Wert (€) *</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newVoucher.value}
                      onChange={(e) => setNewVoucher({ ...newVoucher, value: e.target.value })}
                      placeholder="20.00"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Verkaufspreis (€) *</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newVoucher.price}
                      onChange={(e) => setNewVoucher({ ...newVoucher, price: e.target.value })}
                      placeholder="15.00"
                      required
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Ihre Auszahlung: €{newVoucher.price ? (parseFloat(newVoucher.price) * (1 - (partner?.commission_rate || 10) / 100)).toFixed(2) : '0.00'}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Anzahl</label>
                    <Input
                      type="number"
                      min="1"
                      value={newVoucher.quantity}
                      onChange={(e) => setNewVoucher({ ...newVoucher, quantity: e.target.value })}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gültig bis</label>
                    <Input
                      type="date"
                      value={newVoucher.valid_until}
                      onChange={(e) => setNewVoucher({ ...newVoucher, valid_until: e.target.value })}
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                    <textarea
                      value={newVoucher.description}
                      onChange={(e) => setNewVoucher({ ...newVoucher, description: e.target.value })}
                      placeholder="Details zum Gutschein..."
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bedingungen</label>
                    <Input
                      value={newVoucher.terms}
                      onChange={(e) => setNewVoucher({ ...newVoucher, terms: e.target.value })}
                      placeholder="z.B. Nicht mit anderen Aktionen kombinierbar"
                    />
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                  <Button type="button" variant="outline" onClick={() => setView('vouchers')} className="flex-1">
                    Abbrechen
                  </Button>
                  <Button type="submit" disabled={loading} className="flex-1 bg-amber-500 hover:bg-amber-600">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Erstellen'}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Statistics View */}
          {view === 'statistics' && (
            <div className="space-y-6">
              <h2 className="font-bold text-gray-800 text-xl">Statistiken & Berichte</h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-blue-500">
                  <p className="text-gray-500 text-sm">Erstellt</p>
                  <p className="text-2xl font-bold text-gray-800">{dashboardData?.vouchers?.total || 0}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-green-500">
                  <p className="text-gray-500 text-sm">Verkauft</p>
                  <p className="text-2xl font-bold text-green-600">{dashboardData?.vouchers?.sold || 0}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-amber-500">
                  <p className="text-gray-500 text-sm">Eingelöst</p>
                  <p className="text-2xl font-bold text-amber-600">{dashboardData?.vouchers?.redeemed || 0}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-purple-500">
                  <p className="text-gray-500 text-sm">Provision</p>
                  <p className="text-2xl font-bold text-purple-600">{partner?.commission_rate || 10}%</p>
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-4">Finanzübersicht</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-gray-500 text-sm">Gesamtumsatz</p>
                    <p className="text-3xl font-bold text-gray-800">€{(dashboardData?.stats?.total_sales || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Ausstehende Auszahlung</p>
                    <p className="text-3xl font-bold text-green-600">€{(dashboardData?.stats?.pending_payout || 0).toFixed(2)}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-amber-800 text-sm">
                  <strong>Tipp:</strong> Erstellen Sie mehr Gutscheine mit attraktiven Rabatten, um Ihren Umsatz zu steigern!
                </p>
              </div>
            </div>
          )}

          {/* Payouts View */}
          {view === 'payouts' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-800 text-xl">Auszahlungen</h2>
                <div className="bg-green-100 text-green-700 px-4 py-2 rounded-lg">
                  Verfügbar: €{(dashboardData?.stats?.pending_payout || 0).toFixed(2)}
                </div>
              </div>
              
              {/* Request Payout */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Euro className="w-5 h-5 text-green-500" />
                  Auszahlung beantragen
                </h3>
                
                {(dashboardData?.stats?.pending_payout || 0) >= 50 ? (
                  <div className="space-y-4">
                    <p className="text-gray-600 text-sm">
                      Mindestbetrag: €50.00 | Bearbeitungszeit: 3-5 Werktage
                    </p>
                    <Button 
                      onClick={async () => {
                        if (!confirm(`Möchten Sie €${(dashboardData?.stats?.pending_payout || 0).toFixed(2)} auszahlen lassen?`)) return;
                        try {
                          const res = await fetch(`${API}/api/partner-portal/request-payout?token=${token}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({})
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.detail);
                          toast.success(data.message);
                          fetchDashboard();
                        } catch (err) {
                          toast.error(err.message);
                        }
                      }}
                      className="w-full bg-green-500 hover:bg-green-600"
                    >
                      Gesamten Betrag auszahlen (€{(dashboardData?.stats?.pending_payout || 0).toFixed(2)})
                    </Button>
                  </div>
                ) : (
                  <div className="bg-gray-100 rounded-lg p-4 text-center text-gray-500">
                    <p>Mindestbetrag von €50.00 noch nicht erreicht</p>
                    <p className="text-sm mt-1">Aktuell verfügbar: €{(dashboardData?.stats?.pending_payout || 0).toFixed(2)}</p>
                  </div>
                )}
              </div>
              
              {/* Payout History */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="font-bold text-gray-800">Auszahlungsverlauf</h3>
                  <History className="w-5 h-5 text-gray-400" />
                </div>
                <div className="p-8 text-center text-gray-400">
                  <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Noch keine Auszahlungen</p>
                </div>
              </div>
            </div>
          )}

          {/* Profile View */}
          {view === 'profile' && (
            <div className="space-y-6">
              <h2 className="font-bold text-gray-800 text-xl">Profil & Einstellungen</h2>
              
              {/* Logo Upload */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-amber-500" />
                  Logo
                </h3>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden">
                    {partner?.logo_url ? (
                      <img src={partner.logo_url} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl">{BUSINESS_TYPES.find(bt => bt.id === partner?.business_type)?.icon || '🏪'}</span>
                    )}
                  </div>
                  <div>
                    <input
                      type="file"
                      id="logo-upload"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const formData = new FormData();
                        formData.append('logo', file);
                        try {
                          const res = await fetch(`${API}/api/partner-portal/upload-logo?token=${token}`, {
                            method: 'POST',
                            body: formData
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.detail);
                          toast.success(data.message);
                          setPartner({ ...partner, logo_url: data.logo_url });
                          localStorage.setItem('partner_data', JSON.stringify({ ...partner, logo_url: data.logo_url }));
                        } catch (err) {
                          toast.error(err.message);
                        }
                      }}
                    />
                    <label htmlFor="logo-upload" className="cursor-pointer">
                      <Button type="button" variant="outline" size="sm" asChild>
                        <span>Logo hochladen</span>
                      </Button>
                    </label>
                    <p className="text-xs text-gray-400 mt-1">Max. 2MB (JPG, PNG, WebP)</p>
                  </div>
                </div>
              </div>
              
              {/* Banking Info */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-amber-500" />
                  Bankdaten
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">IBAN</label>
                    <Input
                      id="profile-iban"
                      defaultValue={partner?.iban || ''}
                      placeholder="DE89 3704 0044 0532 0130 00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Steuernummer</label>
                    <Input
                      id="profile-tax"
                      defaultValue={partner?.tax_id || ''}
                      placeholder="DE123456789"
                    />
                  </div>
                  <Button 
                    onClick={async () => {
                      const iban = document.getElementById('profile-iban')?.value;
                      const taxId = document.getElementById('profile-tax')?.value;
                      try {
                        const res = await fetch(`${API}/api/partner-portal/update-iban?token=${token}&iban=${encodeURIComponent(iban)}&tax_id=${encodeURIComponent(taxId || '')}`, {
                          method: 'PUT'
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.detail);
                        toast.success(data.message);
                      } catch (err) {
                        toast.error(err.message);
                      }
                    }}
                    className="bg-amber-500 hover:bg-amber-600"
                  >
                    Bankdaten speichern
                  </Button>
                </div>
              </div>
              
              {/* Account Info */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-4">Kontoinformationen</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Firmenname:</span>
                    <span className="font-medium text-gray-800">{partner?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">E-Mail:</span>
                    <span className="font-medium text-gray-800">{partner?.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Geschäftstyp:</span>
                    <span className="font-medium text-gray-800">
                      {BUSINESS_TYPES.find(bt => bt.id === partner?.business_type)?.name || 'Unbekannt'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Provision:</span>
                    <span className="font-medium text-gray-800">{partner?.commission_rate || 10}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  return null;
}
