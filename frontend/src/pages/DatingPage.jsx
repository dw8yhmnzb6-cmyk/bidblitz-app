import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Heart, X, Star, MapPin, Sparkles, MessageCircle, Check } from "lucide-react";
const API = process.env.REACT_APP_BACKEND_URL;

export default function DatingPage({ onBack }) {
  const [profiles, setProfiles] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [tab, setTab] = useState("discover");
  const [matchPopup, setMatchPopup] = useState(false);
  const [dir, setDir] = useState(null);

  useEffect(()=>{load();},[]);
  const load = async()=>{try{const[r1,r2]=await Promise.all([fetch(`${API}/api/dating/discover`,{credentials:"include"}),fetch(`${API}/api/dating/matches`,{credentials:"include"}).catch(()=>({ok:false}))]);const d1=await r1.json();setProfiles(d1.profiles||[]);if(r2.ok){const d2=await r2.json();setMatches(d2.matches||[]);}}catch{}setLoading(false);};

  const action = async(type)=>{
    const p=profiles[idx]; if(!p)return;
    setDir(type==="like"?"right":"left");
    try{
      if(type==="like"){const r=await fetch(`${API}/api/dating/like`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({profile_id:p.profile_id})});if(r.ok){const d=await r.json();if(d.match)setMatchPopup(true);}}
      else{await fetch(`${API}/api/dating/pass`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({profile_id:p.profile_id})});}
    }catch{}
    setTimeout(()=>{setIdx(i=>i+1);setDir(null);},300);
  };

  const current = profiles[idx];

  return(
    <div className="min-h-screen pb-24" style={{background:"var(--bg-primary,#030303)"}}>
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:"var(--bg-card,#111)"}} data-testid="dat-back"><ArrowLeft size={20} style={{color:"var(--text-primary,#fff)"}}/></button>
        <h1 className="text-lg font-bold" style={{color:"var(--text-primary,#fff)"}}>Dating</h1>
        <div className="ml-auto flex gap-1 p-1 rounded-xl" style={{background:"var(--bg-card,#111)"}}>
          {[{id:"discover",label:"Entdecken"},{id:"matches",label:"Matches"}].map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{background:tab===t.id?"#EC4899":"transparent",color:tab===t.id?"#fff":"var(--text-secondary,#888)"}} data-testid={`dat-tab-${t.id}`}>{t.label}</button>))}
        </div>
      </div>

      {tab==="discover"?(
        <div className="px-4 flex flex-col items-center">
          {loading?<div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{borderColor:"#EC4899",borderTopColor:"transparent"}}/></div>:!current?(
            <div className="text-center py-20"><Heart size={48} className="mx-auto mb-3" style={{color:"var(--text-secondary,#444)"}}/><p className="text-sm" style={{color:"var(--text-secondary,#888)"}}>Keine Profile mehr. Komm später wieder!</p></div>
          ):(
            <AnimatePresence mode="wait">
              <motion.div key={current.profile_id} initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1,x:dir==="right"?300:dir==="left"?-300:0,rotate:dir==="right"?15:dir==="left"?-15:0}} exit={{opacity:0}} transition={{duration:0.3}} className="w-full max-w-sm rounded-3xl overflow-hidden relative" style={{background:"var(--bg-card,#111)"}} data-testid={`dat-profile-${current.profile_id}`}>
                <div className="relative"><img src={current.avatar} alt={current.name} className="w-full h-80 object-cover"/><div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"/>
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="flex items-center gap-2"><h2 className="text-xl font-bold text-white">{current.name}</h2>{current.verified&&<Check size={16} className="text-blue-400"/>}</div>
                    <div className="flex items-center gap-1 text-white/70 text-sm mt-1"><MapPin size={14}/>{current.city}</div>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-sm mb-3" style={{color:"var(--text-secondary,#aaa)"}}>{current.bio}</p>
                  <div className="flex flex-wrap gap-2">{current.interests?.map((i,idx)=>(<span key={idx} className="px-3 py-1 rounded-full text-xs" style={{background:"rgba(236,72,153,0.15)",color:"#EC4899"}}>{i}</span>))}</div>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
          {current&&(
            <div className="flex items-center gap-6 mt-6">
              <button onClick={()=>action("pass")} className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg" style={{background:"var(--bg-card,#111)",border:"2px solid #EF4444"}} data-testid="dat-pass"><X size={28} className="text-red-400"/></button>
              <button onClick={()=>action("superlike")} className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg" style={{background:"var(--bg-card,#111)",border:"2px solid #3B82F6"}} data-testid="dat-super"><Star size={22} className="text-blue-400"/></button>
              <button onClick={()=>action("like")} className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg" style={{background:"var(--bg-card,#111)",border:"2px solid #10B981"}} data-testid="dat-like"><Heart size={28} className="text-green-400"/></button>
            </div>
          )}
        </div>
      ):(
        <div className="px-4 space-y-3">{matches.length===0?(<div className="text-center py-20"><Sparkles size={48} className="mx-auto mb-3" style={{color:"var(--text-secondary,#444)"}}/><p className="text-sm" style={{color:"var(--text-secondary,#888)"}}>Noch keine Matches</p></div>):matches.map(m=>(
          <motion.div key={m.profile_id} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="rounded-2xl p-4 flex items-center gap-3" style={{background:"var(--bg-card,#111)",border:"1px solid rgba(236,72,153,0.2)"}}>
            <img src={m.avatar} alt={m.name} className="w-14 h-14 rounded-full object-cover"/>
            <div className="flex-1"><h3 className="text-sm font-semibold" style={{color:"var(--text-primary,#fff)"}}>{m.name}</h3><p className="text-xs" style={{color:"var(--text-secondary,#888)"}}>{m.city}</p></div>
            <button className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:"rgba(236,72,153,0.15)"}}><MessageCircle size={18} className="text-pink-400"/></button>
          </motion.div>
        ))}</div>
      )}

      <AnimatePresence>{matchPopup&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur" onClick={()=>setMatchPopup(false)}>
          <motion.div initial={{scale:0.5}} animate={{scale:1}} className="text-center p-8">
            <Sparkles size={64} className="mx-auto mb-4 text-pink-400"/>
            <h2 className="text-3xl font-bold text-white mb-2">It's a Match!</h2>
            <p className="text-white/70">Ihr mögt euch gegenseitig!</p>
            <button onClick={()=>setMatchPopup(false)} className="mt-6 px-6 py-3 rounded-xl font-semibold text-sm" style={{background:"#EC4899",color:"white"}} data-testid="dat-match-close">Nachricht senden</button>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
}
