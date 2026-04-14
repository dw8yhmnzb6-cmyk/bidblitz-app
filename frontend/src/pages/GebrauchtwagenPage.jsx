import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Search, Star, Car, Fuel, Gauge, Calendar, Eye, MapPin, Phone, Send, CheckCircle } from "lucide-react";
const API = process.env.REACT_APP_BACKEND_URL;

export default function GebrauchtwagenPage({ onBack }) {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(()=>{load();},[]);
  const load = async()=>{try{const r=await fetch(`${API}/api/gebrauchtwagen/listings`);const d=await r.json();setCars(d.cars||[]);}catch{}setLoading(false);};
  const contact = async()=>{if(!selected)return;try{await fetch(`${API}/api/gebrauchtwagen/contact`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({car_id:selected.car_id,message:msg})});setSent(true);setTimeout(()=>{setSent(false);},2000);}catch{}};
  const filtered = cars.filter(c=>!search||c.title?.toLowerCase().includes(search.toLowerCase())||c.brand?.toLowerCase().includes(search.toLowerCase()));

  if(selected){const c=selected;return(
    <div className="min-h-screen pb-24" style={{background:"var(--bg-primary,#030303)"}}>
      <div className="relative"><img src={c.image} alt={c.title} className="w-full h-56 object-cover"/><div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"/>
        <button onClick={()=>setSelected(null)} className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center" data-testid="gw-back2"><ArrowLeft size={20} className="text-white"/></button>
        <div className="absolute bottom-4 left-4 right-4"><h1 className="text-white text-lg font-bold">{c.title}</h1><div className="text-white/70 text-xs mt-1">{c.seller}</div></div>
      </div>
      <div className="px-4 py-5 space-y-4">
        <div className="text-2xl font-bold" style={{color:"#00C2FF"}}>{c.price?.toLocaleString("de-DE")} €</div>
        <div className="grid grid-cols-4 gap-2">
          {[{icon:Calendar,v:c.year},{icon:Gauge,v:`${(c.mileage/1000).toFixed(0)}T km`},{icon:Fuel,v:c.fuel},{icon:Car,v:`${c.power_hp} PS`}].map((item,i)=>(
            <div key={i} className="rounded-xl p-2 text-center" style={{background:"var(--bg-card,#111)"}}><item.icon size={16} className="mx-auto mb-1" style={{color:"#00C2FF"}}/><div className="text-[10px]" style={{color:"var(--text-primary,#fff)"}}>{item.v}</div></div>
          ))}
        </div>
        <p className="text-sm" style={{color:"var(--text-secondary,#aaa)"}}>{c.description}</p>
        <div className="flex flex-wrap gap-2">{c.features?.map((f,i)=>(<span key={i} className="px-3 py-1 rounded-full text-xs" style={{background:"rgba(0,194,255,0.1)",color:"#00C2FF"}}>{f}</span>))}</div>
        <div className="rounded-xl p-4 space-y-3" style={{background:"var(--bg-card,#111)"}}>
          <h3 className="text-sm font-semibold" style={{color:"var(--text-primary,#fff)"}}>Verkäufer kontaktieren</h3>
          <textarea value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Ihre Nachricht..." className="w-full px-3 py-2 rounded-lg text-sm resize-none" rows={3} style={{background:"var(--bg-primary,#030303)",color:"var(--text-primary,#fff)",border:"1px solid rgba(255,255,255,0.1)"}} data-testid="gw-msg"/>
          <button onClick={contact} className="w-full py-3 rounded-xl font-semibold text-sm text-black flex items-center justify-center gap-2" style={{background:"#00C2FF"}} data-testid="gw-send">{sent?<><CheckCircle size={16}/>Gesendet!</>:<><Send size={16}/>Nachricht senden</>}</button>
        </div>
      </div>
    </div>
  );}

  return(
    <div className="min-h-screen pb-24" style={{background:"var(--bg-primary,#030303)"}}>
      <div className="sticky top-0 z-30 px-4 pt-4 pb-3" style={{background:"var(--bg-primary,#030303)"}}>
        <div className="flex items-center gap-3 mb-3"><button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:"var(--bg-card,#111)"}} data-testid="gw-back"><ArrowLeft size={20} style={{color:"var(--text-primary,#fff)"}}/></button><h1 className="text-lg font-bold" style={{color:"var(--text-primary,#fff)"}}>Gebrauchtwagen</h1></div>
        <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{color:"var(--text-secondary,#666)"}}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Marke, Modell suchen..." className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm" style={{background:"var(--bg-card,#111)",color:"var(--text-primary,#fff)",border:"1px solid rgba(255,255,255,0.06)"}} data-testid="gw-search"/></div>
      </div>
      <div className="px-4 space-y-3">{loading?<div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{borderColor:"#00C2FF",borderTopColor:"transparent"}}/></div>:filtered.map(c=>(
        <motion.div key={c.car_id} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="rounded-2xl overflow-hidden cursor-pointer" style={{background:"var(--bg-card,#111)",border:"1px solid rgba(255,255,255,0.05)"}} onClick={()=>setSelected(c)} data-testid={`gw-card-${c.car_id}`}>
          <div className="relative"><img src={c.image} alt={c.title} className="w-full h-40 object-cover" loading="lazy"/>{c.featured&&<span className="absolute top-3 left-3 px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500 text-black">TOP</span>}</div>
          <div className="p-3"><h3 className="text-sm font-semibold mb-1" style={{color:"var(--text-primary,#fff)"}}>{c.title}</h3>
            <div className="flex items-center gap-3 text-xs mb-2" style={{color:"var(--text-secondary,#888)"}}><span>{c.year}</span><span>{(c.mileage/1000).toFixed(0)}T km</span><span>{c.fuel}</span><span>{c.power_hp} PS</span></div>
            <div className="flex items-center justify-between"><span className="text-base font-bold" style={{color:"#00C2FF"}}>{c.price?.toLocaleString("de-DE")} €</span><span className="text-xs flex items-center gap-1" style={{color:"var(--text-secondary,#888)"}}><Eye size={12}/>{c.views}</span></div>
          </div>
        </motion.div>
      ))}</div>
    </div>
  );
}
