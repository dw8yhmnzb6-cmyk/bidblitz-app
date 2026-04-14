import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Search, Play, Star, Clock, Film, Tv, BookOpen, Heart, Plus, Crown, Check } from "lucide-react";
const API = process.env.REACT_APP_BACKEND_URL;
const TYPE_LABELS = {film:"Film",serie:"Serie",doku:"Doku"};
const TYPE_ICONS = {film:Film,serie:Tv,doku:BookOpen};

export default function StreamingPage({ onBack }) {
  const [catalog, setCatalog] = useState([]);
  const [plans, setPlans] = useState([]);
  const [watchlist, setWatchlist] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("browse");

  useEffect(() => { load(); }, [typeFilter]);
  const load = async () => {
    try {
      const p = typeFilter?`?type=${typeFilter}`:"";
      const [r1,r2,r3] = await Promise.all([fetch(`${API}/api/streaming/catalog${p}`),fetch(`${API}/api/streaming/plans`),fetch(`${API}/api/streaming/watchlist`,{credentials:"include"}).catch(()=>({ok:false}))]);
      const d1=await r1.json(); const d2=await r2.json();
      setCatalog(d1.catalog||[]); setPlans(d2.plans||[]);
      if(r3.ok){const d3=await r3.json();setWatchlist(new Set((d3.watchlist||[]).map(w=>w.content_id)));}
    } catch {} setLoading(false);
  };
  const toggleWL = async(id)=>{try{await fetch(`${API}/api/streaming/watchlist/toggle`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({content_id:id})});setWatchlist(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});}catch{}};
  const filtered = catalog.filter(c=>!search||c.title?.toLowerCase().includes(search.toLowerCase()));

  if(selected){const c=selected;return(
    <div className="min-h-screen pb-24" style={{background:"var(--bg-primary,#030303)"}}>
      <div className="relative"><img src={c.image} alt={c.title} className="w-full h-64 object-cover"/><div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"/>
        <button onClick={()=>setSelected(null)} className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center" data-testid="str-back2"><ArrowLeft size={20} className="text-white"/></button>
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex gap-2 mb-2">{c.premium&&<span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500 text-black flex items-center gap-1"><Crown size={10}/>PREMIUM</span>}<span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/20 text-white">{TYPE_LABELS[c.type]||c.type}</span></div>
          <h1 className="text-white text-xl font-bold">{c.title}</h1>
          <div className="flex items-center gap-3 mt-1 text-white/70 text-xs"><span>{c.year}</span><span>{c.duration_min} Min.</span><span className="flex items-center gap-1"><Star size={12} className="text-yellow-400"/>{c.rating}</span></div>
        </div>
      </div>
      <div className="px-4 py-5 space-y-4">
        <p className="text-sm leading-relaxed" style={{color:"var(--text-secondary,#aaa)"}}>{c.description}</p>
        {c.seasons&&<div className="text-xs" style={{color:"var(--text-secondary,#888)"}}>{c.seasons} Staffeln · {c.episodes} Episoden</div>}
        <div className="flex gap-3">
          <button className="flex-1 py-3 rounded-xl font-semibold text-sm text-black flex items-center justify-center gap-2" style={{background:"#00C2FF"}} data-testid="str-play"><Play size={16}/>Abspielen</button>
          <button onClick={()=>toggleWL(c.content_id)} className="w-12 h-12 rounded-xl flex items-center justify-center" style={{background:"var(--bg-card,#111)"}} data-testid="str-wl"><Heart size={20} className={watchlist.has(c.content_id)?"text-red-500 fill-red-500":"text-white"}/></button>
        </div>
        <div className="text-xs" style={{color:"var(--text-secondary,#666)"}}>{c.views?.toLocaleString()} Aufrufe</div>
      </div>
    </div>
  );}

  return (
    <div className="min-h-screen pb-24" style={{background:"var(--bg-primary,#030303)"}}>
      <div className="sticky top-0 z-30 px-4 pt-4 pb-3" style={{background:"var(--bg-primary,#030303)"}}>
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:"var(--bg-card,#111)"}} data-testid="str-back"><ArrowLeft size={20} style={{color:"var(--text-primary,#fff)"}}/></button>
          <h1 className="text-lg font-bold" style={{color:"var(--text-primary,#fff)"}}>Streaming</h1>
        </div>
        <div className="relative mb-3"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{color:"var(--text-secondary,#666)"}}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Film oder Serie suchen..." className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm" style={{background:"var(--bg-card,#111)",color:"var(--text-primary,#fff)",border:"1px solid rgba(255,255,255,0.06)"}} data-testid="str-search"/></div>
        <div className="flex gap-2">
          {["","film","serie","doku"].map(t=>(<button key={t} onClick={()=>setTypeFilter(t)} className="px-3 py-1.5 rounded-full text-xs font-medium" style={{background:typeFilter===t?"#00C2FF":"var(--bg-card,#111)",color:typeFilter===t?"#000":"var(--text-secondary,#aaa)"}} data-testid={`str-type-${t||"all"}`}>{t?TYPE_LABELS[t]:"Alle"}</button>))}
        </div>
      </div>
      <div className="px-4 space-y-3">
        {loading?<div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{borderColor:"#00C2FF",borderTopColor:"transparent"}}/></div>:filtered.map(c=>(
          <motion.div key={c.content_id} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="rounded-2xl overflow-hidden cursor-pointer" style={{background:"var(--bg-card,#111)",border:"1px solid rgba(255,255,255,0.05)"}} onClick={()=>setSelected(c)} data-testid={`str-card-${c.content_id}`}>
            <div className="relative"><img src={c.image} alt={c.title} className="w-full h-44 object-cover" loading="lazy"/><div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"/>
              {c.premium&&<span className="absolute top-3 left-3 px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500 text-black flex items-center gap-1"><Crown size={10}/>PREMIUM</span>}
              <button onClick={e=>{e.stopPropagation();toggleWL(c.content_id);}} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur flex items-center justify-center"><Heart size={14} className={watchlist.has(c.content_id)?"text-red-500 fill-red-500":"text-white"}/></button>
              <div className="absolute bottom-3 left-3 flex items-center gap-2"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/20 text-white">{TYPE_LABELS[c.type]}</span><span className="text-white/70 text-xs">{c.year}</span></div>
            </div>
            <div className="p-3"><h3 className="text-sm font-semibold" style={{color:"var(--text-primary,#fff)"}}>{c.title}</h3>
              <div className="flex items-center justify-between mt-1"><div className="flex items-center gap-1"><Star size={12} className="text-yellow-400 fill-yellow-400"/><span className="text-xs" style={{color:"var(--text-primary,#fff)"}}>{c.rating}</span></div><span className="text-xs" style={{color:"var(--text-secondary,#888)"}}>{c.duration_min} Min.</span></div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
