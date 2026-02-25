import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Wallet, QrCode, CreditCard, History, ChevronRight, 
  Store, RefreshCw, Euro, CheckCircle, AlertCircle,
  Smartphone, ArrowUpRight, ArrowDownLeft, Gift, Languages,
  Plus, Minus, X, Shield, Loader2, Camera, ScanLine, Banknote, Percent, Copy, Filter, Users, Bell, Trophy, Crown, Zap, Keyboard,
  Lock, PieChart, TrendingUp
} from 'lucide-react';
import Barcode from 'react-barcode';
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
import SpendingStats from '../components/SpendingStats';
import CardLock from '../components/CardLock';
import QuickTopUp from '../components/QuickTopUp';
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
  const [view, setView] = useState('topup'); // topup, qr, wallet, history, bonus, referral, etc.
  // Use global language from localStorage
  const [language, setLanguage] = useState(() => localStorage.getItem('language') || 'de');
  
  // Payment notification states
  const [paymentReceived, setPaymentReceived] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  // Add Contact Dialog states
  const [showAddContactDialog, setShowAddContactDialog] = useState(false);
  const [newContactId, setNewContactId] = useState('');
  const [newContactNickname, setNewContactNickname] = useState('');
  const [addingContact, setAddingContact] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
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
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(false);
  const [cameraPermissionAsked, setCameraPermissionAsked] = useState(false);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  // Kamera-Berechtigung beim Laden der Seite anfordern (einmalig)
  useEffect(() => {
    const requestCameraPermission = async () => {
      // Prüfen ob bereits erteilt
      const permissionStatus = localStorage.getItem('bidblitz_camera_permission');
      if (permissionStatus === 'granted') {
        setCameraPermissionGranted(true);
        return;
      }
      
      // Prüfen ob bereits gefragt wurde
      if (localStorage.getItem('bidblitz_camera_asked') === 'true') {
        setCameraPermissionAsked(true);
        return;
      }
      
      // Berechtigung anfordern
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
          const constraints = isIOS ? { video: true } : { video: { facingMode: "environment" } };
          
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          // Erfolg - Stream stoppen und Status speichern
          stream.getTracks().forEach(track => track.stop());
          localStorage.setItem('bidblitz_camera_permission', 'granted');
          setCameraPermissionGranted(true);
          setShowCameraHelp(false); // Hilfe-Box ausblenden wenn Berechtigung erteilt
          console.log('✅ Kamera-Berechtigung erteilt');
        } catch (err) {
          console.log('❌ Kamera-Berechtigung verweigert:', err.name);
          localStorage.setItem('bidblitz_camera_asked', 'true');
          setCameraPermissionAsked(true);
          
          if (err.name === 'NotAllowedError') {
            localStorage.setItem('bidblitz_camera_permission', 'denied');
          }
        }
      }
    };
    
    // Nur auf der Scan-View automatisch fragen
    if (view === 'scan' || view === 'wallet') {
      requestCameraPermission();
    }
  }, [view]);

  const token = localStorage.getItem('token') || sessionStorage.getItem('token') || localStorage.getItem('bidblitz_token');
  
  const t = (key) => translations[language]?.[key] || translations.de[key] || key;
  const isRTL = language === 'ar';

  // ==================== WEBSOCKET FOR PAYMENT NOTIFICATIONS ====================
  useEffect(() => {
    if (!authUser?.id) return;
    
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = API.replace('https://', '').replace('http://', '');
    const wsUrl = `${wsProtocol}//${wsHost}/api/ws/payments/${authUser.id}`;
    
    let ws = null;
    let reconnectTimeout = null;
    
    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          console.log('✅ BidBlitz Pay: WebSocket connected for payments');
        };
        
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('📩 Payment notification:', message);
            
            if (message.type === 'payment_received') {
              // Show payment confirmation modal
              setPaymentReceived(message.data);
              setShowPaymentModal(true);
              
              // Update wallet balance
              fetchWallet();
              fetchTransactions();
              
              // Vibrate if supported
              if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100]);
              }
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
  }, [authUser?.id]);

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
    setView('send');
    toast.success(`${recipient.nickname} ${t('selected')}`);
  };

  // Add new contact manually
  const addContactManually = async () => {
    if (!newContactId.trim() || !newContactNickname.trim()) {
      toast.error(t('fillAllFields'));
      return;
    }
    
    setAddingContact(true);
    try {
      const response = await fetch(`${API}/api/bidblitz-pay/saved-recipients`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipient_identifier: newContactId.trim(),
          nickname: newContactNickname.trim()
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success(t('contactSaved'));
        setShowAddContactDialog(false);
        setNewContactId('');
        setNewContactNickname('');
        fetchSavedRecipients();
      } else {
        toast.error(data.detail || t('errorSaving'));
      }
    } catch (error) {
      console.error('Add contact error:', error);
      toast.error(t('errorSaving'));
    } finally {
      setAddingContact(false);
    }
  };

  // Edit existing contact
  const updateContact = async () => {
    if (!editingContact || !editingContact.newNickname?.trim()) {
      toast.error(t('enterName'));
      return;
    }
    
    try {
      const response = await fetch(`${API}/api/bidblitz-pay/saved-recipients/${editingContact.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nickname: editingContact.newNickname.trim()
        })
      });
      
      if (response.ok) {
        toast.success(t('contactUpdated'));
        setEditingContact(null);
        fetchSavedRecipients();
      } else {
        const data = await response.json();
        toast.error(data.detail || t('errorUpdating'));
      }
    } catch (error) {
      console.error('Update contact error:', error);
      toast.error(t('errorUpdating'));
    }
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
  const [showCameraHelp, setShowCameraHelp] = useState(false);
  const fileInputRef = useRef(null);
  
  // Foto-basierter QR-Scanner für iOS
  const handlePhotoScan = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      toast.info(t('scanningQR'));
      
      const html5QrCode = new Html5Qrcode("qr-reader-hidden");
      
      const result = await html5QrCode.scanFile(file, true);
      
      console.log('📷 Foto-Scan Ergebnis:', result);
      
      if (result.startsWith("BIDBLITZ-REQ:")) {
        const requestId = result.replace("BIDBLITZ-REQ:", "");
        await fetchRequestDetails(requestId);
        toast.success(t('qrDetected'));
      } else {
        toast.error(t('invalidQR'));
      }
      
      // Cleanup
      html5QrCode.clear();
      
    } catch (err) {
      console.error('Foto-Scan Fehler:', err);
      toast.error(t('qrReadError'));
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const startScanner = async () => {
    try {
      // Prüfen ob wir auf iOS sind
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
      const isFirefox = /Firefox/.test(navigator.userAgent);
      
      console.log('📱 iOS:', isIOS, 'Safari:', isSafari, 'Firefox:', isFirefox);
      
      // Erst prüfen ob Kamera verfügbar ist
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error(t('cameraNotSupported') || 'Kamera wird von diesem Browser nicht unterstützt');
        setShowCameraHelp(true);
        return;
      }
      
      // Für iOS: Erst explizit Kamera-Berechtigung anfordern
      if (isIOS) {
        try {
          console.log('🔐 Fordere Kamera-Berechtigung an (iOS)...');
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
          });
          // Wichtig: Stream stoppen damit html5-qrcode es nutzen kann
          stream.getTracks().forEach(track => track.stop());
          console.log('✅ Kamera-Berechtigung erhalten');
          
          // Kurz warten damit iOS die Kamera freigibt
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (permErr) {
          console.error('❌ Kamera-Berechtigung verweigert:', permErr);
          setShowCameraHelp(true);
          setCameraPermissionGranted(false);
          localStorage.setItem('bidblitz_camera_permission', 'denied');
          
          if (permErr.name === 'NotAllowedError') {
            toast.error(t('cameraAccessDenied'), { duration: 8000 });
          } else {
            toast.error(t('cameraStartError'), { duration: 5000 });
          }
          return;
        }
      }
      
      const html5QrCode = new Html5Qrcode("qr-reader");
      html5QrCodeRef.current = html5QrCode;
      
      try {
        console.log('🎥 Starte QR-Scanner...');
        
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            experimentalFeatures: {
              useBarCodeDetectorIfSupported: true
            }
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
        
        // Erfolg - Berechtigung speichern
        localStorage.setItem('bidblitz_camera_permission', 'granted');
        setCameraPermissionGranted(true);
        setScannerActive(true);
        setShowCameraHelp(false);
        console.log('✅ Scanner erfolgreich gestartet');
        
      } catch (startErr) {
        console.error('❌ Scanner Start Fehler:', startErr);
        
        // Fallback: Versuche mit Frontkamera
        try {
          console.log('🔄 Versuche Frontkamera...');
          await html5QrCode.start(
            { facingMode: "user" },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1.0
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
          
          localStorage.setItem('bidblitz_camera_permission', 'granted');
          setCameraPermissionGranted(true);
          setScannerActive(true);
          setShowCameraHelp(false);
          toast.info('Frontkamera wird verwendet');
          
        } catch (fallbackErr) {
          console.error('❌ Auch Frontkamera fehlgeschlagen:', fallbackErr);
          setShowCameraHelp(true);
          setCameraPermissionGranted(false);
          
          // Zeige spezifische Meldung für iOS
          if (isIOS) {
            toast.error(t('cameraStartError'), { duration: 6000 });
          } else {
            const errorMsg = startErr.message || fallbackErr.message || '';
            toast.error(`${t('cameraStartError')} (${errorMsg})`, { duration: 5000 });
          }
        }
      }
      
    } catch (err) {
      console.error('Scanner error:', err);
      setShowCameraHelp(true);
      if (err.name === 'NotAllowedError') {
        toast.error(t('cameraAccessDenied') || 'Kamerazugriff verweigert');
        localStorage.setItem('bidblitz_camera_permission', 'denied');
      } else {
        toast.error(t('cameraStartError') || 'Kamera konnte nicht gestartet werden. Bitte nutzen Sie "Foto aufnehmen".');
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

  // Auto-refresh balance and transactions every 5 seconds for real-time updates
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      fetchWallet();
      fetchMainBalance();
      // Only refresh transactions if on history view to avoid unnecessary calls
      if (view === 'history') {
        fetchTransactions();
      }
    }, 5000); // 5 Sekunden

    return () => clearInterval(refreshInterval);
  }, [fetchWallet, fetchMainBalance, fetchTransactions, view]);

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
  
  // Auto-refresh when on QR view to keep balance updated
  useEffect(() => {
    if (view === 'qr') {
      // Refresh wallet balance every 3 seconds when showing QR code
      const balanceInterval = setInterval(() => {
        fetchWallet();
      }, 3000);
      return () => clearInterval(balanceInterval);
    }
  }, [view, fetchWallet]);

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
            onClick={() => { setView('topup'); fetchMainBalance(); }}
            className={`flex-shrink-0 py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              view === 'topup' ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Plus className="w-4 h-4 inline mr-1" />
            {t('topUp')}
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
            onClick={() => setView('wallet')}
            className={`flex-shrink-0 py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              view === 'wallet' ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Gift className="w-4 h-4 inline mr-1" />
            {t('vouchers')}
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
          <button
            onClick={() => setView('stats')}
            className={`flex-shrink-0 py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              view === 'stats' ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <PieChart className="w-4 h-4 inline mr-1" />
            {t('stats') || 'Statistik'}
          </button>
          <button
            onClick={() => setView('cardlock')}
            className={`flex-shrink-0 py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              view === 'cardlock' ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Lock className="w-4 h-4 inline mr-1" />
            {t('cardLock') || 'Sperren'}
          </button>
          <button
            onClick={() => setView('quicktopup')}
            className={`flex-shrink-0 py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              view === 'quicktopup' ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Zap className="w-4 h-4 inline mr-1" />
            Apple Pay
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
            {/* Saved Recipients / Contacts Section */}
            <div className="bg-white rounded-2xl shadow-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-500" />
                  {t('savedContacts')}
                </h3>
                <Button
                  size="sm"
                  onClick={() => setShowAddContactDialog(true)}
                  className="bg-green-500 hover:bg-green-600 text-white text-xs h-8"
                  data-testid="add-contact-btn"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  {t('newContact')}
                </Button>
              </div>
              
              {savedRecipients.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {savedRecipients.map((recipient) => (
                    <div
                      key={recipient.id}
                      className="flex-shrink-0 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-3 hover:border-green-400 hover:shadow-md transition-all min-w-[160px] relative group"
                    >
                      <button
                        onClick={() => selectSavedRecipient(recipient)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {recipient.nickname.charAt(0).toUpperCase()}
                          </div>
                          <p className="font-bold text-gray-800 text-sm truncate">{recipient.nickname}</p>
                        </div>
                        <p className="text-xs text-gray-500 truncate">{recipient.recipient_customer_number || recipient.recipient_email}</p>
                      </button>
                      {/* Edit/Delete Buttons */}
                      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingContact({ ...recipient, newNickname: recipient.nickname });
                          }}
                          className="w-6 h-6 bg-blue-100 hover:bg-blue-200 rounded-full flex items-center justify-center"
                          title={t('edit')}
                        >
                          <span className="text-xs">✏️</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`${recipient.nickname} ${t('delete')}?`)) {
                              deleteSavedRecipient(recipient.id);
                            }
                          }}
                          className="w-6 h-6 bg-red-100 hover:bg-red-200 rounded-full flex items-center justify-center"
                          title={t('delete')}
                        >
                          <span className="text-xs">🗑️</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 bg-gray-50 rounded-xl">
                  <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">
                    {t('noContactsSaved')}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {t('clickAddContact')}
                  </p>
                </div>
              )}
            </div>

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
                    {/* Kamera-Status Anzeige - NUR zeigen wenn Berechtigung erteilt UND keine Hilfe benötigt */}
                    {cameraPermissionGranted && !showCameraHelp && (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-sm text-green-700">
                          {t('cameraReady')}
                        </span>
                      </div>
                    )}
                    
                    {/* Kamera-Hilfe Box - erscheint wenn showCameraHelp true ist */}
                    {showCameraHelp && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-red-800 mb-2">
                              {t('cameraPermissionRequired')}
                            </p>
                            <div className="text-sm text-red-700 space-y-2">
                              <p className="font-medium">📱 iPhone/iPad (Safari):</p>
                              <ol className="list-decimal list-inside ml-2 space-y-1 text-xs">
                                <li>Öffnen Sie die <strong>Einstellungen</strong>-App</li>
                                <li>Scrollen Sie nach unten zu <strong>Apps</strong></li>
                                <li>Tippen Sie auf <strong>Safari</strong></li>
                                <li>Unter "Einstellungen für Websites" tippen Sie auf <strong>Kamera</strong></li>
                                <li>Wählen Sie <strong>Erlauben</strong> oder <strong>Fragen</strong></li>
                                <li>Kommen Sie zurück und tippen Sie auf <strong>Neu versuchen</strong></li>
                              </ol>
                              <p className="font-medium mt-3">🌐 Andere Browser:</p>
                              <ol className="list-decimal list-inside ml-2 space-y-1 text-xs">
                                <li>Klicken Sie auf das 🔒 Symbol in der Adressleiste</li>
                                <li>Erlauben Sie die <strong>Kamera</strong></li>
                              </ol>
                            </div>
                            <div className="flex flex-col gap-2 mt-3">
                              {/* Info-Text für iOS Einstellungen */}
                              {/iPad|iPhone|iPod/.test(navigator.userAgent) && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-700">
                                  <strong>Tipp:</strong> Einstellungen → Apps → Safari → Kamera → Erlauben
                                </div>
                              )}
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setShowCameraHelp(false)}
                                  className="text-red-600 border-red-300"
                                >
                                  Verstanden
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    // Berechtigung zurücksetzen und erneut anfordern
                                    localStorage.removeItem('bidblitz_camera_permission');
                                    localStorage.removeItem('bidblitz_camera_asked');
                                    setCameraPermissionGranted(false);
                                    setCameraPermissionAsked(false);
                                    window.location.reload();
                                  }}
                                  className="bg-red-500 hover:bg-red-600 text-white"
                                >
                                  Neu versuchen
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="bg-gray-100 rounded-xl p-6 text-center">
                      <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">{t('scanRequestQR')}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        {t('chooseScanOption')}
                      </p>
                    </div>
                    
                    {/* iOS Photo Scanner - PRIMÄRE OPTION für iOS */}
                    <div className="bg-green-50 border-2 border-green-400 rounded-xl p-4 shadow-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">📸</span>
                        <span className="font-bold text-green-800 text-lg">
                          {t('takePhoto')}
                        </span>
                        <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                          {t('recommended')}
                        </span>
                      </div>
                      <p className="text-sm text-green-600 mb-3">
                        {t('worksReliably')}
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoScan}
                        className="hidden"
                        id="photo-scanner-input"
                      />
                      <label
                        htmlFor="photo-scanner-input"
                        className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-4 rounded-xl cursor-pointer min-h-[56px] touch-manipulation transition-colors shadow-md text-lg"
                      >
                        <Camera className="w-6 h-6" />
                        {t('takePhotoNow')}
                      </label>
                    </div>
                    
                    {/* Hidden element for photo scan processing */}
                    <div id="qr-reader-hidden" style={{ display: 'none' }}></div>
                    
                    {/* Camera Scanner Button - Sekundäre Option */}
                    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                      <p className="text-xs text-gray-500 mb-2 text-center">
                        {t('alternativeLiveCamera')}
                      </p>
                      <Button
                        onClick={startScanner}
                        variant="outline"
                        className="w-full border-gray-300 text-gray-700 min-h-[48px] touch-manipulation"
                      >
                        <Camera className="w-5 h-5 mr-2" />
                        {t('startScanner')}
                      </Button>
                    </div>
                    
                    {/* Manual ID Entry */}
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Keyboard className="w-5 h-5 text-amber-600" />
                        <span className="font-medium text-amber-800">
                          {t('manualEntry')}
                        </span>
                      </div>
                      <form onSubmit={handleManualRequestLoad} className="space-y-3">
                        <Input
                          type="text"
                          value={manualRequestId}
                          onChange={(e) => setManualRequestId(e.target.value.toUpperCase())}
                          placeholder="z.B. 149F919F"
                          className="w-full text-center font-mono tracking-wider bg-white min-h-[48px]"
                          maxLength={12}
                        />
                        <Button
                          type="submit"
                          className="w-full bg-amber-500 hover:bg-amber-600 text-white min-h-[48px] touch-manipulation"
                          disabled={!manualRequestId.trim() || loadingManualRequest}
                        >
                          {loadingManualRequest ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4 mr-2" />
                          )}
                          {t('loadId') || 'ID laden'}
                        </Button>
                      </form>
                    </div>
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
                      id="request-qr-image"
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
                  
                  {/* Share Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* WhatsApp Share */}
                    <Button
                      onClick={() => {
                        const message = `💸 ${t('paymentRequest')}: €${requestQR.amount?.toFixed(2)}${requestQR.description ? '\n📝 ' + requestQR.description : ''}\n\n📱 ID: ${requestQR.request_id}`;
                        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
                      }}
                      className="bg-green-500 hover:bg-green-600 text-white"
                    >
                      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      WhatsApp
                    </Button>
                    
                    {/* Native Share / Copy */}
                    <Button
                      onClick={async () => {
                        const shareText = `💸 ${t('paymentRequest')}: €${requestQR.amount?.toFixed(2)}${requestQR.description ? ' - ' + requestQR.description : ''}\n📱 ID: ${requestQR.request_id}`;
                        
                        // Try native share first
                        if (navigator.share) {
                          try {
                            await navigator.share({
                              title: t('paymentRequest'),
                              text: shareText
                            });
                            toast.success(t('sharedSuccessfully'));
                          } catch (err) {
                            if (err.name !== 'AbortError') {
                              // Fallback to copy
                              await navigator.clipboard.writeText(shareText);
                              toast.success(t('copiedToClipboard'));
                            }
                          }
                        } else {
                          // Fallback to copy
                          await navigator.clipboard.writeText(shareText);
                          toast.success(t('copiedToClipboard'));
                        }
                      }}
                      variant="outline"
                      className="border-gray-300"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      {t('shareQRCode')}
                    </Button>
                  </div>
                  
                  {/* Download QR Code */}
                  <Button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = requestQR.qr_code;
                      link.download = `BidBlitz-Zahlung-${requestQR.request_id}.png`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      toast.success(t('qrDownloaded'));
                    }}
                    variant="outline"
                    className="w-full border-amber-300 text-amber-600 hover:bg-amber-50"
                  >
                    <ArrowDownLeft className="w-4 h-4 mr-2 rotate-45" />
                    {t('saveQRCode')}
                  </Button>
                  
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
                  {/* GRÖSSERER QR-CODE */}
                  <div className="bg-white p-3 rounded-xl inline-block border-4 border-amber-200">
                    <img 
                      src={qrCode.qr_code} 
                      alt="Payment QR Code" 
                      className="w-64 h-64 sm:w-72 sm:h-72 mx-auto"
                    />
                  </div>
                  
                  {/* LINEARER BARCODE - für Scanner die keine QR-Codes lesen */}
                  {customerNumber && (
                    <div className="bg-white p-4 rounded-xl border-2 border-gray-200">
                      <p className="text-xs text-gray-500 mb-2">
                        {language === 'de' ? 'Alternativ: Kundennummer-Barcode' : 'Alternative: Customer Number Barcode'}
                      </p>
                      <div className="flex justify-center">
                        <Barcode 
                          value={customerNumber}
                          format="CODE128"
                          width={2}
                          height={60}
                          fontSize={14}
                          background="#ffffff"
                          lineColor="#000000"
                          displayValue={true}
                        />
                      </div>
                    </div>
                  )}
                  
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

                  {/* KORRIGIERTES GUTHABEN - wallet.wallet.universal_balance */}
                  {!hideBalance && (
                    <div className="bg-amber-50 rounded-xl p-4">
                      <p className="text-xs text-amber-600 mb-2">{t('availableForPayment')}:</p>
                      <p className="text-3xl font-bold text-amber-700">
                        €{(wallet?.wallet?.universal_balance || 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-green-600 mt-1 animate-pulse">
                        ● Live-Aktualisierung aktiv
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

        {/* Spending Stats View */}
        {view === 'stats' && (
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-lg p-6" data-testid="stats-view">
            <SpendingStats 
              language={language}
              userId={user?.id}
            />
          </div>
        )}

        {/* Card Lock View */}
        {view === 'cardlock' && (
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-lg p-6" data-testid="cardlock-view">
            <CardLock 
              language={language}
              walletId={wallet?.id}
              onStatusChange={(isLocked) => {
                if (isLocked) {
                  toast.warning(t('cardLocked') || 'Karte wurde gesperrt');
                }
              }}
            />
          </div>
        )}

        {/* Quick Top Up (Apple Pay / Google Pay) View */}
        {view === 'quicktopup' && (
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-lg p-6" data-testid="quicktopup-view">
            <QuickTopUp 
              language={language}
              walletId={wallet?.id}
              onSuccess={(amount) => {
                fetchWallet();
                fetchTransactions();
                toast.success(`€${amount.toFixed(2)} aufgeladen!`);
              }}
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

      {/* Add New Contact Dialog */}
      {showAddContactDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-800">
                {t('addNewContact')}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {t('saveFrequentRecipients')}
              </p>
            </div>
            
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('customerNumberOrEmail')}
                </label>
                <Input
                  type="text"
                  value={newContactId}
                  onChange={(e) => setNewContactId(e.target.value)}
                  placeholder={t('customerNumberExample')}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('nickname')}
                </label>
                <Input
                  type="text"
                  value={newContactNickname}
                  onChange={(e) => setNewContactNickname(e.target.value)}
                  placeholder={t('nicknameExample')}
                  className="w-full"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setShowAddContactDialog(false);
                  setNewContactId('');
                  setNewContactNickname('');
                }}
                variant="outline"
                className="flex-1"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={addContactManually}
                disabled={!newContactId.trim() || !newContactNickname.trim() || addingContact}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white"
              >
                {addingContact ? (
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

      {/* Edit Contact Dialog */}
      {editingContact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">✏️</span>
              </div>
              <h3 className="text-lg font-bold text-gray-800">
                {t('editContact')}
              </h3>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <p className="text-xs text-gray-500">
                {t('customerNumber')}
              </p>
              <p className="font-medium text-gray-800">{editingContact.recipient_customer_number || editingContact.recipient_email}</p>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('newNickname')}
              </label>
              <Input
                type="text"
                value={editingContact.newNickname || ''}
                onChange={(e) => setEditingContact({ ...editingContact, newNickname: e.target.value })}
                placeholder={t('nicknameExample')}
                className="w-full"
                autoFocus
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={() => setEditingContact(null)}
                variant="outline"
                className="flex-1"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={updateContact}
                disabled={!editingContact.newNickname?.trim()}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                {t('save')}
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* ==================== PAYMENT CONFIRMATION MODAL ==================== */}
      {showPaymentModal && paymentReceived && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Success Header */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-8 text-center">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <CheckCircle className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">
                {language === 'de' ? 'Zahlung erfolgreich!' : 'Payment successful!'}
              </h2>
              <p className="text-green-100 mt-1">
                {paymentReceived.merchant_name || 'Partner'}
              </p>
            </div>
            
            {/* Amount */}
            <div className="p-6 text-center">
              <p className="text-gray-500 text-sm mb-1">
                {language === 'de' ? 'Abgezogen' : 'Deducted'}
              </p>
              <p className="text-4xl font-bold text-gray-900">
                €{paymentReceived.amount?.toFixed(2)}
              </p>
              
              {/* Discount Info */}
              {paymentReceived.has_discount && paymentReceived.discount_amount > 0 && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                  <span>🎉</span>
                  <span>
                    {language === 'de' ? 'Rabatt' : 'Discount'}: €{paymentReceived.discount_amount?.toFixed(2)}
                  </span>
                </div>
              )}
              
              {/* New Balance */}
              <div className="mt-6 p-4 bg-gray-50 rounded-2xl">
                <p className="text-gray-500 text-sm">
                  {language === 'de' ? 'Neues Guthaben' : 'New Balance'}
                </p>
                <p className="text-2xl font-bold text-orange-600">
                  €{paymentReceived.new_balance?.toFixed(2)}
                </p>
              </div>
            </div>
            
            {/* Close Button */}
            <div className="px-6 pb-6">
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentReceived(null);
                }}
                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-semibold hover:bg-gray-800 transition-colors"
              >
                {language === 'de' ? 'Fertig' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BidBlitzPay;
