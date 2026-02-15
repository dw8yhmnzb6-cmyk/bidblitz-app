import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { 
  Gift, CreditCard, Send, User, Clock, Check,
  Star, Heart, ShoppingBag, Zap, ChevronRight
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const translations = {
  de: {
    title: 'Geschenkkarten',
    subtitle: 'Verschenke bidblitz.ae Gebote an Freunde und Familie!',
    buyCard: 'Geschenkkarte kaufen',
    sendGift: 'Geschenk senden',
    myCards: 'Meine Karten',
    receivedGifts: 'Erhaltene Geschenke',
    selectAmount: 'Betrag wählen',
    bids: 'Gebote',
    price: 'Preis',
    recipient: 'Empfänger',
    recipientEmail: 'Empfänger E-Mail',
    message: 'Nachricht (optional)',
    personalMessage: 'Schreibe eine persönliche Nachricht...',
    preview: 'Vorschau',
    from: 'Von',
    to: 'An',
    purchase: 'Kaufen',
    send: 'Senden',
    noCards: 'Noch keine Geschenkkarten',
    noGifts: 'Noch keine Geschenke erhalten',
    buyFirst: 'Kaufe deine erste Geschenkkarte!',
    validUntil: 'Gültig bis',
    redeemed: 'Eingelöst',
    pending: 'Ausstehend',
    sent: 'Gesendet',
    loginRequired: 'Bitte anmelden',
    loginToUse: 'Melde dich an um Geschenkkarten zu kaufen',
    popular: 'Beliebt',
    bestValue: 'Bester Wert',
    loading: 'Laden...',
    howItWorks: 'So funktioniert es',
    step1: 'Wähle einen Betrag',
    step2: 'Gib die E-Mail des Empfängers ein',
    step3: 'Der Empfänger erhält die Gebote sofort!',
    giftDesign: 'Geschenk-Design',
    designs: {
      birthday: 'Geburtstag',
      christmas: 'Weihnachten',
      thankyou: 'Dankeschön',
      general: 'Allgemein'
    }
  },
  en: {
    title: 'Gift Cards',
    subtitle: 'Gift bidblitz.ae bids to friends and family!',
    buyCard: 'Buy Gift Card',
    sendGift: 'Send Gift',
    myCards: 'My Cards',
    receivedGifts: 'Received Gifts',
    selectAmount: 'Select Amount',
    bids: 'Bids',
    price: 'Price',
    recipient: 'Recipient',
    recipientEmail: 'Recipient Email',
    message: 'Message (optional)',
    personalMessage: 'Write a personal message...',
    preview: 'Preview',
    from: 'From',
    to: 'To',
    purchase: 'Purchase',
    send: 'Send',
    noCards: 'No gift cards yet',
    noGifts: 'No gifts received yet',
    buyFirst: 'Buy your first gift card!',
    validUntil: 'Valid until',
    redeemed: 'Redeemed',
    pending: 'Pending',
    sent: 'Sent',
    loginRequired: 'Please login',
    loginToUse: 'Login to buy gift cards',
    popular: 'Popular',
    bestValue: 'Best Value',
    loading: 'Loading...',
    howItWorks: 'How it works',
    step1: 'Choose an amount',
    step2: 'Enter recipient email',
    step3: 'Recipient gets the bids instantly!',
    giftDesign: 'Gift Design',
    designs: {
      birthday: 'Birthday',
      christmas: 'Christmas',
      thankyou: 'Thank You',
      general: 'General'
    }
  },
  sq: {
    title: 'Kartat e Dhuratave',
    subtitle: 'Dhuro ofertat bidblitz.ae miqve dhe familjes!',
    buyCard: 'Bli Kartën e Dhuratës',
    sendGift: 'Dërgo Dhuratë',
    myCards: 'Kartat e Mia',
    receivedGifts: 'Dhuratat e Marra',
    selectAmount: 'Zgjidh Shumën',
    bids: 'Oferta',
    price: 'Çmimi',
    recipient: 'Marrësi',
    recipientEmail: 'Email i Marrësit',
    message: 'Mesazhi (opsionale)',
    personalMessage: 'Shkruaj një mesazh personal...',
    preview: 'Parapamje',
    from: 'Nga',
    to: 'Për',
    purchase: 'Bli',
    send: 'Dërgo',
    noCards: 'Asnjë kartë dhurate ende',
    noGifts: 'Asnjë dhuratë e marrë ende',
    buyFirst: 'Bli kartën e parë të dhuratës!',
    validUntil: 'E vlefshme deri',
    redeemed: 'E përdorur',
    pending: 'Në pritje',
    sent: 'Dërguar',
    loginRequired: 'Ju lutem identifikohuni',
    loginToUse: 'Identifikohuni për të blerë karta dhuratash',
    popular: 'Popullore',
    bestValue: 'Vlera më e Mirë',
    loading: 'Duke ngarkuar...',
    howItWorks: 'Si funksionon',
    step1: 'Zgjidh një shumë',
    step2: 'Fut email-in e marrësit',
    step3: 'Marrësi merr ofertat menjëherë!',
    giftDesign: 'Dizajni i Dhuratës',
    designs: {
      birthday: 'Ditëlindje',
      christmas: 'Krishtlindje',
      thankyou: 'Faleminderit',
      general: 'I Përgjithshëm'
    }
  },
  xk: {
    title: 'Kartat e Dhuratave',
    subtitle: 'Dhuro ofertat bidblitz.ae miqve dhe familjes!',
    buyCard: 'Bli Kartën e Dhuratës',
    sendGift: 'Dërgo Dhuratë',
    myCards: 'Kartat e Mia',
    receivedGifts: 'Dhuratat e Marra',
    selectAmount: 'Zgjidh Shumën',
    bids: 'Oferta',
    price: 'Çmimi',
    recipient: 'Marrësi',
    recipientEmail: 'Email i Marrësit',
    message: 'Mesazhi (opsionale)',
    personalMessage: 'Shkruaj një mesazh personal...',
    preview: 'Parapamje',
    from: 'Nga',
    to: 'Për',
    purchase: 'Bli',
    send: 'Dërgo',
    noCards: 'Asnjë kartë dhurate ende',
    noGifts: 'Asnjë dhuratë e marrë ende',
    buyFirst: 'Bli kartën e parë të dhuratës!',
    validUntil: 'E vlefshme deri',
    redeemed: 'E përdorur',
    pending: 'Në pritje',
    sent: 'Dërguar',
    loginRequired: 'Ju lutem identifikohuni',
    loginToUse: 'Identifikohuni për të blerë karta dhuratash',
    popular: 'Popullore',
    bestValue: 'Vlera më e Mirë',
    loading: 'Duke ngarkuar...',
    howItWorks: 'Si funksionon',
    step1: 'Zgjidh një shumë',
    step2: 'Fut email-in e marrësit',
    step3: 'Marrësi merr ofertat menjëherë!',
    giftDesign: 'Dizajni i Dhuratës',
    designs: {
      birthday: 'Ditëlindje',
      christmas: 'Krishtlindje',
      thankyou: 'Faleminderit',
      general: 'I Përgjithshëm'
    }
  }
};

const GIFT_PACKAGES = [
  { id: 1, bids: 10, price: 5.99, popular: false, bestValue: false },
  { id: 2, bids: 25, price: 12.99, popular: true, bestValue: false },
  { id: 3, bids: 50, price: 22.99, popular: false, bestValue: true },
  { id: 4, bids: 100, price: 39.99, popular: false, bestValue: false },
  { id: 5, bids: 250, price: 89.99, popular: false, bestValue: false }
];

const GIFT_DESIGNS = [
  { id: 'general', icon: '🎁', color: 'from-purple-500 to-pink-500' },
  { id: 'birthday', icon: '🎂', color: 'from-yellow-500 to-orange-500' },
  { id: 'christmas', icon: '🎄', color: 'from-green-500 to-red-500' },
  { id: 'thankyou', icon: '💝', color: 'from-pink-500 to-red-500' }
];

const GiftCardsPage = () => {
  const { isAuthenticated, token, user } = useAuth();
  const { language, mappedLanguage } = useLanguage();
  const navigate = useNavigate();
  const langKey = mappedLanguage || language;
  const t = translations[langKey] || translations.de;

  const [activeTab, setActiveTab] = useState('buy');
  const [selectedPackage, setSelectedPackage] = useState(GIFT_PACKAGES[1]);
  const [selectedDesign, setSelectedDesign] = useState(GIFT_DESIGNS[0]);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');
  const [myCards, setMyCards] = useState([]);
  const [receivedGifts, setReceivedGifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      const [cardsRes, giftsRes] = await Promise.all([
        fetch(`${API}/api/gift-cards/my-cards`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API}/api/gift-cards/received`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (cardsRes.ok) {
        const data = await cardsRes.json();
        setMyCards(data.cards || []);
      }

      if (giftsRes.ok) {
        const data = await giftsRes.json();
        setReceivedGifts(data.gifts || []);
      }
    } catch (err) {
      console.error('Error fetching gift cards:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSendGift = async () => {
    if (!recipientEmail) {
      toast.error('Bitte gib eine E-Mail-Adresse ein');
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`${API}/api/gift-cards/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          recipient_email: recipientEmail,
          bids: selectedPackage.bids,
          design: selectedDesign.id,
          message: personalMessage
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Geschenk erfolgreich gesendet!');
        setRecipientEmail('');
        setPersonalMessage('');
        fetchData();
      } else {
        toast.error(data.detail || 'Fehler beim Senden');
      }
    } catch (err) {
      toast.error('Netzwerkfehler');
    } finally {
      setSending(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-pink-900/20 to-gray-900 pt-20 px-4">
        <div className="max-w-md mx-auto text-center py-16">
          <Gift className="w-16 h-16 text-pink-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">{t.title}</h1>
          <p className="text-gray-400 mb-6">{t.loginToUse}</p>
          <Button onClick={() => navigate('/login')} className="bg-pink-500 hover:bg-pink-600">
            {t.loginRequired}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-pink-900/20 to-gray-900 pt-20 pb-24 px-4" data-testid="gift-cards-page">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Gift className="w-10 h-10 text-pink-500" />
            <h1 className="text-3xl font-black text-white">{t.title}</h1>
          </div>
          <p className="text-gray-400">{t.subtitle}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'buy', label: t.sendGift, icon: <Send className="w-4 h-4" /> },
            { id: 'cards', label: t.myCards, icon: <CreditCard className="w-4 h-4" /> },
            { id: 'received', label: t.receivedGifts, icon: <Heart className="w-4 h-4" /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-pink-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Buy / Send Tab */}
        {activeTab === 'buy' && (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Left - Package Selection */}
            <div className="space-y-6">
              {/* Amount Selection */}
              <div className="bg-gray-800/80 backdrop-blur rounded-xl p-6 border border-pink-500/30">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-pink-500" />
                  {t.selectAmount}
                </h3>
                <div className="space-y-3">
                  {GIFT_PACKAGES.map((pkg) => (
                    <button
                      key={pkg.id}
                      onClick={() => setSelectedPackage(pkg)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${
                        selectedPackage.id === pkg.id
                          ? 'bg-pink-600/20 border-2 border-pink-500'
                          : 'bg-gray-700/50 border-2 border-transparent hover:border-pink-500/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-pink-500/20 rounded-full flex items-center justify-center text-pink-400 font-bold">
                          {pkg.bids}
                        </div>
                        <div className="text-left">
                          <p className="text-white font-bold">{pkg.bids} {t.bids}</p>
                          <p className="text-gray-400 text-sm">€{pkg.price.toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {pkg.popular && (
                          <span className="px-2 py-1 bg-orange-500 rounded text-xs font-bold text-white">
                            {t.popular}
                          </span>
                        )}
                        {pkg.bestValue && (
                          <span className="px-2 py-1 bg-green-500 rounded text-xs font-bold text-white">
                            {t.bestValue}
                          </span>
                        )}
                        {selectedPackage.id === pkg.id && (
                          <Check className="w-5 h-5 text-pink-500" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Design Selection */}
              <div className="bg-gray-800/80 backdrop-blur rounded-xl p-6 border border-pink-500/30">
                <h3 className="text-white font-bold mb-4">{t.giftDesign}</h3>
                <div className="grid grid-cols-4 gap-3">
                  {GIFT_DESIGNS.map((design) => (
                    <button
                      key={design.id}
                      onClick={() => setSelectedDesign(design)}
                      className={`aspect-square rounded-xl flex flex-col items-center justify-center text-2xl transition-all ${
                        selectedDesign.id === design.id
                          ? `bg-gradient-to-br ${design.color} border-2 border-white`
                          : 'bg-gray-700 hover:bg-gray-600 border-2 border-transparent'
                      }`}
                    >
                      {design.icon}
                      <span className="text-xs text-white mt-1">{t.designs[design.id]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right - Recipient & Preview */}
            <div className="space-y-6">
              {/* Recipient */}
              <div className="bg-gray-800/80 backdrop-blur rounded-xl p-6 border border-pink-500/30">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-pink-500" />
                  {t.recipient}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-gray-300 text-sm mb-1 block">{t.recipientEmail}</label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-pink-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-gray-300 text-sm mb-1 block">{t.message}</label>
                    <textarea
                      value={personalMessage}
                      onChange={(e) => setPersonalMessage(e.target.value)}
                      placeholder={t.personalMessage}
                      rows={3}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-pink-500 focus:outline-none resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className={`bg-gradient-to-br ${selectedDesign.color} rounded-xl p-6 text-white`}>
                <div className="text-center">
                  <p className="text-5xl mb-4">{selectedDesign.icon}</p>
                  <h3 className="text-2xl font-black mb-2">bidblitz.ae Geschenk</h3>
                  <p className="text-4xl font-black">{selectedPackage.bids} {t.bids}</p>
                  {personalMessage && (
                    <p className="mt-4 italic text-white/80">"{personalMessage}"</p>
                  )}
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm opacity-80">
                    <span>{t.from}: {user?.name || 'Du'}</span>
                    {recipientEmail && (
                      <>
                        <span>→</span>
                        <span>{t.to}: {recipientEmail}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Send Button */}
              <Button
                onClick={handleSendGift}
                disabled={!recipientEmail || sending}
                className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 py-4 text-lg font-bold disabled:opacity-50"
              >
                <Send className="w-5 h-5 mr-2" />
                {sending ? t.loading : `${t.send} (€${selectedPackage.price.toFixed(2)})`}
              </Button>
            </div>
          </div>
        )}

        {/* My Cards Tab */}
        {activeTab === 'cards' && (
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <Gift className="w-12 h-12 text-pink-500 mx-auto animate-pulse" />
                <p className="text-gray-400 mt-4">{t.loading}</p>
              </div>
            ) : myCards.length === 0 ? (
              <div className="text-center py-12 bg-gray-800/50 rounded-xl">
                <CreditCard className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 mb-2">{t.noCards}</p>
                <Button onClick={() => setActiveTab('buy')} className="bg-pink-600 hover:bg-pink-700">
                  {t.buyFirst}
                </Button>
              </div>
            ) : (
              myCards.map((card) => (
                <div
                  key={card.id}
                  className="bg-gray-800/80 backdrop-blur rounded-xl p-4 border border-pink-500/30 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-pink-500/20 rounded-full flex items-center justify-center text-2xl">
                      🎁
                    </div>
                    <div>
                      <p className="text-white font-bold">{card.bids} {t.bids}</p>
                      <p className="text-gray-400 text-sm">{t.to}: {card.recipient_email}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                    card.status === 'redeemed'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {card.status === 'redeemed' ? t.redeemed : t.sent}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Received Gifts Tab */}
        {activeTab === 'received' && (
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <Gift className="w-12 h-12 text-pink-500 mx-auto animate-pulse" />
                <p className="text-gray-400 mt-4">{t.loading}</p>
              </div>
            ) : receivedGifts.length === 0 ? (
              <div className="text-center py-12 bg-gray-800/50 rounded-xl">
                <Heart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">{t.noGifts}</p>
              </div>
            ) : (
              receivedGifts.map((gift) => (
                <div
                  key={gift.id}
                  className="bg-gradient-to-r from-pink-600/20 to-purple-600/20 backdrop-blur rounded-xl p-4 border border-pink-500/30"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-pink-500/30 rounded-full flex items-center justify-center text-2xl">
                        🎁
                      </div>
                      <div>
                        <p className="text-white font-bold">{gift.bids} {t.bids}</p>
                        <p className="text-gray-400 text-sm">{t.from}: {gift.sender_name}</p>
                        {gift.message && (
                          <p className="text-gray-300 text-sm italic mt-1">"{gift.message}"</p>
                        )}
                      </div>
                    </div>
                    <Check className="w-6 h-6 text-green-400" />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* How It Works */}
        <div className="mt-12 bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h3 className="text-white font-bold text-lg mb-6 text-center flex items-center justify-center gap-2">
            <Star className="w-5 h-5 text-pink-500" />
            {t.howItWorks}
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-pink-500/20 rounded-full flex items-center justify-center text-pink-400 font-bold text-xl mx-auto mb-3">1</div>
              <p className="text-white font-medium">{t.step1}</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-pink-500/20 rounded-full flex items-center justify-center text-pink-400 font-bold text-xl mx-auto mb-3">2</div>
              <p className="text-white font-medium">{t.step2}</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-pink-500/20 rounded-full flex items-center justify-center text-pink-400 font-bold text-xl mx-auto mb-3">3</div>
              <p className="text-white font-medium">{t.step3}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GiftCardsPage;
