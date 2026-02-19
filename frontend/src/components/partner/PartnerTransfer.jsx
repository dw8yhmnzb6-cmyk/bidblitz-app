/**
 * PartnerTransfer - Partner-zu-Partner Überweisungen
 * Ermöglicht Händlern, Geld an andere Händler zu senden
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Send, ArrowUpRight, ArrowDownLeft, History, Search, 
  RefreshCw, CheckCircle, AlertCircle, Loader2, Euro, Users
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

// Translations for all supported languages
const translations = {
  de: {
    title: 'Händler-Überweisungen',
    subtitle: 'Geld an andere Partner senden',
    availableBalance: 'Verfügbares Guthaben',
    sendMoney: 'Geld senden',
    recipient: 'Empfänger',
    recipientPlaceholder: 'Partnernummer (P-XXXXX) oder E-Mail',
    amount: 'Betrag',
    message: 'Nachricht (optional)',
    messagePlaceholder: 'z.B. Für gemeinsame Werbung',
    send: 'Überweisen',
    sending: 'Wird überwiesen...',
    history: 'Verlauf',
    sent: 'Gesendet',
    received: 'Empfangen',
    noTransfers: 'Noch keine Überweisungen',
    searchPartner: 'Partner suchen',
    searchPlaceholder: 'Firmenname, E-Mail oder Partnernummer',
    lastTransfer: 'Letzte Überweisung',
    useRecipient: 'Übernehmen',
    recipientLoaded: 'Empfänger übernommen!',
    transferSuccess: 'Überweisung erfolgreich!',
    insufficientFunds: 'Nicht genug Guthaben',
    recipientNotFound: 'Empfänger nicht gefunden',
    enterAmount: 'Bitte Betrag eingeben',
    enterRecipient: 'Bitte Empfänger eingeben',
    to: 'An',
    from: 'Von',
    partnerNumber: 'Partnernummer',
    searchResults: 'Suchergebnisse',
    noResults: 'Keine Partner gefunden',
    selectRecipient: 'Empfänger auswählen',
    customerIdError: 'Nur Partner-Überweisungen möglich (keine Kunden-IDs)',
    searchByName: 'Nach Firmenname suchen'
  },
  en: {
    title: 'Partner Transfers',
    subtitle: 'Send money to other partners',
    availableBalance: 'Available Balance',
    sendMoney: 'Send Money',
    recipient: 'Recipient',
    recipientPlaceholder: 'Partner number (P-XXXXX) or email',
    amount: 'Amount',
    message: 'Message (optional)',
    messagePlaceholder: 'e.g. For joint advertising',
    send: 'Transfer',
    sending: 'Transferring...',
    history: 'History',
    sent: 'Sent',
    received: 'Received',
    noTransfers: 'No transfers yet',
    searchPartner: 'Search Partner',
    searchPlaceholder: 'Company name, email or partner number',
    lastTransfer: 'Last Transfer',
    useRecipient: 'Use',
    recipientLoaded: 'Recipient loaded!',
    transferSuccess: 'Transfer successful!',
    insufficientFunds: 'Insufficient funds',
    recipientNotFound: 'Recipient not found',
    enterAmount: 'Please enter amount',
    enterRecipient: 'Please enter recipient',
    to: 'To',
    from: 'From',
    partnerNumber: 'Partner Number',
    searchResults: 'Search Results',
    noResults: 'No partners found',
    selectRecipient: 'Select recipient',
    customerIdError: 'Only partner transfers allowed (no customer IDs)',
    searchByName: 'Search by company name'
  },
  sq: {
    title: 'Transfertat e Partnerëve',
    subtitle: 'Dërgo para tek partnerët e tjerë',
    availableBalance: 'Bilanci i Disponueshëm',
    sendMoney: 'Dërgo Para',
    recipient: 'Marrësi',
    recipientPlaceholder: 'Numri i partnerit (P-XXXXX) ose email',
    amount: 'Shuma',
    message: 'Mesazhi (opsional)',
    messagePlaceholder: 'p.sh. Për reklamim të përbashkët',
    send: 'Transfero',
    sending: 'Duke transferuar...',
    history: 'Historiku',
    sent: 'Dërguar',
    received: 'Marrë',
    noTransfers: 'Nuk ka transferta ende',
    searchPartner: 'Kërko Partner',
    searchPlaceholder: 'Emri i kompanisë, email ose numri i partnerit',
    lastTransfer: 'Transferta e Fundit',
    useRecipient: 'Përdor',
    recipientLoaded: 'Marrësi u ngarkua!',
    transferSuccess: 'Transferta e suksesshme!',
    insufficientFunds: 'Fonde të pamjaftueshme',
    recipientNotFound: 'Marrësi nuk u gjet',
    enterAmount: 'Ju lutem vendosni shumën',
    enterRecipient: 'Ju lutem vendosni marrësin',
    to: 'Tek',
    from: 'Nga',
    partnerNumber: 'Numri i Partnerit',
    searchResults: 'Rezultatet e Kërkimit',
    noResults: 'Nuk u gjetën partnerë',
    selectRecipient: 'Zgjedh marrësin',
    customerIdError: 'Vetëm transferta partnerësh (pa ID të klientëve)',
    searchByName: 'Kërko sipas emrit të kompanisë'
  },
  tr: {
    title: 'Partner Transferleri',
    subtitle: 'Diğer partnerlere para gönder',
    availableBalance: 'Mevcut Bakiye',
    sendMoney: 'Para Gönder',
    recipient: 'Alıcı',
    recipientPlaceholder: 'Partner numarası (P-XXXXX) veya e-posta',
    amount: 'Tutar',
    message: 'Mesaj (isteğe bağlı)',
    messagePlaceholder: 'örn. Ortak reklam için',
    send: 'Transfer Et',
    sending: 'Transfer ediliyor...',
    history: 'Geçmiş',
    sent: 'Gönderilen',
    received: 'Alınan',
    noTransfers: 'Henüz transfer yok',
    searchPartner: 'Partner Ara',
    searchPlaceholder: 'Şirket adı, e-posta veya partner numarası',
    lastTransfer: 'Son Transfer',
    useRecipient: 'Kullan',
    recipientLoaded: 'Alıcı yüklendi!',
    transferSuccess: 'Transfer başarılı!',
    insufficientFunds: 'Yetersiz bakiye',
    recipientNotFound: 'Alıcı bulunamadı',
    enterAmount: 'Lütfen tutar girin',
    enterRecipient: 'Lütfen alıcı girin',
    to: 'Kime',
    from: 'Kimden',
    partnerNumber: 'Partner Numarası',
    searchResults: 'Arama Sonuçları',
    noResults: 'Partner bulunamadı',
    selectRecipient: 'Alıcı seç',
    customerIdError: 'Sadece partner transferleri (müşteri ID kabul edilmez)',
    searchByName: 'Şirket adına göre ara'
  },
  ar: {
    title: 'تحويلات الشركاء',
    subtitle: 'إرسال الأموال إلى شركاء آخرين',
    availableBalance: 'الرصيد المتاح',
    sendMoney: 'إرسال الأموال',
    recipient: 'المستلم',
    recipientPlaceholder: 'رقم الشريك (P-XXXXX) أو البريد الإلكتروني',
    amount: 'المبلغ',
    message: 'رسالة (اختياري)',
    messagePlaceholder: 'مثال: للإعلان المشترك',
    send: 'تحويل',
    sending: 'جاري التحويل...',
    history: 'السجل',
    sent: 'مرسل',
    received: 'مستلم',
    noTransfers: 'لا توجد تحويلات بعد',
    searchPartner: 'البحث عن شريك',
    searchPlaceholder: 'اسم الشركة، البريد الإلكتروني أو رقم الشريك',
    lastTransfer: 'آخر تحويل',
    useRecipient: 'استخدام',
    recipientLoaded: 'تم تحميل المستلم!',
    transferSuccess: 'تم التحويل بنجاح!',
    insufficientFunds: 'رصيد غير كافٍ',
    recipientNotFound: 'المستلم غير موجود',
    enterAmount: 'الرجاء إدخال المبلغ',
    enterRecipient: 'الرجاء إدخال المستلم',
    to: 'إلى',
    from: 'من',
    partnerNumber: 'رقم الشريك',
    searchResults: 'نتائج البحث',
    noResults: 'لم يتم العثور على شركاء',
    selectRecipient: 'اختر المستلم',
    customerIdError: 'تحويلات الشركاء فقط (لا يُقبل معرف العميل)',
    searchByName: 'البحث باسم الشركة'
  }
};

export function PartnerTransfer({ token, language = 'de' }) {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('send'); // send, history
  const [transfers, setTransfers] = useState([]);
  const [lastRecipient, setLastRecipient] = useState(null);
  
  // Form states
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  
  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  
  // Translation helper
  const t = (key) => translations[language]?.[key] || translations.de[key] || key;
  
  // Fetch balance
  const fetchBalance = useCallback(async () => {
    try {
      const response = await fetch(`${API}/api/partner-transfer/balance?token=${token}`);
      if (response.ok) {
        const data = await response.json();
        setBalance(data);
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);
  
  // Fetch transfer history
  const fetchHistory = useCallback(async () => {
    try {
      const response = await fetch(`${API}/api/partner-transfer/history?token=${token}`);
      if (response.ok) {
        const data = await response.json();
        setTransfers(data.transfers || []);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  }, [token]);
  
  // Fetch last recipient
  const fetchLastRecipient = useCallback(async () => {
    try {
      const response = await fetch(`${API}/api/partner-transfer/last-recipient?token=${token}`);
      if (response.ok) {
        const data = await response.json();
        setLastRecipient(data.last_recipient);
      }
    } catch (error) {
      console.error('Error fetching last recipient:', error);
    }
  }, [token]);
  
  useEffect(() => {
    fetchBalance();
    fetchHistory();
    fetchLastRecipient();
  }, [fetchBalance, fetchHistory, fetchLastRecipient]);
  
  // Search partners
  const searchPartners = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setSearching(true);
    try {
      const response = await fetch(`${API}/api/partner-transfer/search-partner?token=${token}&query=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      }
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setSearching(false);
    }
  };
  
  // Handle search input
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    searchPartners(query);
  };
  
  // Select partner from search
  const selectPartner = (partner) => {
    setRecipient(partner.partner_number);
    setSearchQuery('');
    setSearchResults([]);
    setShowSearch(false);
  };
  
  // Use last recipient
  const useLastRecipientData = () => {
    if (lastRecipient) {
      setRecipient(lastRecipient.partner_number);
      setMessage(lastRecipient.last_message || '');
      toast.success(t('recipientLoaded'));
    }
  };
  
  // Send money
  const handleSend = async (e) => {
    e.preventDefault();
    
    if (!recipient) {
      toast.error(t('enterRecipient'));
      return;
    }
    
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error(t('enterAmount'));
      return;
    }
    
    if (amountNum > (balance?.available_balance || 0)) {
      toast.error(t('insufficientFunds'));
      return;
    }
    
    setSending(true);
    try {
      const response = await fetch(`${API}/api/partner-transfer/send?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_identifier: recipient,
          amount: amountNum,
          message: message || null
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success(`${t('transferSuccess')} €${amountNum.toFixed(2)}`);
        setRecipient('');
        setAmount('');
        setMessage('');
        fetchBalance();
        fetchHistory();
        fetchLastRecipient();
      } else {
        // Check for customer ID error from backend
        if (data.detail && (data.detail.includes('BID-') || data.detail.includes('Kunden-IDs') || data.detail.includes('Partner'))) {
          toast.error(t('customerIdError'));
        } else {
          toast.error(data.detail || t('recipientNotFound'));
        }
      }
    } catch (error) {
      console.error('Transfer error:', error);
      toast.error(t('recipientNotFound'));
    } finally {
      setSending(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <Users className="w-8 h-8" />
          <div>
            <h2 className="text-xl font-bold">{t('title')}</h2>
            <p className="text-white/80 text-sm">{t('subtitle')}</p>
          </div>
        </div>
        
        <div className="bg-white/20 rounded-xl p-4">
          <p className="text-sm text-white/80">{t('availableBalance')}</p>
          <p className="text-3xl font-bold">€{(balance?.available_balance || 0).toFixed(2)}</p>
          <p className="text-xs text-white/60 mt-1">
            {t('partnerNumber')}: {balance?.partner_number}
          </p>
        </div>
      </div>
      
      {/* Tab Navigation */}
      <div className="flex gap-2">
        <button
          onClick={() => setView('send')}
          className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
            view === 'send' 
              ? 'bg-amber-500 text-white' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Send className="w-4 h-4" />
          {t('sendMoney')}
        </button>
        <button
          onClick={() => setView('history')}
          className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
            view === 'history' 
              ? 'bg-amber-500 text-white' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <History className="w-4 h-4" />
          {t('history')}
        </button>
      </div>
      
      {/* Send View */}
      {view === 'send' && (
        <div className="space-y-4">
          {/* Last Recipient Quick Select */}
          {lastRecipient && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-amber-600 font-medium">{t('lastTransfer')}</p>
                    <p className="font-bold text-gray-800">{lastRecipient.name}</p>
                    <p className="text-xs text-gray-500">
                      #{lastRecipient.partner_number} • €{lastRecipient.last_amount?.toFixed(2)}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={useLastRecipientData}
                  className="bg-amber-500 hover:bg-amber-600 text-white text-sm"
                >
                  {t('useRecipient')}
                </Button>
              </div>
            </div>
          )}
          
          {/* Send Form */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <form onSubmit={handleSend} className="space-y-4">
              {/* Recipient */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('recipient')}
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder={t('recipientPlaceholder')}
                    className="w-full"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSearch(!showSearch)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 rounded"
                  >
                    <Search className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
              
              {/* Partner Search */}
              {showSearch && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-medium text-gray-700">{t('searchPartner')}</p>
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder={t('searchPlaceholder')}
                    className="w-full"
                  />
                  
                  {searching && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                    </div>
                  )}
                  
                  {!searching && searchResults.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">{t('searchResults')}</p>
                      {searchResults.map((partner, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => selectPartner(partner)}
                          className="w-full p-3 bg-white rounded-lg border hover:border-amber-300 hover:bg-amber-50 transition-all text-left"
                        >
                          <p className="font-medium text-gray-800">{partner.name}</p>
                          <p className="text-xs text-gray-500">
                            #{partner.partner_number} • {partner.email}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">{t('noResults')}</p>
                  )}
                </div>
              )}
              
              {/* Amount */}
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
                    max={balance?.available_balance || 0}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-8"
                    placeholder="0.00"
                  />
                </div>
              </div>
              
              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('message')}
                </label>
                <Input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t('messagePlaceholder')}
                  className="w-full"
                  maxLength={200}
                />
              </div>
              
              {/* Submit Button */}
              <Button
                type="submit"
                disabled={sending || !recipient || !amount}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white py-4 text-lg disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {t('sending')}
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    {t('send')} {amount && `€${parseFloat(amount || 0).toFixed(2)}`}
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>
      )}
      
      {/* History View */}
      {view === 'history' && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">{t('history')}</h3>
          
          {transfers.length > 0 ? (
            <div className="space-y-3">
              {transfers.map((transfer) => (
                <div 
                  key={transfer.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      transfer.direction === 'sent' 
                        ? 'bg-red-100 text-red-600' 
                        : 'bg-green-100 text-green-600'
                    }`}>
                      {transfer.direction === 'sent' 
                        ? <ArrowUpRight className="w-5 h-5" />
                        : <ArrowDownLeft className="w-5 h-5" />
                      }
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">
                        {transfer.direction === 'sent' 
                          ? `${t('to')}: ${transfer.recipient_name}`
                          : `${t('from')}: ${transfer.sender_name}`
                        }
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(transfer.created_at).toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US')}
                        {transfer.message && ` • ${transfer.message}`}
                      </p>
                    </div>
                  </div>
                  <p className={`font-bold ${
                    transfer.direction === 'sent' ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {transfer.direction === 'sent' ? '-' : '+'}€{transfer.amount.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <History className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">{t('noTransfers')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PartnerTransfer;
