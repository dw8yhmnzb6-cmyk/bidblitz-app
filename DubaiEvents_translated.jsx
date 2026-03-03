/**
 * Dubai Events & Tickets Page
 * With full i18n translation support
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { Calendar, MapPin, Clock, Ticket, Star, ChevronRight, Search, Filter } from 'lucide-react';

// Translations for DubaiEvents
const eventsTranslations = {
  de: {
    title: 'Dubai Events',
    subtitle: 'Entdecke die besten Events in Dubai',
    searchPlaceholder: 'Events suchen...',
    all: 'Alle',
    experience: 'Erlebnis',
    entertainment: 'Unterhaltung',
    food: 'Food',
    shopping: 'Shopping',
    fair: 'Messe',
    free: 'Kostenlos',
    daily: 'Täglich',
    until: 'Bis'
  },
  en: {
    title: 'Dubai Events',
    subtitle: 'Discover the best events in Dubai',
    searchPlaceholder: 'Search events...',
    all: 'All',
    experience: 'Experience',
    entertainment: 'Entertainment',
    food: 'Food',
    shopping: 'Shopping',
    fair: 'Fair',
    free: 'Free',
    daily: 'Daily',
    until: 'Until'
  },
  sq: {
    title: 'Evente Dubai',
    subtitle: 'Zbulo eventet më të mira në Dubai',
    searchPlaceholder: 'Kërko evente...',
    all: 'Të gjitha',
    experience: 'Përvojë',
    entertainment: 'Argëtim',
    food: 'Ushqim',
    shopping: 'Blerje',
    fair: 'Panair',
    free: 'Falas',
    daily: 'Çdo ditë',
    until: 'Deri'
  },
  ar: {
    title: 'فعاليات دبي',
    subtitle: 'اكتشف أفضل الفعاليات في دبي',
    searchPlaceholder: 'ابحث عن فعاليات...',
    all: 'الكل',
    experience: 'تجارب',
    entertainment: 'ترفيه',
    food: 'طعام',
    shopping: 'تسوق',
    fair: 'معرض',
    free: 'مجاني',
    daily: 'يومياً',
    until: 'حتى'
  },
  tr: {
    title: 'Dubai Etkinlikleri',
    subtitle: "Dubai'deki en iyi etkinlikleri keşfedin",
    searchPlaceholder: 'Etkinlik ara...',
    all: 'Tümü',
    experience: 'Deneyim',
    entertainment: 'Eğlence',
    food: 'Yemek',
    shopping: 'Alışveriş',
    fair: 'Fuar',
    free: 'Ücretsiz',
    daily: 'Her gün',
    until: 'Kadar'
  },
  fr: {
    title: 'Événements Dubai',
    subtitle: 'Découvrez les meilleurs événements à Dubaï',
    searchPlaceholder: 'Rechercher des événements...',
    all: 'Tous',
    experience: 'Expérience',
    entertainment: 'Divertissement',
    food: 'Gastronomie',
    shopping: 'Shopping',
    fair: 'Salon',
    free: 'Gratuit',
    daily: 'Quotidien',
    until: "Jusqu'à"
  }
};

// Category translations
const categoryTranslations = {
  de: { 'Erlebnis': 'Erlebnis', 'Unterhaltung': 'Unterhaltung', 'Food': 'Food', 'Shopping': 'Shopping', 'Messe': 'Messe' },
  en: { 'Erlebnis': 'Experience', 'Unterhaltung': 'Entertainment', 'Food': 'Food', 'Shopping': 'Shopping', 'Messe': 'Fair' },
  sq: { 'Erlebnis': 'Përvojë', 'Unterhaltung': 'Argëtim', 'Food': 'Ushqim', 'Shopping': 'Blerje', 'Messe': 'Panair' },
  ar: { 'Erlebnis': 'تجارب', 'Unterhaltung': 'ترفيه', 'Food': 'طعام', 'Shopping': 'تسوق', 'Messe': 'معرض' },
  tr: { 'Erlebnis': 'Deneyim', 'Unterhaltung': 'Eğlence', 'Food': 'Yemek', 'Shopping': 'Alışveriş', 'Messe': 'Fuar' },
  fr: { 'Erlebnis': 'Expérience', 'Unterhaltung': 'Divertissement', 'Food': 'Gastronomie', 'Shopping': 'Shopping', 'Messe': 'Salon' }
};

const EVENTS = [
  { id: 1, title: 'Dubai Shopping Festival', date: '2026-03-15', location: 'Dubai Mall', price: 0, img: 'https://images.unsplash.com/photo-1580674684081-7617fbf3d745?w=400&q=80', category: 'Shopping', hot: true },
  { id: 2, title: 'Burj Khalifa Laser Show', date: '2026-03-20', location: 'Downtown Dubai', price: 0, img: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=400&q=80', category: 'Unterhaltung', hot: true },
  { id: 3, title: 'Desert Safari Premium', date: 'daily', location: 'Dubai Desert', price: 200, img: 'https://images.unsplash.com/photo-1451337516015-6b6e9a44a8a3?w=400&q=80', category: 'Erlebnis' },
  { id: 4, title: 'Dubai Food Festival', date: '2026-04-01', location: 'Various', price: 50, img: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80', category: 'Food' },
  { id: 5, title: 'Global Village Dubai', date: 'until_apr_2026', location: 'Dubai Land', price: 25, img: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=400&q=80', category: 'Unterhaltung' },
  { id: 6, title: 'Yacht Party Sunset Cruise', date: 'fri_sat', location: 'Dubai Marina', price: 350, img: 'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=400&q=80', category: 'Erlebnis', hot: true },
  { id: 7, title: 'Dubai Expo City Events', date: '2026-03-25', location: 'Expo City', price: 30, img: 'https://images.unsplash.com/photo-1580674684081-7617fbf3d745?w=400&q=80', category: 'Messe' },
  { id: 8, title: 'Skydive Dubai Tandem', date: 'daily', location: 'Palm Dropzone', price: 550, img: 'https://images.unsplash.com/photo-1521673252667-e05e7f9b8c6b?w=400&q=80', category: 'Erlebnis' },
  { id: 9, title: 'Atlantis Aquaventure', date: 'daily', location: 'Palm Jumeirah', price: 89, img: 'https://images.unsplash.com/photo-1519671282429-b44660ead0a7?w=400&q=80', category: 'Unterhaltung' },
  { id: 10, title: 'Ferrari World Abu Dhabi', date: 'daily', location: 'Yas Island', price: 120, img: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=400&q=80', category: 'Erlebnis' },
];

export default function DubaiEvents() {
  const { language } = useLanguage();
  const langKey = language === 'ae' ? 'ar' : language === 'xk' ? 'sq' : language === 'gb' ? 'en' : language;
  const t = eventsTranslations[langKey] || eventsTranslations.de;
  const catTrans = categoryTranslations[langKey] || categoryTranslations.de;
  
  const [activeCat, setActiveCat] = useState('all');
  const [search, setSearch] = useState('');

  // Categories with translations
  const CATS = [
    { id: 'all', label: t.all },
    { id: 'Erlebnis', label: t.experience },
    { id: 'Unterhaltung', label: t.entertainment },
    { id: 'Food', label: t.food },
    { id: 'Shopping', label: t.shopping },
    { id: 'Messe', label: t.fair }
  ];

  const filtered = EVENTS.filter(e => {
    const matchCat = activeCat === 'all' || e.category === activeCat;
    const matchSearch = e.title.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  // Function to translate date
  const translateDate = (date) => {
    if (date === 'daily') return t.daily;
    if (date === 'fri_sat') return langKey === 'de' ? 'Fr & Sa' : langKey === 'en' ? 'Fri & Sat' : langKey === 'tr' ? 'Cuma & Cmt' : langKey === 'fr' ? 'Ven & Sam' : langKey === 'ar' ? 'الجمعة والسبت' : 'P & Sht';
    if (date === 'until_apr_2026') return `${t.until} Apr 2026`;
    if (date.includes('-')) return date;
    return date;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white pb-24" data-testid="events-page">
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white px-6 py-10 text-center">
        <Calendar className="w-10 h-10 mx-auto mb-2 opacity-80" />
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p className="text-indigo-200 text-sm mt-1">{t.subtitle}</p>
      </div>

      <div className="max-w-2xl mx-auto px-4">
        <div className="relative mt-4 mb-3">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t.searchPlaceholder} className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 text-sm" />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-4">
          {CATS.map(c => (
            <button key={c.id} onClick={() => setActiveCat(c.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                activeCat === c.id ? 'bg-indigo-500 text-white' : 'bg-white text-slate-600 border border-slate-200'
              }`}>{c.label}</button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.map(event => (
            <div key={event.id} className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="flex">
                <img src={event.img} alt="" className="w-28 h-28 object-cover flex-shrink-0" loading="lazy" />
                <div className="p-3 flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm text-slate-800 line-clamp-1">{event.title}</h3>
                    {event.hot && <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[9px] font-bold rounded flex-shrink-0">HOT</span>}
                  </div>
                  <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                    <p className="flex items-center gap-1"><Calendar className="w-3 h-3" />{translateDate(event.date)}</p>
                    <p className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.location}</p>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold text-indigo-600">{event.price === 0 ? t.free : `${event.price} AED`}</span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded-full">{catTrans[event.category] || event.category}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
