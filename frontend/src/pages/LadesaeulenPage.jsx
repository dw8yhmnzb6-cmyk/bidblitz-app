import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Search, Zap, BatteryCharging, MapPin, Star, Clock, Plug, CheckCircle, CircleStop } from "lucide-react";
const API = process.env.REACT_APP_BACKEND_URL;
const STATUS_COLORS = {available:"#10B981",occupied:"#F59E0B",offline:"#EF4444"};
const STATUS_LABELS = {available:"Verfügbar",occupied:"Belegt",offline:"Offline"};

export default function LadesaeulenPage({ onBack }) {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [charging, setCharging] = useState(null);
  const [result, setResult] = useState(null);
  const [unlocked, setUnlocked] = useState(false);
  const [unlockData, setUnlockData] = useState(null);

  useEffect(()=>{load();},[typeFilter]);
  const load = async()=>{try{const p=typeFilter?`?type=${typeFilter}`:"";const r=await fetch(`${API}/api/ladesaeulen/stations${p}`);const d=await r.json();setStations(d.stations||[]);}catch{}setLoading(false);};
  const startCharge = async()=>{if(!selected)return;try{const r=await fetch(`${API}/api/ladesaeulen/start`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({station_id:selected.station_id})});if(r.ok){const d=await r.json();setCharging(d.session);}else{const e=await r.json();alert(e.detail||"Fehler");}}catch{}};
  const unlockStation = async()=>{if(!selected)return;try{const r=await fetch(`${API}/api/ladesaeulen/unlock`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({station_id:selected.station_id})});if(r.ok){const d=await r.json();setUnlockData(d.unlock);setUnlocked(true);}else{const e=await r.json();alert(e.detail||"Fehler");}}catch{}};
  const stopCharge = async()=>{if(!charging)return;try{const r=await fetch(`${API}/api/ladesaeulen/stop`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:charging.session_id})});if(r.ok){const d=await r.json();setResult(d);setCharging(null);setUnlocked(false);setUnlockData(null);}}catch{}};
  const filtered = stations.filter(s=>!search||s.name?.toLowerCase().includes(search.toLowerCase())||s.city?.toLowerCase().includes(search.toLowerCase()));

  if(result) return(
    <div className="min-h-screen flex items-center justify-center px-4" style={{background:"var(--bg-primary,#030303)"}}>
      <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} className="rounded-2xl p-6 text-center max-w-sm w-full" style={{background:"var(--bg-card,#111)",border:"1px solid rgba(16,185,129,0.3)"}}>
        <CheckCircle size={48} className="mx-auto mb-3 text-green-400"/><h2 className="text-lg font-bold" style={{color:"var(--text-primary,#fff)"}}>Ladevorgang beendet</h2>
        <div className="text-3xl font-bold my-3" style={{color:"#00C2FF"}}>{result.kwh_charged} kWh</div>
        <div className="text-xl font-bold" style={{color:"var(--text-primary,#fff)"}}>{result.cost}€</div>
        <button onClick={()=>{setResult(null);setSelected(null);}} className="w-full py-3 rounded-xl font-semibold text-sm text-black mt-4" style={{background:"#00C2FF"}} data-testid="ev-done">Fertig</button>
      </motion.div>
    </div>
  );

  if(selected){const s=selected;const statusColor=STATUS_COLORS[s.status]||"#888";return(
    <div className="min-h-screen pb-24" style={{background:"var(--bg-primary,#030303)"}}>
      <div className="relative"><img src={s.image} alt={s.name} className="w-full h-48 object-cover"/><div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"/><button onClick={()=>setSelected(null)} className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center" data-testid="ev-back2"><ArrowLeft size={20} className="text-white"/></button>
        <div className="absolute bottom-4 left-4 right-4"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{background:statusColor}}/><span className="text-xs text-white">{STATUS_LABELS[s.status]}</span></div><h1 className="text-white text-lg font-bold mt-1">{s.name}</h1></div>
      </div>
      <div className="px-4 py-5 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[{icon:Zap,v:`${s.power_kw} kW`,l:"Leistung"},{icon:Plug,v:s.connectors?.join(", "),l:"Anschlüsse"},{icon:BatteryCharging,v:`${s.slots_available}/${s.slots_total}`,l:"Frei"}].map((item,i)=>(
            <div key={i} className="rounded-xl p-3 text-center" style={{background:"var(--bg-card,#111)"}}><item.icon size={18} className="mx-auto mb-1" style={{color:"#00C2FF"}}/><div className="text-xs font-medium" style={{color:"var(--text-primary,#fff)"}}>{item.v}</div><div className="text-[10px]" style={{color:"var(--text-secondary,#888)"}}>{item.l}</div></div>
          ))}
        </div>
        <div className="rounded-xl p-3 flex items-center justify-between" style={{background:"var(--bg-card,#111)"}}><div className="flex items-center gap-2"><MapPin size={14} style={{color:"var(--text-secondary,#888)"}}/><span className="text-xs" style={{color:"var(--text-secondary,#aaa)"}}>{s.address}</span></div></div>
        <div className="rounded-xl p-3" style={{background:"var(--bg-card,#111)"}}><div className="flex items-center justify-between"><span className="text-sm" style={{color:"var(--text-primary,#fff)"}}>Preis pro kWh</span><span className="text-lg font-bold" style={{color:"#00C2FF"}}>{s.price_per_kwh}€</span></div><div className="text-xs mt-1" style={{color:"var(--text-secondary,#888)"}}>Betreiber: {s.operator}</div></div>
        <div className="flex flex-wrap gap-2">{s.features?.map((f,i)=>(<span key={i} className="px-3 py-1 rounded-full text-xs" style={{background:"rgba(0,194,255,0.1)",color:"#00C2FF"}}>{f}</span>))}</div>
        {charging?(
          <div className="space-y-3">
            <motion.div animate={{opacity:[0.5,1,0.5]}} transition={{duration:2,repeat:Infinity}} className="rounded-xl p-4 text-center" style={{background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)"}}>
              <BatteryCharging size={32} className="mx-auto mb-2 text-green-400"/>
              <div className="text-sm font-bold text-green-400">Ladevorgang aktiv</div>
              <div className="text-xs mt-1" style={{color:"var(--text-secondary,#888)"}}>{charging.power_kw} kW · {charging.price_per_kwh}€/kWh</div>
              <div className="text-xs mt-1" style={{color:"var(--text-secondary,#888)"}}>Station: {charging.station_name}</div>
            </motion.div>
            <button onClick={stopCharge} className="w-full py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2" style={{background:"#EF4444"}} data-testid="ev-stop"><CircleStop size={16}/>Laden beenden & bezahlen</button>
          </div>
        ):unlocked?(
          <div className="space-y-3">
            <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} className="rounded-xl p-4 text-center" style={{background:"rgba(0,194,255,0.1)",border:"1px solid rgba(0,194,255,0.3)"}}>
              <CheckCircle size={32} className="mx-auto mb-2" style={{color:"#00C2FF"}}/>
              <div className="text-sm font-bold" style={{color:"#00C2FF"}}>Ladesäule freigeschaltet!</div>
              <div className="text-lg font-mono font-bold tracking-widest mt-2" style={{color:"var(--text-primary,#fff)"}}>{unlockData?.unlock_code}</div>
              <div className="text-xs mt-1" style={{color:"var(--text-secondary,#888)"}}>Stecken Sie jetzt das Ladekabel ein</div>
            </motion.div>
            <button onClick={startCharge} className="w-full py-3 rounded-xl font-semibold text-sm text-black flex items-center justify-center gap-2" style={{background:"#10B981"}} data-testid="ev-start"><BatteryCharging size={16}/>Laden starten</button>
          </div>
        ):s.slots_available>0?(
          <button onClick={unlockStation} className="w-full py-3 rounded-xl font-semibold text-sm text-black flex items-center justify-center gap-2" style={{background:"#10B981"}} data-testid="ev-unlock"><Zap size={16}/>Ladesäule freischalten</button>
        ):(<div className="text-center py-3 rounded-xl text-sm font-medium" style={{background:"rgba(245,158,11,0.1)",color:"#F59E0B"}}>Alle Ladepunkte belegt</div>)}
      </div>
    </div>
  );}

  const TYPES=[{id:"",label:"Alle"},{id:"DC",label:"DC Schnell"},{id:"HPC",label:"HPC 350kW"},{id:"AC",label:"AC 22kW"}];
  return(
    <div className="min-h-screen pb-24" style={{background:"var(--bg-primary,#030303)"}}>
      <div className="sticky top-0 z-30 px-4 pt-4 pb-3" style={{background:"var(--bg-primary,#030303)"}}>
        <div className="flex items-center gap-3 mb-3"><button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:"var(--bg-card,#111)"}} data-testid="ev-back"><ArrowLeft size={20} style={{color:"var(--text-primary,#fff)"}}/></button><h1 className="text-lg font-bold" style={{color:"var(--text-primary,#fff)"}}>Ladesäulen</h1><BatteryCharging size={24} style={{color:"#10B981"}}/></div>
        <div className="relative mb-3"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{color:"var(--text-secondary,#666)"}}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Station oder Stadt suchen..." className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm" style={{background:"var(--bg-card,#111)",color:"var(--text-primary,#fff)",border:"1px solid rgba(255,255,255,0.06)"}} data-testid="ev-search"/></div>
        <div className="flex gap-2">{TYPES.map(t=>(<button key={t.id} onClick={()=>setTypeFilter(t.id)} className="px-3 py-1.5 rounded-full text-xs font-medium shrink-0" style={{background:typeFilter===t.id?"#10B981":"var(--bg-card,#111)",color:typeFilter===t.id?"#000":"var(--text-secondary,#aaa)"}} data-testid={`ev-type-${t.id||"all"}`}>{t.label}</button>))}</div>
      </div>
      <div className="px-4 space-y-3">{loading?<div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{borderColor:"#10B981",borderTopColor:"transparent"}}/></div>:filtered.map(s=>{const statusColor=STATUS_COLORS[s.status]||"#888";return(
        <motion.div key={s.station_id} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="rounded-2xl overflow-hidden cursor-pointer" style={{background:"var(--bg-card,#111)",border:"1px solid rgba(255,255,255,0.05)"}} onClick={()=>setSelected(s)} data-testid={`ev-station-${s.station_id}`}>
          <div className="relative"><img src={s.image} alt={s.name} className="w-full h-36 object-cover" loading="lazy"/><span className="absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-bold text-white" style={{background:statusColor}}>{STATUS_LABELS[s.status]}</span></div>
          <div className="p-3"><h3 className="text-sm font-semibold" style={{color:"var(--text-primary,#fff)"}}>{s.name}</h3>
            <div className="flex items-center gap-3 mt-1 text-xs" style={{color:"var(--text-secondary,#888)"}}><span className="flex items-center gap-1"><Zap size={12}/>{s.power_kw}kW</span><span>{s.connectors?.join(", ")}</span><span className="flex items-center gap-1"><BatteryCharging size={12}/>{s.slots_available}/{s.slots_total} frei</span></div>
            <div className="flex items-center justify-between mt-2"><span className="text-sm font-bold" style={{color:"#10B981"}}>{s.price_per_kwh}€/kWh</span><span className="text-xs" style={{color:"var(--text-secondary,#888)"}}>{s.operator}</span></div>
          </div>
        </motion.div>
      );})}</div>
    </div>
  );
}
