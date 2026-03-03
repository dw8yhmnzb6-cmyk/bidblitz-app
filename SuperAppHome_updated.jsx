/**
 * BidBlitz Super-App Homepage - Alipay Style with Multi-Language Support
 * Updated with Location Selection and Real-time Bids Balance
 */
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getSuperAppTranslation } from '../i18n/superAppTranslations';

import axios from 'axios';
import {
  QrCode, Wallet, Send, Bike, Search, ChevronRight, Star,
  Gavel, Gift, CreditCard, MapPin, Ticket, ShoppingBag,
  Coffee, Plane, Building2, Smartphone, Heart, Trophy,
  Zap, Shield, HelpCircle, Banknote, Globe, Map,
  Clock, Users, Percent, Crown, Bell, ArrowRight, Sparkles, Calendar, Car, FileText, Tag, ChevronDown, X
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Location options
const LOCATIONS = [
  { id: 'dubai', name: 'Dubai', flag: '🇦🇪', country: 'VAE' },
  { id: 'kosovo', name: 'Kosovo', flag: '🇽🇰', country: 'Kosovo' },
  { id: 'deutschland', name: 'Deutschland', flag: '🇩🇪', country: 'Deutschland' },
  { id: 'oesterreich', name: 'Österreich', flag: '🇦🇹', country: 'Österreich' },
  { id: 'schweiz', name: 'Schweiz', flag: '🇨🇭', country: 'Schweiz' },
];

export default function SuperAppHome() {
  const { isAuthenticated, user, token } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('auktionen');
  const [auctions, setAuctions] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [bidsBalance, setBidsBalance] = useState(0);
  
  // Location state
  const [selectedLocation, setSelectedLocation] = useState(() => {
    const saved = localStorage.getItem('bidblitz_location');
    return saved ? JSON.parse(saved) : LOCATIONS[0];
  });
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // Translation helper
  const t = (key) => getSuperAppTranslation(language, key);

  // Category tabs with translations
  const CATEGORIES = {
    auktionen: {
      label: t('auctions'),
      items: [
        { icon: Gavel, label: t('liveAuctions'), to: '/auctions', color: 'text-cyan-500', bg: 'bg-cyan-50' },
        { icon: Crown, label: t('vipAuctions'), to: '/vip-auctions', color: 'text-amber-500', bg: 'bg-amber-50' },
        { icon: Trophy, label: t('leaderboard'), to: '/leaderboard', color: 'text-purple-500', bg: 'bg-purple-50' },
        { icon: Gift, label: t('voucherAuctions'), to: '/auctions?scrollTo=gratis', color: 'text-green-500', bg: 'bg-green-50' },
        { icon: Sparkles, label: t('mysteryBox'), to: '/mystery-box', color: 'text-pink-500', bg: 'bg-pink-50' },
        { icon: Zap, label: t('buyBids'), to: '/buy-bids', color: 'text-orange-500', bg: 'bg-orange-50' },
        { icon: Clock, label: t('lastChance'), to: '/last-chance', color: 'text-red-500', bg: 'bg-red-50' },
        { icon: Users, label: t('inviteFriends'), to: '/invite', color: 'text-blue-500', bg: 'bg-blue-50' },
      ]
    },
    mobility: {
      label: t('mobility'),
      items: [
        { icon: Car, label: t('taxi'), to: '/taxi', color: 'text-blue-500', bg: 'bg-blue-50' },
        { icon: Bike, label: t('eScooter'), to: '/scooter', color: 'text-emerald-500', bg: 'bg-emerald-50' },
        { icon: Map, label: t('map'), to: '/scooter', color: 'text-blue-500', bg: 'bg-blue-50' },
        { icon: Crown, label: t('scooterAbo'), to: '/scooter-abo', color: 'text-amber-500', bg: 'bg-amber-50' },
        { icon: Users, label: t('groupRide'), to: '/gruppen-fahrt', color: 'text-violet-500', bg: 'bg-violet-50' },
        { icon: MapPin, label: t('dealerFinder'), to: '/haendler-finder', color: 'text-orange-500', bg: 'bg-orange-50' },
        { icon: Shield, label: t('safeRiding'), to: '/scooter-guide', color: 'text-teal-500', bg: 'bg-teal-50' },
        { icon: Star, label: t('reviews'), to: '/scooter-bewertungen', color: 'text-yellow-500', bg: 'bg-yellow-50' },
        { icon: Clock, label: t('rideHistory'), to: '/dashboard', color: 'text-slate-500', bg: 'bg-slate-50' },
      ]
    },
    essen: {
      label: t('food'),
      items: [
        { icon: Coffee, label: t('orderFood'), to: '/essen-bestellen', color: 'text-orange-500', bg: 'bg-orange-50' },
        { icon: Coffee, label: t('restaurants'), to: '/auctions?scrollTo=restaurant', color: 'text-orange-500', bg: 'bg-orange-50' },
        { icon: Ticket, label: t('restaurantVouchers'), to: '/haendler-gutscheine', color: 'text-red-500', bg: 'bg-red-50' },
        { icon: MapPin, label: t('nearby'), to: '/haendler-finder', color: 'text-emerald-500', bg: 'bg-emerald-50' },
        { icon: Star, label: t('topRated'), to: '/haendler-finder', color: 'text-amber-500', bg: 'bg-amber-50' },
      ]
    },
    shopping: {
      label: t('shopping'),
      items: [
        { icon: Tag, label: t('marketplace'), to: '/marktplatz', color: 'text-pink-500', bg: 'bg-pink-50' },
        { icon: ShoppingBag, label: t('deals'), to: '/deal-radar', color: 'text-pink-500', bg: 'bg-pink-50' },
        { icon: Percent, label: t('cashback'), to: '/features', color: 'text-green-500', bg: 'bg-green-50' },
        { icon: Gift, label: t('giftCards'), to: '/gift-cards', color: 'text-purple-500', bg: 'bg-purple-50' },
        { icon: Ticket, label: t('coupons'), to: '/features', color: 'text-blue-500', bg: 'bg-blue-50' },
        { icon: CreditCard, label: t('bidblitzPay'), to: '/bidblitz-pay-info', color: 'text-emerald-500', bg: 'bg-emerald-50' },
        { icon: Banknote, label: t('microLoans'), to: '/loans', color: 'text-teal-500', bg: 'bg-teal-50' },
      ]
    },
    services: {
      label: t('services'),
      items: [
        { icon: Wallet, label: t('wallet'), to: '/pay', color: 'text-blue-500', bg: 'bg-blue-50' },
        { icon: Crown, label: t('loyaltyPoints'), to: '/treuepunkte', color: 'text-amber-500', bg: 'bg-amber-50' },
        { icon: Gift, label: t('inviteFriends'), to: '/treuepunkte', color: 'text-emerald-500', bg: 'bg-emerald-50' },
        { icon: Building2, label: t('hotels'), to: '/services', color: 'text-blue-500', bg: 'bg-blue-50' },
        { icon: Shield, label: t('insurance'), to: '/versicherung', color: 'text-emerald-500', bg: 'bg-emerald-50' },
        { icon: CreditCard, label: t('crypto'), to: '/krypto', color: 'text-amber-500', bg: 'bg-amber-50' },
        { icon: Search, label: t('directory'), to: '/branchenverzeichnis', color: 'text-teal-500', bg: 'bg-teal-50' },
        { icon: HelpCircle, label: t('support'), to: '/support-tickets', color: 'text-violet-500', bg: 'bg-violet-50' },
        { icon: Globe, label: t('currencyCalc'), to: '/waehrungsrechner', color: 'text-cyan-500', bg: 'bg-cyan-50' },
        { icon: FileText, label: t('invoices'), to: '/rechnungen', color: 'text-cyan-500', bg: 'bg-cyan-50' },
        { icon: Smartphone, label: t('topUpMobile'), to: '/handy-aufladen', color: 'text-pink-500', bg: 'bg-pink-50' },
        { icon: Calendar, label: t('events'), to: '/dubai-events', color: 'text-amber-500', bg: 'bg-amber-50' },
        { icon: Plane, label: t('dubaiEvents'), to: '/dubai-events', color: 'text-blue-600', bg: 'bg-blue-50' },
        { icon: Building2, label: t('forPartners'), to: '/partner-landing', color: 'text-slate-500', bg: 'bg-slate-50' },
      ]
    },
  };

  // Fetch data
  useEffect(() => {
    // Fetch auctions (optionally filter by location)
    axios.get(`${API}/auctions`).then(r => setAuctions((r.data || []).slice(0, 6))).catch(() => {});
    
    // Fetch wallet and bids balance
    if (isAuthenticated && token) {
      // Fetch wallet balance
      axios.get(`${API}/bidblitz-pay/main-balance`, { 
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => {
        setWalletBalance(Math.round((r.data.bidblitz_balance || 0) * 100));
      }).catch(() => {});
      
      // Fetch current bids balance from user profile
      axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => {
        setBidsBalance(r.data.bids_balance || 0);
      }).catch(() => {});
    }
  }, [isAuthenticated, token]);

  // Save location to localStorage
  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
    localStorage.setItem('bidblitz_location', JSON.stringify(location));
    setShowLocationPicker(false);
  };

  const tabKeys = Object.keys(CATEGORIES);
  const currentItems = CATEGORIES[activeTab]?.items || [];

  // Get explore section title based on location
  const getExploreTitle = () => {
    if (selectedLocation.id === 'dubai') return t('exploreDubai');
    if (selectedLocation.id === 'kosovo') return language === 'sq' ? 'Eksploro Kosovën' : 'Erkunde Kosovo';
    if (selectedLocation.id === 'deutschland') return language === 'de' ? 'Erkunde Deutschland' : 'Explore Germany';
    return t('exploreDubai');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-20" data-testid="super-app-home">
      
      {/* TOP BAR */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 pt-3 pb-5 text-white">
        <div className="flex items-center justify-between mb-4 max-w-lg mx-auto">
          {/* Location Selector */}
          <button 
            onClick={() => setShowLocationPicker(true)}
            className="flex items-center gap-2 bg-white/20 rounded-full px-3 py-1.5 hover:bg-white/30 transition-all"
            data-testid="location-selector"
          >
            <MapPin className="w-4 h-4" />
            <span className="font-medium text-sm">{selectedLocation.flag} {selectedLocation.name}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          
          <div className="flex-1 mx-3">
            <div className="flex items-center bg-white/20 rounded-full px-4 py-2 backdrop-blur">
              <Search className="w-4 h-4 text-white/70" />
              <input type="text" placeholder={t('search')} className="bg-transparent text-white placeholder-white/60 text-sm ml-2 w-full outline-none" />
            </div>
          </div>
          <Link to="/notifications" className="relative">
            <Bell className="w-5 h-5" />
          </Link>
        </div>

        {/* 5 Main Actions */}
        <div className="grid grid-cols-5 gap-2 max-w-lg mx-auto">
          <Link to="/scooter" className="flex flex-col items-center gap-1.5 group" data-testid="action-scan">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:bg-white/30 transition-all backdrop-blur">
              <QrCode className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium">{t('scan')}</span>
          </Link>
          <Link to="/pay" className="flex flex-col items-center gap-1.5 group" data-testid="action-pay">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:bg-white/30 transition-all backdrop-blur">
              <Send className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium">{t('pay')}</span>
          </Link>
          <Link to="/scooter" className="flex flex-col items-center gap-1.5 group" data-testid="action-transport">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:bg-white/30 transition-all backdrop-blur">
              <Bike className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium">{t('transport')}</span>
          </Link>
          <Link to="/pay" className="flex flex-col items-center gap-1.5 group" data-testid="action-wallet">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:bg-white/30 transition-all backdrop-blur">
              <Wallet className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium">{t('wallet')}</span>
          </Link>
          <Link to="/marktplatz" className="flex flex-col items-center gap-1.5 group" data-testid="action-market">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:bg-white/30 transition-all backdrop-blur">
              <Tag className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium">{t('marketplace')}</span>
          </Link>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4">

        {/* WALLET QUICK VIEW - Updated with real bids balance */}
        {isAuthenticated && (
          <Link to="/pay" className="block -mt-3 mb-4 bg-white rounded-2xl shadow-lg p-4 border border-slate-100" data-testid="wallet-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('myWallet')}</p>
                  <p className="text-lg font-bold text-slate-800">{'\u20AC'}{(walletBalance / 100).toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-blue-600 font-medium">{bidsBalance || user?.bids_balance || 0} {t('bids')}</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          </Link>
        )}

        {/* CATEGORY TABS */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-4">
          <div className="flex border-b border-slate-100 overflow-x-auto scrollbar-hide">
            {tabKeys.map(key => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex-1 min-w-[80px] py-3 text-sm font-medium text-center transition-all whitespace-nowrap ${
                  activeTab === key ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'
                }`}
              >
                {CATEGORIES[key].label}
              </button>
            ))}
          </div>

          <div className="p-4">
            <div className="grid grid-cols-4 gap-4">
              {currentItems.map((item, i) => (
                <Link key={i} to={item.to} className="flex flex-col items-center gap-1.5 group" data-testid={`cat-item-${i}`}>
                  <div className={`w-11 h-11 ${item.bg} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <item.icon className={`w-5 h-5 ${item.color}`} />
                  </div>
                  <span className="text-[11px] text-slate-700 text-center leading-tight font-medium">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* SPECIAL OFFERS */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-800">{t('offers')}</h2>
            <Link to="/auctions" className="text-blue-600 text-sm flex items-center gap-1">{t('more')} <ChevronRight className="w-4 h-4" /></Link>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
            {auctions.slice(0, 4).map((a, i) => (
              <Link key={a.id} to={`/auctions/${a.id}`}
                className="flex-shrink-0 w-[160px] bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="h-24 bg-slate-100 flex items-center justify-center overflow-hidden">
                  <img src={a.product?.image_url || 'https://via.placeholder.com/160'} alt="" className="w-full h-full object-cover" loading="lazy" />
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-medium text-slate-800 line-clamp-1">{a.title}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm font-bold text-blue-600">{'\u20AC'}{a.current_price?.toFixed(2)}</span>
                    <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">-99%</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* EXPLORE SECTION - Dynamic based on location */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-800">{getExploreTitle()}</h2>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/haendler-finder" className="relative h-32 rounded-2xl overflow-hidden shadow-md group">
              <img 
                src={selectedLocation.id === 'dubai' 
                  ? "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=400&q=80"
                  : selectedLocation.id === 'kosovo'
                  ? "https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=400&q=80"
                  : "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=400&q=80"
                } 
                alt={selectedLocation.name} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-3 left-3">
                <p className="text-white font-bold text-lg leading-tight">
                  {selectedLocation.id === 'dubai' ? t('dubaiGuide') : `${selectedLocation.name} Guide`}
                </p>
              </div>
            </Link>
            <Link to="/auctions" className="relative h-32 rounded-2xl overflow-hidden shadow-md group">
              <img 
                src={selectedLocation.id === 'dubai'
                  ? "https://images.unsplash.com/photo-1518684079-3c830dcef090?w=400&q=80"
                  : selectedLocation.id === 'kosovo'
                  ? "https://images.unsplash.com/photo-1555990538-1e7e0d836b0e?w=400&q=80"
                  : "https://images.unsplash.com/photo-1560969184-10fe8719e047?w=400&q=80"
                }
                alt={`${selectedLocation.name} Auctions`} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-3 left-3">
                <p className="text-white font-bold text-lg leading-tight">
                  {selectedLocation.id === 'dubai' ? t('dubaiAuctions') : `${selectedLocation.name} Auktionen`}
                </p>
              </div>
            </Link>
          </div>
        </div>

        {/* QUICK SERVICES ROW */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-4 mb-4 text-white">
          <p className="font-bold text-sm mb-3">{t('quickAccess')}</p>
          <div className="grid grid-cols-5 gap-3">
            {[
              { icon: Gavel, label: t('bid'), to: '/auctions' },
              { icon: Bike, label: t('scooter'), to: '/scooter' },
              { icon: Gift, label: t('gifts'), to: '/gift-bids' },
              { icon: HelpCircle, label: t('help'), to: '/support-tickets' },
              { icon: Tag, label: t('marketplace'), to: '/marktplatz' },
            ].map((s, i) => (
              <Link key={i} to={s.to} className="flex flex-col items-center gap-1">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur">
                  <s.icon className="w-5 h-5" />
                </div>
                <span className="text-[10px]">{s.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* PARTNER BECOME CTA */}
        <Link to="/partner-landing" className="block bg-white rounded-2xl border border-slate-100 p-4 mb-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-amber-500" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-slate-800 text-sm">{t('becomePartner')}</p>
              <p className="text-xs text-slate-500">{t('earnWith')}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300" />
          </div>
        </Link>
      </div>

      {/* Location Picker Modal */}
      {showLocationPicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowLocationPicker(false)}>
          <div 
            className="bg-white w-full sm:w-96 rounded-t-3xl sm:rounded-2xl max-h-[70vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-800">
                {language === 'de' ? 'Standort wählen' : language === 'en' ? 'Select Location' : language === 'sq' ? 'Zgjidh Vendndodhjen' : language === 'tr' ? 'Konum Seç' : 'Standort wählen'}
              </h3>
              <button onClick={() => setShowLocationPicker(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-2 max-h-[50vh] overflow-y-auto">
              {LOCATIONS.map(location => (
                <button
                  key={location.id}
                  onClick={() => handleLocationSelect(location)}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all ${
                    selectedLocation.id === location.id 
                      ? 'bg-blue-50 border-2 border-blue-500' 
                      : 'hover:bg-slate-50 border-2 border-transparent'
                  }`}
                >
                  <span className="text-3xl">{location.flag}</span>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-slate-800">{location.name}</p>
                    <p className="text-xs text-slate-500">{location.country}</p>
                  </div>
                  {selectedLocation.id === location.id && (
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
