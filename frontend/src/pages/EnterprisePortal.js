/**
 * Enterprise Portal - Großhändler-Verwaltung
 * Redesigned with better UI, mobile support, and multi-language
 */
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Building2, Key, Users, BarChart3, Download, Store, Plus,
  LogOut, Check, X, RefreshCw, FileText, TrendingUp, Menu,
  Euro, ShoppingBag, Gift, Percent, Copy, Globe, ChevronDown,
  Trash2, ToggleLeft, ToggleRight, Eye, EyeOff, Clock, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Translations for Enterprise Portal
const enterpriseTranslations = {
  de: {
    title: 'Händler-Portal',
    subtitle: 'Verwalten Sie Ihre Filialen, Kassen und Berichte',
    login: 'Anmelden',
    register: 'Registrieren',
    email: 'E-Mail',
    password: 'Passwort',
    rememberMe: 'Angemeldet bleiben',
    companyName: 'Firmenname',
    contactPerson: 'Ansprechpartner',
    phone: 'Telefon',
    address: 'Adresse',
    noAccount: 'Noch kein Konto?',
    hasAccount: 'Bereits registriert?',
    dashboard: 'Dashboard',
    branches: 'Filialen',
    apiKeys: 'Kassen & API-Keys',
    users: 'Mitarbeiter',
    reports: 'Berichte',
    today: 'Heute',
    week: 'Woche',
    month: 'Monat',
    year: 'Jahr',
    revenue: 'Umsatz',
    transactions: 'Transaktionen',
    commission: 'Provision',
    bonus: 'Bonus',
    cashback: 'Cashback',
    newBranch: 'Neue Filiale',
    newKey: 'Neue Kasse',
    newUser: 'Neuer Mitarbeiter',
    branchName: 'Filialname',
    city: 'Stadt',
    managerName: 'Filialleiter',
    managerEmail: 'Filialleiter E-Mail',
    registerName: 'Kassenname',
    selectBranch: 'Filiale auswählen',
    role: 'Rolle',
    admin: 'Administrator',
    branchManager: 'Filialleiter',
    cashier: 'Kassierer',
    active: 'Aktiv',
    inactive: 'Inaktiv',
    export: 'Exportieren',
    csvExport: 'CSV Export',
    pdfExport: 'PDF Export',
    logout: 'Abmelden',
    save: 'Speichern',
    cancel: 'Abbrechen',
    delete: 'Löschen',
    activate: 'Aktivieren',
    deactivate: 'Deaktivieren',
    noData: 'Keine Daten vorhanden',
    registrationSuccess: 'Registrierung erfolgreich! Ihr Konto wird geprüft.',
    allBranches: 'Alle Filialen',
    recentTransactions: 'Letzte Transaktionen',
    branchComparison: 'Filial-Vergleich',
    topBranches: 'Top Filialen',
  },
  en: {
    title: 'Merchant Portal',
    subtitle: 'Manage your branches, registers and reports',
    login: 'Login',
    register: 'Register',
    email: 'Email',
    password: 'Password',
    rememberMe: 'Remember me',
    companyName: 'Company Name',
    contactPerson: 'Contact Person',
    phone: 'Phone',
    address: 'Address',
    noAccount: "Don't have an account?",
    hasAccount: 'Already registered?',
    dashboard: 'Dashboard',
    branches: 'Branches',
    apiKeys: 'Registers & API Keys',
    users: 'Staff',
    reports: 'Reports',
    today: 'Today',
    week: 'Week',
    month: 'Month',
    year: 'Year',
    revenue: 'Revenue',
    transactions: 'Transactions',
    commission: 'Commission',
    bonus: 'Bonus',
    cashback: 'Cashback',
    newBranch: 'New Branch',
    newKey: 'New Register',
    newUser: 'New Staff',
    branchName: 'Branch Name',
    city: 'City',
    managerName: 'Manager Name',
    managerEmail: 'Manager Email',
    registerName: 'Register Name',
    selectBranch: 'Select Branch',
    role: 'Role',
    admin: 'Administrator',
    branchManager: 'Branch Manager',
    cashier: 'Cashier',
    active: 'Active',
    inactive: 'Inactive',
    export: 'Export',
    csvExport: 'CSV Export',
    pdfExport: 'PDF Export',
    logout: 'Logout',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    activate: 'Activate',
    deactivate: 'Deactivate',
    noData: 'No data available',
    registrationSuccess: 'Registration successful! Your account is being reviewed.',
    allBranches: 'All Branches',
    recentTransactions: 'Recent Transactions',
    branchComparison: 'Branch Comparison',
    topBranches: 'Top Branches',
  },
  ar: {
    title: 'بوابة التجار',
    subtitle: 'إدارة فروعك ونقاط البيع والتقارير',
    login: 'تسجيل الدخول',
    register: 'تسجيل',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    rememberMe: 'تذكرني',
    companyName: 'اسم الشركة',
    contactPerson: 'جهة الاتصال',
    phone: 'الهاتف',
    address: 'العنوان',
    noAccount: 'ليس لديك حساب؟',
    hasAccount: 'لديك حساب بالفعل؟',
    dashboard: 'لوحة التحكم',
    branches: 'الفروع',
    apiKeys: 'نقاط البيع',
    users: 'الموظفين',
    reports: 'التقارير',
    today: 'اليوم',
    week: 'الأسبوع',
    month: 'الشهر',
    year: 'السنة',
    revenue: 'الإيرادات',
    transactions: 'المعاملات',
    commission: 'العمولة',
    bonus: 'المكافأة',
    cashback: 'استرداد النقود',
    newBranch: 'فرع جديد',
    newKey: 'نقطة بيع جديدة',
    newUser: 'موظف جديد',
    branchName: 'اسم الفرع',
    city: 'المدينة',
    managerName: 'اسم المدير',
    managerEmail: 'بريد المدير',
    registerName: 'اسم نقطة البيع',
    selectBranch: 'اختر الفرع',
    role: 'الدور',
    admin: 'مدير',
    branchManager: 'مدير فرع',
    cashier: 'كاشير',
    active: 'نشط',
    inactive: 'غير نشط',
    export: 'تصدير',
    csvExport: 'تصدير CSV',
    pdfExport: 'تصدير PDF',
    logout: 'تسجيل الخروج',
    save: 'حفظ',
    cancel: 'إلغاء',
    delete: 'حذف',
    activate: 'تفعيل',
    deactivate: 'إلغاء التفعيل',
    noData: 'لا توجد بيانات',
    registrationSuccess: 'تم التسجيل بنجاح! حسابك قيد المراجعة.',
    allBranches: 'جميع الفروع',
    recentTransactions: 'آخر المعاملات',
    branchComparison: 'مقارنة الفروع',
    topBranches: 'أفضل الفروع',
  },
  tr: {
    title: 'Bayi Portalı',
    subtitle: 'Şubelerinizi, kasalarınızı ve raporlarınızı yönetin',
    login: 'Giriş Yap',
    register: 'Kayıt Ol',
    email: 'E-posta',
    password: 'Şifre',
    rememberMe: 'Beni hatırla',
    companyName: 'Şirket Adı',
    contactPerson: 'İletişim Kişisi',
    phone: 'Telefon',
    address: 'Adres',
    noAccount: 'Hesabınız yok mu?',
    hasAccount: 'Zaten kayıtlı mısınız?',
    dashboard: 'Panel',
    branches: 'Şubeler',
    apiKeys: 'Kasalar & API',
    users: 'Çalışanlar',
    reports: 'Raporlar',
    today: 'Bugün',
    week: 'Hafta',
    month: 'Ay',
    year: 'Yıl',
    revenue: 'Gelir',
    transactions: 'İşlemler',
    commission: 'Komisyon',
    bonus: 'Bonus',
    cashback: 'Cashback',
    newBranch: 'Yeni Şube',
    newKey: 'Yeni Kasa',
    newUser: 'Yeni Çalışan',
    branchName: 'Şube Adı',
    city: 'Şehir',
    managerName: 'Müdür Adı',
    managerEmail: 'Müdür E-posta',
    registerName: 'Kasa Adı',
    selectBranch: 'Şube Seçin',
    role: 'Rol',
    admin: 'Yönetici',
    branchManager: 'Şube Müdürü',
    cashier: 'Kasiyer',
    active: 'Aktif',
    inactive: 'Pasif',
    export: 'Dışa Aktar',
    csvExport: 'CSV İndir',
    pdfExport: 'PDF İndir',
    logout: 'Çıkış',
    save: 'Kaydet',
    cancel: 'İptal',
    delete: 'Sil',
    activate: 'Aktifleştir',
    deactivate: 'Devre Dışı Bırak',
    noData: 'Veri yok',
    registrationSuccess: 'Kayıt başarılı! Hesabınız inceleniyor.',
    allBranches: 'Tüm Şubeler',
    recentTransactions: 'Son İşlemler',
    branchComparison: 'Şube Karşılaştırması',
    topBranches: 'En İyi Şubeler',
  }
};

// Language options
const languages = [
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'ar', name: 'العربية', flag: '🇦🇪' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
];

export default function EnterprisePortal() {
  const { i18n } = useTranslation();
  const [lang, setLang] = useState(localStorage.getItem('enterprise_lang') || i18n.language || 'de');
  const t = enterpriseTranslations[lang] || enterpriseTranslations.de;
  
  const [token, setToken] = useState(localStorage.getItem('enterprise_token') || '');
  const [enterprise, setEnterprise] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  
  // Auth state
  const [isRegistering, setIsRegistering] = useState(false);
  const [rememberMe, setRememberMe] = useState(localStorage.getItem('enterprise_remember') === 'true');
  const [showPassword, setShowPassword] = useState(false);
  const [authForm, setAuthForm] = useState({ 
    email: localStorage.getItem('enterprise_email') || '', 
    password: '', 
    company_name: '', 
    contact_person: '', 
    phone: '', 
    address: '' 
  });
  
  // Data state
  const [branches, setBranches] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  
  // Modal state
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  // Report filters
  const [reportPeriod, setReportPeriod] = useState('month');
  const [selectedBranch, setSelectedBranch] = useState('');

  // Change language
  const changeLanguage = (code) => {
    setLang(code);
    localStorage.setItem('enterprise_lang', code);
    i18n.changeLanguage(code);
    setShowLangDropdown(false);
  };

  // Fetch enterprise info
  const fetchEnterprise = useCallback(async () => {
    if (!token) {
      setInitialLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/enterprise/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEnterprise(data);
      } else {
        localStorage.removeItem('enterprise_token');
        setToken('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setInitialLoading(false);
    }
  }, [token]);

  // Fetch all data
  const fetchBranches = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/enterprise/branches`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBranches(data.branches || []);
      }
    } catch (err) { console.error(err); }
  }, [token]);

  const fetchApiKeys = useCallback(async () => {
    if (!token) return;
    try {
      const url = selectedBranch 
        ? `${API_URL}/api/enterprise/api-keys?branch_id=${selectedBranch}`
        : `${API_URL}/api/enterprise/api-keys`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setApiKeys(data.api_keys || []);
      }
    } catch (err) { console.error(err); }
  }, [token, selectedBranch]);

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/enterprise/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) { console.error(err); }
  }, [token]);

  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      const url = selectedBranch
        ? `${API_URL}/api/enterprise/reports/overview?period=${reportPeriod}&branch_id=${selectedBranch}`
        : `${API_URL}/api/enterprise/reports/overview?period=${reportPeriod}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) { console.error(err); }
  }, [token, reportPeriod, selectedBranch]);

  const fetchTransactions = useCallback(async () => {
    if (!token) return;
    try {
      const url = selectedBranch
        ? `${API_URL}/api/enterprise/reports/transactions?period=${reportPeriod}&branch_id=${selectedBranch}`
        : `${API_URL}/api/enterprise/reports/transactions?period=${reportPeriod}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
      }
    } catch (err) { console.error(err); }
  }, [token, reportPeriod, selectedBranch]);

  useEffect(() => {
    fetchEnterprise();
  }, [fetchEnterprise]);

  useEffect(() => {
    if (token && enterprise) {
      fetchBranches();
      fetchApiKeys();
      fetchUsers();
      fetchStats();
      fetchTransactions();
    }
  }, [token, enterprise, fetchBranches, fetchApiKeys, fetchUsers, fetchStats, fetchTransactions]);

  // Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/enterprise/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authForm.email, password: authForm.password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('enterprise_token', data.token);
        if (rememberMe) {
          localStorage.setItem('enterprise_remember', 'true');
          localStorage.setItem('enterprise_email', authForm.email);
        } else {
          localStorage.removeItem('enterprise_remember');
          localStorage.removeItem('enterprise_email');
        }
        setToken(data.token);
        toast.success(`Willkommen, ${data.company_name}!`);
      } else {
        toast.error(data.detail || 'Login fehlgeschlagen');
      }
    } catch (err) {
      toast.error('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  };

  // Register
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/enterprise/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(t.registrationSuccess);
        setIsRegistering(false);
        setAuthForm({ ...authForm, password: '', company_name: '', contact_person: '', phone: '', address: '' });
      } else {
        toast.error(data.detail || 'Registrierung fehlgeschlagen');
      }
    } catch (err) {
      toast.error('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('enterprise_token');
    if (!rememberMe) {
      localStorage.removeItem('enterprise_email');
    }
    setToken('');
    setEnterprise(null);
    toast.success(t.logout);
  };

  // CRUD Operations
  const handleCreateBranch = async (formData) => {
    try {
      const res = await fetch(`${API_URL}/api/enterprise/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setShowBranchModal(false);
        fetchBranches();
      } else {
        toast.error(data.detail);
      }
    } catch (err) { toast.error('Fehler'); }
  };

  const handleCreateApiKey = async (formData) => {
    try {
      const res = await fetch(`${API_URL}/api/enterprise/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setEditingItem({ type: 'new_key', api_key: data.api_key, secret_key: data.secret_key });
        fetchApiKeys();
      } else {
        toast.error(data.detail);
      }
    } catch (err) { toast.error('Fehler'); }
  };

  const handleToggleKey = async (keyId) => {
    try {
      const res = await fetch(`${API_URL}/api/enterprise/api-keys/${keyId}/toggle`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        fetchApiKeys();
      } else {
        toast.error(data.detail);
      }
    } catch (err) { toast.error('Fehler'); }
  };

  const handleDeleteKey = async (keyId) => {
    if (!window.confirm('API-Key wirklich löschen?')) return;
    try {
      const res = await fetch(`${API_URL}/api/enterprise/api-keys/${keyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('API-Key gelöscht');
        fetchApiKeys();
      }
    } catch (err) { toast.error('Fehler'); }
  };

  const handleCreateUser = async (formData) => {
    try {
      const res = await fetch(`${API_URL}/api/enterprise/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setShowUserModal(false);
        fetchUsers();
      } else {
        toast.error(data.detail);
      }
    } catch (err) { toast.error('Fehler'); }
  };

  const handleExport = async (format) => {
    try {
      const url = `${API_URL}/api/enterprise/reports/export?format=${format}&period=${reportPeriod}${selectedBranch ? `&branch_id=${selectedBranch}` : ''}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const blob = await res.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = format === 'csv' ? `report_${reportPeriod}.csv` : `report_${reportPeriod}.html`;
        a.click();
        toast.success(`${format.toUpperCase()} Export`);
      }
    } catch (err) { toast.error('Export fehlgeschlagen'); }
  };

  // Loading screen
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <RefreshCw className="w-10 h-10 animate-spin text-amber-500" />
      </div>
    );
  }

  // ==================== LOGIN / REGISTER SCREEN ====================
  if (!token || !enterprise) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
        {/* Language Selector */}
        <div className="absolute top-4 right-4 z-50">
          <div className="relative">
            <button
              onClick={() => setShowLangDropdown(!showLangDropdown)}
              className="flex items-center gap-2 px-3 py-2 bg-white/10 backdrop-blur-sm rounded-lg text-white hover:bg-white/20 transition-colors"
            >
              <Globe className="w-4 h-4" />
              <span className="text-sm">{languages.find(l => l.code === lang)?.flag}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {showLangDropdown && (
              <div className="absolute right-0 mt-2 w-40 bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden">
                {languages.map(l => (
                  <button
                    key={l.code}
                    onClick={() => changeLanguage(l.code)}
                    className={`w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-slate-700 transition-colors ${
                      lang === l.code ? 'bg-amber-500/20 text-amber-400' : 'text-white'
                    }`}
                  >
                    <span>{l.flag}</span>
                    <span className="text-sm">{l.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl shadow-lg shadow-amber-500/30 mb-4">
                <Building2 className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white">{t.title}</h1>
              <p className="text-slate-400 mt-2">{t.subtitle}</p>
            </div>

            {/* Form Card */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 shadow-xl">
              {isRegistering ? (
                // Register Form
                <form onSubmit={handleRegister} className="space-y-4">
                  <h2 className="text-xl font-bold text-white mb-4">{t.register}</h2>
                  
                  <div>
                    <input
                      type="text"
                      placeholder={t.companyName}
                      value={authForm.company_name}
                      onChange={(e) => setAuthForm({...authForm, company_name: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder={t.contactPerson}
                      value={authForm.contact_person}
                      onChange={(e) => setAuthForm({...authForm, contact_person: e.target.value})}
                      className="px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      required
                    />
                    <input
                      type="tel"
                      placeholder={t.phone}
                      value={authForm.phone}
                      onChange={(e) => setAuthForm({...authForm, phone: e.target.value})}
                      className="px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>
                  
                  <input
                    type="email"
                    placeholder={t.email}
                    value={authForm.email}
                    onChange={(e) => setAuthForm({...authForm, email: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    required
                  />
                  
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder={t.password}
                      value={authForm.password}
                      onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent pr-12"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 shadow-lg shadow-amber-500/30"
                  >
                    {loading ? <RefreshCw className="w-5 h-5 animate-spin mx-auto" /> : t.register}
                  </button>
                  
                  <p className="text-center text-slate-400 text-sm">
                    {t.hasAccount}{' '}
                    <button type="button" onClick={() => setIsRegistering(false)} className="text-amber-400 hover:underline">
                      {t.login}
                    </button>
                  </p>
                </form>
              ) : (
                // Login Form
                <form onSubmit={handleLogin} className="space-y-4">
                  <h2 className="text-xl font-bold text-white mb-4">{t.login}</h2>
                  
                  <input
                    type="email"
                    placeholder={t.email}
                    value={authForm.email}
                    onChange={(e) => setAuthForm({...authForm, email: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    required
                  />
                  
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder={t.password}
                      value={authForm.password}
                      onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent pr-12"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  
                  <label className="flex items-center gap-2 text-slate-300 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500"
                    />
                    {t.rememberMe}
                  </label>
                  
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 shadow-lg shadow-amber-500/30"
                  >
                    {loading ? <RefreshCw className="w-5 h-5 animate-spin mx-auto" /> : t.login}
                  </button>
                  
                  <p className="text-center text-slate-400 text-sm">
                    {t.noAccount}{' '}
                    <button type="button" onClick={() => setIsRegistering(true)} className="text-amber-400 hover:underline">
                      {t.register}
                    </button>
                  </p>
                </form>
              )}
            </div>

            {/* BidBlitz branding */}
            <p className="text-center text-slate-500 text-sm mt-6">
              Powered by <span className="text-amber-500 font-semibold">BidBlitz</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ==================== MAIN PORTAL ====================
  const navItems = [
    { id: 'dashboard', label: t.dashboard, icon: BarChart3 },
    { id: 'branches', label: t.branches, icon: Store },
    { id: 'api-keys', label: t.apiKeys, icon: Key },
    { id: 'users', label: t.users, icon: Users },
    { id: 'reports', label: t.reports, icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Menu + Logo */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 hover:bg-white/10 rounded-lg"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="hidden sm:block">
                  <h1 className="font-bold text-lg truncate max-w-[200px]">{enterprise.company_name}</h1>
                  <p className="text-xs text-slate-400">{t.title}</p>
                </div>
              </div>
            </div>

            {/* Right: Stats + Language + Logout */}
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden md:flex items-center gap-4 text-sm text-slate-300">
                <span className="flex items-center gap-1"><Store className="w-4 h-4" /> {enterprise.stats?.branches || 0}</span>
                <span className="flex items-center gap-1"><Key className="w-4 h-4" /> {enterprise.stats?.api_keys || 0}</span>
              </div>
              
              {/* Language */}
              <div className="relative">
                <button
                  onClick={() => setShowLangDropdown(!showLangDropdown)}
                  className="flex items-center gap-1 px-2 py-1.5 bg-white/10 rounded-lg hover:bg-white/20 text-sm"
                >
                  <span>{languages.find(l => l.code === lang)?.flag}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showLangDropdown && (
                  <div className="absolute right-0 mt-2 w-36 bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden z-50">
                    {languages.map(l => (
                      <button
                        key={l.code}
                        onClick={() => changeLanguage(l.code)}
                        className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-700 text-sm ${
                          lang === l.code ? 'bg-amber-500/20 text-amber-400' : 'text-white'
                        }`}
                      >
                        <span>{l.flag}</span>
                        <span>{l.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-lg" title={t.logout}>
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Navigation - Desktop */}
        <div className="hidden lg:block border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4">
            <nav className="flex gap-1">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
                    activeTab === item.id
                      ? 'border-amber-500 text-amber-400 bg-white/5'
                      : 'border-transparent text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setMobileMenuOpen(false)}>
          <div className="w-64 h-full bg-slate-900 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-700">
              <h2 className="font-bold text-white">{enterprise.company_name}</h2>
              <p className="text-sm text-slate-400">{t.title}</p>
            </div>
            <nav className="p-2">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                    activeTab === item.id
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Period Selector - Show on Dashboard and Reports */}
        {(activeTab === 'dashboard' || activeTab === 'reports') && (
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="flex bg-white rounded-xl p-1 shadow-sm">
              {[
                { id: 'day', label: t.today },
                { id: 'week', label: t.week },
                { id: 'month', label: t.month },
                { id: 'year', label: t.year }
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => setReportPeriod(p.id)}
                  className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    reportPeriod === p.id ? 'bg-amber-500 text-white shadow' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button onClick={() => { fetchStats(); fetchTransactions(); }} className="p-2 bg-white rounded-lg shadow-sm hover:bg-slate-50">
              <RefreshCw className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        )}

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                {[
                  { label: t.revenue, value: stats.stats?.total_revenue, icon: Euro, color: 'emerald' },
                  { label: t.transactions, value: stats.stats?.total_transactions, icon: ShoppingBag, color: 'blue', isCount: true },
                  { label: t.commission, value: stats.stats?.total_commission, icon: Percent, color: 'amber' },
                  { label: t.bonus, value: stats.stats?.total_bonus_given, icon: Gift, color: 'purple' },
                  { label: t.cashback, value: stats.stats?.total_cashback, icon: TrendingUp, color: 'pink' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 bg-${stat.color}-100 rounded-xl flex items-center justify-center`}>
                        <stat.icon className={`w-4 h-4 sm:w-5 sm:h-5 text-${stat.color}-600`} />
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-500">{stat.label}</p>
                    <p className="text-lg sm:text-2xl font-bold text-slate-800">
                      {stat.isCount ? (stat.value || 0) : `€${(stat.value || 0).toFixed(2)}`}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Branch Comparison */}
            {stats?.branch_comparison?.length > 0 && (
              <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-100">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <Store className="w-5 h-5 text-amber-500" />
                  {t.topBranches}
                </h3>
                <div className="space-y-3">
                  {stats.branch_comparison.slice(0, 5).map((branch, i) => (
                    <div key={branch.branch_id} className="flex items-center gap-3 sm:gap-4">
                      <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{branch.branch_name}</p>
                        <p className="text-sm text-slate-500">{branch.transactions} {t.transactions}</p>
                      </div>
                      <p className="font-bold text-emerald-600 whitespace-nowrap">€{branch.revenue?.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Transactions */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-100">
              <h3 className="font-bold text-lg mb-4">{t.recentTransactions}</h3>
              {transactions.length > 0 ? (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-slate-500">Datum</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-500">{t.branches}</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-500">Typ</th>
                        <th className="px-4 py-3 text-right font-medium text-slate-500">{t.revenue}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {transactions.slice(0, 10).map((tx, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-600">{new Date(tx.created_at).toLocaleDateString('de-DE')}</td>
                          <td className="px-4 py-3">{tx.branch_name || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              tx.type === 'topup' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {tx.type === 'topup' ? 'Aufladung' : 'Zahlung'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-medium">€{tx.amount?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-slate-500 py-8">{t.noData}</p>
              )}
            </div>
          </div>
        )}

        {/* Branches Tab */}
        {activeTab === 'branches' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">{t.branches}</h2>
              <button
                onClick={() => setShowBranchModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl hover:bg-amber-600 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">{t.newBranch}</span>
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {branches.map(branch => (
                <div key={branch.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        branch.is_active ? 'bg-emerald-100' : 'bg-slate-100'
                      }`}>
                        <Store className={`w-5 h-5 ${branch.is_active ? 'text-emerald-600' : 'text-slate-400'}`} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800">{branch.name}</h3>
                        <p className="text-sm text-slate-500">{branch.city || '-'}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      branch.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {branch.is_active ? t.active : t.inactive}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-slate-600">
                    <p className="flex items-center gap-2"><Key className="w-4 h-4" /> {branch.api_keys_count || 0} API-Keys</p>
                    <p className="flex items-center gap-2"><Euro className="w-4 h-4" /> €{branch.total_revenue?.toFixed(2) || '0.00'}</p>
                  </div>
                </div>
              ))}
            </div>

            {branches.length === 0 && (
              <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
                <Store className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">{t.noData}</p>
              </div>
            )}
          </div>
        )}

        {/* API Keys Tab */}
        {activeTab === 'api-keys' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-slate-800">{t.apiKeys}</h2>
              <div className="flex items-center gap-2">
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm"
                >
                  <option value="">{t.allBranches}</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowKeyModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl hover:bg-amber-600 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">{t.newKey}</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-slate-500">{t.registerName}</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-500">{t.branches}</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-500">API-Key</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-500">Status</th>
                      <th className="px-4 py-3 text-center font-medium text-slate-500">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {apiKeys.map(key => (
                      <tr key={key.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{key.name}</td>
                        <td className="px-4 py-3 text-slate-600">{key.branch_name}</td>
                        <td className="px-4 py-3">
                          <code className="px-2 py-1 bg-slate-100 rounded text-xs">{key.api_key?.slice(0, 15)}...</code>
                          <button
                            onClick={() => { navigator.clipboard.writeText(key.api_key); toast.success('Kopiert!'); }}
                            className="ml-2 text-slate-400 hover:text-slate-600"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            key.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {key.is_active ? t.active : t.inactive}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleToggleKey(key.id)}
                              className={`p-1.5 rounded-lg ${key.is_active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}
                            >
                              {key.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                            </button>
                            <button
                              onClick={() => handleDeleteKey(key.id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {apiKeys.length === 0 && (
                <div className="p-8 text-center text-slate-500">{t.noData}</div>
              )}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">{t.users}</h2>
              <button
                onClick={() => setShowUserModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl hover:bg-amber-600 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">{t.newUser}</span>
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {users.map(user => (
                <div key={user.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        user.role === 'admin' ? 'bg-purple-100' : user.role === 'branch_manager' ? 'bg-blue-100' : 'bg-slate-100'
                      }`}>
                        <Users className={`w-5 h-5 ${
                          user.role === 'admin' ? 'text-purple-600' : user.role === 'branch_manager' ? 'text-blue-600' : 'text-slate-600'
                        }`} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800">{user.name}</h3>
                        <p className="text-sm text-slate-500">{user.email}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 
                      user.role === 'branch_manager' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {user.role === 'admin' ? t.admin : user.role === 'branch_manager' ? t.branchManager : t.cashier}
                    </span>
                    {user.branch_name && (
                      <span className="text-sm text-slate-500">{user.branch_name}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {users.length === 0 && (
              <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">{t.noData}</p>
              </div>
            )}
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">{t.reports}</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <FileText className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{t.csvExport}</h3>
                    <p className="text-sm text-slate-500">Excel-kompatibel</p>
                  </div>
                </div>
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full py-3 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  {t.csvExport}
                </button>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                    <FileText className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{t.pdfExport}</h3>
                    <p className="text-sm text-slate-500">Zum Ausdrucken</p>
                  </div>
                </div>
                <button
                  onClick={() => handleExport('pdf')}
                  className="w-full py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  {t.pdfExport}
                </button>
              </div>
            </div>

            {/* Stats Preview */}
            {stats && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-800 mb-4">Vorschau</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-sm text-slate-500">{t.revenue}</p>
                    <p className="text-xl font-bold text-slate-800">€{stats.stats?.total_revenue?.toFixed(2)}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-sm text-slate-500">{t.transactions}</p>
                    <p className="text-xl font-bold text-slate-800">{stats.stats?.total_transactions}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-sm text-slate-500">{t.commission}</p>
                    <p className="text-xl font-bold text-amber-600">€{stats.stats?.total_commission?.toFixed(2)}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-sm text-slate-500">{t.bonus}</p>
                    <p className="text-xl font-bold text-purple-600">€{stats.stats?.total_bonus_given?.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      {showBranchModal && (
        <Modal title={t.newBranch} onClose={() => setShowBranchModal(false)}>
          <BranchForm t={t} onSubmit={handleCreateBranch} onCancel={() => setShowBranchModal(false)} />
        </Modal>
      )}

      {showKeyModal && (
        <Modal title={t.newKey} onClose={() => setShowKeyModal(false)}>
          <ApiKeyForm t={t} branches={branches} onSubmit={handleCreateApiKey} onCancel={() => setShowKeyModal(false)} />
        </Modal>
      )}

      {showUserModal && (
        <Modal title={t.newUser} onClose={() => setShowUserModal(false)}>
          <UserForm t={t} branches={branches} onSubmit={handleCreateUser} onCancel={() => setShowUserModal(false)} />
        </Modal>
      )}

      {editingItem?.type === 'new_key' && (
        <Modal title="⚠️ API-Schlüssel erstellt!" onClose={() => setEditingItem(null)}>
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
              <strong>Wichtig:</strong> Speichern Sie diese Schlüssel jetzt!
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">API-Key:</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-slate-100 rounded-lg text-sm break-all">{editingItem.api_key}</code>
                <button onClick={() => { navigator.clipboard.writeText(editingItem.api_key); toast.success('Kopiert!'); }}
                  className="p-2 bg-slate-200 rounded-lg hover:bg-slate-300"><Copy className="w-4 h-4" /></button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Secret-Key:</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-slate-100 rounded-lg text-sm break-all">{editingItem.secret_key}</code>
                <button onClick={() => { navigator.clipboard.writeText(editingItem.secret_key); toast.success('Kopiert!'); }}
                  className="p-2 bg-slate-200 rounded-lg hover:bg-slate-300"><Copy className="w-4 h-4" /></button>
              </div>
            </div>
            <button onClick={() => setEditingItem(null)}
              className="w-full py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600">
              Verstanden
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Modal Component
function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h2 className="font-bold text-lg text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

// Forms
function BranchForm({ t, onSubmit, onCancel }) {
  const [form, setForm] = useState({ name: '', city: '', address: '', manager_name: '', manager_email: '', phone: '' });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <input type="text" placeholder={t.branchName} value={form.name} onChange={(e) => setForm({...form, name: e.target.value})}
        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500" required />
      <div className="grid grid-cols-2 gap-3">
        <input type="text" placeholder={t.city} value={form.city} onChange={(e) => setForm({...form, city: e.target.value})}
          className="px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500" />
        <input type="tel" placeholder={t.phone} value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})}
          className="px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500" />
      </div>
      <input type="text" placeholder={t.address} value={form.address} onChange={(e) => setForm({...form, address: e.target.value})}
        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500" />
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 py-3 border border-slate-200 rounded-xl hover:bg-slate-50">{t.cancel}</button>
        <button type="submit" className="flex-1 py-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600">{t.save}</button>
      </div>
    </form>
  );
}

function ApiKeyForm({ t, branches, onSubmit, onCancel }) {
  const [form, setForm] = useState({ name: '', branch_id: '', description: '' });
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!form.branch_id) { toast.error(t.selectBranch); return; } onSubmit(form); }} className="space-y-4">
      <select value={form.branch_id} onChange={(e) => setForm({...form, branch_id: e.target.value})}
        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500" required>
        <option value="">{t.selectBranch}...</option>
        {branches.filter(b => b.is_active).map(b => (<option key={b.id} value={b.id}>{b.name}</option>))}
      </select>
      <input type="text" placeholder={t.registerName} value={form.name} onChange={(e) => setForm({...form, name: e.target.value})}
        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500" required />
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 py-3 border border-slate-200 rounded-xl hover:bg-slate-50">{t.cancel}</button>
        <button type="submit" className="flex-1 py-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600">{t.save}</button>
      </div>
    </form>
  );
}

function UserForm({ t, branches, onSubmit, onCancel }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: '', branch_id: '' });
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (form.role !== 'admin' && !form.branch_id) { toast.error(t.selectBranch); return; } onSubmit(form); }} className="space-y-4">
      <input type="text" placeholder="Name" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})}
        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500" required />
      <input type="email" placeholder={t.email} value={form.email} onChange={(e) => setForm({...form, email: e.target.value})}
        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500" required />
      <input type="password" placeholder={t.password} value={form.password} onChange={(e) => setForm({...form, password: e.target.value})}
        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500" required minLength={6} />
      <select value={form.role} onChange={(e) => setForm({...form, role: e.target.value})}
        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500" required>
        <option value="">{t.role}...</option>
        <option value="admin">{t.admin}</option>
        <option value="branch_manager">{t.branchManager}</option>
        <option value="cashier">{t.cashier}</option>
      </select>
      {form.role && form.role !== 'admin' && (
        <select value={form.branch_id} onChange={(e) => setForm({...form, branch_id: e.target.value})}
          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500" required>
          <option value="">{t.selectBranch}...</option>
          {branches.filter(b => b.is_active).map(b => (<option key={b.id} value={b.id}>{b.name}</option>))}
        </select>
      )}
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 py-3 border border-slate-200 rounded-xl hover:bg-slate-50">{t.cancel}</button>
        <button type="submit" className="flex-1 py-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600">{t.save}</button>
      </div>
    </form>
  );
}
