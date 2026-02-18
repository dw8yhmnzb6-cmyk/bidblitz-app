/**
 * MerchantVouchersPage - Händler-Gutscheine Seite
 * Zeigt alle Partner/Händler und deren Gutscheine zum Bieten
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Store, Ticket, Clock, ChevronRight, ChevronLeft, Zap, Gift, 
  MapPin, Phone, Globe, Star, Euro, Users, Gavel, Trophy,
  Search, Filter, Coffee, Utensils, Wine, ShoppingBag, Sparkles,
  Heart, Award, Timer, ArrowRight, Crown, Camera, ExternalLink,
  Mail, Instagram, Facebook, CreditCard, CheckCircle
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const translations = {
  de: {
    title: 'Händler-Gutscheine',
    subtitle: 'Ersteigere Gutscheine bei lokalen Partnern',
    allMerchants: 'Alle Händler',
    searchPlaceholder: 'Händler suchen...',
    filterAll: 'Alle',
    filterRestaurant: 'Restaurants',
    filterBar: 'Bars',
    filterCafe: 'Cafés',
    filterRetail: 'Einzelhandel',
    filterWellness: 'Wellness',
    filterOther: 'Sonstige',
    noMerchants: 'Keine Händler gefunden',
    vouchers: 'Gutscheine',
    noVouchers: 'Noch keine Gutscheine verfügbar',
    value: 'Wert',
    currentPrice: 'Aktueller Preis',
    bids: 'Gebote',
    endsIn: 'Endet in',
    bidNow: 'Jetzt bieten',
    viewMerchant: 'Händler ansehen',
    back: 'Zurück',
    activeAuctions: 'Aktive Auktionen',
    wonVouchers: 'Gewonnene Gutscheine',
    redeemAt: 'Einlösbar bei',
    savings: 'Ersparnis',
    hot: 'Beliebt',
    new: 'Neu',
    endingSoon: 'Endet bald',
    premium: 'Premium Partner',
    verified: 'Verifiziert',
    openingHours: 'Öffnungszeiten',
    gallery: 'Galerie',
    contact: 'Kontakt',
    website: 'Website',
    specialties: 'Spezialitäten',
    paymentMethods: 'Zahlungsarten',
    reviews: 'Bewertungen',
    monday: 'Montag',
    tuesday: 'Dienstag',
    wednesday: 'Mittwoch',
    thursday: 'Donnerstag',
    friday: 'Freitag',
    saturday: 'Samstag',
    sunday: 'Sonntag',
    closed: 'Geschlossen',
    winnerGets: 'Gewinner erhält',
    redeemInfo: 'Nach dem Gewinn können Sie diesen Gutschein direkt beim Händler einlösen.',
    howItWorks: 'So funktioniert\'s',
    step1: 'Wählen Sie einen Händler',
    step2: 'Bieten Sie auf einen Gutschein',
    step3: 'Gewinnen Sie und lösen Sie beim Händler ein',
    availableVouchers: 'Verfügbare Gutscheine',
    comingSoon: 'Bald verfügbar'
  },
  en: {
    title: 'Merchant Vouchers',
    subtitle: 'Bid on vouchers from local partners',
    allMerchants: 'All Merchants',
    searchPlaceholder: 'Search merchants...',
    filterAll: 'All',
    filterRestaurant: 'Restaurants',
    filterBar: 'Bars',
    filterCafe: 'Cafés',
    filterRetail: 'Retail',
    filterWellness: 'Wellness',
    filterOther: 'Other',
    noMerchants: 'No merchants found',
    vouchers: 'Vouchers',
    noVouchers: 'No vouchers available yet',
    value: 'Value',
    currentPrice: 'Current Price',
    bids: 'Bids',
    endsIn: 'Ends in',
    bidNow: 'Bid Now',
    viewMerchant: 'View Merchant',
    back: 'Back',
    activeAuctions: 'Active Auctions',
    wonVouchers: 'Won Vouchers',
    redeemAt: 'Redeem at',
    savings: 'Savings',
    hot: 'Hot',
    new: 'New',
    endingSoon: 'Ending soon',
    premium: 'Premium Partner',
    verified: 'Verified',
    openingHours: 'Opening Hours',
    gallery: 'Gallery',
    contact: 'Contact',
    website: 'Website',
    specialties: 'Specialties',
    paymentMethods: 'Payment Methods',
    reviews: 'Reviews',
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
    closed: 'Closed',
    winnerGets: 'Winner gets',
    redeemInfo: 'After winning, you can redeem this voucher directly at the merchant.',
    howItWorks: 'How it works',
    step1: 'Choose a merchant',
    step2: 'Bid on a voucher',
    step3: 'Win and redeem at the merchant',
    availableVouchers: 'Available Vouchers',
    comingSoon: 'Coming Soon'
  },
  el: {
    title: 'Κουπόνια Εμπόρων',
    subtitle: 'Πλειοδοτήστε σε κουπόνια από τοπικούς συνεργάτες',
    allMerchants: 'Όλοι οι Έμποροι',
    searchPlaceholder: 'Αναζήτηση εμπόρων...',
    filterAll: 'Όλα',
    filterRestaurant: 'Εστιατόρια',
    filterBar: 'Μπαρ',
    filterCafe: 'Καφετέριες',
    filterRetail: 'Λιανική',
    filterWellness: 'Ευεξία',
    filterOther: 'Άλλα',
    noMerchants: 'Δεν βρέθηκαν έμποροι',
    vouchers: 'Κουπόνια',
    noVouchers: 'Δεν υπάρχουν ακόμα κουπόνια',
    value: 'Αξία',
    currentPrice: 'Τρέχουσα Τιμή',
    bids: 'Προσφορές',
    endsIn: 'Λήγει σε',
    bidNow: 'Κάνε Προσφορά',
    viewMerchant: 'Δείτε τον Έμπορο',
    back: 'Πίσω',
    activeAuctions: 'Ενεργές Δημοπρασίες',
    wonVouchers: 'Κερδισμένα Κουπόνια',
    redeemAt: 'Εξαργύρωση στον',
    savings: 'Εξοικονόμηση',
    hot: 'Δημοφιλές',
    new: 'Νέο',
    endingSoon: 'Λήγει σύντομα',
    premium: 'Premium Συνεργάτης',
    verified: 'Επαληθευμένο',
    openingHours: 'Ώρες Λειτουργίας',
    gallery: 'Γκαλερί',
    contact: 'Επικοινωνία',
    website: 'Ιστοσελίδα',
    specialties: 'Σπεσιαλιτέ',
    paymentMethods: 'Τρόποι Πληρωμής',
    reviews: 'Κριτικές',
    monday: 'Δευτέρα',
    tuesday: 'Τρίτη',
    wednesday: 'Τετάρτη',
    thursday: 'Πέμπτη',
    friday: 'Παρασκευή',
    saturday: 'Σάββατο',
    sunday: 'Κυριακή',
    closed: 'Κλειστά',
    winnerGets: 'Ο νικητής παίρνει',
    redeemInfo: 'Μετά τη νίκη, μπορείτε να εξαργυρώσετε αυτό το κουπόνι απευθείας στον έμπορο.',
    howItWorks: 'Πώς λειτουργεί',
    step1: 'Επιλέξτε έναν έμπορο',
    step2: 'Πλειοδοτήστε σε ένα κουπόνι',
    step3: 'Κερδίστε και εξαργυρώστε στον έμπορο',
    availableVouchers: 'Διαθέσιμα Κουπόνια',
    comingSoon: 'Έρχεται σύντομα'
  },
  tr: {
    title: 'Satıcı Kuponları',
    subtitle: 'Yerel ortaklardan kuponlar için teklif verin',
    allMerchants: 'Tüm Satıcılar',
    searchPlaceholder: 'Satıcı ara...',
    filterAll: 'Tümü',
    filterRestaurant: 'Restoranlar',
    filterBar: 'Barlar',
    filterCafe: 'Kafeler',
    filterRetail: 'Perakende',
    filterWellness: 'Wellness',
    filterOther: 'Diğer',
    noMerchants: 'Satıcı bulunamadı',
    vouchers: 'Kuponlar',
    noVouchers: 'Henüz kupon yok',
    value: 'Değer',
    currentPrice: 'Mevcut Fiyat',
    bids: 'Teklifler',
    endsIn: 'Biter',
    bidNow: 'Şimdi Teklif Ver',
    viewMerchant: 'Satıcıyı Gör',
    back: 'Geri',
    activeAuctions: 'Aktif Açık Artırmalar',
    wonVouchers: 'Kazanılan Kuponlar',
    redeemAt: 'Kullanım yeri',
    savings: 'Tasarruf',
    hot: 'Popüler',
    new: 'Yeni',
    endingSoon: 'Yakında bitiyor',
    premium: 'Premium Partner',
    verified: 'Doğrulanmış',
    openingHours: 'Çalışma Saatleri',
    gallery: 'Galeri',
    contact: 'İletişim',
    website: 'Web Sitesi',
    specialties: 'Özellikler',
    paymentMethods: 'Ödeme Yöntemleri',
    reviews: 'Yorumlar',
    winnerGets: 'Kazanan alır',
    redeemInfo: 'Kazandıktan sonra bu kuponu doğrudan satıcıda kullanabilirsiniz.',
    howItWorks: 'Nasıl çalışır',
    step1: 'Bir satıcı seçin',
    step2: 'Bir kupon için teklif verin',
    step3: 'Kazanın ve satıcıda kullanın',
    availableVouchers: 'Mevcut Kuponlar',
    comingSoon: 'Yakında'
  },
  ar: {
    title: 'قسائم التجار',
    subtitle: 'زايد على قسائم من الشركاء المحليين',
    allMerchants: 'جميع التجار',
    searchPlaceholder: 'بحث عن التجار...',
    filterAll: 'الكل',
    filterRestaurant: 'مطاعم',
    filterBar: 'بارات',
    filterCafe: 'مقاهي',
    filterRetail: 'تجزئة',
    filterWellness: 'عافية',
    filterOther: 'أخرى',
    noMerchants: 'لم يتم العثور على تجار',
    vouchers: 'قسائم',
    noVouchers: 'لا توجد قسائم متاحة بعد',
    value: 'القيمة',
    currentPrice: 'السعر الحالي',
    bids: 'العروض',
    endsIn: 'ينتهي في',
    bidNow: 'زايد الآن',
    viewMerchant: 'عرض التاجر',
    back: 'رجوع',
    activeAuctions: 'المزادات النشطة',
    premium: 'شريك Premium',
    verified: 'موثق',
    winnerGets: 'الفائز يحصل على',
    redeemInfo: 'بعد الفوز، يمكنك استرداد هذه القسيمة مباشرة عند التاجر.',
    howItWorks: 'كيف يعمل',
    step1: 'اختر تاجرًا',
    step2: 'زايد على قسيمة',
    step3: 'اربح واسترد عند التاجر',
    availableVouchers: 'القسائم المتاحة',
    comingSoon: 'قريبًا'
  }
};
    address: 'Adresse',
    phone: 'Telefon',
    website: 'Website',
    openingHours: 'Öffnungszeiten',
    about: 'Über uns',
    availableVouchers: 'Verfügbare Gutscheine',
    comingSoon: 'Bald verfügbar',
    winnerGets: 'Gewinner erhält',
    redeemInfo: 'Nach dem Gewinn können Sie diesen Gutschein direkt beim Händler einlösen.',
    howItWorks: 'So funktioniert\'s',
    step1: 'Wählen Sie einen Händler',
    step2: 'Bieten Sie auf einen Gutschein',
    step3: 'Gewinnen Sie und lösen Sie beim Händler ein'
  },
  en: {
    title: 'Merchant Vouchers',
    subtitle: 'Bid on vouchers from local partners',
    allMerchants: 'All Merchants',
    searchPlaceholder: 'Search merchants...',
    filterAll: 'All',
    filterRestaurant: 'Restaurants',
    filterBar: 'Bars',
    filterCafe: 'Cafés',
    filterRetail: 'Retail',
    filterWellness: 'Wellness',
    filterOther: 'Other',
    noMerchants: 'No merchants found',
    vouchers: 'Vouchers',
    noVouchers: 'No vouchers available yet',
    value: 'Value',
    currentPrice: 'Current Price',
    bids: 'Bids',
    endsIn: 'Ends in',
    bidNow: 'Bid Now',
    viewMerchant: 'View Merchant',
    back: 'Back',
    activeAuctions: 'Active Auctions',
    wonVouchers: 'Won Vouchers',
    redeemAt: 'Redeem at',
    savings: 'Savings',
    hot: 'Hot',
    new: 'New',
    endingSoon: 'Ending soon',
    address: 'Address',
    phone: 'Phone',
    website: 'Website',
    openingHours: 'Opening Hours',
    about: 'About',
    availableVouchers: 'Available Vouchers',
    comingSoon: 'Coming Soon',
    winnerGets: 'Winner gets',
    redeemInfo: 'After winning, you can redeem this voucher directly at the merchant.',
    howItWorks: 'How it works',
    step1: 'Choose a merchant',
    step2: 'Bid on a voucher',
    step3: 'Win and redeem at the merchant'
  }
};

const categoryIcons = {
  restaurant: <Utensils className="w-5 h-5" />,
  bar: <Wine className="w-5 h-5" />,
  cafe: <Coffee className="w-5 h-5" />,
  retail: <ShoppingBag className="w-5 h-5" />,
  wellness: <Sparkles className="w-5 h-5" />,
  other: <Store className="w-5 h-5" />
};

const categoryColors = {
  restaurant: 'from-orange-500 to-red-500',
  bar: 'from-purple-500 to-pink-500',
  cafe: 'from-amber-500 to-yellow-500',
  retail: 'from-blue-500 to-cyan-500',
  wellness: 'from-green-500 to-emerald-500',
  other: 'from-gray-500 to-slate-500'
};

const MerchantVouchersPage = () => {
  const navigate = useNavigate();
  const { merchantId } = useParams();
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = translations[language] || translations.de;

  const [merchants, setMerchants] = useState([]);
  const [selectedMerchant, setSelectedMerchant] = useState(null);
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  // Fetch all merchants with vouchers
  const fetchMerchants = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/merchant-vouchers/merchants`);
      if (res.ok) {
        const data = await res.json();
        setMerchants(data.merchants || []);
      }
    } catch (err) {
      console.error('Error fetching merchants:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch vouchers for a specific merchant
  const fetchMerchantVouchers = useCallback(async (mId) => {
    try {
      setLoading(true);
      const [merchantRes, vouchersRes] = await Promise.all([
        fetch(`${API}/api/merchant-vouchers/merchant/${mId}`),
        fetch(`${API}/api/merchant-vouchers/merchant/${mId}/vouchers`)
      ]);
      
      if (merchantRes.ok) {
        const merchantData = await merchantRes.json();
        setSelectedMerchant(merchantData.merchant);
      }
      
      if (vouchersRes.ok) {
        const vouchersData = await vouchersRes.json();
        setVouchers(vouchersData.vouchers || []);
      }
    } catch (err) {
      console.error('Error fetching merchant vouchers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (merchantId) {
      fetchMerchantVouchers(merchantId);
    } else {
      fetchMerchants();
      setSelectedMerchant(null);
    }
  }, [merchantId, fetchMerchants, fetchMerchantVouchers]);

  const formatTimeLeft = (endTime) => {
    if (!endTime) return '--:--';
    const now = new Date();
    const end = new Date(endTime);
    const diff = Math.max(0, end - now) / 1000;

    if (diff < 60) return `${Math.floor(diff)}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const filteredMerchants = merchants.filter(m => {
    const matchesSearch = m.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         m.city?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'all' || m.business_type === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const filterButtons = [
    { id: 'all', label: t.filterAll, icon: <Store className="w-4 h-4" /> },
    { id: 'restaurant', label: t.filterRestaurant, icon: <Utensils className="w-4 h-4" /> },
    { id: 'bar', label: t.filterBar, icon: <Wine className="w-4 h-4" /> },
    { id: 'cafe', label: t.filterCafe, icon: <Coffee className="w-4 h-4" /> },
    { id: 'retail', label: t.filterRetail, icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'wellness', label: t.filterWellness, icon: <Sparkles className="w-4 h-4" /> },
  ];

  // Merchant Detail View
  if (selectedMerchant) {
    const category = selectedMerchant.business_type || 'other';
    const colorClass = categoryColors[category] || categoryColors.other;
    const isPremium = selectedMerchant.is_premium;
    const isVerified = selectedMerchant.is_verified;
    const photos = selectedMerchant.photos || [];
    const openingHours = selectedMerchant.opening_hours || {};
    const specialties = selectedMerchant.specialties || [];
    const paymentMethods = selectedMerchant.payment_methods || [];
    const socialMedia = selectedMerchant.social_media || {};

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 pt-20 pb-12">
        <div className="max-w-6xl mx-auto px-4">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => navigate('/haendler-gutscheine')}
            className="mb-4 text-gray-600 hover:text-gray-800"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {t.back}
          </Button>

          {/* Premium Badge */}
          {isPremium && (
            <div className="mb-4 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-xl p-3 flex items-center gap-2 text-white">
              <Crown className="w-5 h-5" />
              <span className="font-bold">{t.premium || 'Premium Partner'}</span>
            </div>
          )}

          {/* Merchant Header */}
          <div className={`bg-gradient-to-r ${colorClass} rounded-2xl p-6 mb-6 text-white relative overflow-hidden`}>
            {/* Premium Ribbon */}
            {isPremium && (
              <div className="absolute top-4 right-4 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                <Crown className="w-3 h-3" />
                PREMIUM
              </div>
            )}
            
            <div className="flex items-start gap-4">
              <div className="w-24 h-24 bg-white/20 rounded-xl flex items-center justify-center overflow-hidden">
                {selectedMerchant.logo_url ? (
                  <img src={selectedMerchant.logo_url} alt={selectedMerchant.business_name} className="w-full h-full object-cover" />
                ) : (
                  categoryIcons[category] || <Store className="w-12 h-12" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">{selectedMerchant.business_name}</h1>
                  {isVerified && (
                    <CheckCircle className="w-5 h-5 text-green-300" title={t.verified} />
                  )}
                </div>
                
                {/* Rating */}
                {selectedMerchant.rating > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < selectedMerchant.rating ? 'text-yellow-300 fill-yellow-300' : 'text-white/30'}`} />
                    ))}
                    <span className="text-white/80 text-sm ml-1">({selectedMerchant.review_count || 0} {t.reviews})</span>
                  </div>
                )}
                
                <p className="text-white/80 text-sm flex items-center gap-1 mt-2">
                  <MapPin className="w-4 h-4" />
                  {selectedMerchant.address}, {selectedMerchant.city}
                </p>
                
                {/* Contact Info */}
                <div className="flex flex-wrap gap-3 mt-3">
                  {selectedMerchant.phone && (
                    <a href={`tel:${selectedMerchant.phone}`} className="text-white/90 text-sm flex items-center gap-1 hover:text-white">
                      <Phone className="w-4 h-4" />
                      {selectedMerchant.phone}
                    </a>
                  )}
                  {selectedMerchant.website && (
                    <a href={selectedMerchant.website} target="_blank" rel="noopener noreferrer" className="text-white/90 text-sm flex items-center gap-1 hover:text-white">
                      <Globe className="w-4 h-4" />
                      {t.website}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {selectedMerchant.email && (
                    <a href={`mailto:${selectedMerchant.email}`} className="text-white/90 text-sm flex items-center gap-1 hover:text-white">
                      <Mail className="w-4 h-4" />
                      E-Mail
                    </a>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="bg-white/20 rounded-lg px-3 py-1">
                  <span className="text-sm font-medium">{vouchers.length} {t.vouchers}</span>
                </div>
              </div>
            </div>
            
            {selectedMerchant.description && (
              <p className="mt-4 text-white/90 text-sm">{selectedMerchant.description}</p>
            )}
            
            {/* Social Media Links */}
            {(socialMedia.instagram || socialMedia.facebook) && (
              <div className="flex gap-2 mt-4">
                {socialMedia.instagram && (
                  <a href={socialMedia.instagram} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                    <Instagram className="w-5 h-5" />
                  </a>
                )}
                {socialMedia.facebook && (
                  <a href={socialMedia.facebook} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                    <Facebook className="w-5 h-5" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Photo Gallery */}
          {photos.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                <Camera className="w-5 h-5 text-amber-500" />
                {t.gallery || 'Galerie'}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {photos.slice(0, 4).map((photo, idx) => (
                  <div key={idx} className="aspect-video rounded-lg overflow-hidden bg-gray-200">
                    <img src={photo} alt={`${selectedMerchant.business_name} ${idx + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Opening Hours */}
            {Object.keys(openingHours).length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <h3 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  {t.openingHours || 'Öffnungszeiten'}
                </h3>
                <div className="space-y-1 text-sm">
                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                    <div key={day} className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400 capitalize">{t[day] || day}</span>
                      <span className="text-gray-800 dark:text-gray-200">{openingHours[day] || t.closed || 'Geschlossen'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Specialties & Payment */}
            <div className="space-y-4">
              {/* Specialties */}
              {specialties.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <h3 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-500" />
                    {t.specialties || 'Spezialitäten'}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {specialties.map((spec, idx) => (
                      <span key={idx} className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm">{spec}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment Methods */}
              {paymentMethods.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <h3 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-amber-500" />
                    {t.paymentMethods || 'Zahlungsarten'}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {paymentMethods.map((method, idx) => (
                      <span key={idx} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm">{method}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Vouchers Grid */}
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <Ticket className="w-5 h-5 text-amber-500" />
            {t.availableVouchers}
          </h2>

          {vouchers.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center border border-gray-200 dark:border-gray-700">
              <Ticket className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">{t.noVouchers}</p>
              <p className="text-gray-400 text-sm mt-2">{t.comingSoon}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vouchers.map((voucher) => {
                const savings = voucher.voucher_value 
                  ? Math.round((1 - (voucher.current_price || 0) / voucher.voucher_value) * 100)
                  : 95;
                const timeLeft = formatTimeLeft(voucher.end_time);
                const isEndingSoon = timeLeft.endsWith('s') || (timeLeft.endsWith('m') && parseInt(timeLeft) < 10);

                return (
                  <div
                    key={voucher.id}
                    className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all border border-gray-100 dark:border-gray-700"
                  >
                    {/* Voucher Header */}
                    <div className={`bg-gradient-to-r ${colorClass} p-4 text-white`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-white/70 text-xs">{t.winnerGets}</p>
                          <p className="text-2xl font-bold">€{voucher.voucher_value}</p>
                        </div>
                        <div className="bg-white/20 rounded-lg px-2 py-1">
                          <span className="text-sm font-bold">-{savings}%</span>
                        </div>
                      </div>
                      <p className="text-white/90 text-sm mt-2">{voucher.name || 'Gutschein'}</p>
                    </div>

                    {/* Voucher Body */}
                    <div className="p-4">
                      {voucher.description && (
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">{voucher.description}</p>
                      )}

                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <p className="text-xs text-gray-400">{t.currentPrice}</p>
                          <p className="text-xl font-bold text-amber-600">€{(voucher.current_price || 0).toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400">{t.bids}</p>
                          <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">{voucher.total_bids || 0}</p>
                        </div>
                      </div>

                      {/* Timer */}
                      <div className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg mb-3 ${
                        isEndingSoon ? 'bg-red-100 text-red-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}>
                        <Clock className="w-4 h-4" />
                        <span className="font-medium">{t.endsIn}: {timeLeft}</span>
                      </div>

                      {/* Info */}
                      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 mb-3">
                        <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                          <Gift className="w-3 h-3" />
                          {t.redeemInfo}
                        </p>
                      </div>

                      <Button
                        onClick={() => navigate(`/auctions/${voucher.auction_id || voucher.id}`)}
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        {t.bidNow}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Merchants List View
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 pt-20 pb-12">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 rounded-full mb-4">
            <Ticket className="w-5 h-5" />
            <span className="font-bold">{t.title}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">{t.subtitle}</h1>
          
          {/* How it works */}
          <div className="flex flex-wrap justify-center gap-4 mt-6 text-sm">
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-sm">
              <div className="w-6 h-6 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center font-bold text-xs">1</div>
              <span className="text-gray-600 dark:text-gray-400">{t.step1}</span>
            </div>
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-sm">
              <div className="w-6 h-6 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center font-bold text-xs">2</div>
              <span className="text-gray-600 dark:text-gray-400">{t.step2}</span>
            </div>
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-sm">
              <div className="w-6 h-6 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center font-bold text-xs">3</div>
              <span className="text-gray-600 dark:text-gray-400">{t.step3}</span>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder={t.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              {filterButtons.map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setActiveFilter(btn.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeFilter === btn.id
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  {btn.icon}
                  <span className="hidden sm:inline">{btn.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Merchants Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
          </div>
        ) : filteredMerchants.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700">
            <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">{t.noMerchants}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMerchants.map((merchant) => {
              const category = merchant.business_type || 'other';
              const colorClass = categoryColors[category] || categoryColors.other;
              const voucherCount = merchant.voucher_count || 0;
              const isPremium = merchant.is_premium;
              const isVerified = merchant.is_verified;

              return (
                <div
                  key={merchant.id}
                  onClick={() => navigate(`/haendler-gutscheine/${merchant.id}`)}
                  className={`bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all cursor-pointer group ${
                    isPremium ? 'border-2 border-yellow-400 ring-2 ring-yellow-400/20' : 'border border-gray-100 dark:border-gray-700'
                  }`}
                >
                  {/* Premium Badge */}
                  {isPremium && (
                    <div className="bg-gradient-to-r from-yellow-400 to-amber-500 px-3 py-1 text-center">
                      <span className="text-xs font-bold text-yellow-900 flex items-center justify-center gap-1">
                        <Crown className="w-3 h-3" />
                        {t.premium || 'Premium Partner'}
                      </span>
                    </div>
                  )}
                  
                  {/* Merchant Header with gradient */}
                  <div className={`bg-gradient-to-r ${colorClass} p-4 text-white relative`}>
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center overflow-hidden">
                        {merchant.logo_url ? (
                          <img src={merchant.logo_url} alt={merchant.business_name} className="w-full h-full object-cover" />
                        ) : (
                          categoryIcons[category] || <Store className="w-8 h-8" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <h3 className="font-bold text-lg truncate">{merchant.business_name}</h3>
                          {isVerified && (
                            <CheckCircle className="w-4 h-4 text-green-300 flex-shrink-0" title={t.verified} />
                          )}
                        </div>
                        <p className="text-white/80 text-sm flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {merchant.city}
                        </p>
                        {/* Rating */}
                        {merchant.rating > 0 && (
                          <div className="flex items-center gap-0.5 mt-1">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className={`w-3 h-3 ${i < merchant.rating ? 'text-yellow-300 fill-yellow-300' : 'text-white/30'}`} />
                            ))}
                            <span className="text-white/70 text-xs ml-1">({merchant.review_count || 0})</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Merchant Body */}
                  <div className="p-4">
                    {/* Description snippet */}
                    {merchant.description && (
                      <p className="text-gray-500 text-xs mb-3 line-clamp-2">{merchant.description}</p>
                    )}
                    
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Ticket className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {voucherCount} {t.vouchers}
                        </span>
                      </div>
                      {voucherCount > 0 && (
                        <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
                          {t.activeAuctions}
                        </span>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      className={`w-full transition-all ${
                        isPremium 
                          ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-yellow-900 border-yellow-400 hover:from-yellow-500 hover:to-amber-600'
                          : 'group-hover:bg-amber-500 group-hover:text-white group-hover:border-amber-500'
                      }`}
                    >
                      {t.viewMerchant}
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MerchantVouchersPage;
