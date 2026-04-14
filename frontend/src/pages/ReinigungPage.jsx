import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, Clock, CheckCircle, Calendar } from "lucide-react";
const API = process.env.REACT_APP_BACKEND_URL;

export default function ReinigungPage({ onBack }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [hours, setHours] = useState(2);
  const [addr, setAddr] = useState("");
  const [booked, setBooked] = useState(false);

  useEffect(()=>{(async()=>{try{const r=await fetch(`${API}/api/reinigung/services`);const d=await r.json();setServices(d.services||[]);}catch{}setLoading(false);})();},[]);
  const book = async()=>{if(!selected||!date||!addr)return;try{const r=await fetch(`${API}/api/reinigung/book`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({service_id:selected.service_id,date,time,hours,address:addr})});if(r.ok)setBooked(true);setTimeout(()=>{setBooked(false);setSelected(null);},2000);}catch{}};

  if(selected){const s=selected;return(
    <div className="min-h-screen pb-24" style={{background:"var(--bg-primary,#030303)"}}>
      <div className="px-4 pt-4 pb-3 flex items-center gap-3"><button onClick={()=>setSelected(null)} className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:"var(--bg-card,#111)"}} data-testid="rein-back2"><ArrowLeft size={20} style={{color:"var(--text-primary,#fff)"}}/></button><h1 className="text-lg font-bold" style={{color:"var(--text-primary,#fff)"}}>Buchen</h1></div>
      <div className="px-4 space-y-4">
        <div className="rounded-xl overflow-hidden" style={{background:"var(--bg-card,#111)"}}><img src={s.image} alt={s.name} className="w-full h-40 object-cover"/><div className="p-4"><h2 className="text-base font-bold" style={{color:"var(--text-primary,#fff)"}}>{s.name}</h2><p className="text-sm mt-1" style={{color:"var(--text-secondary,#aaa)"}}>{s.description}</p><div className="text-sm font-bold mt-2" style={{color:"#00C2FF"}}>{s.price_per_hour}€/Std. · Min. {s.min_hours}h</div></div></div>
        <div className="space-y-3">
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={{background:"var(--bg-card,#111)",color:"var(--text-primary,#fff)",border:"1px solid rgba(255,255,255,0.1)"}} data-testid="rein-date"/>
          <input type="time" value={time} onChange={e=>setTime(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={{background:"var(--bg-card,#111)",color:"var(--text-primary,#fff)",border:"1px solid rgba(255,255,255,0.1)"}} data-testid="rein-time"/>
          <div className="flex items-center gap-3"><span className="text-sm" style={{color:"var(--text-primary,#fff)"}}>Stunden:</span>{[2,3,4,5,6].map(h=>(<button key={h} onClick={()=>setHours(h)} className="w-10 h-10 rounded-lg text-sm font-medium" style={{background:hours===h?"#00C2FF":"var(--bg-card,#111)",color:hours===h?"#000":"var(--text-primary,#fff)"}}>{h}</button>))}</div>
          <input value={addr} onChange={e=>setAddr(e.target.value)} placeholder="Adresse" className="w-full px-3 py-2 rounded-lg text-sm" style={{background:"var(--bg-card,#111)",color:"var(--text-primary,#fff)",border:"1px solid rgba(255,255,255,0.1)"}} data-testid="rein-addr"/>
          <div className="rounded-xl p-3 text-center" style={{background:"rgba(0,194,255,0.1)"}}><span className="text-lg font-bold" style={{color:"#00C2FF"}}>{s.price_per_hour*hours}€</span><span className="text-xs ml-2" style={{color:"var(--text-secondary,#888)"}}>für {hours} Stunden</span></div>
          <button onClick={book} className="w-full py-3 rounded-xl font-semibold text-sm text-black flex items-center justify-center gap-2" style={{background:"#00C2FF"}} data-testid="rein-book">{booked?<><CheckCircle size={16}/>Gebucht!</>:<><Calendar size={16}/>Jetzt buchen — {s.price_per_hour*hours}€</>}</button>
        </div>
      </div>
    </div>
  );}

  return(
    <div className="min-h-screen pb-24" style={{background:"var(--bg-primary,#030303)"}}>
      <div className="px-4 pt-4 pb-3 flex items-center gap-3"><button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:"var(--bg-card,#111)"}} data-testid="rein-back"><ArrowLeft size={20} style={{color:"var(--text-primary,#fff)"}}/></button><h1 className="text-lg font-bold" style={{color:"var(--text-primary,#fff)"}}>Reinigungsservice</h1></div>
      <div className="px-4 space-y-3">{loading?<div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{borderColor:"#00C2FF",borderTopColor:"transparent"}}/></div>:services.map(s=>(
        <motion.div key={s.service_id} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="rounded-2xl overflow-hidden cursor-pointer" style={{background:"var(--bg-card,#111)",border:"1px solid rgba(255,255,255,0.05)"}} onClick={()=>setSelected(s)} data-testid={`rein-${s.service_id}`}>
          <img src={s.image} alt={s.name} className="w-full h-36 object-cover" loading="lazy"/>
          <div className="p-4"><h3 className="text-sm font-semibold" style={{color:"var(--text-primary,#fff)"}}>{s.name}</h3><p className="text-xs mt-1 line-clamp-2" style={{color:"var(--text-secondary,#aaa)"}}>{s.description}</p>
            <div className="flex items-center justify-between mt-2"><span className="text-sm font-bold" style={{color:"#00C2FF"}}>ab {s.price_per_hour*s.min_hours}€</span><span className="text-xs" style={{color:"var(--text-secondary,#888)"}}>{s.price_per_hour}€/Std.</span></div>
          </div>
        </motion.div>
      ))}</div>
    </div>
  );
}
