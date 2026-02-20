/**
 * POS Terminal - Point of Sale Terminal for Digital Payments
 * Merchants can create payments and display QR codes for customers to scan
 */
import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Store, QrCode, Euro, RefreshCw, CheckCircle, Clock, XCircle,
  Plus, History, Volume2, VolumeX, Printer, Settings, LogOut,
  AlertTriangle, Wifi, WifiOff
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const FRONTEND_URL = window.location.origin;

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

export default function POSTerminal() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('pos_api_key') || '');
  const [merchantName, setMerchantName] = useState('');
  const [merchantCommission, setMerchantCommission] = useState(2.0);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Mode: 'payment' or 'topup'
  const [mode, setMode] = useState('payment');
  
  // Payment state
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [currentPayment, setCurrentPayment] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  
  // Top-up state
  const [topupAmount, setTopupAmount] = useState('');
  const [customerNumber, setCustomerNumber] = useState('');
  const [topupResult, setTopupResult] = useState(null);
  const [bonusTiers] = useState([
    { min: 100, bonus: 5.00, label: '€100+ → +€5' },
    { min: 50, bonus: 2.00, label: '€50+ → +€2' },
    { min: 20, bonus: 0.50, label: '€20+ → +€0,50' }
  ]);
  
  // Settings
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [recentPayments, setRecentPayments] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

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
        setIsConnected(false);
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
    toast.success('Abgemeldet');
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
          reference: reference || `POS-${Date.now()}`,
          description: description || `Zahlung bei ${merchantName}`,
          expires_in_minutes: 5
        })
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentPayment(data);
        setPaymentStatus('pending');
        setAmount('');
        setReference('');
        setDescription('');
        if (soundEnabled) playSound('pending');
        toast.success('Zahlung erstellt - Warte auf Bestätigung');
      } else {
        toast.error('Fehler beim Erstellen der Zahlung');
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
          } else if (newStatus === 'expired' || newStatus === 'failed') {
            if (soundEnabled) playSound('error');
            toast.error('Zahlung abgelaufen/fehlgeschlagen');
          }
        }
      }
    } catch (err) {
      console.error('Status check failed:', err);
    }
  }, [currentPayment, apiKey, paymentStatus, soundEnabled, isConnected]);

  // Auto-refresh payment status
  useEffect(() => {
    if (!autoRefresh || !currentPayment || paymentStatus !== 'pending') return;
    
    const interval = setInterval(checkPaymentStatus, 2000);
    return () => clearInterval(interval);
  }, [autoRefresh, currentPayment, paymentStatus, checkPaymentStatus]);

  // Fetch recent payments
  const fetchRecentPayments = async () => {
    try {
      const res = await fetch(`${API_URL}/api/digital/payments?limit=10`, {
        headers: { 'X-API-Key': apiKey }
      });
      if (res.ok) {
        const data = await res.json();
        setRecentPayments(data.payments || []);
      }
    } catch (err) {}
  };

  // Reset for new payment
  const newPayment = () => {
    setCurrentPayment(null);
    setPaymentStatus(null);
  };

  // Auto-connect on load
  useEffect(() => {
    if (apiKey) {
      connect();
    }
  }, []);

  // Generate checkout URL
  const checkoutUrl = currentPayment 
    ? `${FRONTEND_URL}/checkout/${currentPayment.payment_id}`
    : '';

  // Login Screen
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Store className="w-8 h-8 text-orange-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">BidBlitz POS</h1>
            <p className="text-gray-500 mt-1">Kassensystem für digitale Zahlungen</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API-Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="bbz_xxxxxxxxxxxxxxxx"
                className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500 font-mono text-sm"
                onKeyDown={(e) => e.key === 'Enter' && connect()}
              />
            </div>

            <button
              onClick={connect}
              disabled={loading}
              className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Wifi className="w-5 h-5" />
                  Verbinden
                </>
              )}
            </button>

            <p className="text-xs text-gray-500 text-center">
              API-Key erhalten Sie im Admin-Panel unter "Digital API"
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main POS Screen
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Store className="w-6 h-6 text-orange-500" />
            <div>
              <p className="font-semibold">{merchantName}</p>
              <p className="text-xs text-green-400 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                Verbunden
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 hover:bg-gray-700 rounded-lg"
              title={soundEnabled ? 'Ton aus' : 'Ton ein'}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5 text-gray-500" />}
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 hover:bg-gray-700 rounded-lg"
              title="Verlauf"
            >
              <History className="w-5 h-5" />
            </button>
            <button
              onClick={disconnect}
              className="p-2 hover:bg-gray-700 rounded-lg text-red-400"
              title="Abmelden"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input & QR Code */}
        <div className="space-y-6">
          {/* New Payment Form */}
          {!currentPayment && (
            <div className="bg-gray-800 rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-orange-500" />
                Neue Zahlung
              </h2>

              <div className="space-y-4">
                {/* Amount - Large */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Betrag (EUR)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-gray-500">€</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-12 pr-4 py-4 bg-gray-900 border border-gray-700 rounded-xl text-3xl font-bold focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Reference */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Referenz (optional)</label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="z.B. Bestellnummer"
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Beschreibung (optional)</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="z.B. Einkauf"
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <button
                  onClick={createPayment}
                  disabled={loading || !amount}
                  className={`w-full py-4 rounded-xl font-semibold text-lg transition-colors flex items-center justify-center gap-2 ${
                    amount 
                      ? 'bg-orange-500 hover:bg-orange-600 text-white'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {loading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <QrCode className="w-5 h-5" />
                      QR-Code generieren
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* QR Code Display */}
          {currentPayment && (
            <div className="bg-gray-800 rounded-2xl p-6">
              {/* Status Header */}
              <div className={`flex items-center justify-center gap-2 mb-4 text-lg font-semibold ${
                paymentStatus === 'completed' ? 'text-green-400' :
                paymentStatus === 'pending' ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {paymentStatus === 'completed' && <CheckCircle className="w-6 h-6" />}
                {paymentStatus === 'pending' && <Clock className="w-6 h-6 animate-pulse" />}
                {(paymentStatus === 'expired' || paymentStatus === 'failed') && <XCircle className="w-6 h-6" />}
                {paymentStatus === 'completed' ? 'Zahlung erfolgreich!' :
                 paymentStatus === 'pending' ? 'Warte auf Scan...' :
                 'Zahlung abgelaufen'}
              </div>

              {/* Amount Display */}
              <div className="text-center mb-6">
                <p className="text-5xl font-bold">€{currentPayment.amount?.toFixed(2)}</p>
                {currentPayment.reference && (
                  <p className="text-gray-400 mt-2">{currentPayment.reference}</p>
                )}
              </div>

              {/* QR Code */}
              {paymentStatus === 'pending' && (
                <div className="bg-white rounded-2xl p-6 mx-auto max-w-xs">
                  <QRCodeSVG
                    value={checkoutUrl}
                    size={240}
                    level="H"
                    includeMargin={true}
                    className="w-full h-auto"
                  />
                  <p className="text-gray-800 text-center text-sm mt-2 font-medium">
                    Mit BidBlitz App scannen
                  </p>
                </div>
              )}

              {/* Success Animation */}
              {paymentStatus === 'completed' && (
                <div className="flex items-center justify-center py-12">
                  <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                    <CheckCircle className="w-12 h-12 text-white" />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={newPayment}
                  className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 rounded-xl font-semibold flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Neue Zahlung
                </button>
                {paymentStatus === 'pending' && (
                  <button
                    onClick={checkPaymentStatus}
                    className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl"
                    title="Status aktualisieren"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Recent Payments / History */}
        <div className="bg-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-orange-500" />
            Letzte Zahlungen
          </h2>

          {recentPayments.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Noch keine Zahlungen</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {recentPayments.map((payment, idx) => (
                <div 
                  key={idx}
                  className={`p-4 rounded-xl ${
                    payment.status === 'completed' ? 'bg-green-900/30 border border-green-800' :
                    payment.status === 'pending' ? 'bg-yellow-900/30 border border-yellow-800' :
                    'bg-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">€{payment.amount?.toFixed(2)}</p>
                      <p className="text-sm text-gray-400">{payment.reference}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                        payment.status === 'completed' ? 'text-green-400' :
                        payment.status === 'pending' ? 'text-yellow-400' :
                        'text-gray-400'
                      }`}>
                        {payment.status === 'completed' && <CheckCircle className="w-3 h-3" />}
                        {payment.status === 'pending' && <Clock className="w-3 h-3" />}
                        {payment.status === 'expired' && <XCircle className="w-3 h-3" />}
                        {payment.status === 'completed' ? 'Bezahlt' :
                         payment.status === 'pending' ? 'Offen' : 'Abgelaufen'}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(payment.created_at).toLocaleTimeString('de-DE', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="mt-4 pt-4 border-t border-gray-700 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-400">Heute</p>
              <p className="text-xl font-bold text-green-400">
                €{recentPayments
                  .filter(p => p.status === 'completed')
                  .reduce((sum, p) => sum + (p.amount || 0), 0)
                  .toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Transaktionen</p>
              <p className="text-xl font-bold">
                {recentPayments.filter(p => p.status === 'completed').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-refresh indicator */}
      {autoRefresh && currentPayment && paymentStatus === 'pending' && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-800 px-4 py-2 rounded-full text-sm flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          Auto-Aktualisierung aktiv
        </div>
      )}
    </div>
  );
}
