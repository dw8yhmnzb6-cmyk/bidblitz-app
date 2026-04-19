/**
 * ClassifiedsPage - Kleinanzeigen-Marktplatz
 * Backend: /api/classifieds/*
 */
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Plus, Search, MapPin, Eye, MessageCircle, TrendingUp, Trash2, X, Camera, Check } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

export default function ClassifiedsPage({ onBack, onNavigate }) {
  const [view, setView] = useState("browse"); // browse | mine | create | detail
  const [items, setItems] = useState([]);
  const [myItems, setMyItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [boostTiers, setBoostTiers] = useState({});
  const [selectedCat, setSelectedCat] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [contactMsg, setContactMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", category: "elektronik", price: "", is_free: false,
    city: "", plz: "", condition: "gut", image_urls: [],
  });

  // Load categories once
  useEffect(() => {
    fetch(`${API}/api/classifieds/categories`).then(r => r.json()).then(d => {
      setCats(d.categories || []);
      setBoostTiers(d.boost_tiers || {});
    });
  }, []);

  const loadBrowse = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCat) params.set("category", selectedCat);
      if (search) params.set("search", search);
      const r = await fetch(`${API}/api/classifieds/list?${params}`);
      const j = await r.json();
      setItems(j.items || []);
    } catch { toast.error("Fehler beim Laden"); }
    setLoading(false);
  }, [selectedCat, search]);

  const loadMine = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/classifieds/me/list`, { credentials: "include" });
      const j = await r.json();
      setMyItems(j.items || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (view === "browse") loadBrowse();
    if (view === "mine") loadMine();
  }, [view, loadBrowse, loadMine]);

  const create = async () => {
    if (!form.title || !form.description || !form.city) return toast.error("Bitte alle Felder ausfüllen");
    try {
      const r = await fetch(`${API}/api/classifieds/create`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          price: form.is_free ? 0 : parseFloat(form.price || 0),
          image_urls: form.image_urls.filter(Boolean),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || "Fehler");
      toast.success("Anzeige erstellt! 🎉");
      setForm({ title: "", description: "", category: "elektronik", price: "", is_free: false, city: "", plz: "", condition: "gut", image_urls: [] });
      setView("mine");
    } catch (e) { toast.error(e.message); }
  };

  const openDetail = async (cid) => {
    try {
      const r = await fetch(`${API}/api/classifieds/${cid}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || "Fehler");
      setSelected(j);
      setView("detail");
    } catch (e) { toast.error(e.message); }
  };

  const contact = async () => {
    if (contactMsg.length < 5) return toast.error("Nachricht zu kurz");
    setSending(true);
    try {
      const r = await fetch(`${API}/api/classifieds/${selected.classified_id}/contact`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: contactMsg }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || "Fehler");
      toast.success("Nachricht gesendet 📨");
      setContactMsg("");
    } catch (e) { toast.error(e.message); }
    setSending(false);
  };

  const boost = async (cid, tier) => {
    if (!window.confirm(`${boostTiers[tier]?.label} für €${boostTiers[tier]?.eur} buchen?`)) return;
    try {
      const r = await fetch(`${API}/api/classifieds/${cid}/boost`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || "Fehler");
      toast.success("Boost aktiviert! 🚀");
      loadMine();
    } catch (e) { toast.error(e.message); }
  };

  const del = async (cid) => {
    if (!window.confirm("Anzeige löschen?")) return;
    try {
      await fetch(`${API}/api/classifieds/${cid}`, { method: "DELETE", credentials: "include" });
      toast.success("Gelöscht");
      loadMine();
    } catch {}
  };

  // Detail view
  if (view === "detail" && selected) {
    return (
      <div className="min-h-screen bg-[#060810] pb-24">
        <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#060810]/90 border-b border-white/[0.06]">
          <div className="flex items-center justify-between px-4 py-3 pt-[max(env(safe-area-inset-top,0px),14px)]">
            <button onClick={() => { setSelected(null); setView("browse"); }} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
              <ArrowLeft size={15} className="text-white/70"/>
            </button>
            <h1 className="text-[14px] font-bold text-white truncate px-2">{selected.title}</h1>
            <div className="w-9"/>
          </div>
        </div>
        <div className="p-4 space-y-3">
          {selected.image_urls?.length > 0 && (
            <div className="rounded-2xl overflow-hidden bg-black/30 aspect-[4/3]">
              <img src={selected.image_urls[0]} alt="" className="w-full h-full object-cover"/>
            </div>
          )}
          <div className="rounded-2xl p-4 bg-white/5 border border-white/10">
            <div className="flex items-start justify-between">
              <h2 className="text-[18px] font-black text-white flex-1">{selected.title}</h2>
              <p className="text-[20px] font-black tabular-nums ml-2" style={{ color: selected.is_free ? "#00D26A" : "#00C2FF" }}>
                {selected.is_free ? "Gratis" : `€${selected.price}`}
              </p>
            </div>
            <p className="text-[11px] text-white/50 mt-1"><MapPin size={10} className="inline"/> {selected.city} {selected.plz && `· ${selected.plz}`}</p>
            <div className="flex gap-3 mt-2 text-[10px] text-white/40">
              <span><Eye size={10} className="inline"/> {selected.views || 0}</span>
              <span><MessageCircle size={10} className="inline"/> {selected.contact_count || 0}</span>
              {selected.condition && <span className="px-1.5 rounded bg-white/5 uppercase">{selected.condition}</span>}
            </div>
          </div>
          <div className="rounded-2xl p-4 bg-white/5 border border-white/10">
            <p className="text-[13px] text-white whitespace-pre-wrap">{selected.description}</p>
          </div>
          <div className="rounded-2xl p-4 bg-white/5 border border-white/10">
            <p className="text-[10px] text-white/50 uppercase mb-1">Anbieter</p>
            <p className="text-[13px] font-bold text-white">{selected.seller_name || "Anonym"}</p>
          </div>
          {/* Contact */}
          <div className="rounded-2xl p-4 bg-white/5 border border-white/10">
            <p className="text-[10px] text-white/50 uppercase mb-2">Nachricht senden</p>
            <textarea
              data-testid="contact-msg"
              value={contactMsg}
              onChange={e => setContactMsg(e.target.value)}
              placeholder="Hallo, ist das noch verfügbar?"
              rows={3}
              className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-[13px] text-white placeholder-white/30 focus:outline-none focus:border-[#00C2FF]"
            />
            <button onClick={contact} disabled={sending || contactMsg.length < 5}
              className="w-full mt-2 py-3 rounded-xl bg-[#00C2FF] text-black font-bold text-[13px] disabled:opacity-50"
              data-testid="contact-send">
              {sending ? <Loader2 size={13} className="animate-spin inline"/> : "Senden"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Create view
  if (view === "create") {
    return (
      <div className="min-h-screen bg-[#060810] pb-24">
        <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#060810]/90 border-b border-white/[0.06]">
          <div className="flex items-center justify-between px-4 py-3 pt-[max(env(safe-area-inset-top,0px),14px)]">
            <button onClick={() => setView("mine")} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
              <ArrowLeft size={15} className="text-white/70"/>
            </button>
            <h1 className="text-[14px] font-bold text-white">Anzeige erstellen</h1>
            <div className="w-9"/>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <input data-testid="c-title" placeholder="Titel" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-[14px] focus:outline-none focus:border-[#00C2FF]"/>
          <select data-testid="c-cat" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
            className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-[14px]">
            {cats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
          </select>
          <textarea data-testid="c-desc" placeholder="Beschreibung (mind. 10 Zeichen)" value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })} rows={5}
            className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-[13px] focus:outline-none focus:border-[#00C2FF]"/>
          <div className="grid grid-cols-2 gap-2">
            <input data-testid="c-city" placeholder="Stadt" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
              className="px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-[13px]"/>
            <input data-testid="c-plz" placeholder="PLZ" value={form.plz} onChange={e => setForm({ ...form, plz: e.target.value })}
              className="px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-[13px]"/>
          </div>
          <div className="flex items-center gap-2">
            <input data-testid="c-price" type="number" placeholder="Preis €" disabled={form.is_free}
              value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
              className="flex-1 px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-[14px] disabled:opacity-40"/>
            <label className="flex items-center gap-2 px-3 py-3 bg-white/5 border border-white/10 rounded-xl cursor-pointer">
              <input data-testid="c-free" type="checkbox" checked={form.is_free} onChange={e => setForm({ ...form, is_free: e.target.checked })}/>
              <span className="text-white text-[12px]">Gratis</span>
            </label>
          </div>
          <select data-testid="c-cond" value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })}
            className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-[14px]">
            {[["neu","Neu"],["wie_neu","Wie neu"],["gut","Guter Zustand"],["gebraucht","Gebraucht"],["defekt","Defekt"]].map(([v,l]) =>
              <option key={v} value={v}>{l}</option>)}
          </select>
          <input data-testid="c-img" placeholder="Bild-URL (optional)" value={form.image_urls[0] || ""}
            onChange={e => setForm({ ...form, image_urls: [e.target.value] })}
            className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-[13px]"/>
          <button data-testid="c-submit" onClick={create} className="w-full py-4 rounded-2xl bg-[#00C2FF] text-black font-black text-[14px]">
            <Check size={14} className="inline mr-1"/> Veröffentlichen
          </button>
        </div>
      </div>
    );
  }

  // Main view (browse / mine)
  return (
    <div data-testid="classifieds-page" className="min-h-screen bg-[#060810] pb-24">
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#060810]/90 border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-4 py-3 pt-[max(env(safe-area-inset-top,0px),14px)]">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
            <ArrowLeft size={15} className="text-white/70"/>
          </button>
          <h1 className="text-[14px] font-bold text-white">Kleinanzeigen</h1>
          <button onClick={() => setView("create")} className="w-9 h-9 rounded-xl bg-[#00C2FF] flex items-center justify-center" data-testid="classifieds-new">
            <Plus size={16} className="text-black"/>
          </button>
        </div>
        <div className="flex gap-1 px-3 pb-2">
          <button onClick={() => setView("browse")} data-testid="tab-browse"
            className="flex-1 py-2 rounded-xl text-[11px] font-bold"
            style={{ background: view === "browse" ? "rgba(0,194,255,0.15)" : "transparent", color: view === "browse" ? "#00C2FF" : "rgba(255,255,255,0.5)", border: view === "browse" ? "1px solid rgba(0,194,255,0.3)" : "1px solid transparent" }}>
            Entdecken
          </button>
          <button onClick={() => setView("mine")} data-testid="tab-mine"
            className="flex-1 py-2 rounded-xl text-[11px] font-bold"
            style={{ background: view === "mine" ? "rgba(168,85,247,0.15)" : "transparent", color: view === "mine" ? "#A855F7" : "rgba(255,255,255,0.5)", border: view === "mine" ? "1px solid rgba(168,85,247,0.3)" : "1px solid transparent" }}>
            Meine Anzeigen
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {view === "browse" && (
          <>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3">
              <Search size={14} className="text-white/40"/>
              <input data-testid="search" placeholder="Suche..." value={search}
                onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && loadBrowse()}
                className="flex-1 py-2.5 bg-transparent text-white text-[13px] focus:outline-none"/>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <button onClick={() => setSelectedCat("")} data-testid="cat-all"
                className="px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap"
                style={{ background: !selectedCat ? "rgba(0,194,255,0.2)" : "rgba(255,255,255,0.04)", color: !selectedCat ? "#00C2FF" : "white" }}>
                Alle
              </button>
              {cats.map(c => (
                <button key={c.id} onClick={() => setSelectedCat(c.id)} data-testid={`cat-${c.id}`}
                  className="px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap"
                  style={{ background: selectedCat === c.id ? "rgba(0,194,255,0.2)" : "rgba(255,255,255,0.04)", color: selectedCat === c.id ? "#00C2FF" : "rgba(255,255,255,0.7)" }}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          </>
        )}

        {loading ? <Loader2 className="animate-spin text-white/40 mx-auto my-8"/> :
         (view === "browse" ? items : myItems).length === 0 ? (
          <div className="text-center py-12">
            <p className="text-white/40 text-[13px]">{view === "mine" ? "Du hast noch keine Anzeigen" : "Keine Anzeigen gefunden"}</p>
            {view === "mine" && (
              <button onClick={() => setView("create")} className="mt-4 px-5 py-2.5 rounded-xl bg-[#00C2FF] text-black font-bold text-[12px]">
                Erste Anzeige erstellen
              </button>
            )}
          </div>
         ) : (
          <div className="grid grid-cols-2 gap-2">
            {(view === "browse" ? items : myItems).map(item => (
              <motion.div key={item.classified_id}
                onClick={() => openDetail(item.classified_id)}
                className="rounded-xl overflow-hidden bg-white/5 border border-white/10 cursor-pointer relative"
                style={item.is_boosted ? { border: "1px solid rgba(255,184,0,0.5)", boxShadow: "0 0 10px rgba(255,184,0,0.2)" } : {}}
                whileTap={{ scale: 0.98 }}
                data-testid={`ad-${item.classified_id}`}>
                {item.is_boosted && (
                  <div className="absolute top-1 left-1 z-10 px-1.5 py-0.5 rounded bg-[#FFB800] text-[8px] font-black text-black uppercase">
                    <TrendingUp size={8} className="inline"/> Top
                  </div>
                )}
                <div className="aspect-square bg-black/30">
                  {item.image_urls?.[0] ? (
                    <img src={item.image_urls[0]} alt="" className="w-full h-full object-cover"/>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl text-white/10">
                      {cats.find(c => c.id === item.category)?.icon || "📦"}
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-[11px] font-bold text-white truncate">{item.title}</p>
                  <p className="text-[13px] font-black tabular-nums mt-0.5" style={{ color: item.is_free ? "#00D26A" : "#00C2FF" }}>
                    {item.is_free ? "Gratis" : `€${item.price}`}
                  </p>
                  <p className="text-[9px] text-white/40 truncate mt-0.5">
                    <MapPin size={8} className="inline"/> {item.city}
                  </p>
                </div>
                {view === "mine" && (
                  <div className="flex border-t border-white/10">
                    {!item.is_boosted && (
                      <button onClick={e => { e.stopPropagation(); boost(item.classified_id, "top_7d"); }}
                        className="flex-1 py-1.5 text-[9px] font-bold text-[#FFB800] hover:bg-[#FFB800]/10"
                        data-testid={`boost-${item.classified_id}`}>
                        🚀 Boost €{boostTiers.top_7d?.eur}
                      </button>
                    )}
                    <button onClick={e => { e.stopPropagation(); del(item.classified_id); }}
                      className="px-2 py-1.5 text-[9px] text-red-400 hover:bg-red-400/10"
                      data-testid={`del-${item.classified_id}`}>
                      <Trash2 size={10}/>
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
         )
        }
      </div>
    </div>
  );
}
