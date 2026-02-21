import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Wallet, QrCode, CreditCard, History, ChevronRight, 
  Store, RefreshCw, Euro, CheckCircle, AlertCircle,
  Smartphone, ArrowUpRight, ArrowDownLeft, Gift, Languages,
  Plus, Minus, X, Shield, Loader2, Camera, ScanLine, Banknote, Percent, Copy, Filter, Users, Bell, Trophy, Crown, Zap
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { SecuritySettings } from '../components/BiometricAuth';
import { Html5Qrcode } from 'html5-qrcode';
import CreditSystem from '../components/CreditSystem';
import CashbackSystem from '../components/CashbackSystem';
import PaymentHistory from '../components/PaymentHistory';
import DepositOffers from './DepositOffers';
import ReferralProgram from '../components/ReferralProgram';
import NotificationCenter from '../components/NotificationCenter';
import DailyLoginReward from '../components/DailyLoginReward';
import AchievementsPage from '../components/AchievementsPage';
import MonthlyLeaderboard from '../components/MonthlyLeaderboard';
import { walletTranslations } from '../i18n/walletTranslations';
import { useAuth } from '../context/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;

// Use centralized translations from external file
const translations = walletTranslations;

const languages = [
  { code: 'ar', name: 'العربية', flag: '🇦🇪' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'sq', name: 'Shqip', flag: '🇽🇰' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'el', name: 'Ελληνικά', flag: '🇬🇷' }
];

const BidBlitzPay = () => {
  const { user: authUser, refreshUser } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [view, setView] = useState('wallet'); // wallet, qr, history, topup, security, send, request
  // Use global language from localStorage
  const [language, setLanguage] = useState(() => localStorage.getItem('language') || 'de');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [mainBalance, setMainBalance] = useState(0);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [localUser, setLocalUser] = useState(null); // Local user for security settings
  const [hideBalance, setHideBalance] = useState(false); // Hide total balance on QR screen
  const [customerNumber, setCustomerNumber] = useState(null); // User's unique customer number
  
  // Direct Top Up states
  const [directTopUpAmount, setDirectTopUpAmount] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [topUpMode, setTopUpMode] = useState('direct'); // 'direct' or 'transfer'
  const [transferDirection, setTransferDirection] = useState('toMain'); // 'toWallet' or 'toMain'
  
  // P2P Transfer states
  const [recipientEmail, setRecipientEmail] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendMessage, setSendMessage] = useState('');
  const [sendingMoney, setSendingMoney] = useState(false);
  const [transfers, setTransfers] = useState([]);
  const [lastRecipient, setLastRecipient] = useState(null); // Letzte Überweisung speichern
  
  // Saved Recipients / Contacts
  const [savedRecipients, setSavedRecipients] = useState([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveNickname, setSaveNickname] = useState('');
  const [savingRecipient, setSavingRecipient] = useState(false);
  const [lastSuccessfulRecipient, setLastSuccessfulRecipient] = useState(null);
  
  // Load last recipient from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('bidblitz_last_recipient');
    if (saved) {
      try {
        setLastRecipient(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading last recipient:', e);
      }
    }
  }, []);
  
  // Request Money states
  const [requestAmount, setRequestAmount] = useState('');
  const [requestDescription, setRequestDescription] = useState('');
  const [requestQR, setRequestQR] = useState(null);
  const [creatingRequest, setCreatingRequest] = useState(false);
  const [myRequests, setMyRequests] = useState([]);
  
  // Scanner states
  const [scannerActive, setScannerActive] = useState(false);
  const [scannedRequest, setScannedRequest] = useState(null);
  const [payingRequest, setPayingRequest] = useState(false);
  const [manualRequestId, setManualRequestId] = useState('');
  const [loadingManualRequest, setLoadingManualRequest] = useState(false);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  const token = localStorage.getItem('token') || sessionStorage.getItem('token') || localStorage.getItem('bidblitz_token');
  
  const t = (key) => translations[language]?.[key] || translations.de[key] || key;
  const isRTL = language === 'ar';

  // Fetch user data for security settings
  useEffect(() => {
    const fetchLocalUser = async () => {
      if (!token) return;
      try {
        const response = await fetch(`${API}/api/user/profile`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setLocalUser(data);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };
    fetchLocalUser();
  }, [token]);

  const fetchWallet = useCallback(async () => {
    if (!token) return;
    
    try {
      const response = await fetch(`${API}/api/bidblitz-pay/wallet`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setWallet(data);
      }
    } catch (error) {
      console.error('Error fetching wallet:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchMainBalance = useCallback(async () => {
    if (!token) return;
    
    try {
      const response = await fetch(`${API}/api/bidblitz-pay/main-balance`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMainBalance(data.main_balance || 0);
      }
    } catch (error) {
      console.error('Error fetching main balance:', error);
    }
  }, [token]);

  const fetchCustomerNumber = useCallback(async () => {
    if (!token) return;
    
    try {
      const response = await fetch(`${API}/api/bidblitz-pay/my-customer-number`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCustomerNumber(data.customer_number);
      }
    } catch (error) {
      console.error('Error fetching customer number:', error);
    }
  }, [token]);

  // Fetch transactions - MUST be defined before other functions that use it
  const fetchTransactions = useCallback(async () => {
    if (!token) return;
    
    try {
      const response = await fetch(`${API}/api/bidblitz-pay/transactions?limit=20`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  }, [token]);

  const handleTopUp = async () => {
    const amount = parseFloat(topUpAmount);
    if (!amount || amount <= 0) {
      toast.error(t('enterAmount'));
      return;
    }
    
    if (amount > mainBalance) {
      toast.error(`${t('availableOnMain')}: €${mainBalance.toFixed(2)}`);
      return;
    }
    
    setTransferring(true);
    try {
      const response = await fetch(`${API}/api/bidblitz-pay/topup`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount })
      });
      
      if (response.ok) {
        const data = await response.json();
        toast.success(`${t('successTransfer')}: €${amount.toFixed(2)}`);
        setMainBalance(data.new_main_balance);
        setTopUpAmount('');
        setView('wallet');
        fetchWallet();
        fetchTransactions();
        // Refresh user balance in navbar
        if (refreshUser) {
          await refreshUser();
        }
      } else {
        const error = await response.json();
        toast.error(error.detail || t('transferFailed'));
      }
    } catch (error) {
      console.error('Error transferring:', error);
      toast.error(t('transferFailed'));
    } finally {
      setTransferring(false);
    }
  };

  // Transfer from BidBlitz Pay to Main Account
  const handleTransferToMain = async () => {
    const amount = parseFloat(topUpAmount);
    if (!amount || amount <= 0) {
      toast.error(t('enterAmount'));
      return;
    }
    
    const currentBidBlitzBalance = wallet?.wallet?.total_value || 0;
    if (amount > currentBidBlitzBalance) {
      toast.error(`${t('available')}: €${currentBidBlitzBalance.toFixed(2)}`);
      return;
    }
    
    setTransferring(true);
    try {
      const response = await fetch(`${API}/api/bidblitz-pay/transfer-to-main`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount })
      });
      
      if (response.ok) {
        const data = await response.json();
        toast.success(`€${amount.toFixed(2)} ${t('transferToMain')}!`);
        setMainBalance(data.new_main_balance);
        setTopUpAmount('');
        setView('wallet');
        fetchWallet();
        fetchTransactions();
        // Refresh user balance in navbar
        if (refreshUser) {
          await refreshUser();
        }
      } else {
        const error = await response.json();
        toast.error(error.detail || t('transferFailed'));
      }
    } catch (error) {
      console.error('Error transferring to main:', error);
      toast.error(t('transferFailed'));
    } finally {
      setTransferring(false);
    }
  };

  // Direct Top Up function (with card)
  const handleDirectTopUp = async () => {
    const amount = parseFloat(directTopUpAmount);
    if (isNaN(amount) || amount < 5) {
      toast.error(t('minAmount'));
      return;
    }
    if (amount > 500) {
      toast.error(t('maxAmount'));
      return;
    }
    
    setProcessingPayment(true);
    try {
      // Create Stripe Checkout session
      const response = await fetch(`${API}/api/stripe/create-topup-session?token=${token}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          package_id: 'custom',
          custom_amount: amount,
          origin_url: window.location.origin
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        // Redirect to Stripe Checkout
        window.location.href = data.checkout_url;
      } else {
        const error = await response.json();
        toast.error(error.detail || t('paymentCouldNotCreate'));
        setProcessingPayment(false);
      }
    } catch (error) {
      console.error('Stripe checkout error:', error);
      toast.error(t('paymentCouldNotCreate'));
      setProcessingPayment(false);
    }
  };

  // Poll payment status after returning from Stripe
  const pollPaymentStatus = useCallback(async (sessionId, attempts = 0) => {
    const maxAttempts = 10;
    const pollInterval = 2000; // 2 seconds

    if (attempts >= maxAttempts) {
      toast.error(t('paymentStatusError'));
      return;
    }

    try {
      const response = await fetch(`${API}/api/stripe/payment-status/${sessionId}?token=${token}`);
      if (!response.ok) {
        throw new Error('Failed to check payment status');
      }

      const data = await response.json();
      
      if (data.payment_status === 'paid' && data.wallet_credited) {
        toast.success(`${t('paymentSuccessful')}! ${t('paymentCredited')}`);
        fetchWallet();
        fetchTransactions();
        // Refresh user balance in navbar
        if (refreshUser) {
          await refreshUser();
        }
        // Clear URL params
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      } else if (data.status === 'expired') {
        toast.error(t('sessionExpired'));
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      // If payment is still pending, continue polling
      setTimeout(() => pollPaymentStatus(sessionId, attempts + 1), pollInterval);
    } catch (error) {
      console.error('Error checking payment status:', error);
      setTimeout(() => pollPaymentStatus(sessionId, attempts + 1), pollInterval);
    }
  }, [token, fetchWallet, fetchTransactions, refreshUser]);

  // Check for payment return from Stripe
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const sessionId = urlParams.get('session_id');

    if (paymentStatus === 'success' && sessionId) {
      toast.info(t('paymentChecking'));
      pollPaymentStatus(sessionId);
    } else if (paymentStatus === 'cancelled') {
      toast.info(t('paymentCancelled'));
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [pollPaymentStatus]);

  // P2P Transfer function
  const sendMoney = async (e) => {
    e.preventDefault();
    if (!recipientEmail || !sendAmount) {
      toast.error(t('fillAllFields'));
      return;
    }
    
    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('invalidAmount') || 'Ungültiger Betrag');
      return;
    }
    
    setSendingMoney(true);
    try {
      const response = await fetch(`${API}/api/bidblitz-pay/send-money`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipient_email: recipientEmail,
          amount: amount,
          message: sendMessage || null
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success(data.message || `€${amount.toFixed(2)} gesendet!`);
        
        // Speichere letzten Empfänger für Schnellüberweisung
        const recipientData = {
          email: recipientEmail,
          name: data.recipient_name || recipientEmail,
          lastAmount: amount,
          lastMessage: sendMessage || '',
          timestamp: new Date().toISOString()
        };
        localStorage.setItem('bidblitz_last_recipient', JSON.stringify(recipientData));
        setLastRecipient(recipientData);
        
        // Check if this recipient is already saved
        const isAlreadySaved = savedRecipients.some(
          r => r.recipient_email === recipientEmail || r.recipient_customer_number === recipientEmail
        );
        
        // If not saved, offer to save with nickname
        if (!isAlreadySaved) {
          setLastSuccessfulRecipient({
            email: recipientEmail,
            name: data.recipient_name || recipientEmail
          });
          setShowSaveDialog(true);
        }
        
        setRecipientEmail('');
        setSendAmount('');
        setSendMessage('');
        fetchWallet();
        fetchTransferHistory();
      } else {
        toast.error(data.detail || t('sendError'));
      }
    } catch (error) {
      console.error('Send money error:', error);
      toast.error(t('sendError'));
    } finally {
      setSendingMoney(false);
    }
  };

  // Schnellüberweisung - letzten Empfänger auswählen
  const useLastRecipient = () => {
    if (lastRecipient) {
      setRecipientEmail(lastRecipient.email);
      setSendMessage(lastRecipient.lastMessage || '');
      toast.success(t('recipientLoaded'));
    }
  };

  // Fetch transfer history
  const fetchTransferHistory = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API}/api/bidblitz-pay/transfer-history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTransfers(data.transfers || []);
      }
    } catch (error) {
      console.error('Transfer history error:', error);
    }
  }, [token]);

  // Fetch saved recipients
  const fetchSavedRecipients = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API}/api/bidblitz-pay/saved-recipients`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSavedRecipients(data.recipients || []);
      }
    } catch (error) {
      console.error('Saved recipients error:', error);
    }
  }, [token]);

  // Save a new recipient with nickname
  const saveRecipientWithNickname = async () => {
    if (!lastSuccessfulRecipient || !saveNickname.trim()) {
      toast.error(t('enterName'));
      return;
    }
    
    setSavingRecipient(true);
    try {
      const response = await fetch(`${API}/api/bidblitz-pay/saved-recipients`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipient_identifier: lastSuccessfulRecipient.email,
          nickname: saveNickname.trim()
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success(data.message || t('recipientSaved'));
        setShowSaveDialog(false);
        setSaveNickname('');
        setLastSuccessfulRecipient(null);
        fetchSavedRecipients();
      } else {
        toast.error(data.detail || t('errorSaving'));
      }
    } catch (error) {
      console.error('Save recipient error:', error);
      toast.error(t('errorSaving'));
    } finally {
      setSavingRecipient(false);
    }
  };

  // Delete a saved recipient
  const deleteSavedRecipient = async (recipientId) => {
    try {
      const response = await fetch(`${API}/api/bidblitz-pay/saved-recipients/${recipientId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        toast.success(t('recipientDeleted'));
        fetchSavedRecipients();
      }
    } catch (error) {
      console.error('Delete recipient error:', error);
    }
  };

  // Select a saved recipient
  const selectSavedRecipient = (recipient) => {
    setRecipientEmail(recipient.recipient_customer_number || recipient.recipient_email);
    toast.success(`${recipient.nickname} ${t('selected')}`);
  };

  // Request Money functions
  const createPaymentRequest = async (e) => {
    e.preventDefault();
    const amount = parseFloat(requestAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('enterValidAmount'));
      return;
    }
    
    setCreatingRequest(true);
    try {
      const response = await fetch(`${API}/api/bidblitz-pay/request-money`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: amount,
          description: requestDescription || null,
          expires_minutes: 60
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setRequestQR(data);
        fetchMyRequests();
        toast.success(t('requestCreated'));
      } else {
        toast.error(data.detail || t('errorLoadingRequest'));
      }
    } catch (error) {
      console.error('Request money error:', error);
      toast.error(t('errorLoadingRequest'));
    } finally {
      setCreatingRequest(false);
    }
  };

  const fetchMyRequests = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API}/api/bidblitz-pay/my-payment-requests`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMyRequests(data.requests || []);
      }
    } catch (error) {
      console.error('My requests error:', error);
    }
  }, [token]);

  // QR Scanner functions
  const startScanner = async () => {
    try {
      // Erst prüfen ob Kamera verfügbar ist
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error(t('cameraNotSupported') || 'Kamera wird von diesem Browser nicht unterstützt');
        return;
      }
      
      // Kamera-Berechtigung anfordern
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        // Stream sofort wieder stoppen (war nur für Berechtigung)
        stream.getTracks().forEach(track => track.stop());
      } catch (permErr) {
        console.error('Camera permission error:', permErr);
        if (permErr.name === 'NotAllowedError' || permErr.name === 'PermissionDeniedError') {
          toast.error(t('cameraAccessDenied') || 'Kamerazugriff verweigert. Bitte erlauben Sie den Kamerazugriff in Ihren Browsereinstellungen.');
        } else if (permErr.name === 'NotFoundError') {
          toast.error('Keine Kamera gefunden');
        } else {
          toast.error(t('cameraStartError') || 'Kamera konnte nicht gestartet werden');
        }
        return;
      }
      
      const html5QrCode = new Html5Qrcode("qr-reader");
      html5QrCodeRef.current = html5QrCode;
      
      // Versuche zuerst die Rückkamera
      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          async (decodedText) => {
            // Check if it's a payment request QR
            if (decodedText.startsWith("BIDBLITZ-REQ:")) {
              const requestId = decodedText.replace("BIDBLITZ-REQ:", "");
              await stopScanner();
              await fetchRequestDetails(requestId);
            } else {
              toast.error(t('invalidQRCode'));
            }
          },
          () => {}
        );
        
        setScannerActive(true);
      } catch (startErr) {
        console.error('Start scanner error, trying alternative camera:', startErr);
        
        // Fallback: Versuche Frontkamera
        try {
          await html5QrCode.start(
            { facingMode: "user" },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 }
            },
            async (decodedText) => {
              if (decodedText.startsWith("BIDBLITZ-REQ:")) {
                const requestId = decodedText.replace("BIDBLITZ-REQ:", "");
                await stopScanner();
                await fetchRequestDetails(requestId);
              } else {
                toast.error(t('invalidQRCode'));
              }
            },
            () => {}
          );
          setScannerActive(true);
        } catch (fallbackErr) {
          console.error('Fallback camera also failed:', fallbackErr);
          throw fallbackErr;
        }
      }
    } catch (err) {
      console.error('Scanner error:', err);
      if (err.name === 'NotAllowedError') {
        toast.error(t('cameraAccessDenied') || 'Kamerazugriff verweigert');
      } else {
        toast.error(t('cameraStartError') || 'Kamera konnte nicht gestartet werden. Bitte nutzen Sie die manuelle Eingabe.');
      }
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
      } catch (err) {
        console.error('Stop scanner error:', err);
      }
    }
    setScannerActive(false);
  };

  const fetchRequestDetails = async (requestId) => {
    try {
      const response = await fetch(`${API}/api/bidblitz-pay/request-money/${requestId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.status !== 'pending') {
          toast.error(t('requestNoLongerValid'));
          return;
        }
        setScannedRequest(data);
      } else {
        const errorData = await response.json();
        toast.error(errorData.detail || 'Anforderung nicht gefunden');
      }
    } catch (error) {
      console.error('Fetch request error:', error);
      toast.error(t('errorLoadingRequest'));
    }
  };

  const handleManualRequestLoad = async (e) => {
    e.preventDefault();
    if (!manualRequestId.trim()) return;
    
    setLoadingManualRequest(true);
    try {
      // Clean up the ID (remove BIDBLITZ-REQ: prefix if present)
      let requestId = manualRequestId.trim().toUpperCase();
      if (requestId.startsWith('BIDBLITZ-REQ:')) {
        requestId = requestId.replace('BIDBLITZ-REQ:', '');
      }
      
      await fetchRequestDetails(requestId);
      setManualRequestId('');
    } finally {
      setLoadingManualRequest(false);
    }
  };

  const payScannedRequest = async () => {
    if (!scannedRequest) return;
    
    setPayingRequest(true);
    try {
      const response = await fetch(`${API}/api/bidblitz-pay/pay-request/${scannedRequest.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success(data.message || `€${scannedRequest.amount.toFixed(2)} bezahlt!`);
        setScannedRequest(null);
        fetchWallet();
      } else {
        toast.error(data.detail || 'Zahlung fehlgeschlagen');
      }
    } catch (error) {
      console.error('Pay request error:', error);
      toast.error('Zahlung fehlgeschlagen');
    } finally {
      setPayingRequest(false);
    }
  };

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const generateQR = async () => {
    if (!token) {
      toast.error(t('pleaseLogin'));
      return;
    }
    
    try {
      const response = await fetch(`${API}/api/bidblitz-pay/payment-qr`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setQrCode(data);
        setShowQR(true);
        setView('qr');
      } else {
        toast.error(t('errorLoading'));
      }
    } catch (error) {
      console.error('Error generating QR:', error);
      toast.error(t('errorLoading'));
    }
  };

  useEffect(() => {
    fetchWallet();
    fetchTransactions();
    fetchMainBalance();
    fetchCustomerNumber();
    fetchSavedRecipients();
  }, [fetchWallet, fetchTransactions, fetchMainBalance, fetchCustomerNumber, fetchSavedRecipients]);

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  // Auto-refresh QR code every 4 minutes
  useEffect(() => {
    if (showQR) {
      const interval = setInterval(generateQR, 240000);
      return () => clearInterval(interval);
    }
  }, [showQR]);

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="text-center">
          <Wallet className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">BidBlitz Pay</h1>
          <p className="text-gray-600 mb-4">{t('pleaseLogin')}</p>
          <Button onClick={() => window.location.href = '/login'} className="bg-amber-500 hover:bg-amber-600">
            {t('login')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white pb-20" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-4 sm:p-6">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-6 h-6" />
              <h1 className="text-xl font-bold">BidBlitz Pay</h1>
            </div>
            <div className="flex items-center gap-2">
              {/* Language Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowLangMenu(!showLangMenu)}
                  className="flex items-center gap-1 text-white/80 hover:text-white p-1.5 rounded"
                >
                  <span>{languages.find(l => l.code === language)?.flag}</span>
                </button>
                
                {showLangMenu && (
                  <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg py-1 z-50 min-w-[130px]">
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code);
                          setShowLangMenu(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-amber-50 ${
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
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={fetchWallet}
                className="text-white hover:bg-white/20"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Balance Card */}
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
            <p className="text-white/80 text-sm mb-1">{t('availableBalance')}</p>
            <p className="text-3xl font-bold">
              €{(wallet?.wallet?.total_value || 0).toFixed(2)}
            </p>
            <div className="flex gap-4 mt-3 text-sm">
              <div>
                <p className="text-white/70">{t('partnerVouchers')}</p>
                <p className="font-semibold">€{(wallet?.wallet?.partner_vouchers_value || 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-white/70">{t('universal')}</p>
                <p className="font-semibold">€{(wallet?.wallet?.universal_balance || 0).toFixed(2)}</p>
              </div>
            </div>
            
            {/* Free Bids Balance - Gratisguthaben */}
            {authUser?.bids_balance > 0 && (
              <div className="mt-3 pt-3 border-t border-white/20">
                <div className="flex items-center gap-2 bg-gradient-to-r from-green-400/30 to-emerald-400/30 rounded-xl p-3">
                  <Zap className="w-5 h-5 text-yellow-300" />
                  <div>
                    <p className="text-white/70 text-xs">{t('freeBids')}</p>
                    <p className="font-bold text-lg text-yellow-300" data-testid="free-bids-balance">{authUser.bids_balance}</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Customer Number */}
            {customerNumber && (
              <div className="mt-4 pt-3 border-t border-white/20">
                <p className="text-white/70 text-xs mb-1">
                  {t('yourCustomerNumber')}
                </p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-lg font-bold tracking-wider">{customerNumber}</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(customerNumber);
                      toast.success(t('customerNumberCopied'));
                    }}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                    title={t('copyToClipboard')}
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-white/50 text-xs mt-1">
                  {t('forBankTransfers')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs - Mobile scrollable */}
      <div className="max-w-lg mx-auto px-4 -mt-4">
        <div className="bg-white rounded-xl shadow-lg p-1 flex gap-1 overflow-x-auto scrollbar-hide" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
          <button
            onClick={() => setView('wallet')}
            className={`flex-shrink-0 py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              view === 'wallet' ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Gift className="w-4 h-4 inline mr-1" />
            {t('vouchers')}
          </button>
          <button
            onClick={() => { setView('topup'); fetchMainBalance(); }}
            className={`flex-shrink-0 py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              view === 'topup' ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Plus className="w-4 h-4 inline mr-1" />
            {t('topUp')}
          </button>
          <button
            onClick={() => setView('bonus')}
            className={`flex-shrink-0 py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              view === 'bonus' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Gift className="w-4 h-4 inline mr-1" />
            {t('bonusOffers') || 'Bonus'}
          </button>
          <button
            onClick={() => setView('referral')}
            className={`flex-shrink-0 py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              view === 'referral' ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Users className="w-4 h-4 inline mr-1" />
            {t('referrals') || 'Einladen'}
          </button>
          <button
            onClick={() => setView('achievements')}
            className={`flex-shrink-0 py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              view === 'achievements' ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Trophy className="w-4 h-4 inline mr-1" />
            {t('achievements') || 'Abzeichen'}
          </button>
          <button
            onClick={() => setView('leaderboard')}
            className={`flex-shrink-0 py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              view === 'leaderboard' ? 'bg-gradient-to-r from-amber-500 to-red-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Crown className="w-4 h-4 inline mr-1" />
            {t('leaderboard') || 'Rangliste'}
          </button>
          <button
            onClick={() => { setView('send'); fetchTransferHistory(); }}
            className={`flex-shrink-0 py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              view === 'send' ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ArrowUpRight className="w-4 h-4 inline mr-1" />
            {t('send')}
          </button>
          <button
            onClick={() => setView('request')}
            className={`flex-shrink-0 py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              view === 'request' ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4 inline mr-1" />
            {t('request')}
          </button>
          <button
            onClick={() => { setView('qr'); generateQR(); }}
            className={`flex-shrink-0 py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              view === 'qr' ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <QrCode className="w-4 h-4 inline mr-1" />
            {t('pay')}
          </button>
          <button
            onClick={() => { setView('history'); fetchTransactions(); }}
            className={`flex-shrink-0 py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              view === 'history' ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <History className="w-4 h-4 inline mr-1" />
            {t('history')}
          </button>
          <button
            onClick={() => setView('security')}
            className={`flex-shrink-0 py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              view === 'security' ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Shield className="w-4 h-4 inline mr-1" />
            {t('security')}
          </button>
          <button
            onClick={() => setView('credit')}
            className={`flex-shrink-0 py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              view === 'credit' ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Banknote className="w-4 h-4 inline mr-1" />
            {t('credit')}
          </button>
          <button
            onClick={() => setView('cashback')}
            className={`flex-shrink-0 py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              view === 'cashback' ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Percent className="w-4 h-4 inline mr-1" />
            {t('cashback')}
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 mt-6">
        {/* Top Up View */}
        {view === 'topup' && (
          <div className="space-y-6">
            {/* Mode Toggle */}
            <div className="bg-white rounded-2xl shadow-lg p-2 flex gap-2">
              <button
                onClick={() => setTopUpMode('direct')}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all ${
                  topUpMode === 'direct' 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <CreditCard className="w-4 h-4 inline mr-2" />
                {t('directTopUp')}
              </button>
              <button
                onClick={() => setTopUpMode('transfer')}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all ${
                  topUpMode === 'transfer' 
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <RefreshCw className="w-4 h-4 inline mr-2" />
                {t('transfer')}
              </button>
            </div>

            {/* Direct Top Up Section */}
            {topUpMode === 'direct' && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-green-500" />
                  {t('directTopUp')}
                </h2>
                <p className="text-sm text-gray-500 mb-6">{t('directTopUpDesc')}</p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('enterAmount')}</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">€</span>
                      <input
                        type="number"
                        value={directTopUpAmount}
                        onChange={(e) => setDirectTopUpAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-10 pr-4 py-3 text-xl font-semibold border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        min="5"
                        max="500"
                        step="0.01"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {t('minMaxInfo')}
                    </p>
                  </div>
                  
                  {/* Quick amount buttons */}
                  <div className="flex gap-2">
                    {[10, 25, 50, 100].map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setDirectTopUpAmount(String(amount))}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                          parseFloat(directTopUpAmount) === amount
                            ? 'border-green-500 bg-green-50 text-green-600'
                            : 'border-green-300 text-green-600 hover:bg-green-50'
                        }`}
                      >
                        €{amount}
                      </button>
                    ))}
                  </div>
                  
                  <Button
                    onClick={handleDirectTopUp}
                    disabled={processingPayment || !directTopUpAmount || parseFloat(directTopUpAmount) < 5}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 py-4 text-lg disabled:opacity-50"
                  >
                    {processingPayment ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        {t('redirectingStripe')}
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5 mr-2" />
                        {t('payWithCard')} {directTopUpAmount && `€${parseFloat(directTopUpAmount).toFixed(2)}`}
                      </>
                    )}
                  </Button>
                  
                  <div className="flex items-center gap-3 justify-center text-xs text-gray-400">
                    <span>💳 Visa</span>
                    <span>💳 Mastercard</span>
                    <span>📱 Apple Pay</span>
                    <span>📱 Google Pay</span>
                  </div>
                  
                  <p className="text-center text-xs text-gray-400 mt-2">
                    {t('securePaymentStripe')}
                  </p>
                </div>
              </div>
            )}

            {/* Transfer Section - Both directions */}
            {topUpMode === 'transfer' && (
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-amber-500" />
                {t('transferBalance')}
              </h2>
              
              {/* Direction Toggle */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setTransferDirection('toWallet')}
                  className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all ${
                    transferDirection === 'toWallet'
                      ? 'bg-amber-500 text-white shadow-lg'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <ArrowDownLeft className="w-4 h-4 inline mr-2" />
                  {t('toBidBlitzPay')}
                </button>
                <button
                  onClick={() => setTransferDirection('toMain')}
                  className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all ${
                    transferDirection === 'toMain'
                      ? 'bg-green-500 text-white shadow-lg'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4 inline mr-2" />
                  {t('toMainAccount')}
                </button>
              </div>
              
              {/* Balance Display */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className={`rounded-xl p-4 ${transferDirection === 'toWallet' ? 'bg-amber-50 border-2 border-amber-300' : 'bg-gray-50'}`}>
                  <p className="text-xs text-gray-500 mb-1">{t('mainAccount')}</p>
                  <p className="text-xl font-bold text-gray-800">€{mainBalance.toFixed(2)}</p>
                  {transferDirection === 'toWallet' && <p className="text-xs text-amber-600 mt-1">↓ {t('fromHere')}</p>}
                </div>
                <div className={`rounded-xl p-4 ${transferDirection === 'toMain' ? 'bg-green-50 border-2 border-green-300' : 'bg-gray-50'}`}>
                  <p className="text-xs text-gray-500 mb-1">{t('bidblitzPay')}</p>
                  <p className="text-xl font-bold text-gray-800">€{(wallet?.wallet?.total_value || 0).toFixed(2)}</p>
                  {transferDirection === 'toMain' && <p className="text-xs text-green-600 mt-1">↓ {t('fromHere')}</p>}
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('enterAmount')}</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">€</span>
                    <input
                      type="number"
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-10 pr-4 py-3 text-xl font-semibold border rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      min="0"
                      step="0.01"
                      max={transferDirection === 'toWallet' ? mainBalance : (wallet?.wallet?.total_value || 0)}
                    />
                  </div>
                </div>
                
                {/* Quick amount buttons */}
                <div className="flex gap-2 flex-wrap">
                  {[5, 10, 20, 50].map((amount) => {
                    const maxAmount = transferDirection === 'toWallet' ? mainBalance : (wallet?.wallet?.total_value || 0);
                    return (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setTopUpAmount(String(amount))}
                        disabled={maxAmount < amount}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                          parseFloat(topUpAmount) === amount
                            ? transferDirection === 'toWallet' 
                              ? 'border-amber-500 bg-amber-50 text-amber-600' 
                              : 'border-green-500 bg-green-50 text-green-600'
                            : maxAmount >= amount 
                              ? transferDirection === 'toWallet'
                                ? 'border-amber-300 text-amber-600 hover:bg-amber-50'
                                : 'border-green-300 text-green-600 hover:bg-green-50'
                              : 'border-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        €{amount}
                      </button>
                    );
                  })}
                  
                  {/* Complete sum button */}
                  <button
                    type="button"
                    onClick={() => {
                      const maxAmount = transferDirection === 'toWallet' ? mainBalance : (wallet?.wallet?.total_value || 0);
                      setTopUpAmount(String(maxAmount));
                    }}
                    disabled={(transferDirection === 'toWallet' ? mainBalance : (wallet?.wallet?.total_value || 0)) <= 0}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                      (transferDirection === 'toWallet' ? mainBalance : (wallet?.wallet?.total_value || 0)) > 0
                        ? transferDirection === 'toWallet'
                          ? 'border-amber-500 bg-amber-100 text-amber-700 hover:bg-amber-200 font-bold'
                          : 'border-green-500 bg-green-100 text-green-700 hover:bg-green-200 font-bold'
                        : 'border-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {t('all')} (€{(transferDirection === 'toWallet' ? mainBalance : (wallet?.wallet?.total_value || 0)).toFixed(2)})
                  </button>
                </div>
                
                <Button
                  onClick={transferDirection === 'toWallet' ? handleTopUp : handleTransferToMain}
                  disabled={
                    transferring || 
                    !topUpAmount || 
                    parseFloat(topUpAmount) <= 0 || 
                    parseFloat(topUpAmount) > (transferDirection === 'toWallet' ? mainBalance : (wallet?.wallet?.total_value || 0))
                  }
                  className={`w-full py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                    transferDirection === 'toWallet'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
                      : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
                  }`}
                >
                {transferring ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {transferDirection === 'toWallet' ? (
                      <ArrowDownLeft className="w-5 h-5 mr-2" />
                    ) : (
                      <ArrowUpRight className="w-5 h-5 mr-2" />
                    )}
                    {transferDirection === 'toWallet' 
                      ? t('transferToBidBlitzPay')
                      : t('transferToMainAccount')
                    }
                  </>
                )}
                </Button>
                
                {(transferDirection === 'toWallet' ? mainBalance : (wallet?.wallet?.total_value || 0)) === 0 && (
                  <p className="text-center text-sm text-red-500 mt-2">
                    {transferDirection === 'toWallet'
                      ? t('noBalanceMain')
                      : t('noBalanceWallet')
                    }
                  </p>
                )}
              </div>
            </div>
            )}
          </div>
        )}

        {/* Send Money View */}
        {view === 'send' && (
          <div className="space-y-6">
            {/* Saved Recipients */}
            {savedRecipients.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-4">
                <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <Gift className="w-4 h-4 text-amber-500" />
                  {t('savedRecipients')}
                </h3>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {savedRecipients.map((recipient) => (
                    <button
                      key={recipient.id}
                      onClick={() => selectSavedRecipient(recipient)}
                      className="flex-shrink-0 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-3 hover:border-green-400 hover:shadow-md transition-all min-w-[140px]"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {recipient.nickname.charAt(0).toUpperCase()}
                        </div>
                        <p className="font-bold text-gray-800 text-sm truncate">{recipient.nickname}</p>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{recipient.recipient_customer_number || recipient.recipient_email}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Schnellüberweisung - Letzter Empfänger */}
            {lastRecipient && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl shadow-lg p-4 border border-amber-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center">
                      <RefreshCw className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-amber-600 font-medium">
                        {t('lastTransfer')}
                      </p>
                      <p className="font-bold text-gray-800">{lastRecipient.name || lastRecipient.email}</p>
                      <p className="text-xs text-gray-500">
                        {t('lastAmount')}: €{lastRecipient.lastAmount?.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={useLastRecipient}
                    className="bg-amber-500 hover:bg-amber-600 text-white text-sm px-4"
                    data-testid="use-last-recipient-btn"
                  >
                    {t('useRecipient')}
                  </Button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-amber-500" />
                {t('sendMoney')}
              </h2>
              
              <form onSubmit={sendMoney} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('recipientId')}
                  </label>
                  <Input
                    type="text"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder={t('recipientPlaceholder')}
                    className="w-full"
                    required
                    data-testid="recipient-email-input"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {t('recipientHint')}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('amount')}
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">€</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="1"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      className="pl-8"
                      placeholder="0.00"
                      required
                      data-testid="send-amount-input"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('message')}
                  </label>
                  <Input
                    type="text"
                    value={sendMessage}
                    onChange={(e) => setSendMessage(e.target.value)}
                    placeholder={t('messagePlaceholder')}
                    className="w-full"
                    data-testid="send-message-input"
                  />
                </div>
                
                <Button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                  disabled={sendingMoney || !recipientEmail || !sendAmount}
                  data-testid="send-money-btn"
                >
                  {sendingMoney ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('sending')}
                    </>
                  ) : (
                    <>
                      <ArrowUpRight className="w-4 h-4 mr-2" />
                      {t('sendNow')}
                    </>
                  )}
                </Button>
              </form>
            </div>
            
            {/* Transfer History */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <History className="w-5 h-5 text-gray-400" />
                {t('transferHistory')}
              </h3>
              
              {transfers.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {transfers.map((transfer) => (
                    <div
                      key={transfer.id}
                      className={`p-3 rounded-xl border ${
                        transfer.direction === 'sent' 
                          ? 'border-red-100 bg-red-50' 
                          : 'border-green-100 bg-green-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            transfer.direction === 'sent' ? 'bg-red-100' : 'bg-green-100'
                          }`}>
                            {transfer.direction === 'sent' ? (
                              <ArrowUpRight className="w-5 h-5 text-red-600" />
                            ) : (
                              <ArrowDownLeft className="w-5 h-5 text-green-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 text-sm">
                              {transfer.direction === 'sent' 
                                ? `→ ${transfer.recipient_name || transfer.recipient_email}`
                                : `← ${transfer.sender_name || 'Absender'}`
                              }
                            </p>
                            {transfer.message && (
                              <p className="text-xs text-gray-500">"{transfer.message}"</p>
                            )}
                            <p className="text-xs text-gray-400">
                              {new Date(transfer.created_at).toLocaleDateString(language, {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                        <span className={`font-bold ${
                          transfer.direction === 'sent' ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {transfer.direction === 'sent' ? '-' : '+'}€{transfer.amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-xl">
                  <ArrowUpRight className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">{t('noTransfers')}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Request Money View */}
        {view === 'request' && (
          <div className="space-y-6">
            {/* Scanned Request - Pay Modal */}
            {scannedRequest && (
              <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-green-500">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  {t('requestDetails')}
                </h2>
                
                <div className="space-y-4">
                  <div className="bg-green-50 rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-green-600">€{scannedRequest.amount?.toFixed(2)}</p>
                    {scannedRequest.description && (
                      <p className="text-sm text-gray-600 mt-1">{scannedRequest.description}</p>
                    )}
                    <p className="text-sm text-gray-500 mt-2">
                      {t('from')}: <span className="font-medium">{scannedRequest.requester_name}</span>
                    </p>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setScannedRequest(null)}
                      className="flex-1"
                    >
                      {t('cancel')}
                    </Button>
                    <Button
                      onClick={payScannedRequest}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                      disabled={payingRequest}
                    >
                      {payingRequest ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mr-2" />
                      )}
                      {t('confirmPayment')}
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Scanner Section */}
            {!scannedRequest && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <ScanLine className="w-5 h-5 text-blue-500" />
                  {t('scanToPay')}
                </h2>
                
                {scannerActive ? (
                  <div className="space-y-4">
                    <div 
                      id="qr-reader" 
                      ref={scannerRef}
                      className="w-full aspect-square max-w-xs mx-auto rounded-xl overflow-hidden bg-black"
                    />
                    <Button
                      onClick={stopScanner}
                      variant="outline"
                      className="w-full border-red-300 text-red-600 hover:bg-red-50"
                    >
                      <X className="w-4 h-4 mr-2" />
                      {t('stopScanner')}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-gray-100 rounded-xl p-6 text-center">
                      <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">{t('scanRequestQR')}</p>
                    </div>
                    <Button
                      onClick={startScanner}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      {t('startScanner')}
                    </Button>
                    
                    {/* Manual ID Entry */}
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-gray-500">
                          {t('or')}
                        </span>
                      </div>
                    </div>
                    
                    <form onSubmit={handleManualRequestLoad} className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('enterRequestIdManually')}
                        </label>
                        <Input
                          type="text"
                          value={manualRequestId}
                          onChange={(e) => setManualRequestId(e.target.value.toUpperCase())}
                          placeholder="z.B. 149F919F"
                          className="w-full text-center font-mono tracking-wider"
                          maxLength={12}
                        />
                      </div>
                      <Button
                        type="submit"
                        variant="outline"
                        className="w-full"
                        disabled={!manualRequestId.trim() || loadingManualRequest}
                      >
                        {loadingManualRequest ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4 mr-2" />
                        )}
                        {t('loadId')}
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            )}
            
            {/* Create Request Section */}
            {!scannedRequest && !scannerActive && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <ArrowDownLeft className="w-5 h-5 text-green-500" />
                  {t('requestMoney')}
                </h2>
                
                {requestQR ? (
                <div className="text-center space-y-4">
                  <div className="bg-gray-50 rounded-xl p-6">
                    <img 
                      src={requestQR.qr_code} 
                      alt="Payment Request QR" 
                      className="mx-auto w-48 h-48"
                    />
                  </div>
                  <div className="bg-amber-50 rounded-xl p-4">
                    <p className="text-2xl font-bold text-amber-600">€{requestQR.amount?.toFixed(2)}</p>
                    {requestQR.description && (
                      <p className="text-sm text-gray-600 mt-1">{requestQR.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      {t('shareQRToGetPaid')}
                    </p>
                    <p className="text-xs text-gray-400">
                      ID: {requestQR.request_id}
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setRequestQR(null);
                      setRequestAmount('');
                      setRequestDescription('');
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    {t('createRequest')}
                  </Button>
                </div>
              ) : (
                <form onSubmit={createPaymentRequest} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('requestAmount')}
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">€</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="1"
                        value={requestAmount}
                        onChange={(e) => setRequestAmount(e.target.value)}
                        className="pl-8"
                        placeholder="0.00"
                        required
                        data-testid="request-amount-input"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('requestDescription')}
                    </label>
                    <Input
                      type="text"
                      value={requestDescription}
                      onChange={(e) => setRequestDescription(e.target.value)}
                      placeholder={t('descriptionPlaceholder')}
                      className="w-full"
                      data-testid="request-description-input"
                    />
                  </div>
                  
                  <Button
                    type="submit"
                    className="w-full bg-green-500 hover:bg-green-600 text-white"
                    disabled={creatingRequest || !requestAmount}
                    data-testid="create-request-btn"
                  >
                    {creatingRequest ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t('creating')}
                      </>
                    ) : (
                      <>
                        <QrCode className="w-4 h-4 mr-2" />
                        {t('generateRequestQR')}
                      </>
                    )}
                  </Button>
                  
                  <p className="text-xs text-center text-gray-400">
                    {t('requestExpires')}
                  </p>
                </form>
              )}
            </div>
            )}
            
            {/* My Payment Requests */}
            {!scannedRequest && !scannerActive && (
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <History className="w-5 h-5 text-gray-400" />
                {t('myRequests')}
              </h3>
              
              {myRequests.length > 0 ? (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {myRequests.map((req) => (
                    <div
                      key={req.id}
                      className={`p-3 rounded-xl border ${
                        req.status === 'paid' 
                          ? 'border-green-100 bg-green-50' 
                          : req.status === 'expired'
                            ? 'border-gray-100 bg-gray-50'
                            : 'border-amber-100 bg-amber-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-800">€{req.amount?.toFixed(2)}</p>
                          {req.description && (
                            <p className="text-xs text-gray-500">{req.description}</p>
                          )}
                          <p className="text-xs text-gray-400">ID: {req.id}</p>
                        </div>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          req.status === 'paid' 
                            ? 'bg-green-100 text-green-600'
                            : req.status === 'expired'
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-amber-100 text-amber-600'
                        }`}>
                          {req.status === 'paid' ? t('paid') : req.status === 'expired' ? t('expired') : t('pending')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-xl">
                  <ArrowDownLeft className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">{t('noRequestsYet')}</p>
                </div>
              )}
            </div>
            )}
          </div>
        )}

        {/* Wallet View - Vouchers */}
        {view === 'wallet' && (
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : (
              <>
                {/* Partner-specific Vouchers */}
                {wallet?.partner_vouchers?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <Store className="w-4 h-4" />
                      {t('partnerVouchers')}
                    </h3>
                    <div className="space-y-3">
                      {wallet?.partner_vouchers?.map((voucher) => (
                        <div 
                          key={voucher.id}
                          className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                                <Store className="w-6 h-6 text-amber-600" />
                              </div>
                              <div>
                                <p className="font-semibold text-gray-800">{voucher.name}</p>
                                <p className="text-sm text-gray-500">{voucher.partner_name || 'Partner'}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-lg text-green-600">
                                €{(voucher.remaining_value || voucher.value).toFixed(2)}
                              </p>
                              {voucher.remaining_value < voucher.value && (
                                <p className="text-xs text-gray-400">{t('of')} €{voucher.value.toFixed(2)}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Universal Vouchers */}
                {wallet?.universal_vouchers?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      {t('universal')}
                    </h3>
                    <div className="space-y-3">
                      {wallet?.universal_vouchers?.map((voucher) => (
                        <div 
                          key={voucher.id}
                          className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-100"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                                <CreditCard className="w-6 h-6 text-purple-600" />
                              </div>
                              <div>
                                <p className="font-semibold text-gray-800">{voucher.name}</p>
                                <p className="text-sm text-purple-600">{t('redeemableAt')}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-lg text-purple-600">
                                €{(voucher.remaining_value || voucher.value).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {(!wallet?.vouchers || wallet.vouchers.length === 0) && (
                  <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <Gift className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">{t('noVouchers')}</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {t('winVouchers')}
                    </p>
                    <Button 
                      onClick={() => window.location.href = '/'}
                      className="mt-4 bg-amber-500 hover:bg-amber-600"
                    >
                      {t('toAuctions')}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* QR Code View - For Payment */}
        {view === 'qr' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-lg text-center">
              <div className="mb-4">
                <Smartphone className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <h2 className="text-lg font-bold text-gray-800">{t('showQR')}</h2>
                <p className="text-sm text-gray-500">{t('partnerScans')}</p>
              </div>

              {qrCode ? (
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-xl inline-block border-4 border-amber-200">
                    <img 
                      src={qrCode.qr_code} 
                      alt="Payment QR Code" 
                      className="w-48 h-48 mx-auto"
                    />
                  </div>
                  
                  {/* Toggle to hide balance */}
                  <div className="flex items-center justify-center gap-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={hideBalance}
                        onChange={() => setHideBalance(!hideBalance)}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                    <span className="text-sm text-gray-600">
                      {hideBalance ? (t('balanceHidden') || 'Guthaben ausgeblendet') : (t('hideBalance') || 'Guthaben ausblenden')}
                    </span>
                  </div>

                  {/* Show/Hide Balance */}
                  {!hideBalance && (
                    <div className="bg-amber-50 rounded-xl p-4">
                      <p className="text-xs text-amber-600 mb-2">{t('availableForPayment')}:</p>
                      <p className="text-2xl font-bold text-amber-700">
                        €{(qrCode.wallet_summary?.total_value || 0).toFixed(2)}
                      </p>
                    </div>
                  )}
                  
                  {hideBalance && (
                    <div className="bg-gray-100 rounded-xl p-4">
                      <p className="text-xs text-gray-500 mb-2">{t('availableForPayment')}:</p>
                      <p className="text-2xl font-bold text-gray-400">
                        €••••
                      </p>
                    </div>
                  )}

                  <p className="text-xs text-gray-400">
                    {t('qrValidFor')}
                  </p>

                  <Button 
                    onClick={generateQR}
                    variant="outline"
                    className="w-full"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {t('generateNew')}
                  </Button>
                </div>
              ) : (
                <div className="py-8">
                  <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Transaction History - Now using PaymentHistory component */}
        {view === 'history' && (
          <PaymentHistory token={token} language={language} />
        )}

        {/* Security Settings */}
        {view === 'security' && (
          <div className="bg-white rounded-2xl shadow-lg p-6" data-testid="security-view">
            {localUser ? (
              <SecuritySettings user={localUser} token={token} />
            ) : (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}

        {/* Credit System View */}
        {view === 'credit' && (
          <div className="bg-white rounded-2xl shadow-lg p-6" data-testid="credit-view">
            <CreditSystem 
              language={language} 
              walletBalance={wallet?.wallet?.universal_balance || 0}
              onBalanceUpdate={() => { fetchWallet(); fetchTransactions(); }}
            />
          </div>
        )}

        {/* Cashback System View */}
        {view === 'cashback' && (
          <div className="bg-white rounded-2xl shadow-lg p-6" data-testid="cashback-view">
            <CashbackSystem 
              language={language}
              onBalanceUpdate={() => { fetchWallet(); fetchTransactions(); }}
            />
          </div>
        )}

        {/* Bonus / Deposit Offers View */}
        {view === 'bonus' && (
          <div data-testid="bonus-offers-view">
            <DepositOffers onBalanceChange={fetchWallet} />
          </div>
        )}

        {/* Referral Program View */}
        {view === 'referral' && (
          <div data-testid="referral-program-view">
            <ReferralProgram 
              language={language}
              token={token}
              onBalanceUpdate={() => { fetchWallet(); fetchTransactions(); }}
            />
          </div>
        )}

        {/* Achievements View */}
        {view === 'achievements' && (
          <div data-testid="achievements-view">
            <AchievementsPage 
              language={language}
              token={token}
            />
          </div>
        )}

        {/* Leaderboard View */}
        {view === 'leaderboard' && (
          <div data-testid="leaderboard-view">
            <MonthlyLeaderboard 
              language={language}
              token={token}
            />
          </div>
        )}
      </div>

      {/* Save Recipient Dialog */}
      {showSaveDialog && lastSuccessfulRecipient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-800">
                {t('transferSuccessful')}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {t('saveFutureTransfers')}
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <p className="text-xs text-gray-500">
                {t('recipient')}
              </p>
              <p className="font-medium text-gray-800">{lastSuccessfulRecipient.name}</p>
              <p className="text-xs text-gray-400">{lastSuccessfulRecipient.email}</p>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('nameForQuickSelect')}
              </label>
              <Input
                type="text"
                value={saveNickname}
                onChange={(e) => setSaveNickname(e.target.value)}
                placeholder={t('exampleName')}
                className="w-full"
                autoFocus
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setShowSaveDialog(false);
                  setSaveNickname('');
                  setLastSuccessfulRecipient(null);
                }}
                variant="outline"
                className="flex-1"
              >
                {t('dontSave')}
              </Button>
              <Button
                onClick={saveRecipientWithNickname}
                disabled={!saveNickname.trim() || savingRecipient}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white"
              >
                {savingRecipient ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-1" />
                    {t('save')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BidBlitzPay;
