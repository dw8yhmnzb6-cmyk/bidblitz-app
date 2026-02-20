/**
 * BidBlitz Pay Wallet Card
 * Virtual payment card that can be added to mobile wallets
 */
import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  CreditCard, Wallet, Download, Share2, Smartphone, Apple,
  RefreshCw, Copy, Check, ChevronRight, Info, ExternalLink,
  Shield, Zap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Translations
const translations = {
  de: {
    title: 'Meine BidBlitz Karte',
    subtitle: 'Digitale Zahlungskarte',
    balance: 'Guthaben',
    cardNumber: 'Kartennummer',
    validThru: 'Gültig bis',
    cardHolder: 'Karteninhaber',
    addToWallet: 'Zur Wallet hinzufügen',
    appleWallet: 'Apple Wallet',
    googleWallet: 'Google Wallet',
    downloadCard: 'Karte herunterladen',
    shareCard: 'Karte teilen',
    addToHomescreen: 'Zum Startbildschirm',
    howToUse: 'So nutzen Sie Ihre Karte',
    step1: 'Zeigen Sie Ihre Karte oder QR-Code an der Kasse',
    step2: 'Der Händler scannt Ihren Code',
    step3: 'Zahlung erfolgt automatisch',
    securePayment: 'Sichere Zahlung',
    secureInfo: 'Ihre Karte ist durch Verschlüsselung geschützt',
    comingSoon: 'Bald verfügbar',
    addedToHomescreen: 'Zum Startbildschirm hinzugefügt!',
    instructions: 'Anleitung',
    iosInstructions: 'Safari: Teilen → Zum Home-Bildschirm',
    androidInstructions: 'Chrome: Menü → Zum Startbildschirm hinzufügen',
    copySuccess: 'Kartennummer kopiert!'
  },
  en: {
    title: 'My BidBlitz Card',
    subtitle: 'Digital Payment Card',
    balance: 'Balance',
    cardNumber: 'Card Number',
    validThru: 'Valid Thru',
    cardHolder: 'Card Holder',
    addToWallet: 'Add to Wallet',
    appleWallet: 'Apple Wallet',
    googleWallet: 'Google Wallet',
    downloadCard: 'Download Card',
    shareCard: 'Share Card',
    addToHomescreen: 'Add to Homescreen',
    howToUse: 'How to use your card',
    step1: 'Show your card or QR code at checkout',
    step2: 'Merchant scans your code',
    step3: 'Payment is processed automatically',
    securePayment: 'Secure Payment',
    secureInfo: 'Your card is protected by encryption',
    comingSoon: 'Coming soon',
    addedToHomescreen: 'Added to homescreen!',
    instructions: 'Instructions',
    iosInstructions: 'Safari: Share → Add to Home Screen',
    androidInstructions: 'Chrome: Menu → Add to Home Screen',
    copySuccess: 'Card number copied!'
  }
};

export default function WalletCard() {
  const { user, token } = useAuth();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showInstructions, setShowInstructions] = useState(false);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef(null);

  const language = localStorage.getItem('language') || 'de';
  const t = (key) => translations[language]?.[key] || translations.de[key] || key;

  // Generate card number from user ID
  const generateCardNumber = (userId) => {
    if (!userId) return '0000 0000 0000 0000';
    const hash = userId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const nums = hash.split('').map(c => c.charCodeAt(0) % 10).join('');
    const padded = (nums + '0000000000000000').slice(0, 16);
    return padded.match(/.{1,4}/g).join(' ');
  };

  // Generate expiry date (2 years from now)
  const getExpiryDate = () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 2);
    return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`;
  };

  const cardNumber = generateCardNumber(user?.id);
  const customerNumber = user?.customer_number || `BID-${user?.id?.slice(-6).toUpperCase() || '000000'}`;

  // Fetch balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_URL}/api/bidblitz-pay/wallet`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setBalance(data.wallet?.universal_balance || 0);
        }
      } catch (err) {
        console.error('Failed to fetch balance:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBalance();
  }, [token]);

  // Copy card number
  const copyCardNumber = () => {
    navigator.clipboard.writeText(cardNumber.replace(/\s/g, ''));
    setCopied(true);
    toast.success(t('copySuccess'));
    setTimeout(() => setCopied(false), 2000);
  };

  // Download card as image
  const downloadCard = async () => {
    if (!cardRef.current) return;
    
    try {
      // Use html2canvas if available, otherwise show instructions
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2
      });
      
      const link = document.createElement('a');
      link.download = `bidblitz-card-${customerNumber}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Karte heruntergeladen!');
    } catch (err) {
      // Fallback: Show instructions
      toast.info('Screenshot-Funktion: Halten Sie die Karte gedrückt');
    }
  };

  // Share card
  const shareCard = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Meine BidBlitz Pay Karte',
          text: `Kartennummer: ${cardNumber}\nKundennummer: ${customerNumber}`,
          url: window.location.href
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          toast.error('Teilen fehlgeschlagen');
        }
      }
    } else {
      copyCardNumber();
    }
  };

  // Add to homescreen prompt
  const addToHomescreen = () => {
    setShowInstructions(true);
  };

  // Detect device
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <CreditCard className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>Bitte anmelden</p>
          <a href="/login" className="mt-4 inline-block px-6 py-2 bg-orange-500 rounded-lg">
            Anmelden
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 pb-24">
      <div className="max-w-md mx-auto px-4 pt-6">
        {/* Header */}
        <div className="text-center mb-6 text-white">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-gray-400">{t('subtitle')}</p>
        </div>

        {/* Card */}
        <div 
          ref={cardRef}
          className="relative mb-6 transform hover:scale-[1.02] transition-transform"
        >
          {/* Card Background */}
          <div className="aspect-[1.586/1] bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 rounded-2xl p-5 shadow-2xl overflow-hidden relative">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2"></div>
            </div>

            {/* Card Content */}
            <div className="relative z-10 h-full flex flex-col justify-between text-white">
              {/* Top Row */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-orange-100 uppercase tracking-wider">BidBlitz Pay</p>
                  <p className="text-2xl font-bold mt-1">€{balance.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-6 h-6" />
                  <span className="text-sm font-bold">PREMIUM</span>
                </div>
              </div>

              {/* Chip & Contactless */}
              <div className="flex items-center gap-4 my-4">
                {/* Chip */}
                <div className="w-12 h-9 bg-gradient-to-br from-yellow-300 to-yellow-500 rounded-md relative overflow-hidden">
                  <div className="absolute inset-1 border border-yellow-600/30 rounded-sm"></div>
                  <div className="absolute top-1/2 left-0 right-0 h-px bg-yellow-600/30"></div>
                  <div className="absolute top-0 bottom-0 left-1/2 w-px bg-yellow-600/30"></div>
                </div>
                {/* Contactless */}
                <svg className="w-8 h-8 text-white/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8.5 14.5A6.5 6.5 0 0 1 15 8" strokeLinecap="round"/>
                  <path d="M5 18a11 11 0 0 1 14-14" strokeLinecap="round"/>
                  <path d="M2 21.5a16 16 0 0 1 19.5-19.5" strokeLinecap="round"/>
                </svg>
              </div>

              {/* Card Number */}
              <div>
                <p className="text-xl sm:text-2xl font-mono tracking-wider">{cardNumber}</p>
              </div>

              {/* Bottom Row */}
              <div className="flex items-end justify-between mt-2">
                <div>
                  <p className="text-[10px] text-orange-100 uppercase">{t('cardHolder')}</p>
                  <p className="font-semibold truncate max-w-[150px]">{user?.name || 'KARTENINHABER'}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-orange-100 uppercase">{t('validThru')}</p>
                  <p className="font-semibold">{getExpiryDate()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-orange-100 uppercase">CVV</p>
                  <p className="font-semibold">•••</p>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Number Badge */}
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-gray-800 px-4 py-1 rounded-full border border-gray-700">
            <p className="text-xs text-gray-400 font-mono">{customerNumber}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <button
            onClick={copyCardNumber}
            className="flex flex-col items-center gap-2 p-4 bg-gray-800 rounded-xl hover:bg-gray-700 transition-colors"
          >
            {copied ? <Check className="w-6 h-6 text-green-400" /> : <Copy className="w-6 h-6 text-gray-400" />}
            <span className="text-xs text-gray-400">Kopieren</span>
          </button>
          
          <button
            onClick={shareCard}
            className="flex flex-col items-center gap-2 p-4 bg-gray-800 rounded-xl hover:bg-gray-700 transition-colors"
          >
            <Share2 className="w-6 h-6 text-gray-400" />
            <span className="text-xs text-gray-400">Teilen</span>
          </button>
          
          <button
            onClick={downloadCard}
            className="flex flex-col items-center gap-2 p-4 bg-gray-800 rounded-xl hover:bg-gray-700 transition-colors"
          >
            <Download className="w-6 h-6 text-gray-400" />
            <span className="text-xs text-gray-400">Download</span>
          </button>
        </div>

        {/* Add to Wallet Buttons */}
        <div className="space-y-3 mb-6">
          {/* Apple Wallet */}
          <button
            onClick={() => toast.info(t('comingSoon'))}
            className="w-full flex items-center justify-between p-4 bg-black rounded-xl hover:bg-gray-900 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Apple className="w-6 h-6 text-white" />
              <div className="text-left">
                <p className="text-white font-medium">{t('appleWallet')}</p>
                <p className="text-gray-500 text-xs">{t('comingSoon')}</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </button>

          {/* Google Wallet */}
          <button
            onClick={() => toast.info(t('comingSoon'))}
            className="w-full flex items-center justify-between p-4 bg-gray-800 rounded-xl hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Wallet className="w-6 h-6 text-blue-400" />
              <div className="text-left">
                <p className="text-white font-medium">{t('googleWallet')}</p>
                <p className="text-gray-500 text-xs">{t('comingSoon')}</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </button>

          {/* Add to Homescreen */}
          <button
            onClick={addToHomescreen}
            className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl hover:from-orange-600 hover:to-orange-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Smartphone className="w-6 h-6 text-white" />
              <div className="text-left">
                <p className="text-white font-medium">{t('addToHomescreen')}</p>
                <p className="text-orange-200 text-xs">Schnellzugriff</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* QR Code Section */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <p className="text-gray-400 text-sm text-center mb-4">Zahlungs-QR für schnelles Bezahlen</p>
          <div className="bg-white rounded-xl p-4 mx-auto w-fit">
            <QRCodeSVG
              value={JSON.stringify({
                type: 'bidblitz_card',
                customer_number: customerNumber,
                card_number: cardNumber.replace(/\s/g, '')
              })}
              size={160}
              level="H"
              includeMargin={true}
            />
          </div>
          <a
            href="/mein-qr"
            className="mt-4 flex items-center justify-center gap-2 text-orange-400 hover:text-orange-300"
          >
            <span className="text-sm">Dynamischen QR öffnen</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* Security Info */}
        <div className="bg-gray-800/50 rounded-xl p-4 flex items-start gap-3">
          <Shield className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-white font-medium text-sm">{t('securePayment')}</p>
            <p className="text-gray-500 text-xs">{t('secureInfo')}</p>
          </div>
        </div>
      </div>

      {/* Instructions Modal */}
      {showInstructions && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-end justify-center z-50"
          onClick={() => setShowInstructions(false)}
        >
          <div 
            className="bg-gray-800 rounded-t-3xl p-6 w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-6"></div>
            <h3 className="text-xl font-bold text-white mb-4">{t('addToHomescreen')}</h3>
            
            <div className="space-y-4 mb-6">
              {isIOS && (
                <div className="flex items-start gap-3 p-4 bg-gray-700 rounded-xl">
                  <Apple className="w-6 h-6 text-white flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium">iPhone/iPad</p>
                    <p className="text-gray-400 text-sm">{t('iosInstructions')}</p>
                  </div>
                </div>
              )}
              
              {isAndroid && (
                <div className="flex items-start gap-3 p-4 bg-gray-700 rounded-xl">
                  <Smartphone className="w-6 h-6 text-green-400 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium">Android</p>
                    <p className="text-gray-400 text-sm">{t('androidInstructions')}</p>
                  </div>
                </div>
              )}
              
              {!isIOS && !isAndroid && (
                <>
                  <div className="flex items-start gap-3 p-4 bg-gray-700 rounded-xl">
                    <Apple className="w-6 h-6 text-white flex-shrink-0" />
                    <div>
                      <p className="text-white font-medium">iPhone/iPad</p>
                      <p className="text-gray-400 text-sm">{t('iosInstructions')}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-gray-700 rounded-xl">
                    <Smartphone className="w-6 h-6 text-green-400 flex-shrink-0" />
                    <div>
                      <p className="text-white font-medium">Android</p>
                      <p className="text-gray-400 text-sm">{t('androidInstructions')}</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setShowInstructions(false)}
              className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold"
            >
              Verstanden
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
