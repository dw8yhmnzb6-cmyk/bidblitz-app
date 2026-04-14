import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Search, Star, Video, Clock, Stethoscope, Brain, Bone, Heart, Baby, Activity, Phone, Calendar, CheckCircle } from "lucide-react";
const API = process.env.REACT_APP_BACKEND_URL;
const SP_ICONS = {allgemeinmedizin:Activity,dermatologie:Heart,psychologie:Brain,orthopaedie:Bone,kinderheilkunde:Baby,innere:Stethoscope};
const SP_COLORS = {allgemeinmedizin:"#3B82F6",dermatologie:"#A855F7",psychologie:"#10B981",orthopaedie:"#F59E0B",kinderheilkunde:"#EC4899",innere:"#06B6D4"};

export default function TelemedizinPage({ onBack }) {
  const [doctors, setDoctors] = useState([]);
  const [specs, setSpecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [specFilter, setSpecFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [booked, setBooked] = useState(null);

  useEffect(()=>{load();},[specFilter]);
  const load = async()=>{try{const p=specFilter?`?specialty=${specFilter}`:"";const[r1,r2]=await Promise.all([fetch(`${API}/api/telemedizin/doctors${p}`),fetch(`${API}/api/telemedizin/specialties`)]);const[d1,d2]=await Promise.all([r1.json(),r2.json()]);setDoctors(d1.doctors||[]);setSpecs(d2.specialties||[]);}catch{}setLoading(false);};
  const book = async()=>{if(!selected||!date||!time)return;try{const r=await fetch(`${API}/api/telemedizin/appointment`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({doctor_id:selected.doctor_id,date,time,reason})});if(r.ok){const d=await r.json();setBooked(d.appointment);}}catch{}};

  if(booked) return(
    <div className="min-h-screen flex items-center justify-center px-4" style={{background:"var(--bg-primary,#030303)"}}>
      <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} className="rounded-2xl p-6 text-center max-w-sm w-full" style={{background:"var(--bg-card,#111)",border:"1px solid rgba(16,185,129,0.3)"}}>
        <CheckCircle size={48} className="mx-auto mb-3 text-green-400"/>
        <h2 className="text-lg font-bold mb-1" style={{color:"var(--text-primary,#fff)"}}>Termin bestätigt!</h2>
        <p className="text-sm mb-3" style={{color:"var(--text-secondary,#aaa)"}}>{booked.doctor_name}<br/>{booked.date} um {booked.time}</p>
        <div className="rounded-xl p-3 mb-4" style={{background:"rgba(0,194,255,0.1)"}}><Video size={20} className="mx-auto mb-1" style={{color:"#00C2FF"}}/><p className="text-xs" style={{color:"#00C2FF"}}>Video-Link wird per E-Mail gesendet</p></div>
        <button onClick={()=>{setBooked(null);setSelected(null);}} className="w-full py-3 rounded-xl font-semibold text-sm text-black" style={{background:"#00C2FF"}} data-testid="tm-done">Zurück</button>
      </motion.div>
    </div>
  );

  if(selected){const d=selected;const color=SP_COLORS[d.specialty]||"#00C2FF";return(
    <div className="min-h-screen pb-24" style={{background:"var(--bg-primary,#030303)"}}>
      <div className="px-4 pt-4 pb-3 flex items-center gap-3"><button onClick={()=>setSelected(null)} className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:"var(--bg-card,#111)"}} data-testid="tm-back2"><ArrowLeft size={20} style={{color:"var(--text-primary,#fff)"}}/></button><h1 className="text-lg font-bold" style={{color:"var(--text-primary,#fff)"}}>Termin buchen</h1></div>
      <div className="px-4 space-y-4">
        <div className="flex items-center gap-4"><img src={d.avatar} alt={d.name} className="w-16 h-16 rounded-xl object-cover"/><div><h2 className="text-base font-bold" style={{color:"var(--text-primary,#fff)"}}>{d.name}</h2><div className="flex items-center gap-2 mt-1"><Star size={14} className="text-yellow-400 fill-yellow-400"/><span className="text-xs" style={{color:"var(--text-primary,#fff)"}}>{d.rating}</span><span className="text-xs" style={{color:"var(--text-secondary,#888)"}}>({d.reviews})</span></div><div className="text-xs mt-1" style={{color}}>Nächster Termin: {d.next_slot}</div></div></div>
        <p className="text-sm" style={{color:"var(--text-secondary,#aaa)"}}>{d.description}</p>
        <div className="rounded-xl p-3 flex items-center justify-between" style={{background:"var(--bg-card,#111)"}}><span className="text-sm" style={{color:"var(--text-primary,#fff)"}}>Videosprechstunde</span><span className="text-sm font-bold" style={{color:"#00C2FF"}}>{d.price_consultation}€</span></div>
        <div className="space-y-3">
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={{background:"var(--bg-card,#111)",color:"var(--text-primary,#fff)",border:"1px solid rgba(255,255,255,0.1)"}} data-testid="tm-date"/>
          <input type="time" value={time} onChange={e=>setTime(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={{background:"var(--bg-card,#111)",color:"var(--text-primary,#fff)",border:"1px solid rgba(255,255,255,0.1)"}} data-testid="tm-time"/>
          <textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Grund des Besuchs (optional)" className="w-full px-3 py-2 rounded-lg text-sm resize-none" rows={2} style={{background:"var(--bg-card,#111)",color:"var(--text-primary,#fff)",border:"1px solid rgba(255,255,255,0.1)"}} data-testid="tm-reason"/>
          <button onClick={book} className="w-full py-3 rounded-xl font-semibold text-sm text-black flex items-center justify-center gap-2" style={{background:"#00C2FF"}} data-testid="tm-book"><Video size={16}/>Videosprechstunde buchen — {d.price_consultation}€</button>
        </div>
      </div>
    </div>
  );}

  return(
    <div className="min-h-screen pb-24" style={{background:"var(--bg-primary,#030303)"}}>
      <div className="sticky top-0 z-30 px-4 pt-4 pb-3" style={{background:"var(--bg-primary,#030303)"}}>
        <div className="flex items-center gap-3 mb-3"><button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:"var(--bg-card,#111)"}} data-testid="tm-back"><ArrowLeft size={20} style={{color:"var(--text-primary,#fff)"}}/></button><h1 className="text-lg font-bold" style={{color:"var(--text-primary,#fff)"}}>Telemedizin</h1></div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button onClick={()=>setSpecFilter("")} className="px-3 py-1.5 rounded-full text-xs font-medium shrink-0" style={{background:!specFilter?"#00C2FF":"var(--bg-card,#111)",color:!specFilter?"#000":"var(--text-secondary,#aaa)"}} data-testid="tm-spec-all">Alle</button>
          {specs.map(s=>(<button key={s.id} onClick={()=>setSpecFilter(s.id)} className="px-3 py-1.5 rounded-full text-xs font-medium shrink-0" style={{background:specFilter===s.id?(s.color||"#00C2FF"):"var(--bg-card,#111)",color:specFilter===s.id?"#fff":"var(--text-secondary,#aaa)"}} data-testid={`tm-spec-${s.id}`}>{s.label}</button>))}
        </div>
      </div>
      <div className="px-4 space-y-3">{loading?<div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{borderColor:"#00C2FF",borderTopColor:"transparent"}}/></div>:doctors.map(d=>{const color=SP_COLORS[d.specialty]||"#00C2FF";return(
        <motion.div key={d.doctor_id} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="rounded-2xl p-4 cursor-pointer" style={{background:"var(--bg-card,#111)",border:"1px solid rgba(255,255,255,0.05)"}} onClick={()=>setSelected(d)} data-testid={`tm-doc-${d.doctor_id}`}>
          <div className="flex items-start gap-3"><img src={d.avatar} alt={d.name} className="w-14 h-14 rounded-xl object-cover shrink-0"/><div className="flex-1"><h3 className="text-sm font-semibold" style={{color:"var(--text-primary,#fff)"}}>{d.name}</h3><div className="flex items-center gap-2 mt-1"><Star size={12} className="text-yellow-400 fill-yellow-400"/><span className="text-xs" style={{color:"var(--text-primary,#fff)"}}>{d.rating}</span><span className="text-xs" style={{color:"var(--text-secondary,#888)"}}>({d.reviews})</span></div><div className="text-xs mt-1" style={{color}}>Nächster Termin: {d.next_slot}</div></div><div className="text-right shrink-0"><div className="text-sm font-bold" style={{color:"#00C2FF"}}>{d.price_consultation}€</div><div className="text-[10px]" style={{color:"var(--text-secondary,#888)"}}>Video</div></div></div>
        </motion.div>
      );})}</div>
    </div>
  );
}
