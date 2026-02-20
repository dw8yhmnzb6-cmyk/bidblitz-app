/**
 * Staff POS - Mitarbeiter-Kassensystem
 * Mitarbeiter können sich einloggen und Transaktionen durchführen
 */
import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Store, QrCode, Euro, RefreshCw, CheckCircle, Clock, XCircle,
  Plus, History, Printer, LogOut, User, Lock, CreditCard,
  Wallet, ShoppingBag, Receipt, ArrowRight, Scan, Gift, X
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Sound effects
const playSound = (type) => {
  const sounds = {
    success: '/sounds/success.mp3',
    pending: '/sounds/pending.mp3',
    error: '/sounds/error.mp3'
  };
  try {
    const audio = new Audio(sounds[type]);
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch (e) {}
};

export default function StaffPOS() {
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [staff, setStaff] = useState(null);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  
  // Transaction state
  const [mode, setMode] = useState('topup'); // 'topup', 'payment', 'scan'
  const [amount, setAmount] = useState('');
  const [customerNumber, setCustomerNumber] = useState('');
  const [currentTransaction, setCurrentTransaction] = useState(null);
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);

  // Bonus tiers
  const bonusTiers = [
    { min: 200, bonus: 12.00, percent: 6 },
    { min: 100, bonus: 5.00, percent: 5 },
    { min: 50, bonus: 2.00, percent: 4 },
    { min: 20, bonus: 0.50, percent: 2.5 }
  ];

  // Calculate bonus for amount
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
        fetchTransactionHistory(data.branch_id);
      } catch (e) {
        localStorage.removeItem('staff_pos_data');
        localStorage.removeItem('staff_pos_token');
      }
    }
  }, []);

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Try enterprise login first
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
        fetchTransactionHistory(staffData.branch_id);
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
    setCurrentTransaction(null);
    localStorage.removeItem('staff_pos_data');
    localStorage.removeItem('staff_pos_token');
    toast.success('Erfolgreich abgemeldet');
  };

  // Fetch transaction history
  const fetchTransactionHistory = async (branchId) => {
    try {
      const token = localStorage.getItem('staff_pos_token');
      const res = await fetch(`${API_URL}/api/enterprise/transactions?limit=20`, {
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

  // Process top-up
  const processTopup = async () => {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum < 5) {
      toast.error('Mindestbetrag: €5');
      return;
    }
    if (amountNum > 500) {
      toast.error('Maximalbetrag: €500');
      return;
    }
    if (!customerNumber.trim()) {
      toast.error('Bitte Kundennummer eingeben');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('staff_pos_token');
      const res = await fetch(`${API_URL}/api/digital/topup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          customer_number: customerNumber,
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
        setLastReceipt({
          ...data,
          amount: amountNum,
          bonus: calculateBonus(amountNum),
          timestamp: new Date().toISOString(),
          staff_name: staff?.name,
          branch_name: staff?.branch_name
        });
        setShowReceipt(true);
        setAmount('');
        setCustomerNumber('');
        toast.success(`✅ Aufladung erfolgreich! €${amountNum.toFixed(2)} + €${calculateBonus(amountNum).toFixed(2)} Bonus`);
        fetchTransactionHistory(staff?.branch_id);
      } else {
        const error = await res.json();
        playSound('error');
        toast.error(error.detail || 'Aufladung fehlgeschlagen');
      }
    } catch (err) {
      playSound('error');
      toast.error('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  };

  // Quick amount buttons
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
            >
              <History className="w-5 h-5" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto p-4">
        {/* Mode Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'topup', label: 'Aufladung', icon: Wallet },
            { id: 'payment', label: 'Zahlung', icon: CreditCard },
            { id: 'scan', label: 'QR Scan', icon: Scan }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setMode(tab.id)}
              className={`flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                mode === tab.id
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Top-up Mode */}
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

            {/* Customer Number */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
              <label className="block text-slate-300 mb-2">Kundennummer</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
                <input
                  type="text"
                  placeholder="z.B. 12345 oder QR-Code scannen"
                  value={customerNumber}
                  onChange={(e) => setCustomerNumber(e.target.value)}
                  className="w-full pl-14 pr-4 py-4 bg-slate-900/50 border border-slate-600 rounded-xl text-white text-xl placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Process Button */}
            <button
              onClick={processTopup}
              disabled={loading || !amount || !customerNumber}
              className="w-full py-5 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-xl rounded-2xl hover:from-green-600 hover:to-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/30 flex items-center justify-center gap-3"
            >
              {loading ? (
                <RefreshCw className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="w-6 h-6" />
                  Aufladung durchführen
                </>
              )}
            </button>

            {/* Bonus Tiers Info */}
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

        {/* Payment Mode */}
        {mode === 'payment' && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 text-center">
            <CreditCard className="w-16 h-16 text-slate-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Zahlung erstellen</h3>
            <p className="text-slate-400">
              Hier können Sie QR-Code-Zahlungen für Kunden erstellen.
            </p>
            <p className="text-amber-400 mt-4">Funktion in Entwicklung...</p>
          </div>
        )}

        {/* Scan Mode */}
        {mode === 'scan' && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 text-center">
            <Scan className="w-16 h-16 text-slate-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">QR-Code Scanner</h3>
            <p className="text-slate-400">
              Scannen Sie den QR-Code des Kunden, um dessen Kundennummer zu erfassen.
            </p>
            <button
              onClick={() => {
                toast.success('Kamera wird geöffnet...');
                // In real implementation, this would open camera
              }}
              className="mt-4 px-6 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors"
            >
              Scanner öffnen
            </button>
          </div>
        )}
      </main>

      {/* Transaction History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Transaktionsverlauf</h2>
              <button
                onClick={() => setShowHistory(false)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {transactionHistory.length > 0 ? (
                <div className="space-y-3">
                  {transactionHistory.map((tx, i) => (
                    <div key={i} className="bg-slate-700/50 rounded-xl p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-white font-medium">€{tx.amount?.toFixed(2)}</p>
                          <p className="text-slate-400 text-sm">Kunde: {tx.customer_number}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          tx.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {tx.status === 'completed' ? 'Abgeschlossen' : 'Ausstehend'}
                        </span>
                      </div>
                      <p className="text-slate-500 text-xs mt-2">
                        {new Date(tx.created_at).toLocaleString('de-DE')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-center py-8">Keine Transaktionen vorhanden</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && lastReceipt && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            {/* Receipt */}
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
                  <span className="font-bold text-xl">€{(lastReceipt.amount + lastReceipt.bonus).toFixed(2)}</span>
                </div>
              </div>
              
              <div className="mt-4 text-sm text-gray-500">
                <p>Mitarbeiter: {lastReceipt.staff_name}</p>
                <p>{new Date(lastReceipt.timestamp).toLocaleString('de-DE')}</p>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 flex gap-2">
              <button
                onClick={() => {
                  toast.success('Beleg wird gedruckt...');
                }}
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
    </div>
  );
}
