import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import { 
  Crown, 
  Check, 
  Sparkles, 
  Zap, 
  Gift,
  Shield,
  Star,
  ChevronRight
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// VIP page translations
const vipTexts = {
  de: {
    title: "VIP-Mitgliedschaft",
    subtitle: "Exklusive Vorteile für echte Schnäppchenjäger",
    currentPlan: "Aktueller Plan",
    freeMember: "Gratis-Mitglied",
    vipMember: "VIP-Mitglied",
    validUntil: "Gültig bis",
    choosePlan: "Plan wählen",
    month: "Monat",
    popular: "Beliebt",
    bestValue: "Bester Wert",
    subscribe: "Abonnieren",
    subscribing: "Wird abonniert...",
    benefits: "Ihre Vorteile",
    bonusBids: "Bonus-Gebote monatlich",
    vipAuctions: "Zugang zu VIP-Auktionen",
    prioritySupport: "Prioritäts-Support",
    exclusiveOffers: "Exklusive Angebote",
    noAutoRenewal: "Keine automatische Verlängerung",
    cancelAnytime: "Jederzeit kündbar",
    paymentCanceled: "Zahlung abgebrochen",
    subscriptionActive: "VIP-Mitgliedschaft aktiviert!",
    loginRequired: "Bitte melden Sie sich an",
    perMonth: "pro Monat",
    active: "Aktiv",
    unlimited: "Unbegrenzt",
    currentSub: "Aktuelles Abo",
    becomeVip: "Jetzt VIP werden",
    processing: "Wird verarbeitet...",
    whyVip: "Warum VIP werden?",
    freeBids: "Gratis-Gebote",
    freeBidsDesc: "Jeden Monat neue Gebote automatisch auf Ihr Konto",
    discounts: "Rabatte",
    discountsDesc: "Bis zu 15% Rabatt auf alle Gebotspakete",
    exclusive: "Exklusiv",
    exclusiveDesc: "Zugang zu exklusiven Auktionen nur für VIPs",
    support: "Support",
    supportDesc: "Prioritäts-Support für alle Ihre Fragen",
    vipQuestions: "Fragen zu VIP?",
    findAnswersHere: "Hier finden Sie Antworten",
    cancelConfirm: "Möchten Sie Ihr VIP-Abo wirklich kündigen?",
    cancelFailed: "Kündigung fehlgeschlagen"
  },
  en: {
    title: "VIP Membership",
    subtitle: "Exclusive benefits for real bargain hunters",
    currentPlan: "Current Plan",
    freeMember: "Free Member",
    vipMember: "VIP Member",
    validUntil: "Valid until",
    choosePlan: "Choose Plan",
    month: "Month",
    popular: "Popular",
    bestValue: "Best Value",
    subscribe: "Subscribe",
    subscribing: "Subscribing...",
    benefits: "Your Benefits",
    bonusBids: "Bonus bids monthly",
    vipAuctions: "Access to VIP auctions",
    prioritySupport: "Priority support",
    exclusiveOffers: "Exclusive offers",
    noAutoRenewal: "No automatic renewal",
    cancelAnytime: "Cancel anytime",
    paymentCanceled: "Payment canceled",
    subscriptionActive: "VIP membership activated!",
    loginRequired: "Please log in",
    perMonth: "per month",
    active: "Active",
    unlimited: "Unlimited",
    currentSub: "Current subscription",
    becomeVip: "Become VIP now",
    processing: "Processing...",
    whyVip: "Why become VIP?",
    freeBids: "Free Bids",
    freeBidsDesc: "New bids automatically added to your account every month",
    discounts: "Discounts",
    discountsDesc: "Up to 15% discount on all bid packages",
    exclusive: "Exclusive",
    exclusiveDesc: "Access to exclusive auctions only for VIPs",
    support: "Support",
    supportDesc: "Priority support for all your questions",
    vipQuestions: "Questions about VIP?",
    findAnswersHere: "Find answers here",
    cancelConfirm: "Do you really want to cancel your VIP subscription?",
    cancelFailed: "Cancellation failed"
  },
  sq: {
    title: "Anëtarësimi VIP",
    subtitle: "Përfitime ekskluzive për gjuetarët e vërtetë të ofertave",
    currentPlan: "Plani Aktual",
    freeMember: "Anëtar Falas",
    vipMember: "Anëtar VIP",
    validUntil: "I vlefshëm deri më",
    choosePlan: "Zgjidhni Planin",
    month: "Muaj",
    popular: "Popullor",
    bestValue: "Vlera më e Mirë",
    subscribe: "Abonohu",
    subscribing: "Duke u abonuar...",
    benefits: "Përfitimet Tuaja",
    bonusBids: "Oferta bonus mujore",
    vipAuctions: "Qasje në ankande VIP",
    prioritySupport: "Mbështetje me prioritet",
    exclusiveOffers: "Oferta ekskluzive",
    noAutoRenewal: "Pa rinovim automatik",
    cancelAnytime: "Anuloni në çdo kohë",
    paymentCanceled: "Pagesa u anulua",
    subscriptionActive: "Anëtarësimi VIP u aktivizua!",
    loginRequired: "Ju lutem hyni",
    perMonth: "për muaj",
    active: "Aktiv",
    unlimited: "Pa limit",
    currentSub: "Abonamenti aktual",
    becomeVip: "Bëhu VIP tani",
    processing: "Duke u përpunuar...",
    whyVip: "Pse të bëheni VIP?",
    freeBids: "Oferta Falas",
    freeBidsDesc: "Oferta të reja shtohen automatikisht çdo muaj",
    discounts: "Zbritje",
    discountsDesc: "Deri në 15% zbritje në të gjitha paketat",
    exclusive: "Ekskluziv",
    exclusiveDesc: "Qasje në ankande ekskluzive vetëm për VIP",
    support: "Mbështetje",
    supportDesc: "Mbështetje me prioritet për të gjitha pyetjet tuaja",
    vipQuestions: "Pyetje për VIP?",
    findAnswersHere: "Gjeni përgjigjet këtu",
    cancelConfirm: "Dëshironi të anuloni abonimin VIP?",
    cancelFailed: "Anulimi dështoi"
  },
  xk: {
    title: "Anëtarësimi VIP",
    subtitle: "Përfitime ekskluzive për gjuetarët e vërtetë të ofertave",
    currentPlan: "Plani Aktual",
    freeMember: "Anëtar Falas",
    vipMember: "Anëtar VIP",
    validUntil: "I vlefshëm deri më",
    choosePlan: "Zgjidhni Planin",
    month: "Muaj",
    popular: "Popullor",
    bestValue: "Vlera më e Mirë",
    subscribe: "Abonohu",
    subscribing: "Duke u abonuar...",
    benefits: "Përfitimet Tuaja",
    bonusBids: "Oferta bonus mujore",
    vipAuctions: "Qasje në ankande VIP",
    prioritySupport: "Mbështetje me prioritet",
    exclusiveOffers: "Oferta ekskluzive",
    noAutoRenewal: "Pa rinovim automatik",
    cancelAnytime: "Anuloni në çdo kohë",
    paymentCanceled: "Pagesa u anulua",
    subscriptionActive: "Anëtarësimi VIP u aktivizua!",
    loginRequired: "Ju lutem hyni",
    perMonth: "për muaj",
    active: "Aktiv",
    unlimited: "Pa limit",
    currentSub: "Abonamenti aktual",
    becomeVip: "Bëhu VIP tani",
    processing: "Duke u përpunuar...",
    whyVip: "Pse të bëheni VIP?",
    freeBids: "Oferta Falas",
    freeBidsDesc: "Oferta të reja shtohen automatikisht çdo muaj",
    discounts: "Zbritje",
    discountsDesc: "Deri në 15% zbritje në të gjitha paketat",
    exclusive: "Ekskluziv",
    exclusiveDesc: "Qasje në ankande ekskluzive vetëm për VIP",
    support: "Mbështetje",
    supportDesc: "Mbështetje me prioritet për të gjitha pyetjet tuaja",
    vipQuestions: "Pyetje për VIP?",
    findAnswersHere: "Gjeni përgjigjet këtu",
    cancelConfirm: "Dëshironi të anuloni abonimin VIP?",
    cancelFailed: "Anulimi dështoi"
  },
  tr: {
    title: "VIP Üyelik",
    subtitle: "Gerçek fırsat avcıları için özel avantajlar",
    currentPlan: "Mevcut Plan",
    freeMember: "Ücretsiz Üye",
    vipMember: "VIP Üye",
    validUntil: "Geçerlilik",
    choosePlan: "Plan Seçin",
    month: "Ay",
    popular: "Popüler",
    bestValue: "En İyi Değer",
    subscribe: "Abone Ol",
    subscribing: "Abone olunuyor...",
    benefits: "Avantajlarınız",
    bonusBids: "Aylık bonus teklifler",
    vipAuctions: "VIP açık artırmalara erişim",
    prioritySupport: "Öncelikli destek",
    exclusiveOffers: "Özel teklifler",
    noAutoRenewal: "Otomatik yenileme yok",
    cancelAnytime: "İstediğiniz zaman iptal edin",
    paymentCanceled: "Ödeme iptal edildi",
    subscriptionActive: "VIP üyelik aktifleştirildi!",
    loginRequired: "Lütfen giriş yapın",
    perMonth: "aylık",
    active: "Aktif",
    unlimited: "Sınırsız",
    currentSub: "Mevcut abonelik",
    becomeVip: "Şimdi VIP ol",
    processing: "İşleniyor...",
    whyVip: "Neden VIP olmalısınız?",
    freeBids: "Ücretsiz Teklifler",
    freeBidsDesc: "Her ay otomatik olarak yeni teklifler hesabınıza eklenir",
    discounts: "İndirimler",
    discountsDesc: "Tüm teklif paketlerinde %15'e kadar indirim",
    exclusive: "Özel",
    exclusiveDesc: "Sadece VIP'ler için özel açık artırmalara erişim",
    support: "Destek",
    supportDesc: "Tüm sorularınız için öncelikli destek",
    vipQuestions: "VIP hakkında sorularınız mı var?",
    findAnswersHere: "Cevapları burada bulun",
    cancelConfirm: "VIP aboneliğinizi iptal etmek istediğinizden emin misiniz?",
    cancelFailed: "İptal başarısız"
  },
  fr: {
    title: "Adhésion VIP",
    subtitle: "Avantages exclusifs pour les vrais chasseurs de bonnes affaires",
    currentPlan: "Plan Actuel",
    freeMember: "Membre Gratuit",
    vipMember: "Membre VIP",
    validUntil: "Valable jusqu'au",
    choosePlan: "Choisir un Plan",
    month: "Mois",
    popular: "Populaire",
    bestValue: "Meilleure Valeur",
    subscribe: "S'abonner",
    subscribing: "Abonnement...",
    benefits: "Vos Avantages",
    bonusBids: "Enchères bonus mensuelles",
    vipAuctions: "Accès aux enchères VIP",
    prioritySupport: "Support prioritaire",
    exclusiveOffers: "Offres exclusives",
    noAutoRenewal: "Pas de renouvellement automatique",
    cancelAnytime: "Annulez à tout moment",
    paymentCanceled: "Paiement annulé",
    subscriptionActive: "Adhésion VIP activée!",
    loginRequired: "Veuillez vous connecter",
    perMonth: "par mois",
    active: "Actif",
    unlimited: "Illimité",
    currentSub: "Abonnement actuel",
    becomeVip: "Devenez VIP maintenant",
    processing: "Traitement...",
    whyVip: "Pourquoi devenir VIP?",
    freeBids: "Enchères Gratuites",
    freeBidsDesc: "Nouvelles enchères ajoutées automatiquement chaque mois",
    discounts: "Réductions",
    discountsDesc: "Jusqu'à 15% de réduction sur tous les forfaits",
    exclusive: "Exclusif",
    exclusiveDesc: "Accès aux enchères exclusives réservées aux VIP",
    support: "Support",
    supportDesc: "Support prioritaire pour toutes vos questions",
    vipQuestions: "Questions sur VIP?",
    findAnswersHere: "Trouvez les réponses ici",
    cancelConfirm: "Voulez-vous vraiment annuler votre abonnement VIP?",
    cancelFailed: "Échec de l'annulation"
  }
};

// Benefit translations - from German backend to other languages
const benefitTranslations = {
  de: {
    "Gratis-Gebote pro Monat": "Gratis-Gebote pro Monat",
    "Rabatt auf Gebotspakete": "Rabatt auf Gebotspakete",
    "VIP Badge im Profil": "VIP Badge im Profil",
    "Zugang zu VIP-Auktionen": "Zugang zu VIP-Auktionen",
    "Prioritäts-Support": "Prioritäts-Support",
    "Exklusive Rabattcodes": "Exklusive Rabattcodes",
    "Persönlicher Berater": "Persönlicher Berater"
  },
  en: {
    "Gratis-Gebote pro Monat": "Free bids per month",
    "Rabatt auf Gebotspakete": "Discount on bid packages",
    "VIP Badge im Profil": "VIP Badge in profile",
    "Zugang zu VIP-Auktionen": "Access to VIP auctions",
    "Prioritäts-Support": "Priority support",
    "Exklusive Rabattcodes": "Exclusive discount codes",
    "Persönlicher Berater": "Personal advisor"
  },
  sq: {
    "Gratis-Gebote pro Monat": "Oferta falas për muaj",
    "Rabatt auf Gebotspakete": "Zbritje në paketat e ofertave",
    "VIP Badge im Profil": "Distinktiv VIP në profil",
    "Zugang zu VIP-Auktionen": "Qasje në ankandet VIP",
    "Prioritäts-Support": "Mbështetje me prioritet",
    "Exklusive Rabattcodes": "Kode zbritje ekskluzive",
    "Persönlicher Berater": "Këshilltar personal"
  },
  xk: {
    "Gratis-Gebote pro Monat": "Oferta falas për muaj",
    "Rabatt auf Gebotspakete": "Zbritje në paketat e ofertave",
    "VIP Badge im Profil": "Distinktiv VIP në profil",
    "Zugang zu VIP-Auktionen": "Qasje në ankandet VIP",
    "Prioritäts-Support": "Mbështetje me prioritet",
    "Exklusive Rabattcodes": "Kode zbritje ekskluzive",
    "Persönlicher Berater": "Këshilltar personal"
  },
  tr: {
    "Gratis-Gebote pro Monat": "Aylık ücretsiz teklifler",
    "Rabatt auf Gebotspakete": "Teklif paketlerinde indirim",
    "VIP Badge im Profil": "Profilde VIP rozeti",
    "Zugang zu VIP-Auktionen": "VIP açık artırmalara erişim",
    "Prioritäts-Support": "Öncelikli destek",
    "Exklusive Rabattcodes": "Özel indirim kodları",
    "Persönlicher Berater": "Kişisel danışman"
  },
  fr: {
    "Gratis-Gebote pro Monat": "Offres gratuites par mois",
    "Rabatt auf Gebotspakete": "Réduction sur les forfaits",
    "VIP Badge im Profil": "Badge VIP dans le profil",
    "Zugang zu VIP-Auktionen": "Accès aux enchères VIP",
    "Prioritäts-Support": "Support prioritaire",
    "Exklusive Rabattcodes": "Codes de réduction exclusifs",
    "Persönlicher Berater": "Conseiller personnel"
  },
  es: {
    "Gratis-Gebote pro Monat": "Ofertas gratis por mes",
    "Rabatt auf Gebotspakete": "Descuento en paquetes de ofertas",
    "VIP Badge im Profil": "Insignia VIP en perfil",
    "Zugang zu VIP-Auktionen": "Acceso a subastas VIP",
    "Prioritäts-Support": "Soporte prioritario",
    "Exklusive Rabattcodes": "Códigos de descuento exclusivos",
    "Persönlicher Berater": "Asesor personal"
  }
};

// Helper function to translate benefit text
const translateBenefit = (benefit, language) => {
  const langTranslations = benefitTranslations[language] || benefitTranslations['de'];
  
  // Try to match the benefit text (it contains numbers, so we need partial matching)
  for (const [key, value] of Object.entries(langTranslations)) {
    if (benefit.includes(key) || benefit.toLowerCase().includes(key.toLowerCase())) {
      // Replace the German part with translated version
      return benefit.replace(key, value);
    }
  }
  
  // If no match, return original
  return benefit;
};

const VIPBadge = ({ color, size = 'md' }) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };
  
  return (
    <div 
      className={`${sizes[size]} rounded-full flex items-center justify-center`}
      style={{ backgroundColor: color }}
    >
      <Crown className={`${size === 'sm' ? 'w-2.5 h-2.5' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5'} text-black`} />
    </div>
  );
};

export default function VIP() {
  const { user, token } = useAuth();
  const { language , mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const texts = vipTexts[langKey] || vipTexts.de;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [plans, setPlans] = useState([]);
  const [vipStatus, setVipStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(null);

  useEffect(() => {
    fetchData();
    
    // Handle success redirect
    const sessionId = searchParams.get('session_id');
    if (sessionId && token) {
      activateSubscription(sessionId);
    }
    
    // Handle cancellation
    if (searchParams.get('canceled')) {
      toast.error(texts.paymentCanceled);
    }
  }, [searchParams, token]);

  const fetchData = async () => {
    try {
      const [plansRes, statusRes] = await Promise.all([
        axios.get(`${API}/vip/plans`),
        token ? axios.get(`${API}/vip/status`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { is_vip: false } })) : Promise.resolve({ data: { is_vip: false } })
      ]);
      
      setPlans(plansRes.data);
      setVipStatus(statusRes.data);
    } catch (error) {
      console.error('Error fetching VIP data:', error);
    } finally {
      setLoading(false);
    }
  };

  const activateSubscription = async (sessionId) => {
    try {
      const response = await axios.post(
        `${API}/vip/activate?session_id=${sessionId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(texts.subscriptionActive);
      fetchData();
      // Remove session_id from URL
      navigate('/vip', { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Activation failed');
    }
  };

  const handleSubscribe = async (planId) => {
    if (!token) {
      // Save the intended plan in sessionStorage so we can continue after login
      sessionStorage.setItem('pendingVipPlan', planId);
      toast.info(texts.loginRequired);
      navigate('/login?redirect=/vip');
      return;
    }
    
    setSubscribing(planId);
    
    try {
      const response = await axios.post(
        `${API}/vip/subscribe/${planId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Redirect to Stripe Checkout
      window.location.href = response.data.url;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Subscription error');
      setSubscribing(null);
    }
  };
  
  // Check for pending VIP plan after login
  useEffect(() => {
    const pendingPlan = sessionStorage.getItem('pendingVipPlan');
    if (pendingPlan && token) {
      sessionStorage.removeItem('pendingVipPlan');
      handleSubscribe(pendingPlan);
    }
  }, [token]);

  const handleCancel = async () => {
    if (!confirm(texts.cancelConfirm)) return;
    
    try {
      const response = await axios.post(
        `${API}/vip/cancel`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(response.data.message);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || texts.cancelFailed);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a1929] to-[#0d2538] pt-20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFD700]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1929] to-[#0d2538] pt-20 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 rounded-full bg-gradient-to-r from-[#FFD700] to-[#FFA500] flex items-center justify-center mx-auto mb-4">
            <Crown className="w-10 h-10 text-black" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            {texts.title}
          </h1>
          <p className="text-gray-400 max-w-lg mx-auto">
            {texts.subtitle}
          </p>
        </div>

        {/* Current VIP Status */}
        {vipStatus?.is_vip && (
          <div className="mb-10 p-6 rounded-2xl bg-gradient-to-r from-[#FFD700]/20 to-[#FFA500]/20 border border-[#FFD700]/30">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <VIPBadge color={vipStatus.badge_color} size="lg" />
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {texts.vipMember}: {vipStatus.plan?.name}!
                  </h3>
                  <p className="text-gray-400">
                    {vipStatus.monthly_bids_remaining} {texts.bonusBids}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-sm">{texts.validUntil}</p>
                <p className="text-white font-semibold">
                  {vipStatus.next_renewal && new Date(vipStatus.next_renewal).getFullYear() > 1970
                    ? new Date(vipStatus.next_renewal).toLocaleDateString(language === 'de' ? 'de-DE' : language === 'fr' ? 'fr-FR' : language === 'sq' || language === 'xk' ? 'sq-AL' : language === 'tr' ? 'tr-TR' : 'en-US')
                    : vipStatus.is_admin || vipStatus.is_manager || vipStatus.is_influencer
                      ? '∞ ' + (texts.unlimited || 'Unbegrenzt')
                      : texts.active
                  }
                </p>
                {!vipStatus.is_admin && !vipStatus.is_manager && !vipStatus.is_influencer && (
                  <button 
                    onClick={handleCancel}
                    className="text-red-400 text-sm hover:underline mt-2"
                  >
                    {texts.cancelAnytime}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIP Plans */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {plans.map((plan, index) => {
            const isCurrentPlan = vipStatus?.plan_id === plan.id;
            
            return (
              <div 
                key={plan.id}
                className={`relative rounded-2xl p-6 border transition-all ${
                  plan.popular 
                    ? 'bg-gradient-to-b from-[#FFD700]/10 to-[#0d2538] border-[#FFD700]/50 scale-105' 
                    : 'bg-[#1a3a52]/50 border-gray-700/50 hover:border-gray-600'
                } ${isCurrentPlan ? 'ring-2 ring-[#FFD700]' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#FFD700] text-black text-xs font-bold rounded-full">
                    {texts.popular.toUpperCase()}
                  </div>
                )}
                
                {isCurrentPlan && (
                  <div className="absolute -top-3 right-4 px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
                    {texts.active}
                  </div>
                )}
                
                <div className="flex items-center gap-3 mb-4">
                  <VIPBadge color={plan.badge_color} />
                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                </div>
                
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">€{plan.price_monthly.toFixed(2)}</span>
                  <span className="text-gray-400">/{texts.month}</span>
                </div>
                
                <div className="flex items-center gap-2 mb-6 p-3 rounded-lg bg-[#FFD700]/10">
                  <Gift className="w-5 h-5 text-[#FFD700]" />
                  <span className="text-[#FFD700] font-bold">{plan.monthly_bids} {texts.bonusBids}</span>
                  <span className="text-gray-400 text-sm">/{texts.month}</span>
                </div>
                
                <ul className="space-y-3 mb-6">
                  {plan.benefits.map((benefit, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-300">{translateBenefit(benefit, langKey)}</span>
                    </li>
                  ))}
                </ul>
                
                <Button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={isCurrentPlan || subscribing === plan.id}
                  className={`w-full py-3 font-bold ${
                    plan.popular 
                      ? 'bg-[#FFD700] hover:bg-[#FCD34D] text-black'
                      : 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white'
                  }`}
                >
                  {subscribing === plan.id ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                      {texts.processing}
                    </>
                  ) : isCurrentPlan ? (
                    texts.currentSub
                  ) : (
                    <>
                      {texts.becomeVip}
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Benefits Overview */}
        <div className="bg-[#1a3a52]/30 rounded-2xl p-8 border border-gray-700/50">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            {texts.whyVip}
          </h2>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-[#FFD700]/20 flex items-center justify-center mx-auto mb-3">
                <Gift className="w-7 h-7 text-[#FFD700]" />
              </div>
              <h4 className="text-white font-semibold mb-1">{texts.freeBids}</h4>
              <p className="text-gray-400 text-sm">{texts.freeBidsDesc}</p>
            </div>
            
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-7 h-7 text-green-400" />
              </div>
              <h4 className="text-white font-semibold mb-1">{texts.discounts}</h4>
              <p className="text-gray-400 text-sm">{texts.discountsDesc}</p>
            </div>
            
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-3">
                <Star className="w-7 h-7 text-purple-400" />
              </div>
              <h4 className="text-white font-semibold mb-1">{texts.exclusive}</h4>
              <p className="text-gray-400 text-sm">{texts.exclusiveDesc}</p>
            </div>
            
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto mb-3">
                <Shield className="w-7 h-7 text-cyan-400" />
              </div>
              <h4 className="text-white font-semibold mb-1">{texts.support}</h4>
              <p className="text-gray-400 text-sm">{texts.supportDesc}</p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-12 text-center">
          <p className="text-gray-400">
            {texts.vipQuestions} <a href="/faq" className="text-[#FFD700] hover:underline">{texts.findAnswersHere}</a>
          </p>
        </div>
      </div>
    </div>
  );
}
