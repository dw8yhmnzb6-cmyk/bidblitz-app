import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { 
  Utensils, MapPin, ExternalLink, Tag, Clock, 
  Percent, Euro, Gift, ChevronRight, Search,
  Star, Heart, Filter, Sparkles, Send, Building2,
  User, Mail, Phone, Globe, FileText, CheckCircle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

const translations = {
  de: {
    title: 'Restaurant-Gutscheine',
    subtitle: 'Genieße exklusive Rabatte bei unseren Partner-Restaurants',
    searchPlaceholder: 'Restaurant suchen...',
    noRestaurants: 'Aktuell keine Restaurant-Gutscheine verfügbar',
    noRestaurantsDesc: 'Schau bald wieder vorbei für neue Angebote!',
    loading: 'Lade Gutscheine...',
    visitWebsite: 'Website besuchen',
    voucherValue: 'Gutscheinwert',
    discount: 'Rabatt',
    validUntil: 'Gültig bis',
    address: 'Adresse',
    availableVouchers: 'verfügbare Gutscheine',
    oneVoucher: '1 Gutschein verfügbar',
    claimVoucher: 'Gutschein sichern',
    loginToClam: 'Einloggen zum Einlösen',
    partnerRestaurants: 'Partner-Restaurants',
    totalSavings: 'Gesamtersparnis möglich',
    featuredPartner: 'Empfohlener Partner',
    newPartner: 'Neu dabei',
    filterAll: 'Alle',
    filterNearby: 'In der Nähe',
    filterHighValue: 'Hoher Wert',
    errorLoading: 'Fehler beim Laden der Gutscheine',
    // Partner Application Form
    becomePartner: 'Partner werden',
    becomePartnerSubtitle: 'Bewerben Sie sich als Restaurant-Partner und erreichen Sie neue Kunden!',
    benefitsTitle: 'Ihre Vorteile als Partner',
    benefit1: 'Kostenlose Werbung auf unserer Plattform',
    benefit2: 'Neue Kunden durch Gutschein-Aktionen',
    benefit3: 'Einfache Verwaltung Ihrer Gutscheine',
    benefit4: 'Erhöhte Sichtbarkeit in Ihrer Region',
    formTitle: 'Jetzt bewerben',
    restaurantName: 'Restaurant-Name',
    contactName: 'Ansprechpartner',
    email: 'E-Mail-Adresse',
    phone: 'Telefon (optional)',
    website: 'Website (optional)',
    addressField: 'Straße & Hausnummer',
    city: 'Stadt',
    description: 'Was macht Ihr Restaurant besonders?',
    voucherType: 'Gutschein-Art',
    voucherTypeDiscount: 'Prozent-Rabatt',
    voucherTypeEuro: 'Euro-Gutschein',
    voucherValueLabel: 'Gutschein-Wert',
    message: 'Zusätzliche Nachricht (optional)',
    submitApplication: 'Bewerbung absenden',
    submitting: 'Wird gesendet...',
    applicationSuccess: 'Vielen Dank! Ihre Bewerbung wurde erfolgreich eingereicht.',
    applicationError: 'Fehler beim Senden der Bewerbung',
    requiredField: 'Pflichtfeld',
    categories: {
      restaurant: 'Restaurant',
      cafe: 'Café',
      fastfood: 'Fast Food',
      bar: 'Bar & Lounge'
    }
  },
  en: {
    title: 'Restaurant Vouchers',
    subtitle: 'Enjoy exclusive discounts at our partner restaurants',
    searchPlaceholder: 'Search restaurants...',
    noRestaurants: 'No restaurant vouchers available',
    noRestaurantsDesc: 'Check back soon for new offers!',
    loading: 'Loading vouchers...',
    visitWebsite: 'Visit Website',
    voucherValue: 'Voucher Value',
    discount: 'Discount',
    validUntil: 'Valid Until',
    address: 'Address',
    availableVouchers: 'available vouchers',
    oneVoucher: '1 voucher available',
    claimVoucher: 'Claim Voucher',
    loginToClam: 'Login to Claim',
    partnerRestaurants: 'Partner Restaurants',
    totalSavings: 'Total Savings Possible',
    featuredPartner: 'Featured Partner',
    newPartner: 'New Partner',
    filterAll: 'All',
    filterNearby: 'Nearby',
    filterHighValue: 'High Value',
    errorLoading: 'Error loading vouchers',
    // Partner Application Form
    becomePartner: 'Become a Partner',
    becomePartnerSubtitle: 'Apply as a restaurant partner and reach new customers!',
    benefitsTitle: 'Your Benefits as Partner',
    benefit1: 'Free advertising on our platform',
    benefit2: 'New customers through voucher campaigns',
    benefit3: 'Easy management of your vouchers',
    benefit4: 'Increased visibility in your region',
    formTitle: 'Apply Now',
    restaurantName: 'Restaurant Name',
    contactName: 'Contact Person',
    email: 'Email Address',
    phone: 'Phone (optional)',
    website: 'Website (optional)',
    addressField: 'Street & Number',
    city: 'City',
    description: 'What makes your restaurant special?',
    voucherType: 'Voucher Type',
    voucherTypeDiscount: 'Percentage Discount',
    voucherTypeEuro: 'Euro Voucher',
    voucherValueLabel: 'Voucher Value',
    message: 'Additional Message (optional)',
    submitApplication: 'Submit Application',
    submitting: 'Submitting...',
    applicationSuccess: 'Thank you! Your application has been submitted successfully.',
    applicationError: 'Error submitting application',
    requiredField: 'Required field',
    categories: {
      restaurant: 'Restaurant',
      cafe: 'Café',
      fastfood: 'Fast Food',
      bar: 'Bar & Lounge'
    }
  },
  sq: {
    title: 'Kuponat e Restoranteve',
    subtitle: 'Shijo zbritje ekskluzive në restorantet tona partnere',
    searchPlaceholder: 'Kërko restorante...',
    noRestaurants: 'Nuk ka kupona restorantesh të disponueshme',
    noRestaurantsDesc: 'Kontrollo përsëri së shpejti për oferta të reja!',
    loading: 'Duke ngarkuar kuponat...',
    visitWebsite: 'Vizito Faqen',
    voucherValue: 'Vlera e Kuponit',
    discount: 'Zbritje',
    validUntil: 'I vlefshëm deri',
    address: 'Adresa',
    availableVouchers: 'kupona të disponueshme',
    oneVoucher: '1 kupon i disponueshëm',
    claimVoucher: 'Merr Kuponin',
    loginToClam: 'Hyni për të Marrë',
    partnerRestaurants: 'Restorantet Partnere',
    totalSavings: 'Kursime të Mundshme',
    featuredPartner: 'Partner i Rekomanduar',
    newPartner: 'Partner i Ri',
    filterAll: 'Të gjitha',
    filterNearby: 'Afër',
    filterHighValue: 'Vlerë e Lartë',
    errorLoading: 'Gabim gjatë ngarkimit të kuponave',
    // Partner Application Form
    becomePartner: 'Bëhu Partner',
    becomePartnerSubtitle: 'Apliko si partner restoranti dhe arrij klientë të rinj!',
    benefitsTitle: 'Përfitimet Tuaja si Partner',
    benefit1: 'Reklamim falas në platformën tonë',
    benefit2: 'Klientë të rinj përmes aksioneve me kupona',
    benefit3: 'Menaxhim i lehtë i kuponave tuaja',
    benefit4: 'Dukshmëri e shtuar në rajonin tuaj',
    formTitle: 'Apliko Tani',
    restaurantName: 'Emri i Restorantit',
    contactName: 'Personi Kontaktues',
    email: 'Adresa Email',
    phone: 'Telefoni (opsional)',
    website: 'Faqja Web (opsional)',
    addressField: 'Rruga & Numri',
    city: 'Qyteti',
    description: 'Çfarë e bën restorantin tuaj të veçantë?',
    voucherType: 'Lloji i Kuponit',
    voucherTypeDiscount: 'Zbritje në Përqindje',
    voucherTypeEuro: 'Kupon Euro',
    voucherValueLabel: 'Vlera e Kuponit',
    message: 'Mesazh Shtesë (opsional)',
    submitApplication: 'Dërgo Aplikimin',
    submitting: 'Duke dërguar...',
    applicationSuccess: 'Faleminderit! Aplikimi juaj u dërgua me sukses.',
    applicationError: 'Gabim gjatë dërgimit të aplikimit',
    requiredField: 'Fushë e detyrueshme',
    categories: {
      restaurant: 'Restorant',
      cafe: 'Kafe',
      fastfood: 'Fast Food',
      bar: 'Bar & Lounge'
    }
  }
};

// Map xk to sq
translations.xk = translations.sq;

const RestaurantVouchersPage = () => {
  const { language, mappedLanguage } = useLanguage();
  const { isDarkMode } = useTheme();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [totalVouchers, setTotalVouchers] = useState(0);
  
  // Partner Application Form State
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [applicationSuccess, setApplicationSuccess] = useState(false);
  const [formData, setFormData] = useState({
    restaurant_name: '',
    contact_name: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    city: '',
    description: '',
    voucher_type: 'discount',
    voucher_value: 10,
    message: ''
  });

  const langKey = mappedLanguage || language || 'de';
  const t = translations[langKey] || translations.de;

  useEffect(() => {
    fetchRestaurantVouchers();
  }, []);

  const fetchRestaurantVouchers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/vouchers/restaurants`);
      if (response.ok) {
        const data = await response.json();
        setRestaurants(data.restaurants || []);
        setTotalVouchers(data.total_vouchers || 0);
      } else {
        console.error('Failed to fetch restaurant vouchers');
      }
    } catch (error) {
      console.error('Error fetching restaurant vouchers:', error);
      toast.error(t.errorLoading);
    } finally {
      setLoading(false);
    }
  };

  // Filter restaurants based on search term
  const filteredRestaurants = restaurants.filter(restaurant => {
    const matchesSearch = restaurant.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          restaurant.address?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeFilter === 'highValue') {
      // Filter for vouchers with value >= 20
      return matchesSearch && restaurant.vouchers?.some(v => v.value >= 20);
    }
    
    return matchesSearch;
  });

  // Calculate total potential savings
  const totalSavings = restaurants.reduce((sum, restaurant) => {
    return sum + (restaurant.vouchers?.reduce((vSum, v) => vSum + (v.value || 0), 0) || 0);
  }, 0);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(langKey === 'de' ? 'de-DE' : langKey === 'sq' || langKey === 'xk' ? 'sq-AL' : 'en-US', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen pt-20 flex items-center justify-center ${isDarkMode ? 'bg-[#050509]' : 'bg-gradient-to-b from-cyan-50 to-cyan-100'}`}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{t.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen pt-20 pb-12 ${isDarkMode ? 'bg-[#050509]' : 'bg-gradient-to-b from-cyan-50 to-cyan-100'}`} data-testid="restaurant-vouchers-page">
      {/* Hero Section */}
      <div className={`relative overflow-hidden ${isDarkMode ? 'bg-gradient-to-r from-orange-900/30 to-amber-900/30' : 'bg-gradient-to-r from-orange-100 to-amber-100'}`}>
        <div className="max-w-7xl mx-auto px-4 py-12 sm:py-16">
          <div className="text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 mb-4">
              <Utensils className="w-5 h-5 text-orange-500" />
              <span className={`font-medium ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                {restaurants.length} {t.partnerRestaurants}
              </span>
            </div>
            
            <h1 className={`text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {t.title}
            </h1>
            <p className={`text-base sm:text-lg max-w-2xl mx-auto mb-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {t.subtitle}
            </p>

            {/* Stats */}
            <div className="flex flex-wrap justify-center gap-4 sm:gap-8">
              <div className={`px-6 py-3 rounded-xl ${isDarkMode ? 'bg-white/5' : 'bg-white/70'} backdrop-blur-sm`}>
                <div className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-orange-500" />
                  <span className={`font-bold text-xl ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{totalVouchers}</span>
                </div>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{t.availableVouchers}</p>
              </div>
              
              <div className={`px-6 py-3 rounded-xl ${isDarkMode ? 'bg-white/5' : 'bg-white/70'} backdrop-blur-sm`}>
                <div className="flex items-center gap-2">
                  <Euro className="w-5 h-5 text-green-500" />
                  <span className={`font-bold text-xl ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{totalSavings}€</span>
                </div>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{t.totalSavings}</p>
              </div>
            </div>
          </div>

          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl" />
        </div>
      </div>

      {/* Search and Filter */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          {/* Search */}
          <div className="relative w-full sm:w-96">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-3 rounded-xl border ${
                isDarkMode 
                  ? 'bg-white/5 border-white/10 text-white placeholder-gray-500 focus:border-orange-500' 
                  : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-orange-500'
              } outline-none transition-colors`}
              data-testid="search-input"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            {['all', 'highValue'].map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  activeFilter === filter
                    ? 'bg-orange-500 text-white'
                    : isDarkMode
                      ? 'bg-white/5 text-gray-400 hover:bg-white/10'
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
                data-testid={`filter-${filter}`}
              >
                {filter === 'all' ? t.filterAll : t.filterHighValue}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Restaurant Cards */}
      <div className="max-w-7xl mx-auto px-4 pb-12">
        {filteredRestaurants.length === 0 ? (
          <div className={`text-center py-16 rounded-2xl ${isDarkMode ? 'bg-white/5' : 'bg-white'}`}>
            <Utensils className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`} />
            <h3 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {t.noRestaurants}
            </h3>
            <p className={`${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              {t.noRestaurantsDesc}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRestaurants.map((restaurant, index) => (
              <div
                key={restaurant.name || index}
                className={`group relative rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${
                  isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-100 shadow-sm'
                }`}
                data-testid={`restaurant-card-${index}`}
              >
                {/* Featured Badge */}
                {index === 0 && (
                  <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {t.featuredPartner}
                  </div>
                )}

                {/* Restaurant Header */}
                <div className={`p-6 border-b ${isDarkMode ? 'border-white/10' : 'border-gray-100'}`}>
                  <div className="flex items-start gap-4">
                    {/* Logo/Icon */}
                    <div className={`w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isDarkMode ? 'bg-orange-500/20' : 'bg-orange-100'
                    }`}>
                      {restaurant.logo ? (
                        <img 
                          src={restaurant.logo} 
                          alt={restaurant.name} 
                          className="w-12 h-12 object-contain rounded-lg"
                        />
                      ) : (
                        <Utensils className="w-8 h-8 text-orange-500" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-lg font-bold truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {restaurant.name}
                      </h3>
                      
                      {restaurant.address && (
                        <div className={`flex items-start gap-1.5 mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span className="text-sm line-clamp-2">{restaurant.address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Vouchers */}
                <div className="p-6 space-y-4">
                  {restaurant.vouchers?.slice(0, 2).map((voucher, vIndex) => (
                    <div 
                      key={voucher.id || vIndex}
                      className={`p-4 rounded-xl ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {voucher.discount_percent ? (
                            <>
                              <Percent className="w-5 h-5 text-green-500" />
                              <span className={`font-bold text-lg ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                                {voucher.discount_percent}% {t.discount}
                              </span>
                            </>
                          ) : (
                            <>
                              <Euro className="w-5 h-5 text-amber-500" />
                              <span className={`font-bold text-lg ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>
                                {voucher.value}€ {t.voucherValue}
                              </span>
                            </>
                          )}
                        </div>
                        <Tag className={`w-4 h-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                      </div>
                      
                      {voucher.description && (
                        <p className={`text-sm mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {voucher.description}
                        </p>
                      )}
                      
                      {voucher.expires_at && (
                        <div className={`flex items-center gap-1.5 text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                          <Clock className="w-3.5 h-3.5" />
                          <span>{t.validUntil}: {formatDate(voucher.expires_at)}</span>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Show more indicator */}
                  {restaurant.vouchers?.length > 2 && (
                    <p className={`text-center text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      +{restaurant.vouchers.length - 2} {t.availableVouchers}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className={`px-6 pb-6 pt-2 flex gap-3`}>
                  {restaurant.url && (
                    <a
                      href={restaurant.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
                        isDarkMode 
                          ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30' 
                          : 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                      }`}
                      data-testid={`visit-website-${index}`}
                    >
                      <ExternalLink className="w-4 h-4" />
                      {t.visitWebsite}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RestaurantVouchersPage;
