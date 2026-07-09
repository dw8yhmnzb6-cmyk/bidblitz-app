import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Heart, X, Star, MapPin, Sparkles, MessageCircle, Check, Crown, Edit2, SlidersHorizontal, Shield, Ban } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "../store/I18nContext";

const API = process.env.REACT_APP_BACKEND_URL;
const emptyProfile = {
  name: "",
  age: 18,
  city: "",
  bio: "",
  interests: [],
  gender: "unspecified",
  seeking: [],
  relationship_intent: "serious",
  photos: [""],
};

const chipOptions = ["Reisen", "Musik", "Kaffee", "Fitness", "Kunst", "Kochen", "Tech", "Bücher"];

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || `Request failed (${res.status})`);
  return data;
}

export default function DatingPage({ onBack }) {
  const { t } = useI18n();
  const [profiles, setProfiles] = useState([]);
  const [matches, setMatches] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [tab, setTab] = useState("discover");
  const [dir, setDir] = useState(null);
  const [swipesLeft, setSwipesLeft] = useState(20);
  const [isPremium, setIsPremium] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeMatch, setActiveMatch] = useState(null);
  const [chatText, setChatText] = useState("");
  const [showSafetySheet, setShowSafetySheet] = useState(null);
  const [reportReason, setReportReason] = useState("");
  const [matchPopup, setMatchPopup] = useState(false);
  const [profileForm, setProfileForm] = useState(emptyProfile);
  const [filters, setFilters] = useState({ age_min: 18, age_max: 99, city: "", seeking: [], relationship_intent: "" });

  const current = profiles[idx];
  const currentPhotos = current?.photos?.length ? current.photos : current?.avatar ? [current.avatar] : [];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, discoverRes, matchesRes, swipeRes] = await Promise.all([
        api("/api/dating/profile/me"),
        api("/api/dating/discover"),
        api("/api/dating/matches"),
        api("/api/dating/swipes-left"),
      ]);
      setUserProfile(profileRes.profile);
      setProfileForm({
        ...emptyProfile,
        ...profileRes.profile,
        photos: profileRes.profile?.photos?.length ? profileRes.profile.photos : [profileRes.profile?.avatar || ""],
      });
      setFilters(profileRes.filters || { age_min: 18, age_max: 99, city: "", seeking: [], relationship_intent: "" });
      setIsPremium(Boolean(profileRes.profile?.premium));
      setSwipesLeft(swipeRes.swipes_left || 0);
      setProfiles(discoverRes.profiles || []);
      setMatches(matchesRes.matches || []);
      setIdx(0);
      if (!profileRes.profile?.bio || !profileRes.profile?.photos?.[0]) setShowProfileSetup(true);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadMessages = useCallback(async (match) => {
    try {
      const data = await api(`/api/dating/matches/${match.match_id}/messages`);
      setMessages(data.messages || []);
      setActiveMatch(match);
      setTab("chat");
      setMatches((prev) => prev.map((item) => item.match_id === match.match_id ? { ...item, unread_count: 0 } : item));
    } catch (error) {
      toast.error(error.message);
    }
  }, []);

  const handleAction = async (type) => {
    const p = profiles[idx];
    if (!p) return;
    if (!isPremium && swipesLeft <= 0 && type !== "pass") {
      setShowPaywall(true);
      return;
    }
    setDir(type === "pass" ? "left" : "right");
    try {
      if (type === "pass") {
        await api("/api/dating/pass", { method: "POST", body: JSON.stringify({ profile_id: p.profile_id }) });
      } else {
        const res = await api("/api/dating/like", { method: "POST", body: JSON.stringify({ profile_id: p.profile_id, super_like: type === "superlike" }) });
        if (!isPremium) setSwipesLeft((value) => Math.max(0, value - 1));
        if (res.match) {
          setMatchPopup(true);
          await load();
        }
      }
    } catch (error) {
      if (String(error.message).includes("Swipe-Limit")) setShowPaywall(true);
      else toast.error(error.message);
    }
    setTimeout(() => {
      setProfiles((prev) => prev.filter((item) => item.profile_id !== p.profile_id));
      setDir(null);
    }, 280);
  };

  const saveProfile = async () => {
    try {
      const payload = { ...profileForm, interests: profileForm.interests.filter(Boolean), photos: profileForm.photos.filter(Boolean) };
      const data = await api("/api/dating/profile/me", { method: "PUT", body: JSON.stringify(payload) });
      setUserProfile(data.profile);
      setProfileForm({ ...emptyProfile, ...data.profile, photos: data.profile?.photos?.length ? data.profile.photos : [data.profile?.avatar || ""] });
      setShowProfileSetup(false);
      toast.success("Dating-Profil gespeichert");
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const saveFilters = async () => {
    try {
      await api("/api/dating/filters", { method: "POST", body: JSON.stringify(filters) });
      toast.success("Filter gespeichert");
      setShowFilters(false);
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const sendChat = async () => {
    if (!activeMatch || !chatText.trim()) return;
    try {
      const data = await api(`/api/dating/matches/${activeMatch.match_id}/messages`, { method: "POST", body: JSON.stringify({ text: chatText.trim() }) });
      setMessages((prev) => [...prev, data.message]);
      setChatText("");
      setMatches((prev) => prev.map((item) => item.match_id === activeMatch.match_id ? { ...item, last_message: data.message.text, last_message_at: data.message.created_at } : item));
    } catch (error) {
      toast.error(error.message);
    }
  };

  const runSafetyAction = async (action) => {
    if (!showSafetySheet) return;
    try {
      if (action === "block") {
        await api("/api/dating/block", { method: "POST", body: JSON.stringify({ profile_id: showSafetySheet.profile_id, reason: reportReason || "Blockiert" }) });
        toast.success("Profil blockiert");
      } else if (action === "report") {
        await api("/api/dating/report", { method: "POST", body: JSON.stringify({ profile_id: showSafetySheet.profile_id, reason: reportReason || "Unangemessenes Verhalten" }) });
        toast.success("Profil gemeldet");
      } else if (action === "unmatch" && showSafetySheet.match_id) {
        await api(`/api/dating/unmatch/${showSafetySheet.match_id}`, { method: "POST" });
        toast.success("Match entfernt");
      }
      setShowSafetySheet(null);
      setReportReason("");
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const photoSlots = useMemo(() => {
    const slots = [...(profileForm.photos || [])];
    while (slots.length < 3) slots.push("");
    return slots.slice(0, 3);
  }, [profileForm.photos]);

  return (
    <div className="min-h-screen pb-24 bg-[#05060A] text-white" data-testid="dating-page">
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5" data-testid="dating-back-button"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-bold">Dating</h1>
        {!isPremium && tab === "discover" && <div className="ml-2 px-3 py-1 rounded-full flex items-center gap-1.5 bg-pink-500/15"><Heart size={12} className="text-pink-400" /><span className="text-xs font-bold text-pink-300">{swipesLeft}/20</span></div>}
        {isPremium && <div className="ml-2 px-3 py-1 rounded-full flex items-center gap-1 bg-gradient-to-r from-yellow-300 to-orange-400 text-black"><Crown size={12} /><span className="text-xs font-bold">Premium</span></div>}
        <div className="ml-auto flex gap-1 p-1 rounded-xl bg-white/5">
          {[
            { id: "discover", label: "Entdecken" },
            { id: "matches", label: "Matches" },
          ].map((item) => (
            <button key={item.id} onClick={() => setTab(item.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tab === item.id ? "bg-pink-500 text-white" : "text-white/60"}`} data-testid={`dating-tab-${item.id}`}>{item.label}</button>
          ))}
        </div>
        <button onClick={() => setShowFilters(true)} className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5" data-testid="dating-open-filters"><SlidersHorizontal size={16} /></button>
        <button onClick={() => setShowProfileSetup(true)} className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5" data-testid="dating-open-profile-edit"><Edit2 size={16} /></button>
      </div>

      {tab === "discover" && (
        <div className="px-4 flex flex-col items-center">
          {loading ? <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" /></div> : !current ? (
            <div className="text-center py-20"><Heart size={48} className="mx-auto mb-3 text-white/20" /><p className="text-sm text-white/60">Keine Profile mehr. Filter ändern oder später wiederkommen.</p></div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={current.profile_id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1, x: dir === "right" ? 260 : dir === "left" ? -260 : 0, rotate: dir === "right" ? 12 : dir === "left" ? -12 : 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="w-full max-w-sm rounded-3xl overflow-hidden bg-white/5 border border-white/10" data-testid={`dating-profile-${current.profile_id}`}>
                <div className="relative">
                  <img src={currentPhotos[0]} alt={current.name} className="w-full h-80 object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="flex items-center gap-2"><h2 className="text-xl font-bold text-white">{current.name}{current.age ? `, ${current.age}` : ""}</h2>{current.verified && <Check size={16} className="text-blue-400" />}</div>
                    <div className="flex items-center gap-1 text-white/70 text-sm mt-1"><MapPin size={14} />{current.city || "Unbekannt"}</div>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-sm mb-3 text-white/80">{current.bio || "Noch keine Bio"}</p>
                  <div className="flex flex-wrap gap-2">{(current.interests || []).map((interest) => <span key={interest} className="px-3 py-1 rounded-full text-xs bg-pink-500/15 text-pink-300">{interest}</span>)}</div>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
          {current && (
            <div className="flex items-center gap-6 mt-6">
              <button onClick={() => handleAction("pass")} className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg bg-white/5 border-2 border-red-400" data-testid="dating-pass-button"><X size={28} className="text-red-400" /></button>
              <button onClick={() => handleAction("superlike")} className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-white/5 border-2 border-blue-400" data-testid="dating-superlike-button"><Star size={22} className="text-blue-400" /></button>
              <button onClick={() => handleAction("like")} className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg bg-white/5 border-2 border-green-400" data-testid="dating-like-button"><Heart size={28} className="text-green-400" /></button>
            </div>
          )}
        </div>
      )}

      {tab === "matches" && (
        <div className="px-4 space-y-3" data-testid="dating-matches-list">
          {matches.length === 0 ? <div className="text-center py-20"><Sparkles size={48} className="mx-auto mb-3 text-white/20" /><p className="text-sm text-white/60">Noch keine Matches</p></div> : matches.map((match) => (
            <motion.div key={match.match_id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl p-4 flex items-center gap-3 bg-white/5 border border-pink-500/20" data-testid={`dating-match-${match.match_id}`}>
              <img src={match.avatar} alt={match.name} className="w-14 h-14 rounded-full object-cover" />
              <button className="flex-1 text-left" onClick={() => loadMessages(match)} data-testid={`dating-open-chat-${match.match_id}`}>
                <h3 className="text-sm font-semibold text-white">{match.name}</h3>
                <p className="text-xs text-white/60 truncate">{match.last_message || match.city}</p>
              </button>
              {match.unread_count > 0 && <span className="min-w-6 h-6 px-2 rounded-full bg-pink-500 text-white text-xs font-bold flex items-center justify-center" data-testid={`dating-unread-${match.match_id}`}>{match.unread_count}</span>}
              <button onClick={() => loadMessages(match)} className="w-10 h-10 rounded-full flex items-center justify-center bg-pink-500/15" data-testid={`dating-message-button-${match.match_id}`}><MessageCircle size={18} className="text-pink-300" /></button>
              <button onClick={() => setShowSafetySheet({ profile_id: match.profile_id, match_id: match.match_id, name: match.name })} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5" data-testid={`dating-safety-button-${match.match_id}`}><Shield size={16} className="text-white/70" /></button>
            </motion.div>
          ))}
        </div>
      )}

      {tab === "chat" && activeMatch && (
        <div className="px-4 pb-4" data-testid="dating-chat-panel">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setTab("matches")} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center" data-testid="dating-chat-back"><ArrowLeft size={18} /></button>
            <img src={activeMatch.avatar} alt={activeMatch.name} className="w-11 h-11 rounded-full object-cover" />
            <div className="flex-1"><h3 className="font-semibold text-white">{activeMatch.name}</h3><p className="text-xs text-white/55">{activeMatch.city}</p></div>
            <button onClick={() => setShowSafetySheet({ profile_id: activeMatch.profile_id, match_id: activeMatch.match_id, name: activeMatch.name })} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center" data-testid="dating-chat-safety"><Ban size={16} className="text-white/75" /></button>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-3 space-y-3 min-h-[52vh] max-h-[52vh] overflow-y-auto" data-testid="dating-chat-messages">
            {messages.length === 0 ? <p className="text-sm text-white/55 text-center py-10">Schreib die erste Nachricht.</p> : messages.map((message) => (
              <div key={message.message_id} className={`flex ${message.sender_user_id === userProfile?.user_id ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm ${message.sender_user_id === userProfile?.user_id ? "bg-pink-500 text-white" : "bg-white/10 text-white"}`}>{message.text}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input value={chatText} onChange={(event) => setChatText(event.target.value)} placeholder="Nachricht schreiben..." className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none" data-testid="dating-chat-input" />
            <button onClick={sendChat} className="px-4 py-3 rounded-2xl bg-pink-500 text-white font-semibold" data-testid="dating-chat-send">Senden</button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {matchPopup && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur" onClick={() => setMatchPopup(false)}><motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="text-center p-8"><Sparkles size={64} className="mx-auto mb-4 text-pink-400" /><h2 className="text-3xl font-bold text-white mb-2">It&apos;s a Match!</h2><p className="text-white/70">Ihr mögt euch gegenseitig.</p><button onClick={() => { setMatchPopup(false); setTab("matches"); }} className="mt-6 px-6 py-3 rounded-xl font-semibold text-sm bg-pink-500 text-white" data-testid="dating-match-close">Zum Match</button></motion.div></motion.div>}
      </AnimatePresence>

      <AnimatePresence>
        {showPaywall && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"><motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="w-full max-w-md rounded-3xl p-8 text-center bg-[#0F1016] border border-pink-500/30"><div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center bg-gradient-to-r from-yellow-300 to-orange-400"><Crown size={40} className="text-black" /></div><h2 className="text-2xl font-bold text-white mb-3">Gratis-Swipes aufgebraucht</h2><p className="text-gray-400 text-sm mb-6">Upgrade zu Premium für unbegrenzte Swipes, Likes You und Super Likes.</p><button onClick={() => { setIsPremium(true); setShowPaywall(false); setSwipesLeft(999999); toast.success("Premium-Demo aktiviert"); }} className="w-full py-4 rounded-2xl font-bold text-black bg-gradient-to-r from-yellow-300 to-orange-400" data-testid="dating-upgrade-premium">Premium aktivieren</button><button onClick={() => setShowPaywall(false)} className="w-full py-3 rounded-xl font-medium text-white mt-3 bg-white/5">Abbrechen</button></motion.div></motion.div>}
      </AnimatePresence>

      <AnimatePresence>
        {showProfileSetup && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm overflow-y-auto"><div className="min-h-screen flex items-start justify-center px-4 py-6"><div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0C0E14] p-5" data-testid="dating-profile-editor"><div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold text-white">Dating-Profil</h2><button onClick={() => setShowProfileSetup(false)} className="text-white/60">{t("common.close")}</button></div><div className="space-y-4"><input value={profileForm.name} onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))} placeholder="Name" className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm" data-testid="dating-profile-name-input" /><div className="grid grid-cols-2 gap-3"><input type="number" min="18" max="99" value={profileForm.age ?? ""} onChange={(e) => setProfileForm((p) => ({ ...p, age: Number(e.target.value || 18) }))} placeholder="Alter" className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm" data-testid="dating-profile-age-input" /><input value={profileForm.city} onChange={(e) => setProfileForm((p) => ({ ...p, city: e.target.value }))} placeholder="Stadt" className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm" data-testid="dating-profile-city-input" /></div><textarea value={profileForm.bio} onChange={(e) => setProfileForm((p) => ({ ...p, bio: e.target.value }))} placeholder="Beschreibe dich" rows={4} className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm" data-testid="dating-profile-bio-input" /><div><p className="text-xs uppercase tracking-[0.18em] text-white/45 mb-2">Fotos</p><div className="grid grid-cols-1 gap-2">{photoSlots.map((photo, index) => <input key={index} value={photo} onChange={(e) => setProfileForm((p) => { const next = [...photoSlots]; next[index] = e.target.value; return { ...p, photos: next }; })} placeholder={`Foto URL ${index + 1}`} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm" data-testid={`dating-profile-photo-${index}`} />)}</div></div><div><p className="text-xs uppercase tracking-[0.18em] text-white/45 mb-2">Interessen</p><div className="flex flex-wrap gap-2">{chipOptions.map((chip) => { const active = profileForm.interests.includes(chip); return <button key={chip} type="button" onClick={() => setProfileForm((p) => ({ ...p, interests: active ? p.interests.filter((item) => item !== chip) : [...p.interests, chip] }))} className={`px-3 py-2 rounded-full text-xs border ${active ? "border-pink-400 bg-pink-500/20 text-pink-300" : "border-white/10 bg-white/5 text-white/70"}`} data-testid={`dating-interest-${chip}`}>{chip}</button>; })}</div></div><div className="grid grid-cols-2 gap-3"><select value={profileForm.gender} onChange={(e) => setProfileForm((p) => ({ ...p, gender: e.target.value }))} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm" data-testid="dating-profile-gender-select"><option value="unspecified">Geschlecht</option><option value="man">Mann</option><option value="woman">Frau</option><option value="nonbinary">Non-binary</option></select><select value={profileForm.relationship_intent} onChange={(e) => setProfileForm((p) => ({ ...p, relationship_intent: e.target.value }))} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm" data-testid="dating-profile-intent-select"><option value="serious">Beziehung</option><option value="casual">Locker</option><option value="friends">Freunde</option><option value="open">Offen</option></select></div><div><p className="text-xs uppercase tracking-[0.18em] text-white/45 mb-2">Suche</p><div className="flex flex-wrap gap-2">{[{ key: "women", label: "Frauen" }, { key: "men", label: "Männer" }, { key: "nonbinary", label: "Non-binary" }].map((item) => { const active = profileForm.seeking.includes(item.key); return <button key={item.key} type="button" onClick={() => setProfileForm((p) => ({ ...p, seeking: active ? p.seeking.filter((entry) => entry !== item.key) : [...p.seeking, item.key] }))} className={`px-3 py-2 rounded-full text-xs border ${active ? "border-blue-400 bg-blue-500/20 text-blue-300" : "border-white/10 bg-white/5 text-white/70"}`} data-testid={`dating-seeking-${item.key}`}>{item.label}</button>; })}</div></div><button onClick={saveProfile} className="w-full py-4 rounded-2xl font-bold bg-pink-500 text-white" data-testid="dating-profile-save-button">{t("common.save")}</button></div></div></div></motion.div>}
      </AnimatePresence>

      <AnimatePresence>
        {showFilters && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm overflow-y-auto"><div className="min-h-screen flex items-start justify-center px-4 py-6"><div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0C0E14] p-5" data-testid="dating-filters-sheet"><div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold text-white">Dating-Filter</h2><button onClick={() => setShowFilters(false)} className="text-white/60">{t("common.close")}</button></div><div className="grid grid-cols-2 gap-3"><input type="number" min="18" max="99" value={filters.age_min} onChange={(e) => setFilters((f) => ({ ...f, age_min: Number(e.target.value || 18) }))} placeholder="Alter min" className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm" data-testid="dating-filter-age-min" /><input type="number" min="18" max="99" value={filters.age_max} onChange={(e) => setFilters((f) => ({ ...f, age_max: Number(e.target.value || 99) }))} placeholder="Alter max" className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm" data-testid="dating-filter-age-max" /></div><input value={filters.city} onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))} placeholder="Stadt" className="mt-3 w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm" data-testid="dating-filter-city" /><select value={filters.relationship_intent || ""} onChange={(e) => setFilters((f) => ({ ...f, relationship_intent: e.target.value }))} className="mt-3 w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm" data-testid="dating-filter-intent"><option value="">Alle Absichten</option><option value="serious">Beziehung</option><option value="casual">Locker</option><option value="friends">Freunde</option><option value="open">Offen</option></select><div className="mt-3"><p className="text-xs uppercase tracking-[0.18em] text-white/45 mb-2">Suche</p><div className="flex flex-wrap gap-2">{[{ key: "women", label: "Frauen" }, { key: "men", label: "Männer" }, { key: "nonbinary", label: "Non-binary" }].map((item) => { const active = (filters.seeking || []).includes(item.key); return <button key={item.key} type="button" onClick={() => setFilters((f) => ({ ...f, seeking: active ? f.seeking.filter((entry) => entry !== item.key) : [...(f.seeking || []), item.key] }))} className={`px-3 py-2 rounded-full text-xs border ${active ? "border-blue-400 bg-blue-500/20 text-blue-300" : "border-white/10 bg-white/5 text-white/70"}`} data-testid={`dating-filter-seeking-${item.key}`}>{item.label}</button>; })}</div></div><button onClick={saveFilters} className="w-full mt-4 py-4 rounded-2xl font-bold bg-pink-500 text-white" data-testid="dating-filter-save-button">Filter anwenden</button></div></div></motion.div>}
      </AnimatePresence>

      <AnimatePresence>
        {showSafetySheet && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-end"><div className="w-full rounded-t-3xl border border-white/10 bg-[#0C0E14] p-5" data-testid="dating-safety-sheet"><div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-white">Sicherheit · {showSafetySheet.name}</h2><button onClick={() => setShowSafetySheet(null)} className="text-white/60">{t("common.close")}</button></div><textarea value={reportReason} onChange={(e) => setReportReason(e.target.value)} placeholder="Grund angeben" rows={3} className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm" data-testid="dating-safety-reason" /><div className="grid grid-cols-1 gap-3 mt-4"><button onClick={() => runSafetyAction("report")} className="py-3 rounded-2xl bg-amber-500/15 text-amber-300 font-semibold" data-testid="dating-report-button">Profil melden</button><button onClick={() => runSafetyAction("block")} className="py-3 rounded-2xl bg-red-500/15 text-red-300 font-semibold" data-testid="dating-block-button">Profil blockieren</button>{showSafetySheet.match_id && <button onClick={() => runSafetyAction("unmatch")} className="py-3 rounded-2xl bg-white/5 text-white font-semibold" data-testid="dating-unmatch-button">Match auflösen</button>}</div></div></motion.div>}
      </AnimatePresence>
    </div>
  );
}