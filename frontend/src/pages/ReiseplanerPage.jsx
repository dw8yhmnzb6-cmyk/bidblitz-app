import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Star, MapPin, Clock, Users, CheckCircle, Plane, Palmtree, Mountain, Utensils } from "lucide-react";
const API = process.env.REACT_APP_BACKEND_URL;
const CAT_ICONS = {staedtetrip:Plane,strandurlaub:Palmtree,aktivurlaub:Mountain,genussreise:Utensils};

export default function ReiseplanerPage({ onBack }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [travelers, setTravelers] = useState(2);
  const [date, setDate] = useState("");
  const [booked, setBooked] = useState(null);

  useEffect(()=>{load();},[catFilter]);
  const load = async()=>{try{const p=catFilter?`?category=${catFilter}`:"";const r=await fetch(`${API}/api/reiseplaner/trips${p}`);const d=await r.json();setTrips(d.trips||[]);}catch{}setLoading(false);};
  const book = async()=>{if(!selected||!date)return;try{const r=await fetch(`${API}/api/reiseplaner/book`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({trip_id:selected.trip_id,date,travelers})});if(r.ok){const d=await r.json();setBooked(d.booking);}}catch{}};

  if(booked) return(
    <div className="min-h-screen flex items-center justify-center px-4" style={{background:"var(--bg-primary,#030303)"}}>
      <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} className="rounded-2xl p-6 text-center max-w-sm w-full" style={{background:"var(--bg-card,#111)",border:"1px solid rgba(16,185,129,0.3)"}}>
        <CheckCircle size={48} className="mx-auto mb-3 text-green-400"/><h2 className="text-lg font-bold" style={{color:"var(--text-primary,#fff)"}}>Reise gebucht!</h2>
        <p className="text-sm mt-2" style={{color:"var(--text-secondary,#aaa)"}}>{booked.trip_title}</p>
        <div className="text-3xl font-bold my-3" style={{color:"#00C2FF"}}>{booked.total}€</div>
        <div className="text-xs" style={{color:"var(--text-secondary,#888)"}}>{booked.travelers} Reisende · {booked.date}</div>
        <button onClick={()=>{setBooked(null);setSelected(null);}} className="w-full py-3 rounded-xl font-semibold text-sm text-black mt-4" style={{background:"#00C2FF"}} data-testid="reise-done">Zurück</button>
      </motion.div>
    </div>
  );

  if(selected){const t=selected;return(
    <div className="min-h-screen pb-24" style={{background:"var(--bg-primary,#030303)"}}>
      <div className="relative"><img src={t.image} alt={t.title} className="w-full h-56 object-cover"/><div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"/><button onClick={()=>setSelected(null)} className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center" data-testid="reise-back2"><ArrowLeft size={20} className="text-white"/></button>
        <div className="absolute bottom-4 left-4 right-4"><h1 className="text-white text-lg font-bold">{t.title}</h1><div className="text-white/70 text-xs mt-1">{t.destination}, {t.country} · {t.duration_days} Tage</div></div>
      </div>
      <div className="px-4 py-5 space-y-4">
        <div className="flex items-center justify-between"><div><span className="text-2xl font-bold" style={{color:"#00C2FF"}}>{t.price_per_person}€</span><span className="text-xs ml-1" style={{color:"var(--text-secondary,#888)"}}>/ Person</span></div><div className="flex items-center gap-1"><Star size={14} className="text-yellow-400 fill-yellow-400"/><span className="text-sm" style={{color:"var(--text-primary,#fff)"}}>{t.rating}</span></div></div>
        <p className="text-sm" style={{color:"var(--text-secondary,#aaa)"}}>{t.description}</p>
        <div><h3 className="text-sm font-semibold mb-2" style={{color:"var(--text-primary,#fff)"}}>Inklusive</h3><div className="space-y-2">{t.includes?.map((item,i)=>(<div key={i} className="flex items-center gap-2"><CheckCircle size={14} className="text-green-400"/><span className="text-sm" style={{color:"var(--text-secondary,#aaa)"}}>{item}</span></div>))}</div></div>
        <div className="space-y-3">
          <select value={date} onChange={e=>setDate(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={{background:"var(--bg-card,#111)",color:"var(--text-primary,#fff)",border:"1px solid rgba(255,255,255,0.1)"}} data-testid="reise-date"><option value="">Reisedatum wählen</option>{t.available_dates?.map(d=>(<option key={d} value={d}>{d}</option>))}</select>
          <div className="flex items-center gap-3"><span className="text-sm" style={{color:"var(--text-primary,#fff)"}}>Reisende:</span>{[1,2,3,4].map(n=>(<button key={n} onClick={()=>setTravelers(n)} className="w-10 h-10 rounded-lg text-sm font-medium" style={{background:travelers===n?"#00C2FF":"var(--bg-card,#111)",color:travelers===n?"#000":"var(--text-primary,#fff)"}}>{n}</button>))}</div>
          <div className="rounded-xl p-3 text-center" style={{background:"rgba(0,194,255,0.1)"}}><span className="text-2xl font-bold" style={{color:"#00C2FF"}}>{t.price_per_person*travelers}€</span><span className="text-xs ml-2" style={{color:"var(--text-secondary,#888)"}}>für {travelers} Personen</span></div>
          <button onClick={book} className="w-full py-3 rounded-xl font-semibold text-sm text-black flex items-center justify-center gap-2" style={{background:"#00C2FF"}} data-testid="reise-book"><Plane size={16}/>Jetzt buchen</button>
        </div>
      </div>
    </div>
  );}

  const CATS=[{id:"",label:"Alle"},{id:"staedtetrip",label:"Städtetrip"},{id:"strandurlaub",label:"Strand"},{id:"aktivurlaub",label:"Aktiv"},{id:"genussreise",label:"Genuss"}];
  return(
    <div className="min-h-screen pb-24" style={{background:"var(--bg-primary,#030303)"}}>
      <div className="sticky top-0 z-30 px-4 pt-4 pb-3" style={{background:"var(--bg-primary,#030303)"}}>
        <div className="flex items-center gap-3 mb-3"><button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:"var(--bg-card,#111)"}} data-testid="reise-back"><ArrowLeft size={20} style={{color:"var(--text-primary,#fff)"}}/></button><h1 className="text-lg font-bold" style={{color:"var(--text-primary,#fff)"}}>Reiseplaner</h1></div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">{CATS.map(c=>(<button key={c.id} onClick={()=>setCatFilter(c.id)} className="px-3 py-1.5 rounded-full text-xs font-medium shrink-0" style={{background:catFilter===c.id?"#00C2FF":"var(--bg-card,#111)",color:catFilter===c.id?"#000":"var(--text-secondary,#aaa)"}} data-testid={`reise-cat-${c.id||"all"}`}>{c.label}</button>))}</div>
      </div>
      <div className="px-4 space-y-3">{loading?<div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{borderColor:"#00C2FF",borderTopColor:"transparent"}}/></div>:trips.map(t=>(
        <motion.div key={t.trip_id} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="rounded-2xl overflow-hidden cursor-pointer" style={{background:"var(--bg-card,#111)",border:"1px solid rgba(255,255,255,0.05)"}} onClick={()=>setSelected(t)} data-testid={`reise-${t.trip_id}`}>
          <div className="relative"><img src={t.image} alt={t.title} className="w-full h-44 object-cover" loading="lazy"/>{t.featured&&<span className="absolute top-3 left-3 px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500 text-black">TOP</span>}<span className="absolute bottom-3 right-3 px-2 py-0.5 rounded text-[10px] font-bold bg-white/20 text-white">{t.duration_days} Tage</span></div>
          <div className="p-3"><h3 className="text-sm font-semibold" style={{color:"var(--text-primary,#fff)"}}>{t.title}</h3><div className="flex items-center gap-2 mt-1"><MapPin size={12} style={{color:"var(--text-secondary,#666)"}}/><span className="text-xs" style={{color:"var(--text-secondary,#888)"}}>{t.destination}, {t.country}</span><Star size={12} className="text-yellow-400 fill-yellow-400"/><span className="text-xs" style={{color:"var(--text-primary,#fff)"}}>{t.rating}</span></div>
            <div className="flex items-center justify-between mt-2"><span className="text-base font-bold" style={{color:"#00C2FF"}}>ab {t.price_per_person}€</span><span className="text-xs" style={{color:"var(--text-secondary,#888)"}}>pro Person</span></div>
          </div>
        </motion.div>
      ))}</div>
    </div>
  );
}
