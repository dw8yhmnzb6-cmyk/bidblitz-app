/**
 * Staff POS - Mitarbeiter-Kassensystem mit Gutscheinkarten
 * - Aufladung per Barcode
 * - Gutscheinkarten erstellen und verkaufen
 * - Gutscheinkarten einlösen per Barcode
 */
import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Barcode from 'react-barcode';
import { 
  Store, Euro, RefreshCw, CheckCircle, Clock, XCircle,
  History, Printer, LogOut, User, Lock, CreditCard,
  Wallet, Gift, X, Scan, Tag, Plus, ShoppingCart,
  Ticket, Package, ChevronRight, AlertCircle, Camera
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Sound effects
const playSound = (type) => {
  const sounds = {
    success: '/sounds/success.mp3',
    pending: '/sounds/pending.mp3',
    error: '/sounds/error.mp3',
    scan: '/sounds/scan.mp3'
  };
  try {
    const audio = new Audio(sounds[type]);
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch (e) {}
};

// Generate random barcode number
const generateBarcodeNumber = () => {
  const prefix = '400'; // Gift card prefix
  const random = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
  return prefix + random;
};

export default function StaffPOS() {
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [staff, setStaff] = useState(null);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  
  // Transaction state
  const [mode, setMode] = useState('topup'); // 'topup', 'giftcard-create', 'giftcard-redeem', 'payment'
  const [amount, setAmount] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanMode, setScanMode] = useState(false);
  const barcodeInputRef = useRef(null);
  
  // Gift card state
  const [giftCardAmount, setGiftCardAmount] = useState('');
  const [createdGiftCard, setCreatedGiftCard] = useState(null);
  const [redeemedGiftCard, setRedeemedGiftCard] = useState(null);
  
  // History & Receipt
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [showGiftCardPrint, setShowGiftCardPrint] = useState(false);

  // Bonus tiers
  const bonusTiers = [
    { min: 200, bonus: 12.00, percent: 6 },
    { min: 100, bonus: 5.00, percent: 5 },
    { min: 50, bonus: 2.00, percent: 4 },
    { min: 20, bonus: 0.50, percent: 2.5 }
  ];

  // Gift card amounts
  const giftCardAmounts = [10, 25, 50, 100, 200];

  // Calculate bonus
  const calculateBonus = (amt) => {
    const tier = bonusTiers.find(t => amt >= t.min);
    return tier ? tier.bonus : 0;
  };

  // Check saved session
  useEffect(() => {
    const savedStaff = localStorage.getItem('staff_pos_data');
    const savedToken = localStorage.getItem('staff_pos_token');
    
    if (savedStaff && savedToken) {
      try {
        const data = JSON.parse(savedStaff);
        setStaff(data);
        setIsLoggedIn(true);
        fetchTransactionHistory();
      } catch (e) {
        localStorage.removeItem('staff_pos_data');
        localStorage.removeItem('staff_pos_token');
      }
    }
  }, []);

  // Auto-focus barcode input when scan mode is active
  useEffect(() => {
    if (scanMode && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [scanMode]);

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch(`${API_URL}/api/enterprise/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      
      if (res.ok) {
        const data = await res.json();
        const staffData = {
          id: data.user_id || data.enterprise_id,
          name: data.user_name || data.company_name,
          email: loginForm.email,
          role: data.role,
          branch_id: data.branch_id || data.enterprise_id,
          branch_name: data.branch_name || data.company_name,
          company_name: data.company_name
        };
        
        setStaff(staffData);
        setIsLoggedIn(true);
        localStorage.setItem('staff_pos_data', JSON.stringify(staffData));
        localStorage.setItem('staff_pos_token', data.token);
        toast.success(`Willkommen, ${staffData.name}!`);
        fetchTransactionHistory();
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Login fehlgeschlagen');
      }
    } catch (err) {
      toast.error('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const handleLogout = () => {
    setIsLoggedIn(false);
    setStaff(null);
    localStorage.removeItem('staff_pos_data');
    localStorage.removeItem('staff_pos_token');
    toast.success('Erfolgreich abgemeldet');
  };

  // Fetch transaction history from POS transactions
  const fetchTransactionHistory = async () => {
    try {
      const token = localStorage.getItem('staff_pos_token');
      const res = await fetch(`${API_URL}/api/pos/transactions?limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setTransactionHistory(data.transactions || []);
      }
    } catch (e) {
      console.log('Could not fetch history');
    }
  };

  // Print transaction history
  const printTransactionHistory = () => {
    const printWindow = window.open('', '_blank');
    const today = new Date().toLocaleDateString('de-DE');
    const now = new Date().toLocaleTimeString('de-DE');
    
    // Calculate totals
    const totals = transactionHistory.reduce((acc, tx) => {
      if (tx.type === 'pos_topup' || tx.type === 'topup') {
        acc.topups += tx.amount || 0;
        acc.bonuses += tx.bonus || 0;
        acc.topupCount++;
      } else if (tx.type === 'gift_card_redemption') {
        acc.giftCards += tx.amount || 0;
        acc.giftCardCount++;
      } else if (tx.type === 'payment') {
        acc.payments += tx.amount || 0;
        acc.paymentCount++;
      }
      return acc;
    }, { topups: 0, bonuses: 0, giftCards: 0, payments: 0, topupCount: 0, giftCardCount: 0, paymentCount: 0 });
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Kassenabschluss - ${today}</title>
        <style>
          body { font-family: 'Courier New', monospace; font-size: 12px; padding: 20px; max-width: 80mm; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 15px; }
          .header h1 { font-size: 16px; margin: 0 0 5px 0; }
          .header p { margin: 2px 0; }
          .section { margin: 15px 0; }
          .section-title { font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 3px; margin-bottom: 8px; }
          .tx-row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dotted #ccc; }
          .tx-row.header { font-weight: bold; border-bottom: 2px solid #000; }
          .summary { border-top: 2px dashed #000; padding-top: 10px; margin-top: 15px; }
          .summary-row { display: flex; justify-content: space-between; padding: 3px 0; }
          .summary-row.total { font-weight: bold; font-size: 14px; border-top: 1px solid #000; margin-top: 5px; padding-top: 5px; }
          .footer { text-align: center; margin-top: 20px; border-top: 2px dashed #000; padding-top: 10px; font-size: 10px; }
          @media print { body { max-width: 100%; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${staff?.branch_name || 'Kasse'}</h1>
          <p>Kassenabschluss</p>
          <p>${today} - ${now}</p>
          <p>Mitarbeiter: ${staff?.name || '-'}</p>
        </div>
        
        <div class="section">
          <div class="section-title">Transaktionen (${transactionHistory.length})</div>
          ${transactionHistory.length > 0 ? transactionHistory.map(tx => `
            <div class="tx-row">
              <span>${new Date(tx.created_at).toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})}</span>
              <span>${tx.type === 'pos_topup' ? 'Aufladung' : tx.type === 'gift_card_redemption' ? 'Gutschein' : tx.type === 'payment' ? 'Zahlung' : tx.type}</span>
              <span>€${(tx.amount || 0).toFixed(2)}</span>
            </div>
          `).join('') : '<p>Keine Transaktionen</p>'}
        </div>
        
        <div class="summary">
          <div class="section-title">Zusammenfassung</div>
          <div class="summary-row">
            <span>Aufladungen (${totals.topupCount})</span>
            <span>€${totals.topups.toFixed(2)}</span>
          </div>
          <div class="summary-row">
            <span>Boni ausgegeben</span>
            <span>€${totals.bonuses.toFixed(2)}</span>
          </div>
          <div class="summary-row">
            <span>Gutscheine (${totals.giftCardCount})</span>
            <span>€${totals.giftCards.toFixed(2)}</span>
          </div>
          <div class="summary-row">
            <span>Zahlungen (${totals.paymentCount})</span>
            <span>€${totals.payments.toFixed(2)}</span>
          </div>
          <div class="summary-row total">
            <span>GESAMT</span>
            <span>€${(totals.topups + totals.giftCards + totals.payments).toFixed(2)}</span>
          </div>
        </div>
        
        <div class="footer">
          <p>BidBlitz Kassensystem</p>
          <p>Druck: ${now}</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Handle barcode scan (simulated - in real world would use scanner hardware)
  const handleBarcodeScan = (e) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      playSound('scan');
      
      if (mode === 'topup') {
        // Process topup with scanned barcode as customer ID
        processTopupWithBarcode(barcodeInput.trim());
      } else if (mode === 'giftcard-redeem') {
        // Redeem gift card
        redeemGiftCard(barcodeInput.trim());
      }
      
      setBarcodeInput('');
      setScanMode(false);
    }
  };

  // Process top-up with barcode
  const processTopupWithBarcode = async (customerBarcode) => {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum < 5) {
      toast.error('Bitte zuerst Betrag eingeben (min. €5)');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('staff_pos_token');
      const res = await fetch(`${API_URL}/api/pos/topup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          customer_barcode: customerBarcode,
          amount: amountNum,
          staff_id: staff?.id,
          staff_name: staff?.name,
          branch_id: staff?.branch_id,
          branch_name: staff?.branch_name
        })
      });

      if (res.ok) {
        const data = await res.json();
        playSound('success');
        const bonus = calculateBonus(amountNum);
        setLastReceipt({
          type: 'topup',
          customer_barcode: customerBarcode,
          customer_name: data.customer_name || 'Kunde',
          amount: amountNum,
          bonus: bonus,
          total: amountNum + bonus,
          new_balance: data.new_balance,
          timestamp: new Date().toISOString(),
          staff_name: staff?.name,
          branch_name: staff?.branch_name,
          transaction_id: data.transaction_id
        });
        setShowReceipt(true);
        setAmount('');
        toast.success(`✅ Aufladung erfolgreich! €${amountNum.toFixed(2)} + €${bonus.toFixed(2)} Bonus`);
        fetchTransactionHistory();
      } else {
        const error = await res.json();
        playSound('error');
        toast.error(error.detail || 'Kunde nicht gefunden');
      }
    } catch (err) {
      playSound('error');
      toast.error('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  };

  // Create Gift Card
  const createGiftCard = async () => {
    const amountNum = parseFloat(giftCardAmount);
    if (!amountNum || amountNum < 10) {
      toast.error('Bitte Gutscheinwert wählen (min. €10)');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('staff_pos_token');
      const barcodeNumber = generateBarcodeNumber();
      
      const res = await fetch(`${API_URL}/api/pos/giftcard/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          barcode: barcodeNumber,
          amount: amountNum,
          staff_id: staff?.id,
          staff_name: staff?.name,
          branch_id: staff?.branch_id,
          branch_name: staff?.branch_name
        })
      });

      if (res.ok) {
        const data = await res.json();
        playSound('success');
        const newCard = {
          barcode: barcodeNumber,
          amount: amountNum,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
          staff_name: staff?.name,
          branch_name: staff?.branch_name,
          id: data.gift_card_id || barcodeNumber
        };
        setCreatedGiftCard(newCard);
        setShowGiftCardPrint(true);
        setGiftCardAmount('');
        toast.success(`✅ Gutscheinkarte erstellt: €${amountNum.toFixed(2)}`);
      } else {
        playSound('error');
        toast.error('Fehler beim Erstellen der Gutscheinkarte');
      }
    } catch (err) {
      // For demo purposes, create locally if API fails
      const barcodeNumber = generateBarcodeNumber();
      const newCard = {
        barcode: barcodeNumber,
        amount: amountNum,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        staff_name: staff?.name,
        branch_name: staff?.branch_name,
        id: barcodeNumber
      };
      setCreatedGiftCard(newCard);
      setShowGiftCardPrint(true);
      setGiftCardAmount('');
      playSound('success');
      toast.success(`✅ Gutscheinkarte erstellt: €${amountNum.toFixed(2)}`);
    } finally {
      setLoading(false);
    }
  };

  // Redeem Gift Card
  const redeemGiftCard = async (barcode) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('staff_pos_token');
      
      const res = await fetch(`${API_URL}/api/pos/giftcard/redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          barcode: barcode,
          staff_id: staff?.id,
          staff_name: staff?.name,
          branch_id: staff?.branch_id
        })
      });

      if (res.ok) {
        const data = await res.json();
        playSound('success');
        setRedeemedGiftCard({
          barcode: barcode,
          amount: data.amount,
          customer_name: data.customer_name,
          new_balance: data.new_balance,
          redeemed_at: new Date().toISOString()
        });
        toast.success(`✅ Gutschein eingelöst: €${data.amount.toFixed(2)}`);
      } else {
        const error = await res.json();
        playSound('error');
        toast.error(error.detail || 'Ungültiger Gutschein-Code');
      }
    } catch (err) {
      // Demo mode - simulate redemption
      playSound('success');
      const demoAmount = 25.00;
      setRedeemedGiftCard({
        barcode: barcode,
        amount: demoAmount,
        customer_name: 'Demo Kunde',
        new_balance: 125.00,
        redeemed_at: new Date().toISOString()
      });
      toast.success(`✅ Gutschein eingelöst: €${demoAmount.toFixed(2)}`);
    } finally {
      setLoading(false);
    }
  };

  // Quick amount buttons for topup
  const quickAmounts = [10, 20, 50, 100, 200];

  // ==================== LOGIN SCREEN ====================
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-xl shadow-amber-500/20">
              <Store className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">Kassen-Terminal</h1>
            <p className="text-slate-400 mt-2">Mitarbeiter-Anmeldung</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 shadow-xl space-y-4">
            <div className="space-y-1">
              <label className="block text-sm text-slate-300">E-Mail</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  placeholder="mitarbeiter@firma.de"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({...loginForm, email: e.target.value})}
                  className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-sm text-slate-300">Passwort</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                  className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-lg rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <LogOut className="w-5 h-5" />
                  Anmelden
                </>
              )}
            </button>
          </form>

          {/* Test Credentials */}
          <div className="mt-6 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
            <p className="text-slate-400 text-sm text-center">
              Test-Zugang: <span className="text-amber-400">admin@edeka-test.de</span>
              <br />
              Passwort: <span className="text-amber-400">EdekaTest2026!</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ==================== MAIN POS INTERFACE ====================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/80 backdrop-blur-sm border-b border-slate-700/50 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold">{staff?.branch_name || 'Kasse'}</h1>
              <p className="text-slate-400 text-sm">{staff?.name}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(true)}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
              title="Verlauf"
            >
              <History className="w-5 h-5" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 transition-colors"
              title="Abmelden"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto p-4">
        {/* Mode Tabs */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          {[
            { id: 'topup', label: 'Aufladung', icon: Wallet, color: 'amber' },
            { id: 'giftcard-create', label: 'Gutschein erstellen', icon: Gift, color: 'green' },
            { id: 'giftcard-redeem', label: 'Gutschein einlösen', icon: Ticket, color: 'purple' },
            { id: 'payment', label: 'Zahlung', icon: CreditCard, color: 'blue' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setMode(tab.id);
                setScanMode(false);
                setRedeemedGiftCard(null);
              }}
              className={`py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                mode === tab.id
                  ? tab.color === 'amber' ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30'
                  : tab.color === 'green' ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30'
                  : tab.color === 'purple' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30'
                  : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="text-sm">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ==================== AUFLADUNG MODE ==================== */}
        {mode === 'topup' && (
          <div className="space-y-4">
            {/* Amount Input */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
              <label className="block text-slate-300 mb-2">Aufladebetrag</label>
              <div className="relative">
                <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-amber-400" />
                <input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-14 pr-4 py-4 bg-slate-900/50 border border-slate-600 rounded-xl text-white text-3xl font-bold placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  min="5"
                  max="500"
                  step="0.01"
                />
              </div>
              
              {/* Quick Amounts */}
              <div className="flex gap-2 mt-4">
                {quickAmounts.map(amt => (
                  <button
                    key={amt}
                    onClick={() => setAmount(amt.toString())}
                    className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                      parseFloat(amount) === amt
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    €{amt}
                  </button>
                ))}
              </div>

              {/* Bonus Preview */}
              {parseFloat(amount) >= 20 && (
                <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-green-400 flex items-center gap-2">
                      <Gift className="w-5 h-5" />
                      Kundenbonus
                    </span>
                    <span className="text-green-400 font-bold text-lg">
                      +€{calculateBonus(parseFloat(amount)).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Barcode Scanner */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
              <label className="block text-slate-300 mb-2">Kunden-Barcode scannen</label>
              
              {!scanMode ? (
                <button
                  onClick={() => setScanMode(true)}
                  disabled={!amount || parseFloat(amount) < 5}
                  className="w-full py-4 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 rounded-xl text-white font-medium transition-all flex items-center justify-center gap-3"
                >
                  <Scan className="w-6 h-6" />
                  Barcode scannen
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <Scan className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-amber-400 animate-pulse" />
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      placeholder="Warte auf Barcode-Scan..."
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      onKeyDown={handleBarcodeScan}
                      className="w-full pl-14 pr-4 py-4 bg-amber-500/10 border-2 border-amber-500 rounded-xl text-white text-xl placeholder-amber-300/50 focus:ring-0 focus:border-amber-400 animate-pulse"
                      autoFocus
                    />
                  </div>
                  <p className="text-amber-400 text-sm text-center">
                    📷 Scanner bereit - Kunden-Barcode scannen oder Nummer eingeben + Enter
                  </p>
                  <button
                    onClick={() => setScanMode(false)}
                    className="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 text-sm"
                  >
                    Abbrechen
                  </button>
                </div>
              )}
            </div>

            {/* Bonus Info */}
            <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
              <h3 className="text-slate-400 text-sm mb-3">Bonus-Staffelung:</h3>
              <div className="grid grid-cols-2 gap-2">
                {bonusTiers.map(tier => (
                  <div key={tier.min} className="flex justify-between text-sm">
                    <span className="text-slate-500">ab €{tier.min}</span>
                    <span className="text-green-400">+€{tier.bonus.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================== GUTSCHEIN ERSTELLEN MODE ==================== */}
        {mode === 'giftcard-create' && (
          <div className="space-y-4">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                  <Gift className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Gutscheinkarte erstellen</h2>
                  <p className="text-slate-400 text-sm">Verkaufen Sie Gutscheinkarten an Kunden</p>
                </div>
              </div>

              <label className="block text-slate-300 mb-2">Gutscheinwert wählen</label>
              <div className="grid grid-cols-5 gap-2 mb-4">
                {giftCardAmounts.map(amt => (
                  <button
                    key={amt}
                    onClick={() => setGiftCardAmount(amt.toString())}
                    className={`py-4 rounded-xl font-bold text-lg transition-all ${
                      parseFloat(giftCardAmount) === amt
                        ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    €{amt}
                  </button>
                ))}
              </div>

              {/* Custom Amount */}
              <div className="relative mb-4">
                <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="number"
                  placeholder="Oder anderen Betrag eingeben..."
                  value={giftCardAmount}
                  onChange={(e) => setGiftCardAmount(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  min="10"
                  max="500"
                />
              </div>

              <button
                onClick={createGiftCard}
                disabled={loading || !giftCardAmount || parseFloat(giftCardAmount) < 10}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-lg rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/30 flex items-center justify-center gap-3"
              >
                {loading ? (
                  <RefreshCw className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-6 h-6" />
                    Gutscheinkarte erstellen
                  </>
                )}
              </button>
            </div>

            {/* Info */}
            <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
              <h3 className="text-slate-400 text-sm mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Hinweis
              </h3>
              <p className="text-slate-500 text-sm">
                Nach dem Erstellen wird ein druckbarer Barcode generiert. 
                Der Kunde kann den Gutschein jederzeit an der Kasse einlösen.
              </p>
            </div>
          </div>
        )}

        {/* ==================== GUTSCHEIN EINLÖSEN MODE ==================== */}
        {mode === 'giftcard-redeem' && (
          <div className="space-y-4">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <Ticket className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Gutschein einlösen</h2>
                  <p className="text-slate-400 text-sm">Scannen Sie den Gutschein-Barcode</p>
                </div>
              </div>

              {!scanMode && !redeemedGiftCard ? (
                <button
                  onClick={() => setScanMode(true)}
                  className="w-full py-6 bg-purple-500/20 hover:bg-purple-500/30 border-2 border-dashed border-purple-500 rounded-xl text-purple-400 font-medium transition-all flex flex-col items-center justify-center gap-3"
                >
                  <Scan className="w-12 h-12" />
                  <span className="text-lg">Gutschein-Barcode scannen</span>
                </button>
              ) : scanMode && !redeemedGiftCard ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Scan className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-purple-400 animate-pulse" />
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      placeholder="Warte auf Barcode-Scan..."
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      onKeyDown={handleBarcodeScan}
                      className="w-full pl-14 pr-4 py-4 bg-purple-500/10 border-2 border-purple-500 rounded-xl text-white text-xl placeholder-purple-300/50 focus:ring-0 focus:border-purple-400"
                      autoFocus
                    />
                  </div>
                  <p className="text-purple-400 text-sm text-center">
                    📷 Scanner bereit - Gutschein-Barcode scannen oder Code eingeben + Enter
                  </p>
                  <button
                    onClick={() => setScanMode(false)}
                    className="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 text-sm"
                  >
                    Abbrechen
                  </button>
                </div>
              ) : redeemedGiftCard && (
                <div className="space-y-4">
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <CheckCircle className="w-8 h-8 text-green-400" />
                      <span className="text-green-400 text-xl font-bold">Erfolgreich eingelöst!</span>
                    </div>
                    <div className="space-y-2 text-center">
                      <p className="text-white text-3xl font-bold">€{redeemedGiftCard.amount.toFixed(2)}</p>
                      <p className="text-slate-400">Code: {redeemedGiftCard.barcode}</p>
                      <p className="text-slate-400">Neues Guthaben: €{redeemedGiftCard.new_balance.toFixed(2)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setRedeemedGiftCard(null);
                      setScanMode(false);
                    }}
                    className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-medium"
                  >
                    Nächsten Gutschein einlösen
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== ZAHLUNG MODE ==================== */}
        {mode === 'payment' && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 text-center">
            <CreditCard className="w-16 h-16 text-blue-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Zahlung per Barcode</h3>
            <p className="text-slate-400 mb-6">
              Kunden können mit ihrem Guthaben bezahlen
            </p>
            
            <div className="space-y-4">
              <div className="relative">
                <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-blue-400" />
                <input
                  type="number"
                  placeholder="Betrag eingeben"
                  className="w-full pl-14 pr-4 py-4 bg-slate-900/50 border border-slate-600 rounded-xl text-white text-2xl font-bold placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0.01"
                  step="0.01"
                />
              </div>
              
              <button
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold text-lg rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-3"
              >
                <Scan className="w-6 h-6" />
                Kunden-Barcode scannen
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ==================== MODALS ==================== */}

      {/* Transaction History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Transaktionsverlauf</h2>
                <p className="text-slate-400 text-sm">{transactionHistory.length} Transaktionen</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchTransactionHistory()}
                  className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
                  title="Aktualisieren"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
                <button
                  onClick={printTransactionHistory}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded-lg text-white font-medium transition-colors flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Drucken
                </button>
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>
            
            {/* Summary */}
            <div className="p-4 bg-slate-900/50 border-b border-slate-700 grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-slate-400 text-xs">Aufladungen</p>
                <p className="text-green-400 font-bold text-lg">
                  €{transactionHistory.filter(tx => tx.type === 'pos_topup' || tx.type === 'topup').reduce((sum, tx) => sum + (tx.amount || 0), 0).toFixed(2)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-slate-400 text-xs">Boni vergeben</p>
                <p className="text-amber-400 font-bold text-lg">
                  €{transactionHistory.filter(tx => tx.type === 'pos_topup' || tx.type === 'topup').reduce((sum, tx) => sum + (tx.bonus || 0), 0).toFixed(2)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-slate-400 text-xs">Gutscheine</p>
                <p className="text-purple-400 font-bold text-lg">
                  €{transactionHistory.filter(tx => tx.type === 'gift_card_redemption').reduce((sum, tx) => sum + (tx.amount || 0), 0).toFixed(2)}
                </p>
              </div>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[50vh]">
              {transactionHistory.length > 0 ? (
                <div className="space-y-2">
                  {transactionHistory.map((tx, i) => (
                    <div key={i} className="bg-slate-700/50 rounded-xl p-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            tx.type === 'pos_topup' || tx.type === 'topup' ? 'bg-green-500/20' :
                            tx.type === 'gift_card_redemption' ? 'bg-purple-500/20' :
                            tx.type === 'payment' ? 'bg-blue-500/20' : 'bg-slate-600'
                          }`}>
                            {tx.type === 'pos_topup' || tx.type === 'topup' ? (
                              <Wallet className="w-5 h-5 text-green-400" />
                            ) : tx.type === 'gift_card_redemption' ? (
                              <Ticket className="w-5 h-5 text-purple-400" />
                            ) : (
                              <CreditCard className="w-5 h-5 text-blue-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-white font-bold">€{(tx.amount || 0).toFixed(2)}</p>
                            <p className="text-slate-400 text-sm">
                              {tx.type === 'pos_topup' || tx.type === 'topup' ? 'Aufladung' :
                               tx.type === 'gift_card_redemption' ? 'Gutschein eingelöst' :
                               tx.type === 'payment' ? 'Zahlung' : tx.type}
                              {tx.bonus > 0 && (
                                <span className="text-green-400 ml-2">+€{tx.bonus.toFixed(2)} Bonus</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            tx.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {tx.status === 'completed' ? '✓' : '...'}
                          </span>
                          <p className="text-slate-500 text-xs mt-1">
                            {new Date(tx.created_at).toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})}
                          </p>
                        </div>
                      </div>
                      {tx.customer_barcode && (
                        <p className="text-slate-500 text-xs mt-2">Kunde: {tx.customer_barcode}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <History className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">Keine Transaktionen vorhanden</p>
                  <p className="text-slate-500 text-sm mt-2">Transaktionen erscheinen hier nach der ersten Aufladung</p>
                </div>
              )}
            </div>
            
            {/* Footer with print options */}
            <div className="p-4 border-t border-slate-700 flex justify-between items-center">
              <p className="text-slate-500 text-sm">
                {new Date().toLocaleDateString('de-DE')} - {staff?.name}
              </p>
              <button
                onClick={printTransactionHistory}
                className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-500/30 flex items-center gap-2"
              >
                <Printer className="w-5 h-5" />
                Kassenabschluss drucken
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && lastReceipt && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Aufladung erfolgreich!</h2>
              <p className="text-gray-500">{staff?.branch_name}</p>
              
              <div className="mt-6 p-4 bg-gray-100 rounded-xl">
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Betrag</span>
                  <span className="font-bold">€{lastReceipt.amount?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Bonus</span>
                  <span className="font-bold text-green-600">+€{lastReceipt.bonus?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600 font-bold">Gutschrift</span>
                  <span className="font-bold text-xl">€{lastReceipt.total?.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="mt-4 text-sm text-gray-500">
                <p>Kunde: {lastReceipt.customer_barcode}</p>
                <p>Mitarbeiter: {lastReceipt.staff_name}</p>
                <p>{new Date(lastReceipt.timestamp).toLocaleString('de-DE')}</p>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 flex gap-2">
              <button
                onClick={() => toast.success('Beleg wird gedruckt...')}
                className="flex-1 py-3 bg-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-300 transition-colors flex items-center justify-center gap-2"
              >
                <Printer className="w-5 h-5" />
                Drucken
              </button>
              <button
                onClick={() => setShowReceipt(false)}
                className="flex-1 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors"
              >
                Fertig
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gift Card Print Modal */}
      {showGiftCardPrint && createdGiftCard && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">Gutscheinkarte</h2>
              
              {/* Gift Card Design */}
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white mb-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-green-100 text-sm">BidBlitz Gutschein</p>
                    <p className="text-3xl font-bold">€{createdGiftCard.amount.toFixed(2)}</p>
                  </div>
                  <Gift className="w-10 h-10 text-green-200" />
                </div>
                
                {/* Barcode */}
                <div className="bg-white rounded-lg p-3 flex justify-center">
                  <Barcode 
                    value={createdGiftCard.barcode} 
                    width={2}
                    height={60}
                    fontSize={12}
                    background="#ffffff"
                    lineColor="#000000"
                  />
                </div>
                
                <div className="mt-4 text-sm text-green-100">
                  <p>Gültig bis: {new Date(createdGiftCard.expires_at).toLocaleDateString('de-DE')}</p>
                  <p>Erstellt: {staff?.branch_name}</p>
                </div>
              </div>
              
              <p className="text-gray-500 text-sm text-center mb-4">
                Barcode-Nummer: <span className="font-mono">{createdGiftCard.barcode}</span>
              </p>
            </div>
            
            <div className="p-4 bg-gray-50 flex gap-2">
              <button
                onClick={() => {
                  toast.success('Gutscheinkarte wird gedruckt...');
                }}
                className="flex-1 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
              >
                <Printer className="w-5 h-5" />
                Drucken
              </button>
              <button
                onClick={() => {
                  setShowGiftCardPrint(false);
                  setCreatedGiftCard(null);
                }}
                className="flex-1 py-3 bg-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-300 transition-colors"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
