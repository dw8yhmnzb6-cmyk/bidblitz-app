/**
 * POS Kiosk Mode - Full-screen Tablet-optimized Point of Sale Terminal
 * Designed for dedicated POS devices (iPad, Android Tablets)
 * Now supports both Payment and Top-up modes
 */
import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Store, QrCode, Euro, RefreshCw, CheckCircle, Clock, XCircle,
  Plus, History, Volume2, VolumeX, Maximize, Minimize, LogOut,
  Wifi, Delete, ArrowLeft, CreditCard, Download, Share2
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const FRONTEND_URL = window.location.origin;

// Generate receipt text for download
const generateReceiptText = (result, merchantName) => {
  const date = new Date().toLocaleString('de-DE');
  return `
═══════════════════════════════════
        BIDBLITZ AUFLADUNG
═══════════════════════════════════
Händler: ${merchantName}
Datum: ${date}

───────────────────────────────────
Kunde: ${result.customer_name || 'Kunde'}
Kundennummer: ${result.customer_number}
───────────────────────────────────

Aufladebetrag:     €${result.amount.toFixed(2)}
Bonus:            +€${result.bonus.toFixed(2)}
                  ─────────────────
GUTSCHRIFT:       €${result.total_credited.toFixed(2)}

───────────────────────────────────
Neues Guthaben:   €${result.new_balance.toFixed(2)}
───────────────────────────────────

Händler-Provision: €${result.merchant_commission.toFixed(2)}
                   (${result.merchant_commission_rate || 0}%)

═══════════════════════════════════
       Vielen Dank!
       www.bidblitz.ae
═══════════════════════════════════
Transaktion: ${result.topup_id}
`;
};

// Sound effects
const playSound = (type) => {
  const sounds = {
    success: '/sounds/success.mp3',
    pending: '/sounds/pending.mp3',
    error: '/sounds/error.mp3',
    keypress: '/sounds/keypress.mp3'
  };
  try {
    const audio = new Audio(sounds[type]);
    audio.volume = type === 'keypress' ? 0.1 : 0.5;
    audio.play().catch(() => {});
  } catch (e) {}
};

// Numpad component
const Numpad = ({ onInput, onClear, onBackspace, onSubmit, disabled }) => {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];
  
  const handleKey = (key) => {
    if (disabled) return;
    if (key === '⌫') {
      onBackspace();
    } else {
      onInput(key);
    }
  };

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {keys.map((key) => (
        <button
          key={key}
          onClick={() => handleKey(key)}
          disabled={disabled}
          className={`h-16 sm:h-20 lg:h-24 text-2xl sm:text-3xl lg:text-4xl font-bold rounded-xl transition-all active:scale-95 ${
            key === '⌫' 
              ? 'bg-red-100 text-red-600 hover:bg-red-200' 
              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {key === '⌫' ? <Delete className="w-6 h-6 sm:w-8 sm:h-8 mx-auto" /> : key}
        </button>
      ))}
      <button
        onClick={onClear}
        disabled={disabled}
        className="h-16 sm:h-20 lg:h-24 text-lg sm:text-xl font-bold rounded-xl bg-gray-200 text-gray-600 hover:bg-gray-300 transition-all active:scale-95"
      >
        C
      </button>
      <button
        onClick={onSubmit}
        disabled={disabled}
        className={`col-span-2 h-16 sm:h-20 lg:h-24 text-xl sm:text-2xl font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${
          disabled 
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
            : 'bg-orange-500 text-white hover:bg-orange-600'
        }`}
      >
        <QrCode className="w-6 h-6 sm:w-8 sm:h-8" />
        QR-Code
      </button>
    </div>
  );
};

export default function POSKiosk() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('pos_api_key') || '');
  const [merchantName, setMerchantName] = useState('');
  const [merchantVolume, setMerchantVolume] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Mode: 'payment' or 'topup'
  const [mode, setMode] = useState('payment');
  
  // Payment state
  const [amount, setAmount] = useState('0.00');
  const [currentPayment, setCurrentPayment] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  
  // Top-up state
  const [customerNumber, setCustomerNumber] = useState('');
  const [topupResult, setTopupResult] = useState(null);
  const [bonusTiers] = useState([
    { min: 200, bonus: 12.00, label: '€200+ → +€12' },
    { min: 100, bonus: 5.00, label: '€100+ → +€5' },
    { min: 50, bonus: 2.00, label: '€50+ → +€2' },
    { min: 20, bonus: 0.50, label: '€20+ → +€0,50' }
  ]);
  
  // Commission tiers (automatic based on volume)
  const getCommissionRate = (volume) => {
    if (volume >= 10000) return 2.0;
    if (volume >= 5000) return 1.5;
    if (volume >= 2000) return 1.0;
    if (volume >= 500) return 0.5;
    return 0;
  };
  
  // Calculate bonus preview
  const calculateBonus = (amt) => {
    const num = parseFloat(amt) || 0;
    for (const tier of bonusTiers) {
      if (num >= tier.min) return tier.bonus;
    }
    return 0;
  };
  
  // Settings
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [recentPayments, setRecentPayments] = useState([]);
  const [todayStats, setTodayStats] = useState({ total: 0, count: 0 });

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Handle numpad input
  const handleNumpadInput = (key) => {
    if (soundEnabled) playSound('keypress');
    
    setAmount(prev => {
      // Remove leading zeros
      let value = prev.replace(/^0+(?=\d)/, '');
      
      // Handle decimal
      if (key === '.') {
        if (value.includes('.')) return value;
        return value + '.';
      }
      
      // Max 2 decimal places
      const parts = value.split('.');
      if (parts[1] && parts[1].length >= 2) return value;
      
      // Max amount 9999.99
      const newValue = value + key;
      if (parseFloat(newValue) > 9999.99) return value;
      
      return newValue;
    });
  };

  const handleBackspace = () => {
    setAmount(prev => {
      if (prev.length <= 1) return '0';
      return prev.slice(0, -1);
    });
  };

  const handleClear = () => {
    setAmount('0.00');
  };

  // Connect with API key
  const connect = async () => {
    if (!apiKey.trim()) {
      toast.error('Bitte API-Key eingeben');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/digital/balance`, {
        headers: { 'X-API-Key': apiKey }
      });
      
      if (res.ok) {
        const data = await res.json();
        setMerchantName(data.api_key_name || 'Händler');
        setIsConnected(true);
        localStorage.setItem('pos_api_key', apiKey);
        toast.success(`Verbunden als ${data.api_key_name}`);
        fetchRecentPayments();
      } else {
        toast.error('Ungültiger API-Key');
      }
    } catch (err) {
      toast.error('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  };

  // Disconnect
  const disconnect = () => {
    setIsConnected(false);
    setCurrentPayment(null);
    setPaymentStatus(null);
    localStorage.removeItem('pos_api_key');
  };

  // Create payment
  const createPayment = async () => {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      toast.error('Bitte gültigen Betrag eingeben');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/digital/payments/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          amount: amountNum,
          reference: `POS-${Date.now()}`,
          description: `Zahlung bei ${merchantName}`,
          expires_in_minutes: 5
        })
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentPayment({ ...data, amount: amountNum });
        setPaymentStatus('pending');
        if (soundEnabled) playSound('pending');
      } else {
        toast.error('Fehler');
      }
    } catch (err) {
      toast.error('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  };

  // Process card top-up
  const processTopup = async () => {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum < 5 || amountNum > 500) {
      toast.error('Betrag muss zwischen €5 und €500 liegen');
      return;
    }
    if (!customerNumber.trim()) {
      toast.error('Bitte Kundennummer eingeben');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/digital/topup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          amount: amountNum,
          customer_number: customerNumber.toUpperCase()
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        setTopupResult(data);
        setAmount('0.00');
        setCustomerNumber('');
        // Update merchant volume
        if (data.merchant_volume) {
          setMerchantVolume(data.merchant_volume);
        }
        if (soundEnabled) playSound('success');
        toast.success(`${data.customer_name || 'Kunde'} hat €${data.total_credited.toFixed(2)} erhalten!`);
        fetchRecentPayments();
      } else {
        toast.error(data.detail || 'Aufladung fehlgeschlagen');
        if (soundEnabled) playSound('error');
      }
    } catch (err) {
      toast.error('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  };

  // Check payment status
  const checkPaymentStatus = useCallback(async () => {
    if (!currentPayment?.payment_id || !isConnected) return;

    try {
      const res = await fetch(`${API_URL}/api/digital/payments/${currentPayment.payment_id}`, {
        headers: { 'X-API-Key': apiKey }
      });

      if (res.ok) {
        const data = await res.json();
        const newStatus = data.status;
        
        if (newStatus !== paymentStatus) {
          setPaymentStatus(newStatus);
          
          if (newStatus === 'completed') {
            if (soundEnabled) playSound('success');
            toast.success('Zahlung erfolgreich!');
            fetchRecentPayments();
            // Auto-reset after 5 seconds
            setTimeout(() => {
              newPayment();
            }, 5000);
          } else if (newStatus === 'expired' || newStatus === 'failed') {
            if (soundEnabled) playSound('error');
          }
        }
      }
    } catch (err) {}
  }, [currentPayment, apiKey, paymentStatus, soundEnabled, isConnected]);

  // Auto-refresh payment status
  useEffect(() => {
    if (!currentPayment || paymentStatus !== 'pending') return;
    const interval = setInterval(checkPaymentStatus, 2000);
    return () => clearInterval(interval);
  }, [currentPayment, paymentStatus, checkPaymentStatus]);

  // Fetch recent payments
  const fetchRecentPayments = async () => {
    try {
      const res = await fetch(`${API_URL}/api/digital/payments?limit=20`, {
        headers: { 'X-API-Key': apiKey }
      });
      if (res.ok) {
        const data = await res.json();
        const payments = data.payments || [];
        setRecentPayments(payments);
        
        // Calculate today's stats
        const today = new Date().toDateString();
        const todayPayments = payments.filter(p => 
          p.status === 'completed' && 
          new Date(p.created_at).toDateString() === today
        );
        setTodayStats({
          total: todayPayments.reduce((sum, p) => sum + (p.amount || 0), 0),
          count: todayPayments.length
        });
      }
    } catch (err) {}
  };

  // Reset for new payment
  const newPayment = () => {
    setCurrentPayment(null);
    setPaymentStatus(null);
    setAmount('0.00');
  };

  // Auto-connect on load
  useEffect(() => {
    if (apiKey) connect();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isConnected || currentPayment) return;
      
      if (e.key >= '0' && e.key <= '9') {
        handleNumpadInput(e.key);
      } else if (e.key === '.') {
        handleNumpadInput('.');
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Enter') {
        createPayment();
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isConnected, currentPayment, amount]);

  const checkoutUrl = currentPayment 
    ? `${FRONTEND_URL}/checkout/${currentPayment.payment_id}`
    : '';

  // Login Screen (Kiosk Style)
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 sm:p-12 max-w-lg w-full">
          <div className="text-center mb-8">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Store className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">BidBlitz Kasse</h1>
            <p className="text-gray-500 mt-2 text-lg">QR-Code Zahlungsterminal</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">API-Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="bbz_xxxxxxxxxxxxxxxx"
                className="w-full px-5 py-4 border-2 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono text-lg"
                onKeyDown={(e) => e.key === 'Enter' && connect()}
              />
            </div>

            <button
              onClick={connect}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-bold text-xl hover:from-orange-600 hover:to-orange-700 transition-all flex items-center justify-center gap-3 shadow-lg"
            >
              {loading ? (
                <RefreshCw className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <Wifi className="w-6 h-6" />
                  Verbinden
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main Kiosk Screen
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Minimal Header */}
      <div className="bg-gray-800/50 backdrop-blur px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold text-sm">{merchantName}</p>
            <p className="text-xs text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
              Online
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {/* Today's Stats */}
          <div className="hidden sm:flex items-center gap-4 mr-4 text-sm">
            <div className="text-center">
              <p className="text-gray-400 text-xs">Heute</p>
              <p className="font-bold text-green-400">€{todayStats.total.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-400 text-xs">Verkäufe</p>
              <p className="font-bold">{todayStats.count}</p>
            </div>
          </div>
          
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 hover:bg-gray-700 rounded-lg">
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5 text-gray-500" />}
          </button>
          <button onClick={() => setShowHistory(!showHistory)} className="p-2 hover:bg-gray-700 rounded-lg">
            <History className="w-5 h-5" />
          </button>
          <button onClick={toggleFullscreen} className="p-2 hover:bg-gray-700 rounded-lg">
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
          <button onClick={disconnect} className="p-2 hover:bg-gray-700 rounded-lg text-red-400">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        {/* Payment Entry Mode */}
        {!currentPayment && (
          <div className="w-full max-w-md">
            {/* Amount Display */}
            <div className="bg-gray-800 rounded-2xl p-6 mb-4 text-center">
              <p className="text-gray-400 text-sm mb-2">Betrag</p>
              <div className="flex items-center justify-center">
                <span className="text-4xl sm:text-5xl lg:text-6xl text-gray-500 mr-2">€</span>
                <span className="text-5xl sm:text-6xl lg:text-7xl font-bold tabular-nums">
                  {amount}
                </span>
              </div>
            </div>

            {/* Numpad */}
            <Numpad
              onInput={handleNumpadInput}
              onClear={handleClear}
              onBackspace={handleBackspace}
              onSubmit={createPayment}
              disabled={loading || parseFloat(amount) <= 0}
            />
          </div>
        )}

        {/* QR Code Display Mode */}
        {currentPayment && (
          <div className="w-full max-w-lg text-center">
            {/* Status */}
            <div className={`mb-6 ${
              paymentStatus === 'completed' ? 'text-green-400' :
              paymentStatus === 'pending' ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {paymentStatus === 'completed' && (
                <div className="flex flex-col items-center">
                  <div className="w-24 h-24 sm:w-32 sm:h-32 bg-green-500 rounded-full flex items-center justify-center mb-4 animate-bounce">
                    <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 text-white" />
                  </div>
                  <p className="text-3xl sm:text-4xl font-bold">Bezahlt!</p>
                </div>
              )}
              {paymentStatus === 'pending' && (
                <>
                  <Clock className="w-8 h-8 mx-auto mb-2 animate-pulse" />
                  <p className="text-xl font-semibold">Warte auf Zahlung...</p>
                </>
              )}
              {(paymentStatus === 'expired' || paymentStatus === 'failed') && (
                <>
                  <XCircle className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-xl font-semibold">Abgelaufen</p>
                </>
              )}
            </div>

            {/* Amount */}
            <p className="text-6xl sm:text-7xl lg:text-8xl font-bold mb-6">
              €{currentPayment.amount?.toFixed(2)}
            </p>

            {/* QR Code */}
            {paymentStatus === 'pending' && (
              <div className="bg-white rounded-3xl p-6 sm:p-8 inline-block mb-6 shadow-2xl">
                <QRCodeSVG
                  value={checkoutUrl}
                  size={280}
                  level="H"
                  includeMargin={true}
                  className="w-full h-auto max-w-[280px] sm:max-w-[320px]"
                />
                <p className="text-gray-800 text-center mt-4 font-medium">
                  Mit BidBlitz App scannen
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={newPayment}
                className="px-8 py-4 bg-orange-500 hover:bg-orange-600 rounded-xl font-bold text-xl flex items-center gap-2 transition-all"
              >
                <Plus className="w-6 h-6" />
                Neue Zahlung
              </button>
              {paymentStatus === 'pending' && (
                <button
                  onClick={checkPaymentStatus}
                  className="px-6 py-4 bg-gray-700 hover:bg-gray-600 rounded-xl"
                >
                  <RefreshCw className="w-6 h-6" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* History Sidebar */}
      {showHistory && (
        <div className="fixed inset-y-0 right-0 w-80 sm:w-96 bg-gray-800 shadow-2xl z-50 flex flex-col">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h3 className="font-bold text-lg">Transaktionen</h3>
            <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-gray-700 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {recentPayments.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Keine Transaktionen</p>
            ) : (
              recentPayments.map((payment, idx) => (
                <div 
                  key={idx}
                  className={`p-3 rounded-xl ${
                    payment.status === 'completed' ? 'bg-green-900/30' :
                    payment.status === 'pending' ? 'bg-yellow-900/30' :
                    'bg-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold">€{payment.amount?.toFixed(2)}</p>
                      <p className="text-xs text-gray-400">{payment.reference}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs ${
                        payment.status === 'completed' ? 'text-green-400' :
                        payment.status === 'pending' ? 'text-yellow-400' :
                        'text-gray-400'
                      }`}>
                        {payment.status === 'completed' ? '✓ Bezahlt' :
                         payment.status === 'pending' ? '⏳ Offen' : '✗ Abgelaufen'}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(payment.created_at).toLocaleTimeString('de-DE', {
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Stats Footer */}
          <div className="p-4 border-t border-gray-700 grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-gray-400 text-sm">Heute</p>
              <p className="text-2xl font-bold text-green-400">€{todayStats.total.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-400 text-sm">Verkäufe</p>
              <p className="text-2xl font-bold">{todayStats.count}</p>
            </div>
          </div>
        </div>
      )}

      {/* Status indicator */}
      {currentPayment && paymentStatus === 'pending' && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-yellow-500/20 backdrop-blur px-6 py-3 rounded-full flex items-center gap-3">
          <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
          <span className="text-yellow-400 font-medium">Warte auf Bestätigung...</span>
        </div>
      )}
    </div>
  );
}
