/**
 * My Payment QR Code - Personal QR code for customers to use at POS terminals
 * Customers show this code at checkout for fast payments
 */
import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  QrCode, RefreshCw, Shield, Clock, Wallet, Info,
  Download, Share2, Eye, EyeOff, ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Translations
const translations = {
  de: {
    title: 'Mein Zahlungs-QR',
    subtitle: 'Zeigen Sie diesen Code an der Kasse',
    balance: 'Verfügbares Guthaben',
    validFor: 'Gültig für',
    minutes: 'Minuten',
    refresh: 'Neu generieren',
    howItWorks: 'So funktioniert\'s',
    step1: 'Zeigen Sie diesen QR-Code an der Kasse',
    step2: 'Der Händler scannt Ihren Code',
    step3: 'Betrag wird von Ihrem Guthaben abgezogen',
    secure: 'Sichere Zahlung',
    secureInfo: 'Der QR-Code ist nur 5 Minuten gültig und kann nur einmal verwendet werden.',
    noBalance: 'Kein Guthaben vorhanden',
    topUp: 'Jetzt aufladen',
    login: 'Bitte anmelden',
    loginMsg: 'Sie müssen angemeldet sein, um Ihren Zahlungs-QR zu sehen.',
    showBalance: 'Guthaben anzeigen',
    hideBalance: 'Guthaben verbergen'
  },
  en: {
    title: 'My Payment QR',
    subtitle: 'Show this code at checkout',
    balance: 'Available Balance',
    validFor: 'Valid for',
    minutes: 'minutes',
    refresh: 'Regenerate',
    howItWorks: 'How it works',
    step1: 'Show this QR code at checkout',
    step2: 'Merchant scans your code',
    step3: 'Amount is deducted from your balance',
    secure: 'Secure Payment',
    secureInfo: 'The QR code is only valid for 5 minutes and can only be used once.',
    noBalance: 'No balance available',
    topUp: 'Top up now',
    login: 'Please log in',
    loginMsg: 'You need to be logged in to see your payment QR.',
    showBalance: 'Show balance',
    hideBalance: 'Hide balance'
  }
};

export default function MyPaymentQR() {
  const { user, token } = useAuth();
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState(0);
  const [showBalance, setShowBalance] = useState(true);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const [showInfo, setShowInfo] = useState(false);
  
  // Payment confirmation state
  const [paymentReceived, setPaymentReceived] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const language = localStorage.getItem('language') || 'de';
  const t = (key) => translations[language]?.[key] || translations.de[key] || key;
  
  // WebSocket connection for real-time payment notifications
  useEffect(() => {
    if (!user?.id) return;
    
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = API_URL.replace('https://', '').replace('http://', '');
    const wsUrl = `${wsProtocol}//${wsHost}/api/ws/payments/${user.id}`;
    
    let ws = null;
    let reconnectTimeout = null;
    
    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          console.log('✅ Payment WebSocket connected');
        };
        
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('📩 WebSocket message:', message);
            
            if (message.type === 'payment_received') {
              // Show payment confirmation!
              setPaymentReceived(message.data);
              setShowPaymentModal(true);
              
              // Update balance
              if (message.data.new_balance !== undefined) {
                setBalance(message.data.new_balance);
              }
              
              // Vibrate if supported
              if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100]);
              }
              
              // Auto-regenerate QR after payment
              setTimeout(() => {
                generateQR();
              }, 2000);
            }
          } catch (e) {
            console.error('WebSocket parse error:', e);
          }
        };
        
        ws.onclose = () => {
          console.log('WebSocket closed, reconnecting in 3s...');
          reconnectTimeout = setTimeout(connect, 3000);
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };
      } catch (e) {
        console.error('WebSocket connection error:', e);
      }
    };
    
    connect();
    
    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [user?.id]);

  // Generate payment QR token
  const generateQR = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/digital/customer/generate-qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        setQrData(data);
        setTimeLeft(300); // Reset timer
        toast.success('QR-Code generiert');
      } else {
        toast.error('Fehler beim Generieren');
      }
    } catch (err) {
      toast.error('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  };

  // Fetch balance
  const fetchBalance = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/bidblitz-pay/wallet`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBalance(data.wallet?.universal_balance || 0);
      }
    } catch (err) {}
  };

  // Initial load
  useEffect(() => {
    if (token) {
      generateQR();
      fetchBalance();
    }
  }, [token]);

  // Countdown timer
  useEffect(() => {
    if (!qrData || timeLeft <= 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Auto-regenerate when expired
          generateQR();
          return 300;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [qrData, timeLeft]);

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <QrCode className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('login')}</h1>
          <p className="text-gray-600 mb-6">{t('loginMsg')}</p>
          <a
            href="/login"
            className="inline-block px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600"
          >
            Anmelden
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white pb-20">
      <div className="max-w-md mx-auto px-4 pt-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-600">{t('subtitle')}</p>
        </div>

        {/* Balance Card */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-4 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">{t('balance')}</p>
              <p className="text-3xl font-bold">
                {showBalance ? `€${balance.toFixed(2)}` : '€•••••'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30"
              >
                {showBalance ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
              <Wallet className="w-8 h-8 text-orange-200" />
            </div>
          </div>
          {balance < 5 && (
            <a 
              href="/pay"
              className="mt-3 inline-block px-4 py-2 bg-white text-orange-600 rounded-lg text-sm font-medium hover:bg-orange-50"
            >
              {t('topUp')}
            </a>
          )}
        </div>

        {/* QR Code Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Timer */}
          <div className={`px-4 py-2 flex items-center justify-between ${
            timeLeft < 60 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-600'
          }`}>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4" />
              <span>{t('validFor')}</span>
            </div>
            <span className="font-mono font-bold text-lg">{formatTime(timeLeft)}</span>
          </div>

          {/* QR Code */}
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-12 h-12 text-orange-500 animate-spin" />
              </div>
            ) : qrData ? (
              <div className="flex flex-col items-center">
                <div className="bg-white p-4 rounded-2xl border-4 border-orange-100">
                  <QRCodeSVG
                    value={qrData.qr_data_compact || `BIDBLITZ:2.0:${qrData.payment_token}:${qrData.customer_number || ''}:${Math.floor(Date.now()/1000)+300}`}
                    size={220}
                    level="H"
                    includeMargin={true}
                    imageSettings={{
                      src: '/logo192.png',
                      height: 40,
                      width: 40,
                      excavate: true
                    }}
                  />
                </div>
                
                {/* Customer Number */}
                <div className="mt-4 text-center">
                  <p className="text-xs text-gray-500">Kundennummer</p>
                  <p className="font-mono font-bold text-lg text-gray-900">
                    {qrData.customer_number || user.customer_number || `BID-${user.id?.slice(-6).toUpperCase()}`}
                  </p>
                </div>

                {/* QR Format Info */}
                <p className="mt-2 text-xs text-gray-400 text-center">
                  Kompatibel mit allen Kassen-Scannern
                </p>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <QrCode className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>QR-Code wird generiert...</p>
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <div className="px-6 pb-6">
            <button
              onClick={generateQR}
              disabled={loading}
              className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </button>
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-6">
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="w-full flex items-center justify-between p-4 bg-white rounded-xl shadow-sm"
          >
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-orange-500" />
              <span className="font-medium">{t('howItWorks')}</span>
            </div>
            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showInfo ? 'rotate-180' : ''}`} />
          </button>
          
          {showInfo && (
            <div className="mt-2 bg-white rounded-xl shadow-sm p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 text-orange-600 font-bold">1</div>
                <p className="text-gray-600 text-sm pt-1">{t('step1')}</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 text-orange-600 font-bold">2</div>
                <p className="text-gray-600 text-sm pt-1">{t('step2')}</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 text-orange-600 font-bold">3</div>
                <p className="text-gray-600 text-sm pt-1">{t('step3')}</p>
              </div>
              
              <div className="mt-4 p-3 bg-green-50 rounded-lg flex items-start gap-2">
                <Shield className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-800 text-sm">{t('secure')}</p>
                  <p className="text-green-600 text-xs">{t('secureInfo')}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
