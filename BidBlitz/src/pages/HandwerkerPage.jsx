import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Search, Star, MapPin, Clock, Zap, Wrench, Key, TreePine, Paintbrush, Droplets, Phone, Send, CheckCircle } from "lucide-react";
const API = process.env.REACT_APP_BACKEND_URL;
const ICONS = { elektriker: Zap, klempner: Droplets, maler: Paintbrush, schluessel: Key, garten: TreePine, montage: Wrench };
const COLORS = { elektriker:"#F59E0B",klempner:"#3B82F6",maler:"#A855F7",schluessel:"#EF4444",garten:"#10B981",montage:"#F97316" };

export default function HandwerkerPage({ onBack }) {
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [desc, setDesc] = useState("");
  const [addr, setAddr] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => { load(); }, [catFilter]);
  const load = async () => {
    try {
      const p = catFilter ? `?category=${catFilter}` : "";
      const [r1,r2] = await Promise.all([fetch(`${API}/api/handwerker/list${p}`), fetch(`${API}/api/handwerker/categories`)]);
      const [d1,d2] = await Promise.all([r1.json(), r2.json()]);
      setItems(d1.handwerker||[]); setCats(d2.categories||[]);
    } catch {} setLoading(false);
  };
  const book = async () => {
    if (!selected||!desc) return;
    try { await fetch(`${API}/api/handwerker/book`, { method:"POST", credentials:"include", headers:{"Content-Type":"application/json"}, body:JSON.stringify({hw_id:selected.hw_id,description:desc,address:addr}) }); setSent(true); setTimeout(()=>{setSent(false);setSelected(null);setDesc("");setAddr("");},2000); } catch {}
  };

  if (selected) {
    const h = selected; const color = COLORS[h.category]||"#00C2FF";
    return (
      <div className="min-h-screen pb-24" style={{background:"var(--bg-primary,#030303)"}}>
        <div className="px-4 pt-4 pb-3 flex items-center gap-3">
          <button onClick={()=>setSelected(null)} className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:"var(--bg-card,#111)"}} data-testid="hw-detail-back"><ArrowLeft size={20} style={{color:"var(--text-primary,#fff)"}}/></button>
          <h1 className="text-lg font-bold" style={{color:"var(--text-primary,#fff)"}}>Details</h1>
        </div>
        <div className="px-4 space-y-4">
          <div className="flex items-center gap-4">
            <img src={h.avatar} alt={h.name} className="w-16 h-16 rounded-xl object-cover"/>
            <div>
              <h2 className="text-base font-bold" style={{color:"var(--text-primary,#fff)"}}>{h.name}</h2>
              <div className="flex items-center gap-2 mt-1"><Star size={14} className="text-yellow-400 fill-yellow-400"/><span className="text-xs" style={{color:"var(--text-primary,#fff)"}}>{h.rating}</span><span className="text-xs" style={{color:"var(--text-secondary,#888)"}}>({h.reviews})</span></div>
              <div className="text-xs mt-1" style={{color:color}}>{h.hourly_rate}€/Std. · {h.response_time}</div>
            </div>
          </div>
          <p className="text-sm" style={{color:"var(--text-secondary,#aaa)"}}>{h.description}</p>
          <div className="flex flex-wrap gap-2">{h.skills?.map((s,i)=>(<span key={i} className="px-3 py-1 rounded-full text-xs" style={{background:`${color}20`,color}}>{s}</span>))}</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3 text-center" style={{background:"var(--bg-card,#111)"}}><div className="text-sm font-bold" style={{color:"#00C2FF"}}>{h.completed_jobs}</div><div className="text-[10px]" style={{color:"var(--text-secondary,#888)"}}>Aufträge</div></div>
            <div className="rounded-xl p-3 text-center" style={{background:"var(--bg-card,#111)"}}><div className="text-sm font-bold" style={{color:"#00C2FF"}}>{h.response_time}</div><div className="text-[10px]" style={{color:"var(--text-secondary,#888)"}}>Antwortzeit</div></div>
          </div>
          <div className="rounded-xl p-4 space-y-3" style={{background:"var(--bg-card,#111)",border:"1px solid rgba(255,255,255,0.06)"}}>
            <h3 className="text-sm font-semibold" style={{color:"var(--text-primary,#fff)"}}>Auftrag anfragen</h3>
            <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Was muss gemacht werden?" className="w-full px-3 py-2 rounded-lg text-sm resize-none" rows={3} style={{background:"var(--bg-primary,#030303)",color:"var(--text-primary,#fff)",border:"1px solid rgba(255,255,255,0.1)"}} data-testid="hw-desc"/>
            <input value={addr} onChange={e=>setAddr(e.target.value)} placeholder="Adresse" className="w-full px-3 py-2 rounded-lg text-sm" style={{background:"var(--bg-primary,#030303)",color:"var(--text-primary,#fff)",border:"1px solid rgba(255,255,255,0.1)"}} data-testid="hw-addr"/>
            <button onClick={book} className="w-full py-3 rounded-xl font-semibold text-sm text-black flex items-center justify-center gap-2" style={{background:"#00C2FF"}} data-testid="hw-book">{sent?<><CheckCircle size={16}/>Gesendet!</>:<><Send size={16}/>Anfrage senden</>}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{background:"var(--bg-primary,#030303)"}}>
      <div className="sticky top-0 z-30 px-4 pt-4 pb-3" style={{background:"var(--bg-primary,#030303)"}}>
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:"var(--bg-card,#111)"}} data-testid="hw-back"><ArrowLeft size={20} style={{color:"var(--text-primary,#fff)"}}/></button>
          <h1 className="text-lg font-bold" style={{color:"var(--text-primary,#fff)"}}>Handwerker</h1>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button onClick={()=>setCatFilter("")} className="px-3 py-1.5 rounded-full text-xs font-medium shrink-0" style={{background:!catFilter?"#00C2FF":"var(--bg-card,#111)",color:!catFilter?"#000":"var(--text-secondary,#aaa)"}} data-testid="hw-cat-all">Alle</button>
          {cats.map(c=>{const I=ICONS[c.id]||Wrench;return(<button key={c.id} onClick={()=>setCatFilter(c.id)} className="px-3 py-1.5 rounded-full text-xs font-medium shrink-0 flex items-center gap-1" style={{background:catFilter===c.id?(c.color||"#00C2FF"):"var(--bg-card,#111)",color:catFilter===c.id?"#000":"var(--text-secondary,#aaa)"}} data-testid={`hw-cat-${c.id}`}><I size={12}/>{c.label}</button>);})}
        </div>
      </div>
      <div className="px-4 space-y-3">
        {loading?<div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{borderColor:"#00C2FF",borderTopColor:"transparent"}}/></div>:items.map(h=>{const color=COLORS[h.category]||"#00C2FF";return(
          <motion.div key={h.hw_id} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="rounded-2xl p-4 cursor-pointer" style={{background:"var(--bg-card,#111)",border:"1px solid rgba(255,255,255,0.05)"}} onClick={()=>setSelected(h)} data-testid={`hw-card-${h.hw_id}`}>
            <div className="flex items-start gap-3">
              <img src={h.avatar} alt={h.name} className="w-14 h-14 rounded-xl object-cover shrink-0"/>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between"><h3 className="text-sm font-semibold" style={{color:"var(--text-primary,#fff)"}}>{h.name}</h3>{h.featured&&<span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">TOP</span>}</div>
                <div className="flex items-center gap-2 mt-1"><Star size={12} className="text-yellow-400 fill-yellow-400"/><span className="text-xs" style={{color:"var(--text-primary,#fff)"}}>{h.rating}</span><MapPin size={12} style={{color:"var(--text-secondary,#666)"}}/><span className="text-xs" style={{color:"var(--text-secondary,#888)"}}>{h.city}</span></div>
                <div className="flex flex-wrap gap-1 mt-2">{h.skills?.slice(0,3).map((s,i)=>(<span key={i} className="px-2 py-0.5 rounded text-[10px]" style={{background:`${color}15`,color}}>{s}</span>))}</div>
              </div>
              <div className="text-right shrink-0"><div className="text-sm font-bold" style={{color:"#00C2FF"}}>{h.hourly_rate}€</div><div className="text-[10px]" style={{color:"var(--text-secondary,#888)"}}>/Std.</div></div>
            </div>
          </motion.div>
        );})}
      </div>
    </div>
  );
}
