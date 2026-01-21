import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { usePageTranslations } from '../i18n/pageTranslations';
import { Button } from '../components/ui/button';
import { Zap, Check, Sparkles, CreditCard, Bitcoin, X } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Page-specific translations
const buyBidsTexts = {
  de: {
    title: "Gebote kaufen",
    subtitle: "Wählen Sie ein Paket und beginnen Sie mit dem Bieten",
    cryptoSuccess: "Krypto-Zahlung erfolgreich! Gebote werden gutgeschrieben.",
    cryptoCancel: "Krypto-Zahlung abgebrochen",
    loadError: "Fehler beim Laden der Pakete",
    loginRequired: "Bitte melden Sie sich an, um Gebote zu kaufen",
    mostPopular: "Beliebteste",
    bestValue: "Bester Wert",
    bids: "Gebote",
    bonus: "Bonus",
    perBid: "pro Gebot",
    selectPackage: "Paket auswählen",
    paymentMethod: "Zahlungsmethode",
    card: "Karte",
    crypto: "Krypto",
    cryptoUnavailable: "Krypto-Zahlungen derzeit nicht verfügbar",
    pay: "Bezahlen",
    processing: "Wird verarbeitet...",
    cancel: "Abbrechen",
    securePayment: "Sichere Zahlung über Stripe"
  },
  en: {
    title: "Buy Bids",
    subtitle: "Choose a package and start bidding",
    cryptoSuccess: "Crypto payment successful! Bids being credited.",
    cryptoCancel: "Crypto payment cancelled",
    loadError: "Error loading packages",
    loginRequired: "Please log in to buy bids",
    mostPopular: "Most Popular",
    bestValue: "Best Value",
    bids: "Bids",
    bonus: "Bonus",
    perBid: "per bid",
    selectPackage: "Select Package",
    paymentMethod: "Payment Method",
    card: "Card",
    crypto: "Crypto",
    cryptoUnavailable: "Crypto payments currently unavailable",
    pay: "Pay",
    processing: "Processing...",
    cancel: "Cancel",
    securePayment: "Secure payment via Stripe"
  },
  sq: {
    title: "Bli Oferta",
    subtitle: "Zgjidhni një paketë dhe filloni të ofroni",
    cryptoSuccess: "Pagesa kripto me sukses! Ofertat po kreditohen.",
    cryptoCancel: "Pagesa kripto u anulua",
    loadError: "Gabim në ngarkimin e paketave",
    loginRequired: "Ju lutem hyni për të blerë oferta",
    mostPopular: "Më i Popullarizuar",
    bestValue: "Vlera më e Mirë",
    bids: "Oferta",
    bonus: "Bonus",
    perBid: "për ofertë",
    selectPackage: "Zgjidh Paketën",
    paymentMethod: "Metoda e Pagesës",
    card: "Kartë",
    crypto: "Kripto",
    cryptoUnavailable: "Pagesat kripto aktualisht nuk janë të disponueshme",
    pay: "Paguaj",
    processing: "Duke procesuar...",
    cancel: "Anulo",
    securePayment: "Pagesë e sigurt përmes Stripe"
  },
  tr: {
    title: "Teklif Satın Al",
    subtitle: "Bir paket seçin ve teklif vermeye başlayın",
    cryptoSuccess: "Kripto ödeme başarılı! Teklifler kredileniyor.",
    cryptoCancel: "Kripto ödeme iptal edildi",
    loadError: "Paketler yüklenirken hata",
    loginRequired: "Teklif satın almak için lütfen giriş yapın",
    mostPopular: "En Popüler",
    bestValue: "En İyi Değer",
    bids: "Teklif",
    bonus: "Bonus",
    perBid: "teklif başına",
    selectPackage: "Paket Seç",
    paymentMethod: "Ödeme Yöntemi",
    card: "Kart",
    crypto: "Kripto",
    cryptoUnavailable: "Kripto ödemeleri şu anda kullanılamıyor",
    pay: "Öde",
    processing: "İşleniyor...",
    cancel: "İptal",
    securePayment: "Stripe ile güvenli ödeme"
  },
  fr: {
    title: "Acheter des Enchères",
    subtitle: "Choisissez un forfait et commencez à enchérir",
    cryptoSuccess: "Paiement crypto réussi! Enchères en cours de crédit.",
    cryptoCancel: "Paiement crypto annulé",
    loadError: "Erreur de chargement des forfaits",
    loginRequired: "Veuillez vous connecter pour acheter des enchères",
    mostPopular: "Plus Populaire",
    bestValue: "Meilleure Valeur",
    bids: "Enchères",
    bonus: "Bonus",
    perBid: "par enchère",
    selectPackage: "Sélectionner le Forfait",
    paymentMethod: "Mode de Paiement",
    card: "Carte",
    crypto: "Crypto",
    cryptoUnavailable: "Paiements crypto actuellement indisponibles",
    pay: "Payer",
    processing: "Traitement...",
    cancel: "Annuler",
    securePayment: "Paiement sécurisé via Stripe"
  }
};

export default function BuyBids() {
  const { language } = useLanguage();
  const texts = buyBidsTexts[language] || buyBidsTexts.de;
  const { isAuthenticated, token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('stripe');
  const [paymentMethods, setPaymentMethods] = useState({ stripe: true, crypto: false, paypal: false });

  useEffect(() => {
    fetchPackages();
    fetchPaymentMethods();
    
    // Check for crypto callback
    if (searchParams.get('crypto_success')) {
      toast.success(texts.cryptoSuccess);
    }
    if (searchParams.get('crypto_cancel')) {
      toast.info(texts.cryptoCancel);
    }
  }, [searchParams]);

  const fetchPaymentMethods = async () => {
    try {
      const response = await axios.get(`${API}/checkout/payment-methods`);
      setPaymentMethods(response.data);
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    }
  };

  const fetchPackages = async () => {
    try {
      const response = await axios.get(`${API}/bid-packages`);
      setPackages(response.data);
    } catch (error) {
      console.error('Error fetching packages:', error);
      toast.error(texts.loadError);
    } finally {
      setLoading(false);
    }
  };

  const openPaymentModal = (pkg) => {
    if (!isAuthenticated) {
      toast.error(texts.loginRequired);
      navigate('/login');
      return;
    }
    setSelectedPackage(pkg);
    setShowPaymentModal(true);
  };

  const handlePurchase = async () => {
    if (!selectedPackage) return;
    
    setPurchasing(selectedPackage.id);
    
    try {
      if (paymentMethod === 'stripe') {
        // Stripe checkout
        const response = await axios.post(
          `${API}/checkout/create-session`,
          {
            package_id: selectedPackage.id,
            origin_url: window.location.origin
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        window.location.href = response.data.url;
      } else if (paymentMethod === 'crypto') {
        // Coinbase Commerce checkout
        const response = await axios.post(
          `${API}/checkout/create-crypto-charge?package_id=${selectedPackage.id}&bids=${selectedPackage.bids}&price=${selectedPackage.price}`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        // Redirect to Coinbase Commerce hosted page
        window.location.href = response.data.hosted_url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error(error.response?.data?.detail || 'Fehler beim Erstellen der Zahlung');
      setPurchasing(null);
    }
  };

  const getPackageFeatures = (pkg) => {
    const totalBids = pkg.bids + (pkg.bonus || 0);
    const pricePerBid = (pkg.price / totalBids).toFixed(2);
    const features = [
      `${pkg.bids} ${texts.bids}`,
    ];
    
    if (pkg.bonus > 0) {
      features.push(`+${pkg.bonus} ${language === 'en' ? 'FREE' : language === 'sq' ? 'FALAS' : language === 'tr' ? 'ÜCRETSİZ' : language === 'fr' ? 'GRATUIT' : 'GRATIS'} ${texts.bids}`);
    }
    
    features.push(`€${pricePerBid} ${texts.perBid}`);
    features.push(language === 'en' ? 'Instantly available' : language === 'sq' ? 'Menjëherë i disponueshëm' : language === 'tr' ? 'Anında kullanılabilir' : language === 'fr' ? 'Disponible immédiatement' : 'Sofort verfügbar');
    features.push(language === 'en' ? 'No expiry date' : language === 'sq' ? 'Pa datë skadence' : language === 'tr' ? 'Son kullanma tarihi yok' : language === 'fr' ? 'Pas de date d\'expiration' : 'Kein Ablaufdatum');
    
    return features;
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4" data-testid="buy-bids-page">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#181824] border border-white/10 mb-6">
            <Sparkles className="w-4 h-4 text-[#F59E0B]" />
            <span className="text-sm text-[#94A3B8]">{language === 'en' ? 'Best prices guaranteed' : language === 'sq' ? 'Çmimet më të mira të garantuara' : language === 'tr' ? 'En iyi fiyatlar garantili' : language === 'fr' ? 'Meilleurs prix garantis' : 'Beste Preise garantiert'}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            {texts.title}
          </h1>
          <p className="text-[#94A3B8] text-lg max-w-2xl mx-auto">
            {texts.subtitle}
          </p>
          
          {/* Payment Methods Info */}
          <div className="mt-6 flex items-center justify-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#181824] border border-white/10">
              <CreditCard className="w-4 h-4 text-[#7C3AED]" />
              <span className="text-xs text-[#94A3B8]">{language === 'en' ? 'Credit Card' : language === 'sq' ? 'Kartë Krediti' : language === 'tr' ? 'Kredi Kartı' : language === 'fr' ? 'Carte de Crédit' : 'Kreditkarte'}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#181824] border border-white/10">
              <Bitcoin className="w-4 h-4 text-[#F7931A]" />
              <span className="text-xs text-[#94A3B8]">Bitcoin & Crypto</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#181824] border border-white/10">
              <span className="text-xs text-[#94A3B8]">SEPA • Klarna • PayPal</span>
            </div>
          </div>
        </div>

        {/* Packages Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="glass-card rounded-2xl p-6 animate-pulse">
                <div className="h-8 bg-[#181824] rounded mb-4" />
                <div className="h-16 bg-[#181824] rounded mb-6" />
                <div className="space-y-3">
                  {[...Array(4)].map((_, j) => (
                    <div key={j} className="h-4 bg-[#181824] rounded" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className={`relative glass-card rounded-2xl p-6 transition-all hover:-translate-y-2 ${
                  pkg.popular ? 'border-2 border-[#7C3AED] glow-primary' : ''
                }`}
                data-testid={`package-${pkg.id}`}
              >
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="badge-popular">{texts.mostPopular}</span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-white mb-2">{pkg.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-[#06B6D4] font-mono">
                      €{pkg.price.toFixed(0)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 py-4 mb-2 rounded-lg bg-[#181824]">
                  <Zap className="w-6 h-6 text-[#F59E0B]" />
                  <span className="text-2xl font-bold text-white">{pkg.bids}</span>
                  <span className="text-[#94A3B8]">{texts.bids}</span>
                </div>
                
                {/* Bonus Bids */}
                {pkg.bonus > 0 && (
                  <div className="text-center mb-4">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm font-semibold">
                      <Sparkles className="w-4 h-4" />
                      +{pkg.bonus} {language === 'en' ? 'FREE Bids!' : language === 'sq' ? 'Oferta FALAS!' : language === 'tr' ? 'ÜCRETSİZ Teklif!' : language === 'fr' ? 'Enchères GRATUITES!' : 'GRATIS Gebote!'}
                    </span>
                  </div>
                )}
                
                {/* Price per bid */}
                {pkg.per_bid && (
                  <div className="text-center text-gray-400 text-sm mb-4">
                    {language === 'en' ? 'Only' : language === 'sq' ? 'Vetëm' : language === 'tr' ? 'Sadece' : language === 'fr' ? 'Seulement' : 'Nur'} €{pkg.per_bid.toFixed(2)} {texts.perBid}
                  </div>
                )}

                <ul className="space-y-3 mb-6">
                  {getPackageFeatures(pkg).map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-[#94A3B8]">
                      <Check className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => openPaymentModal(pkg)}
                  disabled={purchasing === pkg.id}
                  className={`w-full py-3 h-auto ${
                    pkg.popular ? 'btn-bid' : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                  data-testid={`buy-${pkg.id}`}
                >
                  {purchasing === pkg.id ? (
                    texts.processing
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      {language === 'en' ? 'Buy Now' : language === 'sq' ? 'Bli Tani' : language === 'tr' ? 'Şimdi Satın Al' : language === 'fr' ? 'Acheter' : 'Jetzt kaufen'}
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Info Section */}
        <div className="mt-16 glass-card rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">Wie funktionieren Gebote?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#7C3AED]/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-[#7C3AED]">1</span>
              </div>
              <h3 className="font-bold text-white mb-2">Gebot platzieren</h3>
              <p className="text-[#94A3B8] text-sm">
                Jedes Mal, wenn Sie bieten, wird ein Gebot von Ihrem Konto abgezogen.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#06B6D4]/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-[#06B6D4]">2</span>
              </div>
              <h3 className="font-bold text-white mb-2">Preis erhöht sich</h3>
              <p className="text-[#94A3B8] text-sm">
                Der Auktionspreis steigt um wenige Cent und der Timer wird zurückgesetzt.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#10B981]/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-[#10B981]">3</span>
              </div>
              <h3 className="font-bold text-white mb-2">Gewinnen</h3>
              <p className="text-[#94A3B8] text-sm">
                Der letzte Bieter gewinnt das Produkt zum aktuellen Auktionspreis.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Method Modal */}
      {showPaymentModal && selectedPackage && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-md relative">
            <button 
              onClick={() => {
                setShowPaymentModal(false);
                setPurchasing(null);
              }}
              className="absolute top-4 right-4 text-[#94A3B8] hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-xl font-bold text-white mb-2">Zahlungsmethode wählen</h2>
            <p className="text-[#94A3B8] text-sm mb-6">
              {selectedPackage.bids} Gebote für €{selectedPackage.price.toFixed(2)}
            </p>

            <div className="space-y-3 mb-6">
              {/* Stripe Option */}
              <button
                onClick={() => setPaymentMethod('stripe')}
                className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                  paymentMethod === 'stripe' 
                    ? 'border-[#7C3AED] bg-[#7C3AED]/10' 
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className="w-12 h-12 rounded-lg bg-[#635BFF]/20 flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-[#635BFF]" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-medium">Karte / Klarna / SEPA</p>
                  <p className="text-[#94A3B8] text-xs">Kreditkarte, Klarna, SEPA Lastschrift, Google Pay, Apple Pay</p>
                </div>
                {paymentMethod === 'stripe' && (
                  <Check className="w-5 h-5 text-[#7C3AED]" />
                )}
              </button>

              {/* Crypto Option */}
              <button
                onClick={() => paymentMethods.crypto && setPaymentMethod('crypto')}
                disabled={!paymentMethods.crypto}
                className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                  !paymentMethods.crypto 
                    ? 'border-white/5 opacity-50 cursor-not-allowed'
                    : paymentMethod === 'crypto' 
                      ? 'border-[#F7931A] bg-[#F7931A]/10' 
                      : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className="w-12 h-12 rounded-lg bg-[#F7931A]/20 flex items-center justify-center">
                  <Bitcoin className="w-6 h-6 text-[#F7931A]" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-medium">Kryptowährung</p>
                  {paymentMethods.crypto ? (
                    <p className="text-[#94A3B8] text-xs">Bitcoin, Ethereum, Litecoin, USDC, Dogecoin & mehr</p>
                  ) : (
                    <p className="text-orange-400 text-xs">Derzeit nicht verfügbar</p>
                  )}
                </div>
                {paymentMethod === 'crypto' && paymentMethods.crypto && (
                  <Check className="w-5 h-5 text-[#F7931A]" />
                )}
              </button>
            </div>

            <Button
              onClick={handlePurchase}
              disabled={purchasing}
              className="w-full py-3 h-auto btn-bid"
            >
              {purchasing ? (
                'Wird geladen...'
              ) : paymentMethod === 'crypto' ? (
                <>
                  <Bitcoin className="w-4 h-4 mr-2" />
                  Mit Krypto bezahlen
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Weiter zur Zahlung
                </>
              )}
            </Button>

            <p className="text-[#94A3B8] text-xs text-center mt-4">
              Sichere Zahlung über {paymentMethod === 'crypto' ? 'Coinbase Commerce' : 'Stripe'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
