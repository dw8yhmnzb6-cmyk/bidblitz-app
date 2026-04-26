import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Heart, X, Star, MapPin, Sparkles, MessageCircle, Check, Crown, Camera, Plus, Edit2 } from "lucide-react";
import { toast } from "sonner";
const API = process.env.REACT_APP_BACKEND_URL;

const DAILY_FREE_SWIPES = 20; // Bumble-style limit

export default function DatingPage({ onBack }) {
  const [profiles, setProfiles] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [tab, setTab] = useState("discover");
  const [matchPopup, setMatchPopup] = useState(false);
  const [dir, setDir] = useState(null);
  const [swipesLeft, setSwipesLeft] = useState(DAILY_FREE_SWIPES);
  const [isPremium, setIsPremium] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [showProfileSetup, setShowProfileSetup] = useState(false);

  useEffect(()=>{load();},[]);
  const load = async()=>{
    try{
      // Load user profile
      const profileRes = await fetch(`${API}/api/dating/profile/me`, {credentials:"include"});
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setUserProfile(profileData.profile);
        setIsPremium(profileData.profile?.premium || false);
        
        // Check swipes left today
        const swipesRes = await fetch(`${API}/api/dating/swipes-left`, {credentials:"include"});
        if (swipesRes.ok) {
          const swipesData = await swipesRes.json();
          setSwipesLeft(swipesData.swipes_left);
        }
      } else {
        // No profile yet - show setup
        setShowProfileSetup(true);
      }
      
      const[r1,r2]=await Promise.all([
        fetch(`${API}/api/dating/discover`,{credentials:"include"}),
        fetch(`${API}/api/dating/matches`,{credentials:"include"}).catch(()=>({ok:false}))
      ]);
      const d1=await r1.json();
      setProfiles(d1.profiles||[]);
      if(r2.ok){const d2=await r2.json();setMatches(d2.matches||[]);}
    }catch{}
    setLoading(false);
  };

  const action = async(type)=>{
    const p=profiles[idx]; if(!p)return;
    
    // Check swipe limit (free users only)
    if (!isPremium && swipesLeft <= 0 && type !== "pass") {
      setShowPaywall(true);
      return;
    }
    
    setDir(type==="like"?"right":"left");
    try{
      if(type==="like"){
        const r=await fetch(`${API}/api/dating/like`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({profile_id:p.profile_id})});
        if(r.ok){
          const d=await r.json();
          if(d.match)setMatchPopup(true);
          if(!isPremium) setSwipesLeft(s => Math.max(0, s - 1));
        }
      }
      else{
        await fetch(`${API}/api/dating/pass`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({profile_id:p.profile_id})});
      }
    }catch{}
    setTimeout(()=>{setIdx(i=>i+1);setDir(null);},300);
  };

  const upgradeToPremium = () => {
    toast.success("Premium aktiviert! ∞ Swipes freigeschaltet");
    setIsPremium(true);
    setShowPaywall(false);
    setSwipesLeft(999);
  };

  const current = profiles[idx];

  return(
    <div className="min-h-screen pb-24" style={{background:"var(--bg-primary,#030303)"}}>
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:"var(--bg-card,#111)"}} data-testid="dat-back"><ArrowLeft size={20} style={{color:"var(--text-primary,#fff)"}}/></button>
        <h1 className="text-lg font-bold" style={{color:"var(--text-primary,#fff)"}}>Dating</h1>
        
        {/* Swipe Counter */}
        {!isPremium && tab === "discover" && (
          <div className="ml-2 px-3 py-1 rounded-full flex items-center gap-1.5" style={{background:"rgba(236,72,153,0.15)"}}>
            <Heart size={12} className="text-pink-400"/>
            <span className="text-xs font-bold text-pink-400">{swipesLeft}/{DAILY_FREE_SWIPES}</span>
          </div>
        )}
        
        {isPremium && (
          <div className="ml-2 px-3 py-1 rounded-full flex items-center gap-1" style={{background:"linear-gradient(135deg, #FFD700, #FFA500)"}}>
            <Crown size={12} className="text-black"/>
            <span className="text-xs font-bold text-black">Premium</span>
          </div>
        )}
        
        <div className="ml-auto flex gap-1 p-1 rounded-xl" style={{background:"var(--bg-card,#111)"}}>
          {[{id:"discover",label:"Entdecken"},{id:"matches",label:"Matches"}].map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{background:tab===t.id?"#EC4899":"transparent",color:tab===t.id?"#fff":"var(--text-secondary,#888)"}} data-testid={`dat-tab-${t.id}`}>{t.label}</button>))}
        </div>
        
        {/* Profile Edit Button */}
        <button onClick={()=>setShowProfileSetup(true)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{background:"var(--bg-card,#111)"}}>
          <Edit2 size={16} style={{color:"var(--text-primary,#fff)"}}/>
        </button>
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
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur" onClick={()=>setMatchPopup(false)}>
          <motion.div initial={{scale:0.5}} animate={{scale:1}} className="text-center p-8">
            <Sparkles size={64} className="mx-auto mb-4 text-pink-400"/>
            <h2 className="text-3xl font-bold text-white mb-2">It's a Match!</h2>
            <p className="text-white/70">Ihr mögt euch gegenseitig!</p>
            <button onClick={()=>setMatchPopup(false)} className="mt-6 px-6 py-3 rounded-xl font-semibold text-sm" style={{background:"#EC4899",color:"white"}} data-testid="dat-match-close">Nachricht senden</button>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
      
      {/* 💰 PAYWALL MODAL (Tinder/Bumble Style) */}
      <AnimatePresence>{showPaywall&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <motion.div initial={{scale:0.9,y:20}} animate={{scale:1,y:0}} exit={{scale:0.9,y:20}} className="w-full max-w-md rounded-3xl p-8 text-center" style={{background:"linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)",border:"2px solid rgba(236,72,153,0.3)"}}>
            <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{background:"linear-gradient(135deg, #FFD700, #FFA500)"}}>
              <Crown size={40} className="text-black"/>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Gratis-Swipes aufgebraucht!</h2>
            <p className="text-gray-400 text-sm mb-6">Du hast heute {DAILY_FREE_SWIPES} Swipes verwendet. Upgrade zu Premium für unbegrenzte Swipes!</p>
            
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 text-left">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:"rgba(16,185,129,0.2)"}}><Check size={16} className="text-green-400"/></div>
                <span className="text-sm text-white">∞ Unbegrenzte Swipes</span>
              </div>
              <div className="flex items-center gap-3 text-left">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:"rgba(59,130,246,0.2)"}}><Star size={16} className="text-blue-400"/></div>
                <span className="text-sm text-white">5 Super Likes pro Tag</span>
              </div>
              <div className="flex items-center gap-3 text-left">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:"rgba(236,72,153,0.2)"}}><Sparkles size={16} className="text-pink-400"/></div>
                <span className="text-sm text-white">Siehe wer dich geliked hat</span>
              </div>
            </div>
            
            <div className="space-y-3">
              <button onClick={upgradeToPremium} className="w-full py-4 rounded-2xl font-bold text-black" style={{background:"linear-gradient(135deg, #FFD700, #FFA500)"}}>
                <Crown size={18} className="inline mr-2"/>Premium für €9,99/Monat
              </button>
              <button onClick={()=>setShowPaywall(false)} className="w-full py-3 rounded-xl font-medium text-white" style={{background:"rgba(255,255,255,0.05)"}}>
                Morgen wiederkommen (kostenlos)
              </button>
            </div>
            
            <p className="text-xs text-gray-600 mt-4">
              Swipes werden um 00:00 Uhr zurückgesetzt
            </p>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
}
