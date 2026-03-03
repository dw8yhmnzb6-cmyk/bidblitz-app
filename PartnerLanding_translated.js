/**
 * Partner Landing Page - Public Partner Profile
 * Target for QR codes and social media links
 * Shows partner info, vouchers, ratings, and contact
 * With full i18n translation support
 */
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import { 
  Star, MapPin, Phone, Mail, Globe, Clock, Ticket, 
  ChevronRight, Loader2, Share2, Heart, ExternalLink,
  MessageCircle, Calendar, Award, ThumbsUp
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

// Translations
const partnerLandingTranslations = {
  de: {
    notFound: 'Partner nicht gefunden',
    notFoundDesc: 'Dieser Partner existiert nicht mehr.',
    toHome: 'Zur Startseite',
    verified: 'Verifiziert',
    reviews: 'Bewertungen',
    recommend: 'empfehlen',
    call: 'Anrufen',
    email: 'E-Mail',
    website: 'Website',
    share: 'Teilen',
    availableVouchers: 'Verfügbare Gutscheine',
    viewAll: 'Alle ansehen',
    validUntil: 'Gültig bis',
    unlimited: 'Unbegrenzt gültig',
    getIt: 'Jetzt sichern',
    noVouchers: 'Derzeit keine Gutscheine verfügbar',
    checkBack: 'Schauen Sie später wieder vorbei!',
    customerReviews: 'Kundenbewertungen',
    wouldRecommend: 'Würde empfehlen',
    anonymous: 'Anonym',
    openingHours: 'Öffnungszeiten',
    closed: 'Geschlossen',
    location: 'Standort',
    openInMaps: 'In Google Maps öffnen',
    ctaTitle: 'Jetzt Gutscheine ersteigern!',
    ctaSub: 'Spare bis zu 90% bei',
    withBidBlitz: 'mit BidBlitz',
    toAuctions: 'Zu den Auktionen',
    linkCopied: 'Link kopiert!',
    discoverAt: 'Entdecke',
    onBidBlitz: 'auf BidBlitz!',
    checkOutAt: 'Schau mal bei',
    visit: 'vorbei',
    discount: 'Rabatt',
    onlyMins: 'Nur noch',
    minsLeft: 'Min!',
    view: 'Ansehen',
    // Business types
    restaurant: 'Restaurant',
    bar: 'Bar & Club',
    cafe: 'Café',
    gasStation: 'Tankstelle',
    cinema: 'Kino',
    retail: 'Einzelhandel',
    wellness: 'Wellness & Spa',
    fitness: 'Fitness-Studio',
    beauty: 'Friseur & Beauty',
    hotel: 'Hotel & Unterkunft',
    entertainment: 'Unterhaltung',
    supermarket: 'Supermarkt',
    pharmacy: 'Apotheke',
    other: 'Sonstiges'
  },
  en: {
    notFound: 'Partner not found',
    notFoundDesc: 'This partner no longer exists.',
    toHome: 'To Homepage',
    verified: 'Verified',
    reviews: 'Reviews',
    recommend: 'recommend',
    call: 'Call',
    email: 'Email',
    website: 'Website',
    share: 'Share',
    availableVouchers: 'Available Vouchers',
    viewAll: 'View all',
    validUntil: 'Valid until',
    unlimited: 'No expiry',
    getIt: 'Get it now',
    noVouchers: 'No vouchers available',
    checkBack: 'Check back later!',
    customerReviews: 'Customer Reviews',
    wouldRecommend: 'Would recommend',
    anonymous: 'Anonymous',
    openingHours: 'Opening Hours',
    closed: 'Closed',
    location: 'Location',
    openInMaps: 'Open in Google Maps',
    ctaTitle: 'Win vouchers now!',
    ctaSub: 'Save up to 90% at',
    withBidBlitz: 'with BidBlitz',
    toAuctions: 'To the Auctions',
    linkCopied: 'Link copied!',
    discoverAt: 'Discover',
    onBidBlitz: 'on BidBlitz!',
    checkOutAt: 'Check out',
    visit: '',
    discount: 'off',
    onlyMins: 'Only',
    minsLeft: 'mins left!',
    view: 'View',
    restaurant: 'Restaurant',
    bar: 'Bar & Club',
    cafe: 'Café',
    gasStation: 'Gas Station',
    cinema: 'Cinema',
    retail: 'Retail',
    wellness: 'Wellness & Spa',
    fitness: 'Fitness Studio',
    beauty: 'Hair & Beauty',
    hotel: 'Hotel & Accommodation',
    entertainment: 'Entertainment',
    supermarket: 'Supermarket',
    pharmacy: 'Pharmacy',
    other: 'Other'
  },
  sq: {
    notFound: 'Partneri nuk u gjet',
    notFoundDesc: 'Ky partner nuk ekziston më.',
    toHome: 'Faqja Kryesore',
    verified: 'I verifikuar',
    reviews: 'Vlerësime',
    recommend: 'rekomandojnë',
    call: 'Thirr',
    email: 'Email',
    website: 'Faqja web',
    share: 'Ndaj',
    availableVouchers: 'Kuponat e disponueshëm',
    viewAll: 'Shiko të gjitha',
    validUntil: 'E vlefshme deri',
    unlimited: 'Pa afat',
    getIt: 'Merre tani',
    noVouchers: 'Nuk ka kupona të disponueshëm',
    checkBack: 'Kthehuni më vonë!',
    customerReviews: 'Vlerësimet e klientëve',
    wouldRecommend: 'Do ta rekomandonte',
    anonymous: 'Anonim',
    openingHours: 'Orari',
    closed: 'Mbyllur',
    location: 'Vendndodhja',
    openInMaps: 'Hap në Google Maps',
    ctaTitle: 'Fito kupona tani!',
    ctaSub: 'Kurse deri në 90% në',
    withBidBlitz: 'me BidBlitz',
    toAuctions: 'Te Ankandat',
    linkCopied: 'Linku u kopjua!',
    discoverAt: 'Zbulo',
    onBidBlitz: 'në BidBlitz!',
    checkOutAt: 'Shiko',
    visit: '',
    discount: 'zbritje',
    onlyMins: 'Vetëm',
    minsLeft: 'min të mbetura!',
    view: 'Shiko',
    restaurant: 'Restorant',
    bar: 'Bar & Klub',
    cafe: 'Kafene',
    gasStation: 'Pompë benzine',
    cinema: 'Kinema',
    retail: 'Shitje me pakicë',
    wellness: 'Wellness & Spa',
    fitness: 'Palestër',
    beauty: 'Floktor & Bukuri',
    hotel: 'Hotel & Akomodim',
    entertainment: 'Argëtim',
    supermarket: 'Supermarket',
    pharmacy: 'Farmaci',
    other: 'Tjetër'
  },
  ar: {
    notFound: 'الشريك غير موجود',
    notFoundDesc: 'هذا الشريك لم يعد موجوداً.',
    toHome: 'إلى الرئيسية',
    verified: 'موثق',
    reviews: 'تقييمات',
    recommend: 'يوصون',
    call: 'اتصل',
    email: 'بريد',
    website: 'الموقع',
    share: 'مشاركة',
    availableVouchers: 'القسائم المتاحة',
    viewAll: 'عرض الكل',
    validUntil: 'صالح حتى',
    unlimited: 'بدون انتهاء',
    getIt: 'احصل عليها الآن',
    noVouchers: 'لا توجد قسائم متاحة',
    checkBack: 'تفقد لاحقاً!',
    customerReviews: 'تقييمات العملاء',
    wouldRecommend: 'سأوصي به',
    anonymous: 'مجهول',
    openingHours: 'ساعات العمل',
    closed: 'مغلق',
    location: 'الموقع',
    openInMaps: 'افتح في خرائط جوجل',
    ctaTitle: 'اربح قسائم الآن!',
    ctaSub: 'وفر حتى 90% في',
    withBidBlitz: 'مع BidBlitz',
    toAuctions: 'إلى المزادات',
    linkCopied: 'تم نسخ الرابط!',
    discoverAt: 'اكتشف',
    onBidBlitz: 'على BidBlitz!',
    checkOutAt: 'تفقد',
    visit: '',
    discount: 'خصم',
    onlyMins: 'فقط',
    minsLeft: 'دقائق متبقية!',
    view: 'عرض',
    restaurant: 'مطعم',
    bar: 'بار ونادي',
    cafe: 'مقهى',
    gasStation: 'محطة وقود',
    cinema: 'سينما',
    retail: 'متجر',
    wellness: 'سبا وعافية',
    fitness: 'صالة رياضية',
    beauty: 'تجميل',
    hotel: 'فندق وإقامة',
    entertainment: 'ترفيه',
    supermarket: 'سوبرماركت',
    pharmacy: 'صيدلية',
    other: 'آخر'
  },
  tr: {
    notFound: 'Partner bulunamadı',
    notFoundDesc: 'Bu partner artık mevcut değil.',
    toHome: 'Ana Sayfaya',
    verified: 'Doğrulanmış',
    reviews: 'Değerlendirme',
    recommend: 'tavsiye eder',
    call: 'Ara',
    email: 'E-posta',
    website: 'Web sitesi',
    share: 'Paylaş',
    availableVouchers: 'Mevcut Kuponlar',
    viewAll: 'Tümünü gör',
    validUntil: 'Geçerlilik',
    unlimited: 'Süresiz',
    getIt: 'Şimdi al',
    noVouchers: 'Kupon mevcut değil',
    checkBack: 'Daha sonra tekrar kontrol edin!',
    customerReviews: 'Müşteri Yorumları',
    wouldRecommend: 'Tavsiye ederim',
    anonymous: 'Anonim',
    openingHours: 'Çalışma Saatleri',
    closed: 'Kapalı',
    location: 'Konum',
    openInMaps: "Google Maps'te aç",
    ctaTitle: 'Şimdi kupon kazan!',
    ctaSub: "%90'a kadar tasarruf et",
    withBidBlitz: 'BidBlitz ile',
    toAuctions: 'Açık Artırmalara',
    linkCopied: 'Link kopyalandı!',
    discoverAt: 'Keşfet',
    onBidBlitz: "BidBlitz'de!",
    checkOutAt: 'Bak',
    visit: '',
    discount: 'indirim',
    onlyMins: 'Sadece',
    minsLeft: 'dk kaldı!',
    view: 'Gör',
    restaurant: 'Restoran',
    bar: 'Bar & Kulüp',
    cafe: 'Kafe',
    gasStation: 'Benzin İstasyonu',
    cinema: 'Sinema',
    retail: 'Perakende',
    wellness: 'Wellness & Spa',
    fitness: 'Spor Salonu',
    beauty: 'Kuaför & Güzellik',
    hotel: 'Otel & Konaklama',
    entertainment: 'Eğlence',
    supermarket: 'Süpermarket',
    pharmacy: 'Eczane',
    other: 'Diğer'
  },
  fr: {
    notFound: 'Partenaire introuvable',
    notFoundDesc: "Ce partenaire n'existe plus.",
    toHome: "Page d'accueil",
    verified: 'Vérifié',
    reviews: 'Avis',
    recommend: 'recommandent',
    call: 'Appeler',
    email: 'Email',
    website: 'Site web',
    share: 'Partager',
    availableVouchers: 'Bons disponibles',
    viewAll: 'Voir tout',
    validUntil: "Valable jusqu'au",
    unlimited: 'Sans expiration',
    getIt: 'Obtenir maintenant',
    noVouchers: 'Aucun bon disponible',
    checkBack: 'Revenez plus tard!',
    customerReviews: 'Avis clients',
    wouldRecommend: 'Recommanderait',
    anonymous: 'Anonyme',
    openingHours: "Heures d'ouverture",
    closed: 'Fermé',
    location: 'Emplacement',
    openInMaps: 'Ouvrir dans Google Maps',
    ctaTitle: 'Gagnez des bons maintenant!',
    ctaSub: "Économisez jusqu'à 90% chez",
    withBidBlitz: 'avec BidBlitz',
    toAuctions: 'Aux enchères',
    linkCopied: 'Lien copié!',
    discoverAt: 'Découvrez',
    onBidBlitz: 'sur BidBlitz!',
    checkOutAt: 'Visitez',
    visit: '',
    discount: 'de réduction',
    onlyMins: 'Plus que',
    minsLeft: 'min!',
    view: 'Voir',
    restaurant: 'Restaurant',
    bar: 'Bar & Club',
    cafe: 'Café',
    gasStation: 'Station-service',
    cinema: 'Cinéma',
    retail: 'Commerce',
    wellness: 'Bien-être & Spa',
    fitness: 'Salle de sport',
    beauty: 'Coiffure & Beauté',
    hotel: 'Hôtel & Hébergement',
    entertainment: 'Divertissement',
    supermarket: 'Supermarché',
    pharmacy: 'Pharmacie',
    other: 'Autre'
  }
};

// Business type icons
const BUSINESS_ICONS = {
  restaurant: '🍕',
  bar: '🍺',
  cafe: '☕',
  gas_station: '⛽',
  cinema: '🎬',
  retail: '🛒',
  wellness: '💆',
  fitness: '🏋️',
  beauty: '💇',
  hotel: '🏨',
  entertainment: '🎯',
  supermarket: '🛍️',
  pharmacy: '💊',
  other: '🏪'
};

export default function PartnerLanding() {
  const { partnerId } = useParams();
  const { language } = useLanguage();
  const langKey = language === 'ae' ? 'ar' : language === 'xk' ? 'sq' : language === 'gb' ? 'en' : language;
  const t = partnerLandingTranslations[langKey] || partnerLandingTranslations.de;
  
  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState(null);
  const [vouchers, setVouchers] = useState([]);
  const [ratings, setRatings] = useState(null);
  const [flashSales, setFlashSales] = useState([]);
  const [error, setError] = useState(null);

  // Get business type name
  const getBusinessTypeName = (type) => {
    const typeMap = {
      restaurant: t.restaurant,
      bar: t.bar,
      cafe: t.cafe,
      gas_station: t.gasStation,
      cinema: t.cinema,
      retail: t.retail,
      wellness: t.wellness,
      fitness: t.fitness,
      beauty: t.beauty,
      hotel: t.hotel,
      entertainment: t.entertainment,
      supermarket: t.supermarket,
      pharmacy: t.pharmacy,
      other: t.other
    };
    return typeMap[type] || t.other;
  };

  useEffect(() => {
    fetchPartnerData();
    trackVisit();
  }, [partnerId]);

  const fetchPartnerData = async () => {
    try {
      setLoading(true);
      
      const [partnerRes, vouchersRes, ratingsRes, flashRes] = await Promise.allSettled([
        axios.get(`${API}/api/partners/public/${partnerId}`),
        axios.get(`${API}/api/vouchers/partner/${partnerId}/public`),
        axios.get(`${API}/api/partner-ratings/partner/${partnerId}`),
        axios.get(`${API}/api/partner-flash-sales/active?partner_id=${partnerId}`)
      ]);

      if (partnerRes.status === 'fulfilled') {
        setPartner(partnerRes.value.data);
      } else {
        try {
          const altRes = await axios.get(`${API}/api/partner-portal/public-profile/${partnerId}`);
          setPartner(altRes.data);
        } catch {
          setError(t.notFound);
        }
      }

      if (vouchersRes.status === 'fulfilled') {
        setVouchers(vouchersRes.value.data.vouchers || []);
      }

      if (ratingsRes.status === 'fulfilled') {
        setRatings(ratingsRes.value.data);
      }

      if (flashRes.status === 'fulfilled') {
        setFlashSales(flashRes.value.data.active_sales || []);
      }

    } catch (err) {
      console.error('Partner fetch error:', err);
      setError(t.notFound);
    } finally {
      setLoading(false);
    }
  };

  const trackVisit = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const trackingId = urlParams.get('tid');
      const ref = urlParams.get('ref');
      
      if (trackingId) {
        await axios.post(`${API}/api/partner-social/track-click`, null, {
          params: { tracking_id: trackingId, platform: ref || 'direct' }
        });
      }
    } catch (err) {
      // Silent fail for tracking
    }
  };

  const sharePartner = async () => {
    const url = window.location.href;
    const text = `${t.discoverAt} ${partner?.business_name || partner?.name} ${t.onBidBlitz}`;
    
    if (navigator.share) {
      try {
        await navigator.share({ title: partner?.business_name || partner?.name, text, url });
      } catch (err) {
        // User cancelled
      }
    } else {
      navigator.clipboard.writeText(url);
      toast.success(t.linkCopied);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-amber-500" />
      </div>
    );
  }

  if (error || !partner) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{t.notFound}</h1>
          <p className="text-gray-500 mb-6">{error || t.notFoundDesc}</p>
          <Link to="/">
            <Button className="bg-amber-500 hover:bg-amber-600">
              {t.toHome}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const businessIcon = BUSINESS_ICONS[partner.business_type] || BUSINESS_ICONS.other;
  const businessTypeName = getBusinessTypeName(partner.business_type);
  const activeFlashSale = flashSales.find(s => s.partner_id === partnerId);

  return (
    <div className="min-h-screen bg-gray-50" data-testid="partner-landing">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Flash Sale Banner */}
          {activeFlashSale && (
            <div className="bg-white/20 backdrop-blur rounded-lg p-3 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">⚡</span>
                <div>
                  <p className="font-bold">{activeFlashSale.name}</p>
                  <p className="text-sm opacity-90">
                    -{activeFlashSale.discount_percent}% {t.discount} - {t.onlyMins} {Math.floor(activeFlashSale.remaining_seconds / 60)} {t.minsLeft}
                  </p>
                </div>
              </div>
              <Button size="sm" className="bg-white text-amber-600 hover:bg-gray-100">
                {t.view}
              </Button>
            </div>
          )}

          {/* Partner Header */}
          <div className="flex items-start gap-6">
            {/* Logo */}
            <div className="w-24 h-24 bg-white rounded-xl flex items-center justify-center overflow-hidden shadow-lg flex-shrink-0">
              {partner.logo_url ? (
                <img 
                  src={partner.logo_url} 
                  alt={partner.business_name || partner.name} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-5xl">{businessIcon}</span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm bg-white/20 px-2 py-1 rounded-full">
                  {businessIcon} {businessTypeName}
                </span>
                {partner.is_verified && (
                  <span className="text-sm bg-green-500/30 px-2 py-1 rounded-full flex items-center gap-1">
                    <Award className="w-3 h-3" /> {t.verified}
                  </span>
                )}
              </div>
              <h1 className="text-3xl font-bold mb-2">
                {partner.business_name || partner.name}
              </h1>
              
              {/* Rating */}
              {ratings?.average_rating > 0 && (
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star 
                        key={star} 
                        className={`w-5 h-5 ${star <= ratings.average_rating ? 'text-yellow-300 fill-yellow-300' : 'text-white/30'}`}
                      />
                    ))}
                  </div>
                  <span className="font-bold">{ratings.average_rating.toFixed(1)}</span>
                  <span className="text-sm opacity-80">({ratings.total_ratings} {t.reviews})</span>
                  {ratings.recommend_rate > 0 && (
                    <span className="text-sm opacity-80 flex items-center gap-1">
                      <ThumbsUp className="w-3 h-3" /> {ratings.recommend_rate}% {t.recommend}
                    </span>
                  )}
                </div>
              )}

              {/* Location */}
              {(partner.address || partner.city) && (
                <div className="flex items-center gap-2 text-sm opacity-90">
                  <MapPin className="w-4 h-4" />
                  <span>{partner.address}{partner.city ? `, ${partner.city}` : ''}</span>
                </div>
              )}
            </div>

            {/* Share Button */}
            <Button 
              onClick={sharePartner}
              variant="ghost"
              className="text-white hover:bg-white/20"
              data-testid="share-partner-btn"
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {partner.phone && (
            <a 
              href={`tel:${partner.phone}`}
              className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center gap-2"
            >
              <Phone className="w-6 h-6 text-amber-500" />
              <span className="text-sm text-gray-600">{t.call}</span>
            </a>
          )}
          {partner.email && (
            <a 
              href={`mailto:${partner.email}`}
              className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center gap-2"
            >
              <Mail className="w-6 h-6 text-amber-500" />
              <span className="text-sm text-gray-600">{t.email}</span>
            </a>
          )}
          {partner.website && (
            <a 
              href={partner.website}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center gap-2"
            >
              <Globe className="w-6 h-6 text-amber-500" />
              <span className="text-sm text-gray-600">{t.website}</span>
            </a>
          )}
          <a 
            href={`https://wa.me/?text=${t.checkOutAt} ${partner.business_name || partner.name} ${t.visit}: ${window.location.href}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center gap-2"
          >
            <MessageCircle className="w-6 h-6 text-green-500" />
            <span className="text-sm text-gray-600">{t.share}</span>
          </a>
        </div>

        {/* Available Vouchers */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Ticket className="w-6 h-6 text-amber-500" />
              {t.availableVouchers}
            </h2>
            <Link to={`/vouchers?partner=${partnerId}`}>
              <Button variant="ghost" size="sm" className="text-amber-600">
                {t.viewAll} <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>

          {vouchers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vouchers.slice(0, 4).map((voucher) => (
                <Link 
                  key={voucher.id || voucher._id}
                  to={`/voucher/${voucher.id || voucher._id}`}
                  className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-gray-800 group-hover:text-amber-600 transition-colors">
                      {voucher.name}
                    </h3>
                    <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-sm font-bold">
                      €{voucher.value?.toFixed(2)}
                    </span>
                  </div>
                  {voucher.description && (
                    <p className="text-sm text-gray-500 line-clamp-2 mb-2">{voucher.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      {voucher.valid_until 
                        ? `${t.validUntil} ${new Date(voucher.valid_until).toLocaleDateString(langKey === 'en' ? 'en-US' : langKey === 'fr' ? 'fr-FR' : langKey === 'ar' ? 'ar-AE' : 'de-DE')}`
                        : t.unlimited}
                    </span>
                    <span className="text-amber-600 text-sm font-medium group-hover:underline">
                      {t.getIt} →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl p-8 text-center text-gray-400">
              <Ticket className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{t.noVouchers}</p>
              <p className="text-sm">{t.checkBack}</p>
            </div>
          )}
        </section>

        {/* Reviews */}
        {ratings?.ratings?.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Star className="w-6 h-6 text-amber-500" />
                {t.customerReviews}
              </h2>
            </div>

            {/* Rating Distribution */}
            <div className="bg-white rounded-xl p-6 shadow-sm mb-4">
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <p className="text-4xl font-bold text-gray-800">{ratings.average_rating?.toFixed(1)}</p>
                  <div className="flex justify-center my-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star 
                        key={star} 
                        className={`w-4 h-4 ${star <= ratings.average_rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-gray-500">{ratings.total_ratings} {t.reviews}</p>
                </div>
                <div className="flex-1 space-y-1">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = ratings.distribution?.[star] || 0;
                    const percent = ratings.total_ratings > 0 ? (count / ratings.total_ratings * 100) : 0;
                    return (
                      <div key={star} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-4">{star}</span>
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-amber-400 rounded-full h-2 transition-all" 
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-8">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Recent Reviews */}
            <div className="space-y-4">
              {ratings.ratings.slice(0, 3).map((review, i) => (
                <div key={i} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="text-lg font-bold text-gray-400">
                          {review.user_name?.charAt(0).toUpperCase() || 'A'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{review.user_name || t.anonymous}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(review.created_at).toLocaleDateString(langKey === 'en' ? 'en-US' : langKey === 'fr' ? 'fr-FR' : langKey === 'ar' ? 'ar-AE' : 'de-DE')}
                        </p>
                      </div>
                    </div>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star 
                          key={star} 
                          className={`w-4 h-4 ${star <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`}
                        />
                      ))}
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-gray-600">{review.comment}</p>
                  )}
                  {review.recommend && (
                    <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                      <ThumbsUp className="w-3 h-3" /> {t.wouldRecommend}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Opening Hours */}
        {partner.opening_hours && (
          <section className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              {t.openingHours}
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(partner.opening_hours).map(([day, hours]) => (
                <div key={day} className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-600">{day}</span>
                  <span className="font-medium text-gray-800">{hours || t.closed}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Map */}
        {(partner.latitude && partner.longitude) && (
          <section className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-500" />
              {t.location}
            </h3>
            <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${partner.latitude},${partner.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-center"
              >
                <MapPin className="w-12 h-12 text-amber-500 mx-auto mb-2" />
                <p className="text-gray-600">{t.openInMaps}</p>
                <p className="text-sm text-gray-400">{partner.address}</p>
              </a>
            </div>
          </section>
        )}

        {/* CTA */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-6 text-white text-center">
          <h3 className="text-xl font-bold mb-2">{t.ctaTitle}</h3>
          <p className="opacity-90 mb-4">
            {t.ctaSub} {partner.business_name || partner.name} {t.withBidBlitz}
          </p>
          <Link to={`/auctions?partner=${partnerId}`}>
            <Button className="bg-white text-amber-600 hover:bg-gray-100">
              {t.toAuctions}
            </Button>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Link to="/" className="text-xl font-bold text-white mb-4 inline-block">
            🎯 BidBlitz
          </Link>
          <p className="text-sm">© 2026 BidBlitz. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
