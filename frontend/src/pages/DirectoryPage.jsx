/**
 * Business Directory - Ärzte, Handwerker, Apotheken etc.
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Search, Phone, Globe, MapPin, Star, ChevronRight, Plus, ArrowLeft } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function DirectoryPage() {
  const { token } = useAuth();
  const [listings, setListings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');
  const [region, setRegion] = useState('');
  const [search, setSearch] = useState('');
  const regions = ['Kosovo', 'Dubai', 'Abu Dhabi', 'Deutschland'];

  useEffect(() => {
    axios.get(`${API}/directory/categories`).then(r => setCategories(r.data.categories || []));
    load();
  }, []);

  const load = (cat, reg, q) => {
    const p = new URLSearchParams();
    if (cat) p.set('category', cat);
    if (reg) p.set('region', reg);
    if (q) p.set('search', q);
    axios.get(`${API}/directory/listings?${p}`).then(r => setListings(r.data.listings || []));
  };

  useEffect(() => { load(category, region, search); }, [category, region]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white pb-24" data-testid="directory-page">
      <div className="bg-gradient-to-br from-teal-500 to-emerald-600 text-white px-6 py-10 text-center">
        <Search className="w-10 h-10 mx-auto mb-2 opacity-80" />
        <h1 className="text-2xl font-bold">Branchenbuch</h1>
        <p className="text-teal-100 text-sm">Ärzte, Handwerker, Apotheken & mehr</p>
      </div>
      <div className="max-w-lg mx-auto px-4">
        <div className="relative -mt-5 mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyPress={e => e.key === 'Enter' && load(category, region, search)} placeholder="Suchen..." className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 text-sm shadow-lg bg-white" />
        </div>
        <div className="flex gap-2 mb-2 overflow-x-auto scrollbar-hide">
          <button onClick={() => setRegion('')} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${!region ? 'bg-teal-500 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>Alle</button>
          {regions.map(r => (<button key={r} onClick={() => setRegion(r)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${region === r ? 'bg-teal-500 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>{r}</button>))}
        </div>
        <div className="flex gap-1.5 mb-4 overflow-x-auto scrollbar-hide">
          <button onClick={() => setCategory('')} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap ${!category ? 'bg-emerald-500 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>Alle</button>
          {categories.map(c => (<button key={c} onClick={() => setCategory(c)} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap ${category === c ? 'bg-emerald-500 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>{c}</button>))}
        </div>
        <div className="space-y-2">
          {listings.map(l => (
            <div key={l.id} className={`bg-white rounded-xl border p-4 ${l.listing_type === 'featured' ? 'border-teal-300 shadow-md' : l.listing_type === 'premium' ? 'border-amber-300' : 'border-slate-100'}`}>
              <div className="flex items-start justify-between mb-1">
                <h3 className="font-bold text-slate-800 text-sm">{l.business_name}</h3>
                {l.listing_type !== 'basic' && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-bold rounded">{l.listing_type.toUpperCase()}</span>}
              </div>
              <p className="text-xs text-slate-500">{l.category} · {l.region}</p>
              {l.address && <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" />{l.address}</p>}
              <div className="flex gap-3 mt-2">
                {l.phone && <a href={`tel:${l.phone}`} className="flex items-center gap-1 text-teal-600 text-xs font-medium"><Phone className="w-3 h-3" />{l.phone}</a>}
                {l.website && <a href={l.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 text-xs font-medium"><Globe className="w-3 h-3" />Website</a>}
              </div>
            </div>
          ))}
          {listings.length === 0 && <p className="text-center text-slate-400 py-8">Keine Einträge</p>}
        </div>
      </div>
    </div>
  );
}
