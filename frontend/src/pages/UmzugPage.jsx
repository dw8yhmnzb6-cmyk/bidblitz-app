import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Star, Truck, MapPin, CheckCircle, Package } from "lucide-react";
const API = process.env.REACT_APP_BACKEND_URL;

export default function UmzugPage({ onBack }) {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [rooms, setRooms] = useState(2);
  const [quote, setQuote] = useState(null);

  useEffect(()=>{(async()=>{try{const r=await fetch(`${API}/api/umzug/companies`);const d=await r.json();setCompanies(d.companies||[]);}catch{}setLoading(false);})();},[]);
  const getQuote = async()=>{if(!selected||!from||!to||!date)return;try{const r=await fetch(`${API}/api/umzug/quote`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({company_id:selected.company_id,from_address:from,to_address:to,date,rooms})});if(r.ok){const d=await r.json();setQuote(d.quote);}}catch{}};

  if(quote) return(
    <div className="min-h-screen flex items-center justify-center px-4" style={{background:"var(--bg-primary,#030303)"}}>
      <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} className="rounded-2xl p-6 text-center max-w-sm w-full" style={{background:"var(--bg-card,#111)",border:"1px solid rgba(16,185,129,0.3)"}}>
        <CheckCircle size={48} className="mx-auto mb-3 text-green-400"/><h2 className="text-lg font-bold" style={{color:"var(--text-primary,#fff)"}}>Angebot erhalten!</h2>
        <p className="text-sm mt-2" style={{color:"var(--text-secondary,#aaa)"}}>{quote.company_name}</p>
        <div className="text-3xl font-bold my-4" style={{color:"#00C2FF"}}>ca. {quote.estimated_price}€</div>
        <div className="text-xs space-y-1" style={{color:"var(--text-secondary,#888)"}}><p>Von: {quote.from_address}</p><p>Nach: {quote.to_address}</p><p>{quote.rooms} Zimmer · {quote.date}</p></div>
        <button onClick={()=>{setQuote(null);setSelected(null);}} className="w-full py-3 rounded-xl font-semibold text-sm text-black mt-4" style={{background:"#00C2FF"}} data-testid="umz-done">Zurück</button>
      </motion.div>
    </div>
  );

  if(selected){const c=selected;return(
    <div className="min-h-screen pb-24" style={{background:"var(--bg-primary,#030303)"}}>
      <div className="px-4 pt-4 pb-3 flex items-center gap-3"><button onClick={()=>setSelected(null)} className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:"var(--bg-card,#111)"}} data-testid="umz-back2"><ArrowLeft size={20} style={{color:"var(--text-primary,#fff)"}}/></button><h1 className="text-lg font-bold" style={{color:"var(--text-primary,#fff)"}}>Angebot anfragen</h1></div>
      <div className="px-4 space-y-4">
        <div className="rounded-xl p-4 flex items-center gap-3" style={{background:"var(--bg-card,#111)"}}><img src={c.image} alt={c.name} className="w-16 h-16 rounded-xl object-cover"/><div><h3 className="text-sm font-bold" style={{color:"var(--text-primary,#fff)"}}>{c.name}</h3><div className="flex items-center gap-1 mt-1"><Star size={12} className="text-yellow-400 fill-yellow-400"/><span className="text-xs" style={{color:"var(--text-primary,#fff)"}}>{c.rating}</span></div><div className="text-xs mt-1" style={{color:"#00C2FF"}}>ab {c.base_price}€</div></div></div>
        <div className="space-y-3">
          <input value={from} onChange={e=>setFrom(e.target.value)} placeholder="Von-Adresse" className="w-full px-3 py-2 rounded-lg text-sm" style={{background:"var(--bg-card,#111)",color:"var(--text-primary,#fff)",border:"1px solid rgba(255,255,255,0.1)"}} data-testid="umz-from"/>
          <input value={to} onChange={e=>setTo(e.target.value)} placeholder="Nach-Adresse" className="w-full px-3 py-2 rounded-lg text-sm" style={{background:"var(--bg-card,#111)",color:"var(--text-primary,#fff)",border:"1px solid rgba(255,255,255,0.1)"}} data-testid="umz-to"/>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={{background:"var(--bg-card,#111)",color:"var(--text-primary,#fff)",border:"1px solid rgba(255,255,255,0.1)"}} data-testid="umz-date"/>
          <div className="flex items-center gap-3"><span className="text-sm" style={{color:"var(--text-primary,#fff)"}}>Zimmer:</span>{[1,2,3,4,5,6].map(r=>(<button key={r} onClick={()=>setRooms(r)} className="w-10 h-10 rounded-lg text-sm font-medium" style={{background:rooms===r?"#00C2FF":"var(--bg-card,#111)",color:rooms===r?"#000":"var(--text-primary,#fff)"}}>{r}</button>))}</div>
          <button onClick={getQuote} className="w-full py-3 rounded-xl font-semibold text-sm text-black flex items-center justify-center gap-2" style={{background:"#00C2FF"}} data-testid="umz-quote"><Truck size={16}/>Kostenvoranschlag anfordern</button>
        </div>
      </div>
    </div>
  );}

  return(
    <div className="min-h-screen pb-24" style={{background:"var(--bg-primary,#030303)"}}>
      <div className="px-4 pt-4 pb-3 flex items-center gap-3"><button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:"var(--bg-card,#111)"}} data-testid="umz-back"><ArrowLeft size={20} style={{color:"var(--text-primary,#fff)"}}/></button><h1 className="text-lg font-bold" style={{color:"var(--text-primary,#fff)"}}>Umzugsservice</h1></div>
      <div className="px-4 space-y-3">{loading?<div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{borderColor:"#00C2FF",borderTopColor:"transparent"}}/></div>:companies.map(c=>(
        <motion.div key={c.company_id} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="rounded-2xl overflow-hidden cursor-pointer" style={{background:"var(--bg-card,#111)",border:"1px solid rgba(255,255,255,0.05)"}} onClick={()=>setSelected(c)} data-testid={`umz-${c.company_id}`}>
          <img src={c.image} alt={c.name} className="w-full h-36 object-cover" loading="lazy"/>
          <div className="p-4"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold" style={{color:"var(--text-primary,#fff)"}}>{c.name}</h3>{c.featured&&<span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">TOP</span>}</div>
            <div className="flex items-center gap-2 mt-1"><Star size={12} className="text-yellow-400 fill-yellow-400"/><span className="text-xs" style={{color:"var(--text-primary,#fff)"}}>{c.rating}</span><span className="text-xs" style={{color:"var(--text-secondary,#888)"}}>({c.reviews})</span></div>
            <div className="flex flex-wrap gap-1 mt-2">{c.features?.slice(0,3).map((f,i)=>(<span key={i} className="px-2 py-0.5 rounded text-[10px]" style={{background:"rgba(0,194,255,0.1)",color:"#00C2FF"}}>{f}</span>))}</div>
            <div className="text-sm font-bold mt-2" style={{color:"#00C2FF"}}>ab {c.base_price}€</div>
          </div>
        </motion.div>
      ))}</div>
    </div>
  );
}
