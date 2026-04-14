import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Search, Zap, BatteryCharging, MapPin, Star, Plug, CheckCircle, CircleStop, Wallet, Receipt, Clock, TrendingUp, X, ChevronRight, AlertTriangle } from "lucide-react";
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
  const [receipt, setReceipt] = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [tab, setTab] = useState("stations"); // stations | charging | history
  const [error, setError] = useState("");
  const [timer, setTimer] = useState(0);
  const timerRef = useRef(null);

  useEffect(()=>{load(); loadWallet(); checkActive();},[typeFilter]);

  const load = async()=>{try{const p=typeFilter?`?type=${typeFilter}`:"";const r=await fetch(`${API}/api/ladesaeulen/stations${p}`);const d=await r.json();setStations(d.stations||[]);}catch{}setLoading(false);};

  const loadWallet = async()=>{try{const r=await fetch(`${API}/api/auth/me`,{credentials:"include"});if(r.ok){const d=await r.json();setWalletBalance(d.balance);}}catch{}};

  const checkActive = async()=>{try{const r=await fetch(`${API}/api/ladesaeulen/active-session`,{credentials:"include"});if(r.ok){const d=await r.json();if(d.session){setCharging(d.session);setTab("charging");}}}catch{}};

  const loadHistory = async()=>{try{const r=await fetch(`${API}/api/ladesaeulen/my-sessions`,{credentials:"include"});if(r.ok){const d=await r.json();setSessions(d.sessions||[]);}}catch{}};

  useEffect(()=>{if(tab==="history")loadHistory();},[tab]);

  // Timer for active charging
  useEffect(()=>{
    if(charging&&charging.status==="charging"){
      timerRef.current=setInterval(()=>setTimer(t=>t+1),1000);
      return()=>clearInterval(timerRef.current);
    }else{if(timerRef.current)clearInterval(timerRef.current);setTimer(0);}
  },[charging]);

  const startCharge = async(stationId)=>{
    setError("");
    try{
      const r=await fetch(`${API}/api/ladesaeulen/start`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({station_id:stationId})});
      const d=await r.json();
      if(r.ok){setCharging(d.session);setWalletBalance(d.wallet_balance);setTab("charging");setSelected(null);}
      else{setError(d.detail||"Fehler beim Starten");}
    }catch{setError("Netzwerkfehler");}
  };

  const stopCharge = async()=>{
    if(!charging)return;setError("");
    try{
      const r=await fetch(`${API}/api/ladesaeulen/stop`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:charging.session_id})});
      const d=await r.json();
      if(r.ok){setReceipt(d);setCharging(null);setWalletBalance(d.new_balance);if(timerRef.current)clearInterval(timerRef.current);}
      else{setError(d.detail||"Fehler");}
    }catch{setError("Netzwerkfehler");}
  };

  const formatTime=(s)=>{const m=Math.floor(s/60);const sec=s%60;return`${m}:${sec.toString().padStart(2,"0")}`;};
  const estimatedCost=charging?((timer/60)*(charging.price_per_kwh||0.45)*((charging.power_kw||50)/60)).toFixed(2):"0.00";

  const filtered=stations.filter(s=>!search||s.name?.toLowerCase().includes(search.toLowerCase())||s.city?.toLowerCase().includes(search.toLowerCase()));

  // ═══ RECEIPT OVERLAY ═══
  if(receipt) return(
    <div className="min-h-screen pb-24 flex items-center justify-center px-4" style={{background:"var(--bg-primary,#030303)"}}>
      <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} className="rounded-2xl p-6 max-w-sm w-full" style={{background:"var(--bg-card,#111)",border:"1px solid rgba(16,185,129,0.3)"}}>
        <div className="text-center mb-5">
          <CheckCircle size={48} className="mx-auto mb-3 text-green-400"/>
          <h2 className="text-lg font-bold" style={{color:"var(--text-primary,#fff)"}}>Ladevorgang abgeschlossen</h2>
        </div>

        <div className="rounded-xl p-4 mb-4" style={{background:"var(--bg-primary,#030303)",border:"1px solid rgba(255,255,255,0.06)"}}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs" style={{color:"var(--text-secondary,#888)"}}>Quittung</span>
            <span className="text-[10px] font-mono" style={{color:"var(--text-secondary,#666)"}}>{receipt.receipt?.receipt_id}</span>
          </div>

          {[
            ["Station", receipt.receipt?.station],
            ["Betreiber", receipt.receipt?.operator],
            ["Anschluss", receipt.receipt?.connector],
            ["Geladen", `${receipt.kwh_charged} kWh`],
            ["Preis/kWh", `${receipt.receipt?.price_per_kwh}€`],
          ].map(([k,v],i)=>(
            <div key={i} className="flex justify-between py-1.5 text-xs" style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
              <span style={{color:"var(--text-secondary,#888)"}}>{k}</span>
              <span style={{color:"var(--text-primary,#fff)"}}>{v}</span>
            </div>
          ))}

          <div className="flex justify-between py-2 mt-1" style={{borderTop:"1px solid rgba(255,255,255,0.08)"}}>
            <span className="text-sm font-semibold" style={{color:"var(--text-primary,#fff)"}}>Bezahlt</span>
            <span className="text-sm font-bold" style={{color:"#00C2FF"}}>{receipt.cost}€</span>
          </div>

          {receipt.cashback>0&&(
            <div className="flex justify-between py-1">
              <span className="text-xs text-green-400">Cashback (3%)</span>
              <span className="text-xs font-bold text-green-400">+{receipt.cashback}€</span>
            </div>
          )}
        </div>

        <div className="rounded-xl p-3 mb-4 flex items-center justify-between" style={{background:"rgba(0,194,255,0.08)",border:"1px solid rgba(0,194,255,0.15)"}}>
          <div className="flex items-center gap-2"><Wallet size={16} style={{color:"#00C2FF"}}/><span className="text-xs" style={{color:"var(--text-secondary,#aaa)"}}>Neues Guthaben</span></div>
          <span className="text-sm font-bold" style={{color:"#00C2FF"}}>{receipt.new_balance}€</span>
        </div>

        <div className="text-center text-[10px] mb-4" style={{color:"var(--text-secondary,#666)"}}>Bezahlt mit BidBlitz Wallet</div>

        <button onClick={()=>{setReceipt(null);setTab("stations");load();}} className="w-full py-3 rounded-xl font-semibold text-sm text-black" style={{background:"#00C2FF"}} data-testid="ev-done">Fertig</button>
      </motion.div>
    </div>
  );

  // ═══ STATION DETAIL ═══
  if(selected){const s=selected;const statusColor=STATUS_COLORS[s.status]||"#888";return(
    <div className="min-h-screen pb-24" style={{background:"var(--bg-primary,#030303)"}}>
      <div className="relative"><img src={s.image} alt={s.name} className="w-full h-48 object-cover"/><div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"/><button onClick={()=>setSelected(null)} className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center" data-testid="ev-back2"><ArrowLeft size={20} className="text-white"/></button>
        <div className="absolute bottom-4 left-4 right-4"><div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{background:statusColor}}/><span className="text-xs text-white font-medium">{STATUS_LABELS[s.status]}</span></div><h1 className="text-white text-lg font-bold mt-1">{s.name}</h1></div>
      </div>
      <div className="px-4 py-5 space-y-4">
        {/* Wallet Balance Banner */}
        <div className="rounded-xl p-3 flex items-center justify-between" style={{background:"rgba(0,194,255,0.08)",border:"1px solid rgba(0,194,255,0.15)"}}>
          <div className="flex items-center gap-2"><Wallet size={16} style={{color:"#00C2FF"}}/><span className="text-xs" style={{color:"var(--text-secondary,#aaa)"}}>BidBlitz Guthaben</span></div>
          <span className="text-sm font-bold" style={{color:"#00C2FF"}}>{walletBalance!=null?`${walletBalance.toFixed(2)}€`:"—"}</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[{icon:Zap,v:`${s.power_kw} kW`,l:"Leistung"},{icon:Plug,v:s.connectors?.join(", "),l:"Anschlüsse"},{icon:BatteryCharging,v:`${s.slots_available}/${s.slots_total}`,l:"Frei"}].map((item,i)=>(
            <div key={i} className="rounded-xl p-3 text-center" style={{background:"var(--bg-card,#111)"}}><item.icon size={18} className="mx-auto mb-1" style={{color:"#10B981"}}/><div className="text-xs font-medium" style={{color:"var(--text-primary,#fff)"}}>{item.v}</div><div className="text-[10px]" style={{color:"var(--text-secondary,#888)"}}>{item.l}</div></div>
          ))}
        </div>

        <div className="rounded-xl p-3" style={{background:"var(--bg-card,#111)"}}>
          <div className="flex items-center gap-2 mb-2"><MapPin size={14} style={{color:"var(--text-secondary,#888)"}}/><span className="text-xs" style={{color:"var(--text-secondary,#aaa)"}}>{s.address}</span></div>
          <div className="flex items-center justify-between"><span className="text-sm" style={{color:"var(--text-primary,#fff)"}}>Preis pro kWh</span><span className="text-lg font-bold" style={{color:"#10B981"}}>{s.price_per_kwh}€</span></div>
          <div className="text-xs mt-1" style={{color:"var(--text-secondary,#888)"}}>Betreiber: {s.operator} · 3% Cashback</div>
        </div>

        <div className="flex flex-wrap gap-2">{s.features?.map((f,i)=>(<span key={i} className="px-3 py-1 rounded-full text-xs" style={{background:"rgba(16,185,129,0.1)",color:"#10B981"}}>{f}</span>))}</div>

        {/* Error */}
        <AnimatePresence>{error&&(<motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="rounded-xl p-3 flex items-center gap-2" style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)"}}>
          <AlertTriangle size={16} className="text-red-400 shrink-0"/><span className="text-xs text-red-400">{error}</span>
          <button onClick={()=>setError("")} className="ml-auto"><X size={14} className="text-red-400"/></button>
        </motion.div>)}</AnimatePresence>

        {/* Pricing Info */}
        <div className="rounded-xl p-3" style={{background:"rgba(16,185,129,0.05)",border:"1px solid rgba(16,185,129,0.15)"}}>
          <div className="text-xs font-semibold mb-2" style={{color:"#10B981"}}>Bezahlung via BidBlitz Wallet</div>
          <div className="space-y-1 text-[10px]" style={{color:"var(--text-secondary,#aaa)"}}>
            <div className="flex justify-between"><span>Reservierung beim Start</span><span>5,00€</span></div>
            <div className="flex justify-between"><span>Abrechnung pro kWh</span><span>{s.price_per_kwh}€</span></div>
            <div className="flex justify-between text-green-400"><span>Cashback</span><span>3% zurück</span></div>
          </div>
        </div>

        {s.slots_available>0?(
          <button onClick={()=>startCharge(s.station_id)} className="w-full py-3.5 rounded-xl font-semibold text-sm text-black flex items-center justify-center gap-2" style={{background:"#10B981"}} data-testid="ev-start">
            <BatteryCharging size={18}/>Freischalten & Laden — Bezahlung via Wallet
          </button>
        ):(<div className="text-center py-3 rounded-xl text-sm font-medium" style={{background:"rgba(245,158,11,0.1)",color:"#F59E0B"}}>Alle Ladepunkte belegt</div>)}
      </div>
    </div>
  );}

  return(
    <div className="min-h-screen pb-24" style={{background:"var(--bg-primary,#030303)"}}>
      <div className="sticky top-0 z-30 px-4 pt-4 pb-3" style={{background:"var(--bg-primary,#030303)"}}>
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:"var(--bg-card,#111)"}} data-testid="ev-back"><ArrowLeft size={20} style={{color:"var(--text-primary,#fff)"}}/></button>
          <div className="flex-1">
            <h1 className="text-lg font-bold" style={{color:"var(--text-primary,#fff)"}}>Ladesäulen</h1>
            <p className="text-[10px]" style={{color:"var(--text-secondary,#888)"}}>Bezahlung via BidBlitz Wallet · 3% Cashback</p>
          </div>
          {walletBalance!=null&&(<div className="text-right"><div className="text-xs font-bold" style={{color:"#00C2FF"}}>{walletBalance.toFixed(2)}€</div><div className="text-[9px]" style={{color:"var(--text-secondary,#888)"}}>Guthaben</div></div>)}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl mb-3" style={{background:"var(--bg-card,#111)"}}>
          {[{id:"stations",label:"Stationen",icon:BatteryCharging},{id:"charging",label:"Aktiv",icon:Zap},{id:"history",label:"Verlauf",icon:Clock}].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all" data-testid={`ev-tab-${t.id}`}
              style={{background:tab===t.id?"#10B981":"transparent",color:tab===t.id?"#000":"var(--text-secondary,#888)"}}>
              <t.icon size={12}/>{t.label}
              {t.id==="charging"&&charging&&<span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/>}
            </button>
          ))}
        </div>

        {tab==="stations"&&(
          <>
            <div className="relative mb-3"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{color:"var(--text-secondary,#666)"}}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Station oder Stadt suchen..." className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm" style={{background:"var(--bg-card,#111)",color:"var(--text-primary,#fff)",border:"1px solid rgba(255,255,255,0.06)"}} data-testid="ev-search"/></div>
            <div className="flex gap-2">{[{id:"",label:"Alle"},{id:"DC",label:"DC Schnell"},{id:"HPC",label:"HPC 350kW"},{id:"AC",label:"AC 22kW"}].map(t=>(<button key={t.id} onClick={()=>setTypeFilter(t.id)} className="px-3 py-1.5 rounded-full text-xs font-medium shrink-0" style={{background:typeFilter===t.id?"#10B981":"var(--bg-card,#111)",color:typeFilter===t.id?"#000":"var(--text-secondary,#aaa)"}} data-testid={`ev-type-${t.id||"all"}`}>{t.label}</button>))}</div>
          </>
        )}
      </div>

      <div className="px-4 space-y-3">
        {/* ═══ STATIONS LIST ═══ */}
        {tab==="stations"&&(loading?<div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{borderColor:"#10B981",borderTopColor:"transparent"}}/></div>:filtered.length===0?<div className="text-center py-20"><BatteryCharging size={48} className="mx-auto mb-3" style={{color:"var(--text-secondary,#444)"}}/><p style={{color:"var(--text-secondary,#888)"}}>Keine Stationen gefunden</p></div>:filtered.map(s=>{const statusColor=STATUS_COLORS[s.status]||"#888";return(
          <motion.div key={s.station_id} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="rounded-2xl overflow-hidden cursor-pointer" style={{background:"var(--bg-card,#111)",border:"1px solid rgba(255,255,255,0.05)"}} onClick={()=>setSelected(s)} data-testid={`ev-station-${s.station_id}`}>
            <div className="relative"><img src={s.image} alt={s.name} className="w-full h-36 object-cover" loading="lazy"/><span className="absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-bold text-white" style={{background:statusColor}}>{STATUS_LABELS[s.status]}</span></div>
            <div className="p-3"><h3 className="text-sm font-semibold" style={{color:"var(--text-primary,#fff)"}}>{s.name}</h3>
              <div className="flex items-center gap-3 mt-1 text-xs" style={{color:"var(--text-secondary,#888)"}}><span className="flex items-center gap-1"><Zap size={12}/>{s.power_kw}kW</span><span>{s.connectors?.join(", ")}</span><span className="flex items-center gap-1"><BatteryCharging size={12}/>{s.slots_available}/{s.slots_total} frei</span></div>
              <div className="flex items-center justify-between mt-2"><span className="text-sm font-bold" style={{color:"#10B981"}}>{s.price_per_kwh}€/kWh</span><div className="flex items-center gap-1"><Wallet size={12} style={{color:"#00C2FF"}}/><span className="text-[10px]" style={{color:"#00C2FF"}}>BidBlitz Pay</span></div></div>
            </div>
          </motion.div>
        );}))}

        {/* ═══ ACTIVE CHARGING ═══ */}
        {tab==="charging"&&(charging?(
          <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="space-y-4">
            <motion.div animate={{boxShadow:["0 0 0px rgba(16,185,129,0)","0 0 20px rgba(16,185,129,0.3)","0 0 0px rgba(16,185,129,0)"]}} transition={{duration:2,repeat:Infinity}} className="rounded-2xl p-5 text-center" style={{background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.3)"}}>
              <motion.div animate={{rotate:360}} transition={{duration:3,repeat:Infinity,ease:"linear"}}>
                <BatteryCharging size={40} className="mx-auto mb-3 text-green-400"/>
              </motion.div>
              <div className="text-lg font-bold text-green-400">Laden aktiv</div>
              <div className="text-3xl font-bold mt-2" style={{color:"var(--text-primary,#fff)"}}>{formatTime(timer)}</div>
              <div className="text-xs mt-1" style={{color:"var(--text-secondary,#888)"}}>Minuten : Sekunden</div>
            </motion.div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3 text-center" style={{background:"var(--bg-card,#111)"}}><div className="text-lg font-bold" style={{color:"#00C2FF"}}>~{estimatedCost}€</div><div className="text-[10px]" style={{color:"var(--text-secondary,#888)"}}>Geschätzte Kosten</div></div>
              <div className="rounded-xl p-3 text-center" style={{background:"var(--bg-card,#111)"}}><div className="text-lg font-bold" style={{color:"#10B981"}}>{charging.power_kw}kW</div><div className="text-[10px]" style={{color:"var(--text-secondary,#888)"}}>Ladeleistung</div></div>
            </div>

            <div className="rounded-xl p-3" style={{background:"var(--bg-card,#111)"}}>
              <div className="text-xs font-semibold mb-2" style={{color:"var(--text-primary,#fff)"}}>Session-Details</div>
              {[["Station",charging.station_name],["Betreiber",charging.operator],["Anschluss",charging.connector],["Preis/kWh",`${charging.price_per_kwh}€`]].map(([k,v],i)=>(
                <div key={i} className="flex justify-between py-1 text-xs"><span style={{color:"var(--text-secondary,#888)"}}>{k}</span><span style={{color:"var(--text-primary,#fff)"}}>{v}</span></div>
              ))}
            </div>

            <div className="rounded-xl p-3 flex items-center justify-between" style={{background:"rgba(0,194,255,0.08)",border:"1px solid rgba(0,194,255,0.15)"}}>
              <div className="flex items-center gap-2"><Wallet size={16} style={{color:"#00C2FF"}}/><span className="text-xs" style={{color:"var(--text-secondary,#aaa)"}}>Bezahlung</span></div>
              <span className="text-xs font-medium" style={{color:"#00C2FF"}}>BidBlitz Wallet (5€ reserviert)</span>
            </div>

            <button onClick={stopCharge} className="w-full py-3.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2" style={{background:"#EF4444"}} data-testid="ev-stop">
              <CircleStop size={18}/>Laden beenden & bezahlen
            </button>
          </motion.div>
        ):(
          <div className="text-center py-16"><BatteryCharging size={48} className="mx-auto mb-3" style={{color:"var(--text-secondary,#444)"}}/><p className="text-sm" style={{color:"var(--text-secondary,#888)"}}>Kein aktiver Ladevorgang</p><button onClick={()=>setTab("stations")} className="mt-3 text-xs" style={{color:"#10B981"}}>Station auswählen</button></div>
        ))}

        {/* ═══ HISTORY ═══ */}
        {tab==="history"&&(sessions.length===0?(
          <div className="text-center py-16"><Clock size={48} className="mx-auto mb-3" style={{color:"var(--text-secondary,#444)"}}/><p className="text-sm" style={{color:"var(--text-secondary,#888)"}}>Noch keine Ladevorgänge</p></div>
        ):(<div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3 text-center" style={{background:"var(--bg-card,#111)"}}><div className="text-lg font-bold" style={{color:"#10B981"}}>{sessions.length}</div><div className="text-[10px]" style={{color:"var(--text-secondary,#888)"}}>Ladevorgänge</div></div>
            <div className="rounded-xl p-3 text-center" style={{background:"var(--bg-card,#111)"}}><div className="text-lg font-bold" style={{color:"#00C2FF"}}>{sessions.reduce((s,x)=>s+(x.cost||0),0).toFixed(2)}€</div><div className="text-[10px]" style={{color:"var(--text-secondary,#888)"}}>Gesamt bezahlt</div></div>
          </div>
          {sessions.map(s=>(
            <div key={s.session_id} className="rounded-xl p-3" style={{background:"var(--bg-card,#111)",border:"1px solid rgba(255,255,255,0.05)"}}>
              <div className="flex items-center justify-between mb-2">
                <div><div className="text-xs font-semibold" style={{color:"var(--text-primary,#fff)"}}>{s.station_name}</div><div className="text-[10px]" style={{color:"var(--text-secondary,#888)"}}>{s.operator} · {s.connector}</div></div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.status==="completed"?"bg-green-500/20 text-green-400":s.status==="charging"?"bg-yellow-500/20 text-yellow-400":"bg-gray-500/20 text-gray-400"}`}>{s.status==="completed"?"Abgeschlossen":s.status==="charging"?"Aktiv":"—"}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex gap-3" style={{color:"var(--text-secondary,#888)"}}><span>{s.kwh_charged||0} kWh</span><span>{s.power_kw}kW</span></div>
                <div className="text-right"><span className="font-bold" style={{color:"#00C2FF"}}>{(s.cost||0).toFixed(2)}€</span>{s.cashback>0&&<span className="text-[10px] text-green-400 ml-1">+{s.cashback}€</span>}</div>
              </div>
              {s.started_at&&<div className="text-[10px] mt-1" style={{color:"var(--text-secondary,#666)"}}>{new Date(s.started_at).toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>}
            </div>
          ))}
        </div>))}
      </div>
    </div>
  );
}
