import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { 
  Package, Gift, Crown, Zap, Star, Check, 
  Sparkles, TrendingUp, Clock, Shield
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const BundlesPage = () => {
  const { token, isAuthenticated, refreshUser } = useAuth();
  const { language , mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const [searchParams] = useSearchParams();
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);

  const texts = {
    de: {
      title: 'Bieter-Bundles',
      subtitle: 'Spare bis zu 50% mit unseren Kombi-Paketen!',
      popular: 'Beliebt',
      bestValue: 'Bester Wert',
      bids: 'Gebote',
      vipDays: 'Tage VIP',
      battlePass: 'Battle Pass',
      wheelSpins: 'Glücksrad-Spins',
      save: 'Spare',
      buyNow: 'Jetzt kaufen',
      includes: 'Enthält',
      loginToBuy: 'Anmelden zum Kaufen',
      purchaseSuccess: 'Bundle erfolgreich aktiviert!',
      processing: 'Verarbeitung...',
      originalPrice: 'Statt',
      monthlyBids: 'Gebote/Monat',
      subscription: 'Abo',
      securePayment: 'Sichere Zahlung',
      instantActivation: 'Sofortige Aktivierung',
      exclusiveDiscounts: 'Exklusive Rabatte'
    },
    en: {
      title: 'Bidder Bundles',
      subtitle: 'Save up to 50% with our combo packages!',
      popular: 'Popular',
      bestValue: 'Best Value',
      bids: 'Bids',
      vipDays: 'Days VIP',
      battlePass: 'Battle Pass',
      wheelSpins: 'Lucky Wheel Spins',
      save: 'Save',
      buyNow: 'Buy Now',
      includes: 'Includes',
      loginToBuy: 'Login to Buy',
      purchaseSuccess: 'Bundle activated successfully!',
      processing: 'Processing...',
      originalPrice: 'Was',
      monthlyBids: 'Bids/month',
      subscription: 'Subscription',
      securePayment: 'Secure Payment',
      instantActivation: 'Instant Activation',
      exclusiveDiscounts: 'Exclusive Discounts'
    },
    sq: {
      title: 'Paketat e Ofertuesve',
      subtitle: 'Kurse deri në 50% me paketat tona kombi!',
      popular: 'Popullor',
      bestValue: 'Vlera më e Mirë',
      bids: 'Oferta',
      vipDays: 'Ditë VIP',
      battlePass: 'Battle Pass',
      wheelSpins: 'Rrotullime Glücksrad',
      save: 'Kurse',
      buyNow: 'Bli Tani',
      includes: 'Përfshin',
      loginToBuy: 'Hyni për të Blerë',
      purchaseSuccess: 'Paketa u aktivizua me sukses!',
      processing: 'Duke u përpunuar...',
      originalPrice: 'Ishte',
      monthlyBids: 'Oferta/muaj',
      subscription: 'Abonim',
      securePayment: 'Pagesë e Sigurt',
      instantActivation: 'Aktivizim i Menjëhershëm',
      exclusiveDiscounts: 'Zbritje Ekskluzive'
    },
    xk: {
      title: 'Paketat e Ofertuesve',
      subtitle: 'Kurse deri në 50% me paketat tona kombi!',
      popular: 'Popullor',
      bestValue: 'Vlera më e Mirë',
      bids: 'Oferta',
      vipDays: 'Ditë VIP',
      battlePass: 'Battle Pass',
      wheelSpins: 'Rrotullime Glücksrad',
      save: 'Kurse',
      buyNow: 'Bli Tani',
      includes: 'Përfshin',
      loginToBuy: 'Hyni për të Blerë',
      purchaseSuccess: 'Paketa u aktivizua me sukses!',
      processing: 'Duke u përpunuar...',
      originalPrice: 'Ishte',
      monthlyBids: 'Oferta/muaj',
      subscription: 'Abonim',
      securePayment: 'Pagesë e Sigurt',
      instantActivation: 'Aktivizim i Menjëhershëm',
      exclusiveDiscounts: 'Zbritje Ekskluzive'
    },
    tr: {
      title: 'Teklif Paketleri',
      subtitle: 'Kombi paketlerimizle %50\'ye kadar tasarruf edin!',
      popular: 'Popüler',
      bestValue: 'En İyi Değer',
      bids: 'Teklifler',
      vipDays: 'Gün VIP',
      battlePass: 'Battle Pass',
      wheelSpins: 'Şans Çarkı Dönüşleri',
      save: 'Tasarruf',
      buyNow: 'Şimdi Al',
      includes: 'İçerir',
      loginToBuy: 'Satın Almak için Giriş Yapın',
      purchaseSuccess: 'Paket başarıyla aktifleştirildi!',
      processing: 'İşleniyor...',
      originalPrice: 'Önceki',
      monthlyBids: 'Teklif/ay',
      subscription: 'Abonelik',
      securePayment: 'Güvenli Ödeme',
      instantActivation: 'Anında Aktivasyon',
      exclusiveDiscounts: 'Özel İndirimler'
    },
    fr: {
      title: 'Packs Enchérisseur',
      subtitle: 'Économisez jusqu\'à 50% avec nos packs combo!',
      popular: 'Populaire',
      bestValue: 'Meilleure Valeur',
      bids: 'Enchères',
      vipDays: 'Jours VIP',
      battlePass: 'Battle Pass',
      wheelSpins: 'Tours de Roue',
      save: 'Économisez',
      buyNow: 'Acheter',
      includes: 'Inclus',
      loginToBuy: 'Connectez-vous pour Acheter',
      purchaseSuccess: 'Pack activé avec succès!',
      processing: 'Traitement...',
      originalPrice: 'Avant',
      monthlyBids: 'Enchères/mois',
      subscription: 'Abonnement',
      securePayment: 'Paiement Sécurisé',
      instantActivation: 'Activation Instantanée',
      exclusiveDiscounts: 'Réductions Exclusives'
    }
  };
  const t = texts[langKey] || texts.de;

  useEffect(() => {
    fetchBundles();
    
    // Handle success redirect
    if (searchParams.get('success') === 'true') {
      const bundleId = searchParams.get('bundle');
      if (bundleId) {
        fulfillBundle(bundleId);
      }
    }
  }, [searchParams]);

  const fetchBundles = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API}/api/bundles/available`, { headers });
      setBundles(res.data.bundles || []);
    } catch (err) {
      console.error('Error fetching bundles:', err);
    } finally {
      setLoading(false);
    }
  };

  const fulfillBundle = async (bundleId) => {
    try {
      await axios.post(`${API}/api/bundles/fulfill/${bundleId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(t.purchaseSuccess);
      refreshUser();
    } catch (err) {
      console.error('Fulfill error:', err);
    }
  };

  const handlePurchase = async (bundleId) => {
    if (!isAuthenticated) {
      toast.error(t.loginToBuy);
      return;
    }
    
    setPurchasing(bundleId);
    try {
      const res = await axios.post(`${API}/api/bundles/purchase/${bundleId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      window.location.href = res.data.checkout_url;
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler');
      setPurchasing(null);
    }
  };

  const getIcon = (iconStr) => {
    const icons = { '🌟': Star, '🚀': TrendingUp, '👑': Crown, '💎': Sparkles };
    return icons[iconStr] || Gift;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-96 bg-white rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4" data-testid="bundles-page">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 mb-4">
            <Package className="w-5 h-5 text-purple-400" />
            <span className="text-purple-400 font-bold">Bundles</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-3">{t.title}</h1>
          <p className="text-gray-500 text-lg">{t.subtitle}</p>
        </div>

        {/* Bundles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {bundles.map(bundle => {
            const IconComponent = getIcon(bundle.icon);
            
            return (
              <div 
                key={bundle.id}
                className={`relative glass-card rounded-2xl overflow-hidden transition-transform hover:scale-105 ${
                  bundle.popular ? 'ring-2 ring-purple-500' : ''
                }`}
                style={{ borderColor: `${bundle.color}40` }}
                data-testid={`bundle-${bundle.id}`}
              >
                {/* Popular/Best Value Badge */}
                {(bundle.popular || bundle.best_value) && (
                  <div 
                    className="absolute top-0 right-0 px-3 py-1 text-xs font-bold text-black"
                    style={{ backgroundColor: bundle.color }}
                  >
                    {bundle.popular ? t.popular : t.bestValue}
                  </div>
                )}
                
                {/* Header */}
                <div 
                  className="p-6 text-center"
                  style={{ background: `linear-gradient(180deg, ${bundle.color}20 0%, transparent 100%)` }}
                >
                  <span className="text-5xl mb-3 block">{bundle.icon}</span>
                  <h3 className="text-xl font-bold text-gray-800">{language === 'de' ? bundle.name_de : bundle.name}</h3>
                  <p className="text-gray-500 text-sm mt-1">
                    {language === 'de' ? bundle.description_de : bundle.description}
                  </p>
                </div>
                
                {/* Price */}
                <div className="px-6 py-4 text-center border-t border-gray-200">
                  <div className="text-gray-500 line-through text-sm">
                    {t.originalPrice} €{bundle.original_price?.toFixed(2)}
                  </div>
                  <div className="text-3xl font-bold text-gray-800">
                    €{bundle.price?.toFixed(2)}
                  </div>
                  <div 
                    className="inline-block px-2 py-1 rounded text-xs font-bold mt-1"
                    style={{ backgroundColor: `${bundle.color}30`, color: bundle.color }}
                  >
                    {t.save} {bundle.savings_percent}%
                  </div>
                </div>
                
                {/* Features */}
                <div className="px-6 py-4 space-y-3">
                  <div className="flex items-center gap-2 text-gray-800">
                    <Check className="w-4 h-4 text-green-400" />
                    <span>{bundle.bids} {t.bids}</span>
                    {bundle.bids_monthly && (
                      <span className="text-xs text-gray-500">+{bundle.bids_monthly} {t.monthlyBids}</span>
                    )}
                  </div>
                  
                  {bundle.vip_days > 0 && (
                    <div className="flex items-center gap-2 text-gray-800">
                      <Check className="w-4 h-4 text-green-400" />
                      <span>{bundle.vip_days} {t.vipDays}</span>
                    </div>
                  )}
                  
                  {bundle.battle_pass && (
                    <div className="flex items-center gap-2 text-gray-800">
                      <Check className="w-4 h-4 text-green-400" />
                      <span>{t.battlePass} {bundle.battle_pass_premium ? 'Premium' : ''}</span>
                    </div>
                  )}
                  
                  {bundle.wheel_spins > 0 && (
                    <div className="flex items-center gap-2 text-gray-800">
                      <Check className="w-4 h-4 text-green-400" />
                      <span>{bundle.wheel_spins} {t.wheelSpins}</span>
                    </div>
                  )}
                  
                  {bundle.is_subscription && (
                    <div className="flex items-center gap-2 text-yellow-400 text-sm">
                      <Clock className="w-4 h-4" />
                      <span>{t.subscription}</span>
                    </div>
                  )}
                </div>
                
                {/* CTA */}
                <div className="p-6 pt-0">
                  <Button
                    onClick={() => handlePurchase(bundle.id)}
                    disabled={purchasing === bundle.id}
                    className="w-full h-12 font-bold text-black"
                    style={{ backgroundColor: bundle.color }}
                  >
                    {purchasing === bundle.id ? (
                      <>{t.processing}</>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        {isAuthenticated ? t.buyNow : t.loginToBuy}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Trust Badges */}
        <div className="mt-12 flex flex-wrap justify-center gap-6 text-gray-500 text-sm">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-400" />
            <span>{t.securePayment}</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            <span>{t.instantActivation}</span>
          </div>
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-purple-400" />
            <span>{t.exclusiveDiscounts}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BundlesPage;
