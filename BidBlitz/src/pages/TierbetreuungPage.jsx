import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Star, Heart, Dog, Cat, Stethoscope, Car, Footprints, MapPin, CheckCircle, Calendar } from "lucide-react";
const API = process.env.REACT_APP_BACKEND_URL;
const SVC_ICONS = {hundesitter:Dog,gassi:Footprints,katzensitter:Cat,transport:Car,tierarzt:Stethoscope};
const SVC_COLORS = {hundesitter:"#F59E0B",gassi:"#10B981",katzensitter:"#A855F7",transport:"#3B82F6",tierarzt:"#EF4444"};

export default function TierbetreuungPage({ onBack }) {
  const [sitters, setSitters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [svcFilter, setSvcFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [petName, setPetName] = useState("");
  const [booked, setBooked] = useState(false);

  useEffect(()=>{load();},[svcFilter]);
  const load = async()=>{try{const p=svcFilter?`?service=${svcFilter}`:"";const r=await fetch(`${API}/api/tierbetreuung/sitters${p}`);const d=await r.json();setSitters(d.sitters||[]);}catch{}setLoading(false);};
  const book = async()=>{if(!selected||!startDate)return;try{await fetch(`${API}/api/tierbetreuung/book`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({sitter_id:selected.sitter_id,start_date:startDate,pet_name:petName})});setBooked(true);setTimeout(()=>{setBooked(false);setSelected(null);},2000);}catch{}};

  if(selected){const s=selected;const color=SVC_COLORS[s.service]||"#00C2FF";return(
    <div className="min-h-screen pb-24" style={{background:"var(--bg-primary,#030303)"}}>
      <div className="px-4 pt-4 pb-3 flex items-center gap-3"><button onClick={()=>setSelected(null)} className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:"var(--bg-card,#111)"}} data-testid="pet-back2"><ArrowLeft size={20} style={{color:"var(--text-primary,#fff)"}}/></button><h1 className="text-lg font-bold" style={{color:"var(--text-primary,#fff)"}}>Buchen</h1></div>
      <div className="px-4 space-y-4">
        <div className="flex items-center gap-4"><img src={s.avatar} alt={s.name} className="w-16 h-16 rounded-xl object-cover"/><div><h2 className="text-base font-bold" style={{color:"var(--text-primary,#fff)"}}>{s.name}</h2><div className="flex items-center gap-2 mt-1"><Star size={14} className="text-yellow-400 fill-yellow-400"/><span className="text-xs" style={{color:"var(--text-primary,#fff)"}}>{s.rating}</span></div><div className="text-xs mt-1" style={{color}}>{s.price_per_day}€/Tag · {s.city}</div></div></div>
        <p className="text-sm" style={{color:"var(--text-secondary,#aaa)"}}>{s.description}</p>
        <div className="space-y-3">
          <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={{background:"var(--bg-card,#111)",color:"var(--text-primary,#fff)",border:"1px solid rgba(255,255,255,0.1)"}} data-testid="pet-date"/>
          <input value={petName} onChange={e=>setPetName(e.target.value)} placeholder="Name Ihres Tieres" className="w-full px-3 py-2 rounded-lg text-sm" style={{background:"var(--bg-card,#111)",color:"var(--text-primary,#fff)",border:"1px solid rgba(255,255,255,0.1)"}} data-testid="pet-name"/>
          <button onClick={book} className="w-full py-3 rounded-xl font-semibold text-sm text-black flex items-center justify-center gap-2" style={{background:"#00C2FF"}} data-testid="pet-book">{booked?<><CheckCircle size={16}/>Gebucht!</>:<><Calendar size={16}/>Buchen — {s.price_per_day}€/Tag</>}</button>
        </div>
      </div>
    </div>
  );}

  return(
    <div className="min-h-screen pb-24" style={{background:"var(--bg-primary,#030303)"}}>
      <div className="sticky top-0 z-30 px-4 pt-4 pb-3" style={{background:"var(--bg-primary,#030303)"}}>
        <div className="flex items-center gap-3 mb-3"><button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:"var(--bg-card,#111)"}} data-testid="pet-back"><ArrowLeft size={20} style={{color:"var(--text-primary,#fff)"}}/></button><h1 className="text-lg font-bold" style={{color:"var(--text-primary,#fff)"}}>Tierbetreuung</h1></div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button onClick={()=>setSvcFilter("")} className="px-3 py-1.5 rounded-full text-xs font-medium shrink-0" style={{background:!svcFilter?"#00C2FF":"var(--bg-card,#111)",color:!svcFilter?"#000":"var(--text-secondary,#aaa)"}} data-testid="pet-all">Alle</button>
          {Object.entries(SVC_ICONS).map(([id,Icon])=>(<button key={id} onClick={()=>setSvcFilter(id)} className="px-3 py-1.5 rounded-full text-xs font-medium shrink-0 flex items-center gap-1" style={{background:svcFilter===id?(SVC_COLORS[id]):"var(--bg-card,#111)",color:svcFilter===id?"#fff":"var(--text-secondary,#aaa)"}} data-testid={`pet-svc-${id}`}><Icon size={12}/>{id}</button>))}
        </div>
      </div>
      <div className="px-4 space-y-3">{loading?<div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{borderColor:"#00C2FF",borderTopColor:"transparent"}}/></div>:sitters.map(s=>{const color=SVC_COLORS[s.service]||"#00C2FF";return(
        <motion.div key={s.sitter_id} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="rounded-2xl p-4 cursor-pointer" style={{background:"var(--bg-card,#111)",border:"1px solid rgba(255,255,255,0.05)"}} onClick={()=>setSelected(s)} data-testid={`pet-card-${s.sitter_id}`}>
          <div className="flex items-start gap-3"><img src={s.avatar} alt={s.name} className="w-14 h-14 rounded-xl object-cover shrink-0"/><div className="flex-1"><h3 className="text-sm font-semibold" style={{color:"var(--text-primary,#fff)"}}>{s.name}</h3><div className="flex items-center gap-2 mt-1"><Star size={12} className="text-yellow-400 fill-yellow-400"/><span className="text-xs" style={{color:"var(--text-primary,#fff)"}}>{s.rating}</span><MapPin size={12} style={{color:"var(--text-secondary,#666)"}}/><span className="text-xs" style={{color:"var(--text-secondary,#888)"}}>{s.city}</span></div></div><div className="text-right shrink-0"><div className="text-sm font-bold" style={{color:"#00C2FF"}}>{s.price_per_day}€</div><div className="text-[10px]" style={{color:"var(--text-secondary,#888)"}}>/Tag</div></div></div>
        </motion.div>
      );})}</div>
    </div>
  );
}
