import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Star, Dumbbell, MapPin, CheckCircle, Crown } from "lucide-react";
const API = process.env.REACT_APP_BACKEND_URL;

export default function FitnessPage({ onBack }) {
  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [joined, setJoined] = useState(false);

  useEffect(()=>{load();},[typeFilter]);
  const load = async()=>{try{const p=typeFilter?`?type=${typeFilter}`:"";const r=await fetch(`${API}/api/fitness/gyms${p}`);const d=await r.json();setGyms(d.gyms||[]);}catch{}setLoading(false);};
  const join = async()=>{if(!selected)return;try{await fetch(`${API}/api/fitness/membership`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({gym_id:selected.gym_id})});setJoined(true);setTimeout(()=>{setJoined(false);setSelected(null);},2000);}catch{}};

  if(selected){const g=selected;return(
    <div className="min-h-screen pb-24" style={{background:"var(--bg-primary,#030303)"}}>
      <div className="relative"><img src={g.image} alt={g.name} className="w-full h-56 object-cover"/><div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"/><button onClick={()=>setSelected(null)} className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center" data-testid="fit-back2"><ArrowLeft size={20} className="text-white"/></button>
        <div className="absolute bottom-4 left-4 right-4"><h1 className="text-white text-lg font-bold">{g.name}</h1><div className="flex items-center gap-2 text-white/70 text-xs mt-1"><MapPin size={12}/>{g.city} · {g.district}</div></div>
      </div>
      <div className="px-4 py-5 space-y-4">
        <div className="flex items-center justify-between"><div className="text-2xl font-bold" style={{color:"#00C2FF"}}>{g.monthly_price}€<span className="text-sm font-normal" style={{color:"var(--text-secondary,#888)"}}>/Monat</span></div><div className="flex items-center gap-1"><Star size={16} className="text-yellow-400 fill-yellow-400"/><span className="text-sm font-bold" style={{color:"var(--text-primary,#fff)"}}>{g.rating}</span><span className="text-xs" style={{color:"var(--text-secondary,#888)"}}>({g.reviews})</span></div></div>
        <p className="text-sm" style={{color:"var(--text-secondary,#aaa)"}}>{g.description}</p>
        <div className="flex flex-wrap gap-2">{g.features?.map((f,i)=>(<span key={i} className="px-3 py-1 rounded-full text-xs" style={{background:"rgba(0,194,255,0.1)",color:"#00C2FF"}}>{f}</span>))}</div>
        <button onClick={join} className="w-full py-3 rounded-xl font-semibold text-sm text-black flex items-center justify-center gap-2" style={{background:"#00C2FF"}} data-testid="fit-join">{joined?<><CheckCircle size={16}/>Mitglied!</>:<><Dumbbell size={16}/>Mitglied werden — {g.monthly_price}€/Monat</>}</button>
      </div>
    </div>
  );}

  const TYPES = [{id:"",label:"Alle"},{id:"fitnessstudio",label:"Fitness"},{id:"crossfit",label:"CrossFit"},{id:"yoga",label:"Yoga"},{id:"personal",label:"Personal"}];
  return(
    <div className="min-h-screen pb-24" style={{background:"var(--bg-primary,#030303)"}}>
      <div className="sticky top-0 z-30 px-4 pt-4 pb-3" style={{background:"var(--bg-primary,#030303)"}}>
        <div className="flex items-center gap-3 mb-3"><button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:"var(--bg-card,#111)"}} data-testid="fit-back"><ArrowLeft size={20} style={{color:"var(--text-primary,#fff)"}}/></button><h1 className="text-lg font-bold" style={{color:"var(--text-primary,#fff)"}}>Fitness</h1></div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">{TYPES.map(t=>(<button key={t.id} onClick={()=>setTypeFilter(t.id)} className="px-3 py-1.5 rounded-full text-xs font-medium shrink-0" style={{background:typeFilter===t.id?"#00C2FF":"var(--bg-card,#111)",color:typeFilter===t.id?"#000":"var(--text-secondary,#aaa)"}} data-testid={`fit-type-${t.id||"all"}`}>{t.label}</button>))}</div>
      </div>
      <div className="px-4 space-y-3">{loading?<div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{borderColor:"#00C2FF",borderTopColor:"transparent"}}/></div>:gyms.map(g=>(
        <motion.div key={g.gym_id} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="rounded-2xl overflow-hidden cursor-pointer" style={{background:"var(--bg-card,#111)",border:"1px solid rgba(255,255,255,0.05)"}} onClick={()=>setSelected(g)} data-testid={`fit-gym-${g.gym_id}`}>
          <div className="relative"><img src={g.image} alt={g.name} className="w-full h-40 object-cover" loading="lazy"/>{g.featured&&<span className="absolute top-3 left-3 px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500 text-black flex items-center gap-1"><Crown size={10}/>PREMIUM</span>}</div>
          <div className="p-3"><h3 className="text-sm font-semibold" style={{color:"var(--text-primary,#fff)"}}>{g.name}</h3><div className="flex items-center gap-2 mt-1"><Star size={12} className="text-yellow-400 fill-yellow-400"/><span className="text-xs" style={{color:"var(--text-primary,#fff)"}}>{g.rating}</span><MapPin size={12} style={{color:"var(--text-secondary,#666)"}}/><span className="text-xs" style={{color:"var(--text-secondary,#888)"}}>{g.city}</span></div>
            <div className="flex items-center justify-between mt-2"><span className="text-sm font-bold" style={{color:"#00C2FF"}}>{g.monthly_price}€/Monat</span><div className="flex gap-1">{g.features?.slice(0,2).map((f,i)=>(<span key={i} className="px-2 py-0.5 rounded text-[10px]" style={{background:"rgba(0,194,255,0.1)",color:"#00C2FF"}}>{f}</span>))}</div></div>
          </div>
        </motion.div>
      ))}</div>
    </div>
  );
}
