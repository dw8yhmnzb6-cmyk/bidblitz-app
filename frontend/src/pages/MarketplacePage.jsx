/**
 * Marketplace - Kleinanzeigen für Kosovo/Dubai/Abu Dhabi/Deutschland
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Search, MapPin, Euro, Tag, ChevronRight, Plus, Star, Car, Home, Briefcase, Monitor, ArrowLeft, Filter } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';
const CAT_ICONS = { Immobilien: Home, Autos: Car, Elektronik: Monitor, Jobs: Briefcase, Dienstleistungen: Star, Mode: Tag };

export default function MarketplacePage() {
  const { token } = useAuth();
  const [listings, setListings] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [region, setRegion] = useState('');
  const [categories, setCategories] = useState([]);
  const [regions, setRegions] = useState([]);

  useEffect(() => {
    axios.get(`${API}/marketplace/categories`).then(r => { setCategories(r.data.categories || []); setRegions(r.data.regions || []); });
    fetchListings();
  }, []);

  const fetchListings = (cat, reg, q) => {
    const params = new URLSearchParams();
    if (cat) params.set('category', cat);
    if (reg) params.set('region', reg);
    if (q) params.set('search', q);
    axios.get(`${API}/marketplace/listings?${params}`).then(r => setListings(r.data.listings || []));
  };

  useEffect(() => { fetchListings(category, region, search); }, [category, region]);

  const doSearch = () => fetchListings(category, region, search);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 pb-24" data-testid="marketplace-page">
      <div className="px-4 pt-6 pb-4 text-center">
        <Tag className="w-10 h-10 text-pink-400 mx-auto mb-2" />
        <h1 className="text-xl font-bold text-white">Marktplatz</h1>
        <p className="text-slate-400 text-sm">Kaufen & Verkaufen</p>
      </div>

      <div className="px-4 max-w-lg mx-auto">
        {/* Search */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} onKeyPress={e => e.key === 'Enter' && doSearch()} placeholder="Suchen..." className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm placeholder-white/30" />
          </div>
          <button onClick={doSearch} className="px-4 bg-pink-500 text-white rounded-xl font-bold text-sm">Suche</button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-hide">
          <button onClick={() => setRegion('')} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${!region ? 'bg-pink-500 text-white' : 'bg-white/5 text-slate-400 border border-white/10'}`}>Alle</button>
          {regions.map(r => (<button key={r} onClick={() => setRegion(r)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${region === r ? 'bg-pink-500 text-white' : 'bg-white/5 text-slate-400 border border-white/10'}`}>{r}</button>))}
        </div>
        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
          <button onClick={() => setCategory('')} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${!category ? 'bg-cyan-500 text-white' : 'bg-white/5 text-slate-400 border border-white/10'}`}>Alle</button>
          {categories.map(c => (<button key={c} onClick={() => setCategory(c)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${category === c ? 'bg-cyan-500 text-white' : 'bg-white/5 text-slate-400 border border-white/10'}`}>{c}</button>))}
        </div>

        <p className="text-slate-500 text-xs mb-3">{listings.length} Anzeigen</p>

        {/* Listings */}
        <div className="space-y-2">
          {listings.map(l => {
            const Icon = CAT_ICONS[l.category] || Tag;
            return (
              <div key={l.id} className={`bg-white/5 border rounded-xl p-4 ${l.ad_type === 'premium' ? 'border-amber-500/30 bg-amber-500/5' : l.ad_type === 'top' ? 'border-cyan-500/30' : 'border-white/10'}`}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-pink-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-white font-bold text-sm truncate">{l.title}</h3>
                      {l.ad_type !== 'basic' && <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[9px] font-bold rounded flex-shrink-0">{l.ad_type.toUpperCase()}</span>}
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5 line-clamp-1">{l.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-slate-500 text-xs flex items-center gap-1"><MapPin className="w-3 h-3" />{l.region}</span>
                      <span className="text-slate-500 text-xs">{l.category}</span>
                      {l.price_eur && <span className="text-emerald-400 font-bold text-sm ml-auto">{l.price_eur.toLocaleString()} EUR</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {listings.length === 0 && <p className="text-center text-slate-500 py-8">Keine Anzeigen</p>}
        </div>
      </div>
    </div>
  );
}
