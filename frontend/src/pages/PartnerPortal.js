/**
 * Partner Portal - Multi-Business Registration, QR Scanner & Voucher Management
 * Supports: Restaurants, Bars, Gas Stations, Cinemas, Retail, Wellness, Fitness, etc.
 * Features: Statistics with Charts, Stripe Connect Payouts, Document Verification, Staff Management
 */
import { useState, useEffect, useRef } from 'react';
import { 
  QrCode, Scan, Check, X, Euro, History, LogOut, Camera, Loader2, 
  AlertCircle, CheckCircle, Building2, MapPin, Phone, Mail, Globe,
  FileText, CreditCard, User, Plus, Ticket, BarChart3, Clock,
  ChevronRight, Upload, Store, TrendingUp, Shield, ExternalLink,
  PieChart, Trash2, Eye, Download, Users, Languages, Pencil
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { Html5Qrcode } from 'html5-qrcode';
import axios from 'axios';

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
  const [view, setView] = useState('login'); // login, register, scanner, vouchers, dashboard, create-voucher, statistics, payouts, profile, verification, staff
  const [userRole, setUserRole] = useState('admin'); // 'admin' or 'counter'
  const [isStaff, setIsStaff] = useState(false);
  const [language, setLanguage] = useState(() => localStorage.getItem('partner_language') || 'de');
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('partner_remember') === 'true');
  
  // Available languages
  const languages = [
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  ];
  
  // Translations
  const t = (key) => {
    const translations = {
      de: {
        login: 'Anmelden',
        register: 'Registrieren',
        email: 'E-Mail',
        password: 'Passwort',
        dashboard: 'Dashboard',
        scanner: 'Scanner',
        pay: 'Pay',
        vouchers: 'Gutscheine',
        statistics: 'Statistiken',
        payouts: 'Auszahlungen',
        verification: 'Verifizierung',
        profile: 'Profil',
        staff: 'Mitarbeiter',
        logout: 'Abmelden',
        available: 'Verfügbar',
        pending: 'Ausstehend',
        redeemed: 'Eingelöst',
        sold: 'Verkauft',
        commission: 'Provision',
        staffLogin: 'Mitarbeiter-Login',
        adminLogin: 'Admin-Login',
        createStaff: 'Mitarbeiter erstellen',
        counter: 'Theke',
        admin: 'Admin',
        name: 'Name',
        role: 'Rolle',
        active: 'Aktiv',
        inactive: 'Inaktiv',
        delete: 'Löschen',
        save: 'Speichern',
        cancel: 'Abbrechen',
        scanQR: 'QR-Code scannen',
        enterCode: 'Code eingeben',
        processPayment: 'Zahlung verarbeiten',
        amount: 'Betrag',
        success: 'Erfolgreich',
        error: 'Fehler',
        noAccess: 'Kein Zugriff',
        counterOnly: 'Diese Ansicht ist nur für Thekenmitarbeiter.',
        language: 'Sprache',
        welcome: 'Willkommen',
        notPartner: 'Noch kein Partner?',
        applyNow: 'Jetzt bewerben',
        counterInfo: 'Theken-Mitarbeiter Login - Eingeschränkter Zugang nur für Scanner und Zahlungsfunktionen.',
        voucherSystem: 'Gutschein-System'
      },
      en: {
        login: 'Login',
        register: 'Register',
        email: 'Email',
        password: 'Password',
        dashboard: 'Dashboard',
        scanner: 'Scanner',
        pay: 'Pay',
        vouchers: 'Vouchers',
        statistics: 'Statistics',
        payouts: 'Payouts',
        verification: 'Verification',
        profile: 'Profile',
        staff: 'Staff',
        logout: 'Logout',
        available: 'Available',
        pending: 'Pending',
        redeemed: 'Redeemed',
        sold: 'Sold',
        commission: 'Commission',
        staffLogin: 'Staff Login',
        adminLogin: 'Admin Login',
        createStaff: 'Create Staff',
        counter: 'Counter',
        admin: 'Admin',
        name: 'Name',
        role: 'Role',
        active: 'Active',
        inactive: 'Inactive',
        delete: 'Delete',
        save: 'Save',
        cancel: 'Cancel',
        scanQR: 'Scan QR Code',
        enterCode: 'Enter Code',
        processPayment: 'Process Payment',
        amount: 'Amount',
        success: 'Success',
        error: 'Error',
        noAccess: 'No Access',
        counterOnly: 'This view is for counter staff only.',
        language: 'Language',
        welcome: 'Welcome',
        notPartner: 'Not a partner yet?',
        applyNow: 'Apply now',
        counterInfo: 'Counter staff login - Limited access to scanner and payment functions only.',
        voucherSystem: 'Voucher System'
      },
      fr: {
        login: 'Connexion',
        register: "S'inscrire",
        email: 'E-mail',
        password: 'Mot de passe',
        dashboard: 'Tableau de bord',
        scanner: 'Scanner',
        pay: 'Payer',
        vouchers: 'Bons',
        statistics: 'Statistiques',
        payouts: 'Paiements',
        verification: 'Vérification',
        profile: 'Profil',
        staff: 'Personnel',
        logout: 'Déconnexion',
        available: 'Disponible',
        pending: 'En attente',
        redeemed: 'Utilisé',
        sold: 'Vendu',
        commission: 'Commission',
        staffLogin: 'Connexion Personnel',
        adminLogin: 'Connexion Admin',
        createStaff: 'Créer employé',
        counter: 'Comptoir',
        admin: 'Admin',
        name: 'Nom',
        role: 'Rôle',
        active: 'Actif',
        inactive: 'Inactif',
        delete: 'Supprimer',
        save: 'Enregistrer',
        cancel: 'Annuler',
        scanQR: 'Scanner QR Code',
        enterCode: 'Entrer le code',
        processPayment: 'Traiter le paiement',
        amount: 'Montant',
        success: 'Succès',
        error: 'Erreur',
        noAccess: 'Pas d\'accès',
        counterOnly: 'Cette vue est réservée au personnel du comptoir.',
        language: 'Langue',
        welcome: 'Bienvenue',
        notPartner: 'Pas encore partenaire?',
        applyNow: 'Postuler maintenant',
        counterInfo: 'Connexion comptoir - Accès limité au scanner et aux fonctions de paiement.',
        voucherSystem: 'Système de bons'
      },
      es: {
        login: 'Iniciar sesión',
        register: 'Registrarse',
        email: 'Correo',
        password: 'Contraseña',
        dashboard: 'Panel',
        scanner: 'Escáner',
        pay: 'Pagar',
        vouchers: 'Vales',
        statistics: 'Estadísticas',
        payouts: 'Pagos',
        verification: 'Verificación',
        profile: 'Perfil',
        staff: 'Personal',
        logout: 'Cerrar sesión',
        available: 'Disponible',
        pending: 'Pendiente',
        redeemed: 'Canjeado',
        sold: 'Vendido',
        commission: 'Comisión',
        staffLogin: 'Acceso Personal',
        adminLogin: 'Acceso Admin',
        createStaff: 'Crear empleado',
        counter: 'Mostrador',
        admin: 'Admin',
        name: 'Nombre',
        role: 'Rol',
        active: 'Activo',
        inactive: 'Inactivo',
        delete: 'Eliminar',
        save: 'Guardar',
        cancel: 'Cancelar',
        scanQR: 'Escanear QR',
        enterCode: 'Ingresar código',
        processPayment: 'Procesar pago',
        amount: 'Monto',
        success: 'Éxito',
        error: 'Error',
        noAccess: 'Sin acceso',
        counterOnly: 'Esta vista es solo para el personal del mostrador.',
        language: 'Idioma',
        welcome: 'Bienvenido',
        notPartner: '¿Aún no eres socio?',
        applyNow: 'Aplicar ahora',
        counterInfo: 'Acceso mostrador - Acceso limitado solo a escáner y funciones de pago.',
        voucherSystem: 'Sistema de vales'
      },
      tr: {
        login: 'Giriş',
        register: 'Kayıt ol',
        email: 'E-posta',
        password: 'Şifre',
        dashboard: 'Panel',
        scanner: 'Tarayıcı',
        pay: 'Öde',
        vouchers: 'Kuponlar',
        statistics: 'İstatistikler',
        payouts: 'Ödemeler',
        verification: 'Doğrulama',
        profile: 'Profil',
        staff: 'Personel',
        logout: 'Çıkış',
        available: 'Mevcut',
        pending: 'Beklemede',
        redeemed: 'Kullanıldı',
        sold: 'Satıldı',
        commission: 'Komisyon',
        staffLogin: 'Personel Girişi',
        adminLogin: 'Admin Girişi',
        createStaff: 'Personel oluştur',
        counter: 'Kasa',
        admin: 'Admin',
        name: 'Ad',
        role: 'Rol',
        active: 'Aktif',
        inactive: 'Pasif',
        delete: 'Sil',
        save: 'Kaydet',
        cancel: 'İptal',
        scanQR: 'QR Tara',
        enterCode: 'Kod gir',
        processPayment: 'Ödeme işle',
        amount: 'Tutar',
        success: 'Başarılı',
        error: 'Hata',
        noAccess: 'Erişim yok',
        counterOnly: 'Bu görünüm sadece kasa personeli içindir.',
        language: 'Dil',
        welcome: 'Hoş geldiniz',
        notPartner: 'Henüz ortak değil misiniz?',
        applyNow: 'Şimdi başvur',
        counterInfo: 'Kasa girişi - Sadece tarayıcı ve ödeme işlevlerine sınırlı erişim.',
        voucherSystem: 'Kupon Sistemi'
      },
      ar: {
        login: 'تسجيل الدخول',
        register: 'التسجيل',
        email: 'البريد الإلكتروني',
        password: 'كلمة المرور',
        dashboard: 'لوحة التحكم',
        scanner: 'الماسح',
        pay: 'الدفع',
        vouchers: 'القسائم',
        statistics: 'الإحصائيات',
        payouts: 'المدفوعات',
        verification: 'التحقق',
        profile: 'الملف الشخصي',
        staff: 'الموظفين',
        logout: 'تسجيل الخروج',
        available: 'متاح',
        pending: 'قيد الانتظار',
        redeemed: 'تم الاسترداد',
        sold: 'تم البيع',
        commission: 'العمولة',
        staffLogin: 'دخول الموظف',
        adminLogin: 'دخول المدير',
        createStaff: 'إنشاء موظف',
        counter: 'الكاشير',
        admin: 'مدير',
        name: 'الاسم',
        role: 'الدور',
        active: 'نشط',
        inactive: 'غير نشط',
        delete: 'حذف',
        save: 'حفظ',
        cancel: 'إلغاء',
        scanQR: 'مسح QR',
        enterCode: 'أدخل الرمز',
        processPayment: 'معالجة الدفع',
        amount: 'المبلغ',
        success: 'نجاح',
        error: 'خطأ',
        noAccess: 'لا يوجد وصول',
        counterOnly: 'هذه العرض مخصص لموظفي الكاشير فقط.',
        language: 'اللغة',
        welcome: 'مرحباً',
        notPartner: 'لست شريكاً بعد؟',
        applyNow: 'قدم الآن',
        counterInfo: 'دخول الكاشير - وصول محدود للماسح ووظائف الدفع فقط.',
        voucherSystem: 'نظام القسائم'
      }
    };
    return translations[language]?.[key] || translations.de[key] || key;
  };
  // Login state
  const [email, setEmail] = useState('');
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
        
      const response = await axios.post(endpoint, { email, password });
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

  const handleLogout = () => {
    setToken('');
    setPartner(null);
    setIsLoggedIn(false);
    setView('login');
    setUserRole('admin');
    setIsStaff(false);
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_data');
    localStorage.removeItem('partner_role');
    localStorage.removeItem('partner_is_staff');
    toast.success(language === 'en' ? 'Logged out' : 'Abgemeldet');
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

  // ==================== STRIPE CONNECT ====================
  
  const fetchStripeStatus = async () => {
    try {
      const response = await axios.get(`${API}/api/partner-stripe/account-status?token=${token}`);
      setStripeStatus(response.data);
    } catch (err) {
      console.error('Stripe status error:', err);
    }
  };

  const fetchPayoutHistory = async () => {
    try {
      const response = await axios.get(`${API}/api/partner-stripe/payout-history?token=${token}`);
      setPayoutHistory(response.data.payouts || []);
    } catch (err) {
      console.error('Payout history error:', err);
    }
  };

  const connectStripe = async () => {
    try {
      setLoading(true);
      const response = await axios.post(`${API}/api/partner-stripe/create-connect-account?token=${token}`, {
        return_url: `${window.location.origin}/partner-portal?stripe=success`,
        refresh_url: `${window.location.origin}/partner-portal?stripe=refresh`
      });
      
      // Redirect to Stripe onboarding
      window.location.href = response.data.url;
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  const requestStripePayout = async () => {
    if (!confirm(`Möchten Sie €${(dashboardData?.stats?.pending_payout || 0).toFixed(2)} via Stripe auszahlen?`)) return;
    
    try {
      setLoading(true);
      const response = await axios.post(`${API}/api/partner-stripe/request-payout?token=${token}`, {});
      
      toast.success(response.data.message);
      fetchDashboard();
      fetchPayoutHistory();
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message);
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
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('email')}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={loginMode === 'staff' ? 'staff@partner.com' : 'partner@example.de'}
                    className="pl-10"
                    required
                  />
                </div>
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
                  {language === 'en' ? 'Remember me' : 'Angemeldet bleiben'}
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
            <button onClick={handleLogout} className="text-gray-500 hover:text-red-500">
              <LogOut className="w-5 h-5" />
            </button>
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
                { id: 'statistics', label: t('statistics'), icon: TrendingUp },
                { id: 'payouts', label: t('payouts'), icon: Euro },
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
          {/* Dashboard View - Admin Only */}
          {view === 'dashboard' && userRole === 'admin' && dashboardData && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <p className="text-gray-500 text-sm">{t('pending')}</p>
                  <p className="text-2xl font-bold text-green-600">€{dashboardData.stats.pending_payout?.toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <p className="text-gray-500 text-sm">{t('redeemed')}</p>
                  <p className="text-2xl font-bold text-amber-600">{dashboardData.stats.total_redeemed}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <p className="text-gray-500 text-sm">{t('sold')}</p>
                  <p className="text-2xl font-bold text-blue-600">{dashboardData.vouchers.sold}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <p className="text-gray-500 text-sm">{t('commission')}</p>
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
                            {r.date ? new Date(r.date).toLocaleDateString('de-DE') : '-'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">+€{(r.payout_amount || r.value * 0.9)?.toFixed(2)}</p>
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

          {/* BidBlitz Pay View - Payment Scanner for Customer QR Codes */}
          {view === 'bidblitz-pay' && (
            <BidBlitzPayPartner token={token} partnerId={partner?.id} partnerName={partner?.name} commissionRate={partner?.commission_rate || 10} />
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

          {/* Statistics View with Charts */}
          {view === 'statistics' && (
            <div className="space-y-6">
              <h2 className="font-bold text-gray-800 text-xl flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-amber-500" />
                Statistiken & Berichte
              </h2>
              
              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-blue-500">
                  <p className="text-gray-500 text-sm">Erstellt</p>
                  <p className="text-2xl font-bold text-gray-800">{statistics?.overview?.total_created || 0}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-green-500">
                  <p className="text-gray-500 text-sm">Verkauft</p>
                  <p className="text-2xl font-bold text-green-600">{statistics?.overview?.total_sold || 0}</p>
                  <p className="text-xs text-gray-400">{statistics?.overview?.conversion_rate || 0}% Conversion</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-amber-500">
                  <p className="text-gray-500 text-sm">Eingelöst</p>
                  <p className="text-2xl font-bold text-amber-600">{statistics?.overview?.total_redeemed || 0}</p>
                  <p className="text-xs text-gray-400">{statistics?.overview?.redemption_rate || 0}% Rate</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-purple-500">
                  <p className="text-gray-500 text-sm">Provision</p>
                  <p className="text-2xl font-bold text-purple-600">{statistics?.financials?.commission_rate || 10}%</p>
                </div>
              </div>
              
              {/* Financial Overview */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Euro className="w-5 h-5 text-green-500" />
                  Finanzübersicht
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <p className="text-gray-500 text-sm">Gesamtumsatz</p>
                    <p className="text-2xl font-bold text-gray-800">€{statistics?.financials?.total_sales?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Provision bezahlt</p>
                    <p className="text-2xl font-bold text-red-500">€{statistics?.financials?.total_commission?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Ausstehend</p>
                    <p className="text-2xl font-bold text-green-600">€{statistics?.financials?.pending_payout?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Ausgezahlt</p>
                    <p className="text-2xl font-bold text-blue-600">€{statistics?.financials?.total_paid_out?.toFixed(2) || '0.00'}</p>
                  </div>
                </div>
              </div>
              
              {/* Chart - Voucher Status Pie */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-blue-500" />
                  Gutschein-Status
                </h3>
                <div className="flex items-center justify-center gap-8">
                  {/* Simple CSS Pie Chart */}
                  <div className="relative w-40 h-40">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      {(() => {
                        const total = (statistics?.overview?.total_created || 1);
                        const sold = statistics?.overview?.total_sold || 0;
                        const redeemed = statistics?.overview?.total_redeemed || 0;
                        const available = total - sold;
                        
                        const soldPct = (sold / total) * 100;
                        const redeemedPct = (redeemed / total) * 100;
                        const availablePct = (available / total) * 100;
                        
                        return (
                          <>
                            <circle cx="50" cy="50" r="40" fill="none" stroke="#10B981" strokeWidth="20"
                              strokeDasharray={`${availablePct * 2.51} 251`} strokeDashoffset="0" />
                            <circle cx="50" cy="50" r="40" fill="none" stroke="#3B82F6" strokeWidth="20"
                              strokeDasharray={`${soldPct * 2.51} 251`} strokeDashoffset={`${-availablePct * 2.51}`} />
                            <circle cx="50" cy="50" r="40" fill="none" stroke="#F59E0B" strokeWidth="20"
                              strokeDasharray={`${redeemedPct * 2.51} 251`} strokeDashoffset={`${-(availablePct + soldPct) * 2.51}`} />
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-green-500" />
                      <span className="text-sm text-gray-600">Verfügbar</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-blue-500" />
                      <span className="text-sm text-gray-600">Verkauft</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-amber-500" />
                      <span className="text-sm text-gray-600">Eingelöst</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Top Vouchers */}
              {statistics?.top_vouchers?.length > 0 && (
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-amber-500" />
                    Top Gutscheine
                  </h3>
                  <div className="space-y-3">
                    {statistics.top_vouchers.map((v, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-amber-500">#{i + 1}</span>
                          <div>
                            <p className="font-medium text-gray-800">{v.name}</p>
                            <p className="text-xs text-gray-500">{v.sold} verkauft, {v.redeemed} eingelöst</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">€{v.revenue?.toFixed(2)}</p>
                          <p className="text-xs text-gray-400">Umsatz</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Daily Chart */}
              {statistics?.chart_data?.length > 0 && (
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-500" />
                    Einlösungen (letzte 30 Tage)
                  </h3>
                  <div className="h-40 flex items-end gap-1">
                    {statistics.chart_data.map((d, i) => {
                      const maxValue = Math.max(...statistics.chart_data.map(x => x.value), 1);
                      const height = (d.value / maxValue) * 100;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center group">
                          <div 
                            className="w-full bg-gradient-to-t from-amber-500 to-amber-400 rounded-t transition-all hover:from-amber-600 hover:to-amber-500"
                            style={{ height: `${Math.max(height, 2)}%` }}
                            title={`${d.date}: €${d.value}`}
                          />
                          {i % 5 === 0 && (
                            <span className="text-xs text-gray-400 mt-1 transform -rotate-45 origin-left">
                              {d.date?.slice(5)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Payouts View with Stripe Connect */}
          {view === 'payouts' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-800 text-xl flex items-center gap-2">
                  <Euro className="w-6 h-6 text-green-500" />
                  Auszahlungen
                </h2>
                <div className="bg-green-100 text-green-700 px-4 py-2 rounded-lg font-bold">
                  €{(dashboardData?.stats?.pending_payout || 0).toFixed(2)} verfügbar
                </div>
              </div>
              
              {/* Stripe Connect Status */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-purple-500" />
                  Stripe Connect
                </h3>
                
                {stripeStatus?.connected ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                      <CheckCircle className="w-6 h-6 text-green-500" />
                      <div>
                        <p className="font-medium text-green-700">Stripe-Konto verbunden</p>
                        <p className="text-sm text-green-600">
                          {stripeStatus.payouts_enabled ? 'Auszahlungen aktiviert' : 'Onboarding abschließen'}
                        </p>
                      </div>
                    </div>
                    
                    {stripeStatus.payouts_enabled && (dashboardData?.stats?.pending_payout || 0) >= 50 && (
                      <Button 
                        onClick={requestStripePayout}
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600"
                      >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                          <>
                            <Euro className="w-5 h-5 mr-2" />
                            Jetzt €{(dashboardData?.stats?.pending_payout || 0).toFixed(2)} auszahlen
                          </>
                        )}
                      </Button>
                    )}
                    
                    {!stripeStatus.payouts_enabled && (
                      <Button onClick={connectStripe} variant="outline" className="w-full">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Onboarding abschließen
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-gray-600">
                      Verbinden Sie Ihr Stripe-Konto für automatische Auszahlungen direkt auf Ihr Bankkonto.
                    </p>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <h4 className="font-medium text-purple-800 mb-2">Vorteile von Stripe Connect:</h4>
                      <ul className="text-sm text-purple-700 space-y-1">
                        <li>✓ Sofortige Auszahlungen</li>
                        <li>✓ Sichere Bankverbindung</li>
                        <li>✓ Transparente Gebühren</li>
                        <li>✓ Detaillierte Berichte</li>
                      </ul>
                    </div>
                    <Button 
                      onClick={connectStripe}
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                        <>
                          <CreditCard className="w-5 h-5 mr-2" />
                          Mit Stripe verbinden
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
              
              {/* Payout History */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="font-bold text-gray-800">Auszahlungsverlauf</h3>
                  <History className="w-5 h-5 text-gray-400" />
                </div>
                {payoutHistory.length > 0 ? (
                  <div className="divide-y">
                    {payoutHistory.map((p, i) => (
                      <div key={i} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-800">{p.id}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(p.requested_at).toLocaleDateString('de-DE')}
                            {p.stripe_transfer_id && ` • ${p.stripe_transfer_id}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">€{p.amount?.toFixed(2)}</p>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            p.status === 'completed' ? 'bg-green-100 text-green-700' :
                            p.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {p.status === 'completed' ? 'Abgeschlossen' : 
                             p.status === 'pending' ? 'Ausstehend' : p.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-400">
                    <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Noch keine Auszahlungen</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Verification View */}
          {view === 'verification' && (
            <div className="space-y-6">
              <h2 className="font-bold text-gray-800 text-xl flex items-center gap-2">
                <Shield className="w-6 h-6 text-blue-500" />
                Verifizierung
              </h2>
              
              {/* Verification Status */}
              <div className={`p-4 rounded-xl border ${
                verificationStatus?.is_verified ? 'bg-green-50 border-green-200' :
                verificationStatus?.overall_status === 'in_review' ? 'bg-blue-50 border-blue-200' :
                verificationStatus?.overall_status === 'more_info' ? 'bg-amber-50 border-amber-200' :
                'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center gap-3">
                  {verificationStatus?.is_verified ? (
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  ) : verificationStatus?.overall_status === 'in_review' ? (
                    <Clock className="w-8 h-8 text-blue-500" />
                  ) : (
                    <AlertCircle className="w-8 h-8 text-amber-500" />
                  )}
                  <div>
                    <p className="font-bold text-gray-800">
                      {verificationStatus?.is_verified ? 'Verifiziert' :
                       verificationStatus?.overall_status === 'in_review' ? 'In Prüfung' :
                       verificationStatus?.overall_status === 'more_info' ? 'Mehr Info benötigt' :
                       'Verifizierung ausstehend'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {verificationStatus?.approved_required || 0} von {verificationStatus?.required_documents || 0} erforderlichen Dokumenten genehmigt
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Document Upload */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-amber-500" />
                  Dokumente hochladen
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {documentTypes.map((dt) => {
                    const uploaded = documents.find(d => d.document_type === dt.id && d.status !== 'rejected');
                    
                    return (
                      <div key={dt.id} className={`p-4 rounded-lg border-2 ${
                        uploaded?.status === 'approved' ? 'border-green-300 bg-green-50' :
                        uploaded?.status === 'pending' ? 'border-blue-300 bg-blue-50' :
                        uploaded?.status === 'in_review' ? 'border-amber-300 bg-amber-50' :
                        'border-dashed border-gray-300'
                      }`}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium text-gray-800">{dt.name}</p>
                            {dt.required && <span className="text-xs text-red-500">Erforderlich</span>}
                          </div>
                          {uploaded && (
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              uploaded.status === 'approved' ? 'bg-green-200 text-green-700' :
                              uploaded.status === 'pending' ? 'bg-blue-200 text-blue-700' :
                              'bg-gray-200 text-gray-600'
                            }`}>
                              {uploaded.status === 'approved' ? '✓ Genehmigt' :
                               uploaded.status === 'pending' ? 'Ausstehend' :
                               uploaded.status}
                            </span>
                          )}
                        </div>
                        
                        {uploaded ? (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <FileText className="w-4 h-4" />
                            <span className="truncate">{uploaded.file_name}</span>
                          </div>
                        ) : (
                          <label className="block cursor-pointer">
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png,.webp"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) uploadDocument(file, dt.id);
                              }}
                            />
                            <div className="flex items-center justify-center gap-2 py-3 text-amber-600 hover:text-amber-700 transition-colors">
                              <Upload className="w-5 h-5" />
                              <span className="text-sm font-medium">Hochladen</span>
                            </div>
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Uploaded Documents List */}
              {documents.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="p-4 border-b">
                    <h3 className="font-bold text-gray-800">Hochgeladene Dokumente</h3>
                  </div>
                  <div className="divide-y">
                    {documents.map((doc) => (
                      <div key={doc.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="w-8 h-8 text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-800">{doc.type_info?.name || doc.document_type}</p>
                            <p className="text-xs text-gray-500">{doc.file_name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            doc.status === 'approved' ? 'bg-green-100 text-green-700' :
                            doc.status === 'rejected' ? 'bg-red-100 text-red-700' :
                            doc.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {doc.status === 'approved' ? 'Genehmigt' :
                             doc.status === 'rejected' ? 'Abgelehnt' :
                             doc.status === 'pending' ? 'Ausstehend' :
                             'In Prüfung'}
                          </span>
                          {doc.rejection_reason && (
                            <span className="text-xs text-red-600" title={doc.rejection_reason}>
                              <AlertCircle className="w-4 h-4" />
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                          const res = await axios.post(`${API}/api/partner-portal/upload-logo?token=${token}`, formData);
                          toast.success(res.data.message);
                          setPartner({ ...partner, logo_url: res.data.logo_url });
                          localStorage.setItem('partner_data', JSON.stringify({ ...partner, logo_url: res.data.logo_url }));
                        } catch (err) {
                          toast.error(err.response?.data?.detail || 'Upload fehlgeschlagen');
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
                        const res = await axios.put(`${API}/api/partner-portal/update-iban?token=${token}&iban=${encodeURIComponent(iban)}&tax_id=${encodeURIComponent(taxId || '')}`);
                        toast.success(res.data.message);
                      } catch (err) {
                        toast.error(err.response?.data?.detail || 'Fehler beim Speichern');
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
          
          {/* Staff Management View - Admin Only */}
          {view === 'staff' && userRole === 'admin' && (
            <div className="space-y-6">
              <h2 className="font-bold text-gray-800 text-xl flex items-center gap-2">
                <Users className="w-6 h-6 text-amber-500" />
                {t('staff')}
              </h2>
              
              {/* Create Staff Form */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-4">{t('createStaff')}</h3>
                <form onSubmit={createStaff} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('name')}</label>
                      <Input
                        value={newStaff.name}
                        onChange={(e) => setNewStaff({...newStaff, name: e.target.value})}
                        placeholder={language === 'en' ? 'Staff name' : 'Mitarbeiter Name'}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('email')}</label>
                      <Input
                        type="email"
                        value={newStaff.email}
                        onChange={(e) => setNewStaff({...newStaff, email: e.target.value})}
                        placeholder="staff@example.com"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('password')}</label>
                      <Input
                        type="password"
                        value={newStaff.password}
                        onChange={(e) => setNewStaff({...newStaff, password: e.target.value})}
                        placeholder="••••••••"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('role')}</label>
                      <select
                        value={newStaff.role}
                        onChange={(e) => setNewStaff({...newStaff, role: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="counter">{t('counter')} ({language === 'en' ? 'Scanner & Pay only' : 'Nur Scanner & Pay'})</option>
                        <option value="admin">{t('admin')} ({language === 'en' ? 'Full access' : 'Voller Zugang'})</option>
                      </select>
                    </div>
                  </div>
                  <Button type="submit" className="bg-amber-500 hover:bg-amber-600">
                    <Plus className="w-4 h-4 mr-2" />
                    {t('createStaff')}
                  </Button>
                </form>
              </div>
              
              {/* Staff List */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b">
                  <h3 className="font-bold text-gray-800">{language === 'en' ? 'Staff Members' : 'Mitarbeiter-Liste'}</h3>
                </div>
                
                {loadingStaff ? (
                  <div className="p-8 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto" />
                  </div>
                ) : staffList.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>{language === 'en' ? 'No staff members yet' : 'Noch keine Mitarbeiter'}</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {staffList.map((staff) => (
                      <div key={staff.id} className="p-4">
                        {editingStaff === staff.id ? (
                          // Edit Mode
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">{t('name')}</label>
                                <Input
                                  value={editStaffData.name}
                                  onChange={(e) => setEditStaffData({...editStaffData, name: e.target.value})}
                                  className="h-9"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">{t('email')}</label>
                                <Input
                                  value={editStaffData.email}
                                  disabled
                                  className="h-9 bg-gray-50"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">{t('role')}</label>
                                <select
                                  value={editStaffData.role}
                                  onChange={(e) => setEditStaffData({...editStaffData, role: e.target.value})}
                                  className="w-full px-3 py-2 h-9 border border-gray-300 rounded-lg text-sm"
                                >
                                  <option value="counter">{t('counter')}</option>
                                  <option value="admin">{t('admin')}</option>
                                </select>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                onClick={() => updateStaff(staff.id)}
                                className="bg-green-500 hover:bg-green-600"
                              >
                                <Check className="w-4 h-4 mr-1" />
                                {t('save')}
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => setEditingStaff(null)}
                              >
                                <X className="w-4 h-4 mr-1" />
                                {t('cancel')}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          // View Mode
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                staff.role === 'admin' ? 'bg-purple-100' : 'bg-amber-100'
                              }`}>
                                {staff.role === 'admin' ? (
                                  <User className="w-5 h-5 text-purple-600" />
                                ) : (
                                  <Store className="w-5 h-5 text-amber-600" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-gray-800">{staff.name}</p>
                                <p className="text-sm text-gray-500">{staff.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                staff.role === 'admin' 
                                  ? 'bg-purple-100 text-purple-700' 
                                  : 'bg-amber-100 text-amber-700'
                              }`}>
                                {staff.role === 'admin' ? t('admin') : t('counter')}
                              </span>
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                staff.is_active !== false
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}>
                                {staff.is_active !== false ? t('active') : t('inactive')}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingStaff(staff.id);
                                  setEditStaffData({ name: staff.name, email: staff.email, role: staff.role });
                                }}
                                className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteStaff(staff.id)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Info Box */}
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">{language === 'en' ? 'Staff Roles:' : 'Mitarbeiter-Rollen:'}</p>
                    <ul className="space-y-1 text-blue-700">
                      <li><strong>{t('counter')}:</strong> {language === 'en' ? 'Only Scanner and Pay - perfect for counter employees' : 'Nur Scanner und Pay - perfekt für Thekenmitarbeiter'}</li>
                      <li><strong>{t('admin')}:</strong> {language === 'en' ? 'Full access to statistics, payouts, and settings' : 'Voller Zugang zu Statistiken, Auszahlungen und Einstellungen'}</li>
                    </ul>
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

// BidBlitz Pay Partner Component - Payment Scanner
function BidBlitzPayPartner({ token, partnerId, partnerName, commissionRate }) {
  const [scanning, setScanning] = useState(false);
  const [customerData, setCustomerData] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [manualQR, setManualQR] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(null);
  const html5QrCodeRef = useRef(null);

  const startScanner = async () => {
    setScanning(true);
    setCustomerData(null);
    setPaymentSuccess(null);
    
    try {
      const html5QrCode = new Html5Qrcode("bidblitz-pay-scanner");
      html5QrCodeRef.current = html5QrCode;
      
      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        async (decodedText) => {
          await html5QrCode.stop();
          setScanning(false);
          handleQRScanned(decodedText);
        },
        () => {}
      );
    } catch (err) {
      console.error("Scanner error:", err);
      setScanning(false);
      toast.error("Kamera-Zugriff nicht möglich");
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
      } catch {}
    }
    setScanning(false);
  };

  const handleQRScanned = async (qrData) => {
    try {
      const response = await axios.get(
        `${API}/api/bidblitz-pay/scan-customer?qr_data=${encodeURIComponent(qrData)}&token=${token}`
      );
      
      setCustomerData(response.data);
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
      toast.success(`Zahlung von €${amount.toFixed(2)} erfolgreich!`);
    } catch (error) {
      console.error("Payment error:", error);
      toast.error(error.response?.data?.detail || "Zahlung fehlgeschlagen");
    } finally {
      setProcessing(false);
    }
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
            onClick={() => setPaymentSuccess(null)}
            className="mt-4 bg-green-500 hover:bg-green-600"
          >
            Weitere Zahlung
          </Button>
        </div>
      )}

      {/* Scanner */}
      {!paymentSuccess && !customerData && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <QrCode className="w-5 h-5 text-amber-500" />
            Kunden-QR scannen
          </h3>
          
          <div id="bidblitz-pay-scanner" className="w-full max-w-sm mx-auto rounded-lg overflow-hidden bg-black" />
          
          {!scanning ? (
            <Button onClick={startScanner} className="w-full mt-4 bg-amber-500 hover:bg-amber-600">
              <Camera className="w-4 h-4 mr-2" />
              Scanner starten
            </Button>
          ) : (
            <Button onClick={stopScanner} variant="outline" className="w-full mt-4">
              <X className="w-4 h-4 mr-2" />
              Scanner beenden
            </Button>
          )}
          
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

      {/* Customer Found - Payment Form */}
      {!paymentSuccess && customerData && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
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

          {/* Payment Amount */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Zahlungsbetrag eingeben:
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xl">€</span>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={customerData.available_balance.total}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="pl-10 text-2xl font-bold h-16 text-center"
                placeholder="0.00"
                autoFocus
              />
            </div>
            {parseFloat(paymentAmount) > customerData.available_balance.total && (
              <p className="text-red-500 text-sm mt-2">
                Betrag übersteigt verfügbares Guthaben
              </p>
            )}
          </div>

          {/* Quick Amount Buttons */}
          <div className="flex gap-2 mb-6">
            {[5, 10, 20, 50].map((amount) => (
              <Button
                key={amount}
                variant="outline"
                onClick={() => setPaymentAmount(String(amount))}
                disabled={amount > customerData.available_balance.total}
                className="flex-1"
              >
                €{amount}
              </Button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => setCustomerData(null)}
              className="flex-1"
            >
              Abbrechen
            </Button>
            <Button 
              onClick={processPayment}
              disabled={processing || !paymentAmount || parseFloat(paymentAmount) <= 0 || parseFloat(paymentAmount) > customerData.available_balance.total}
              className="flex-1 bg-green-500 hover:bg-green-600"
            >
              {processing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Zahlung €{parseFloat(paymentAmount || 0).toFixed(2)}
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
