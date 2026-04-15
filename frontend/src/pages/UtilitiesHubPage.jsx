import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Package, Music, ClipboardList, CreditCard, Briefcase, MessageSquare, Contact, Heart, ScanLine, Lock, Globe, Cloud, Loader2, Check, Star, Gift, Users, Play, X } from "lucide-react";
const API = process.env.REACT_APP_BACKEND_URL;

const SECTIONS = [
  { id: "boxes", label: "Abo-Boxen", icon: Package, color: "#F59E0B", desc: "Monatliche Ueberraschungsboxen" },
  { id: "music", label: "BlitzMusic", icon: Music, color: "#8B5CF6", desc: "Streaming & Podcasts" },
  { id: "surveys", label: "Umfragen", icon: ClipboardList, color: "#22C55E", desc: "Verdiene Geld mit Umfragen" },
  { id: "cards", label: "Karten-Vergleich", icon: CreditCard, color: "#0EA5E9", desc: "Beste Kreditkarten finden" },
  { id: "tasks", label: "Mikro-Aufgaben", icon: Briefcase, color: "#EF4444", desc: "Kleine Aufgaben, echtes Geld" },
  { id: "groups", label: "Gruppen-Chat", icon: MessageSquare, color: "#06B6D4", desc: "Channels & Communities" },
  { id: "vcard", label: "Visitenkarte", icon: Contact, color: "#EC4899", desc: "Digitale vCard mit QR" },
  { id: "wishlist", label: "Wunschliste", icon: Heart, color: "#F43F5E", desc: "Geburtstag & Geschenke" },
  { id: "scanner", label: "Doc Scanner", icon: ScanLine, color: "#F97316", desc: "Dokumente scannen" },
  { id: "passwords", label: "Passwort-Safe", icon: Lock, color: "#6366F1", desc: "Sichere Passwoerter" },
  { id: "vpn", label: "BlitzVPN", icon: Globe, color: "#10B981", desc: "Sicher surfen" },
  { id: "cloud", label: "Cloud-Speicher", icon: Cloud, color: "#3B82F6", desc: "5GB gratis, 50GB Premium" },
];

export default function UtilitiesHubPage({ onBack }) {
  const [active, setActive] = useState(null);
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const api = async (path, method = "GET", body = null) => {
    const opts = { method, credentials: "include", headers: body ? { "Content-Type": "application/json" } : {} };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(`${API}${path}`, opts);
    return r.json();
  };

  const loadSection = async (id) => {
    setActive(id);
    try {
      if (id === "boxes") { const d = await api("/api/abo-boxes/list"); setData({ boxes: d.boxes || [] }); }
      else if (id === "music") { const [p, pod] = await Promise.all([api("/api/music/playlists"), api("/api/music/podcasts")]); setData({ playlists: p.playlists || [], podcasts: pod.podcasts || [] }); }
      else if (id === "surveys") { const d = await api("/api/surveys/available"); setData({ surveys: d.surveys || [], earned: d.total_earned || 0 }); }
      else if (id === "cards") { const d = await api("/api/card-compare/cards"); setData({ cards: d.cards || [] }); }
      else if (id === "tasks") { const d = await api("/api/micro-tasks/available"); setData({ tasks: d.tasks || [], earned: d.total_earned || 0 }); }
      else if (id === "groups") { const d = await api("/api/utilities/groups"); setData({ groups: d.groups || [] }); }
      else if (id === "vcard") { const d = await api("/api/utilities/vcard/mine"); setData({ vcard: d.vcard }); }
      else if (id === "wishlist") { const d = await api("/api/utilities/wishlist/mine"); setData({ wishes: d.wishes || [] }); }
      else if (id === "scanner") { const d = await api("/api/utilities/scanner/mine"); setData({ scans: d.scans || [] }); }
      else if (id === "passwords") { const d = await api("/api/utilities/passwords/mine"); setData({ passwords: d.entries || [] }); }
      else if (id === "cloud") { const d = await api("/api/utilities/cloud/usage"); setData({ cloud: d }); }
      else setData({});
    } catch { setData({}); }
  };

  const action = async (path, body = null, successMsg = "") => {
    setLoading(true);
    try { const d = await api(path, "POST", body); setMsg(d.message || successMsg); if (active) loadSection(active); }
    catch { setMsg("Fehler"); }
    setLoading(false); setTimeout(() => setMsg(""), 4000);
  };

  // ─── HUB VIEW ───
  if (!active) return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="utilities-hub">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"><ArrowLeft size={18} /></button>
        <div><h1 className="text-base font-bold">Extras & Tools</h1><p className="text-[10px] text-cyan-400">12 Premium-Dienste</p></div>
      </div>
      <div className="px-4 pt-4 grid grid-cols-3 gap-3">
        {SECTIONS.map((s, i) => (
          <motion.button key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            onClick={() => loadSection(s.id)} className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-center hover:bg-white/[0.06] transition-all" data-testid={`hub-${s.id}`}>
            <div className="w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center" style={{ background: s.color + "20" }}>
              <s.icon size={20} style={{ color: s.color }} />
            </div>
            <p className="text-[11px] font-bold">{s.label}</p>
            <p className="text-[8px] text-gray-500 mt-0.5">{s.desc}</p>
          </motion.button>
        ))}
      </div>
    </div>
  );

  // ─── SECTION VIEW ───
  const sec = SECTIONS.find(s => s.id === active);
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid={`section-${active}`}>
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <button onClick={() => { setActive(null); setData({}); }} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"><ArrowLeft size={18} /></button>
        <div><h1 className="text-base font-bold flex items-center gap-2"><sec.icon size={18} style={{ color: sec.color }} /> {sec.label}</h1>
          <p className="text-[10px]" style={{ color: sec.color }}>{sec.desc}</p></div>
      </div>
      <div className="px-4 pt-4 space-y-3">

        {/* ABO BOXES */}
        {active === "boxes" && data.boxes?.map((b, i) => (
          <motion.div key={b.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: b.color + "20" }}><Package size={18} style={{ color: b.color }} /></div>
                <div><p className="text-sm font-bold">{b.name} {b.popular && <span className="text-[8px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded ml-1">Beliebt</span>}</p>
                  <p className="text-[10px] text-gray-500">{b.desc} · {b.items_count}</p></div>
              </div>
              <p className="text-sm font-bold" style={{ color: b.color }}>{b.price} EUR/Mo</p>
            </div>
            <button onClick={() => action("/api/abo-boxes/subscribe", { box_id: b.id })} disabled={loading}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-black" style={{ background: b.color }}
              data-testid={`sub-box-${b.id}`}>Abonnieren</button>
          </motion.div>
        ))}

        {/* MUSIC */}
        {active === "music" && (<>
          <button onClick={() => action("/api/music/subscribe", { plan: "premium" })} disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-violet-500 to-pink-500 rounded-2xl text-white font-bold text-sm" data-testid="music-sub">
            BlitzMusic Premium — 4.99 EUR/Mo</button>
          <p className="text-xs font-bold text-gray-500">Playlists</p>
          {data.playlists?.map((p, i) => (
            <div key={p.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: p.color + "20" }}><Music size={16} style={{ color: p.color }} /></div>
              <div className="flex-1"><p className="text-sm font-bold">{p.name}</p><p className="text-[10px] text-gray-500">{p.genre} · {p.tracks} Tracks · {p.duration}</p></div>
              <Play size={16} className="text-gray-400" />
            </div>
          ))}
          <p className="text-xs font-bold text-gray-500 mt-2">Podcasts</p>
          {data.podcasts?.map((p, i) => (
            <div key={p.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
              <div><p className="text-sm font-bold">{p.name} {p.premium && <span className="text-[8px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded ml-1">Premium</span>}</p>
                <p className="text-[10px] text-gray-500">{p.host} · {p.episodes} Folgen · {p.category}</p></div>
            </div>
          ))}
        </>)}

        {/* SURVEYS */}
        {active === "surveys" && (<>
          <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
            <p className="text-lg font-bold text-green-400">{data.earned || 0} EUR verdient</p></div>
          {data.surveys?.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
              <div className="flex justify-between mb-2"><p className="text-sm font-bold">{s.title}</p><p className="text-sm font-bold text-green-400">+{s.reward_eur} EUR</p></div>
              <p className="text-[10px] text-gray-500 mb-2">von {s.sponsor} · {s.questions} Fragen · ~{s.time_min} Min</p>
              <button onClick={() => action("/api/surveys/complete", { survey_id: s.id })} disabled={loading}
                className="w-full py-2.5 bg-green-500 text-black rounded-xl text-xs font-bold">Teilnehmen & verdienen</button>
            </motion.div>
          ))}
          {!data.surveys?.length && <p className="text-center text-gray-600 py-8">Alle Umfragen abgeschlossen!</p>}
        </>)}

        {/* CARD COMPARE */}
        {active === "cards" && data.cards?.map((c, i) => (
          <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-14 h-9 rounded-lg" style={{ background: c.color }} />
              <div className="flex-1"><p className="text-sm font-bold">{c.name}</p><p className="text-[10px] text-gray-500">{c.bank} · {c.cashback}% Cashback</p></div>
              <p className="text-sm font-bold">{c.fee === 0 ? "Gratis" : `${c.fee}/Mo`}</p>
            </div>
            <p className="text-[10px] text-green-400 mb-2">{c.bonus}</p>
            <button onClick={() => action(`/api/card-compare/apply/${c.id}`)} className="w-full py-2 bg-white/5 rounded-xl text-xs font-bold">Jetzt beantragen</button>
          </motion.div>
        ))}

        {/* MICRO TASKS */}
        {active === "tasks" && (<>
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
            <p className="text-lg font-bold text-red-400">{data.earned || 0} EUR verdient</p></div>
          {data.tasks?.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
              <div className="flex justify-between mb-1"><p className="text-sm font-bold">{t.title}</p><p className="text-sm font-bold text-green-400">+{t.reward} EUR</p></div>
              <p className="text-[10px] text-gray-500 mb-2">{t.desc} · ~{t.time_min} Min · {t.difficulty}</p>
              <button onClick={() => action("/api/micro-tasks/complete", { task_id: t.id })} disabled={loading}
                className="w-full py-2.5 bg-red-500 text-white rounded-xl text-xs font-bold">Aufgabe erledigen</button>
            </motion.div>
          ))}
          {!data.tasks?.length && <p className="text-center text-gray-600 py-8">Alle Aufgaben erledigt!</p>}
        </>)}

        {/* GROUPS */}
        {active === "groups" && (<>
          {data.groups?.map((g, i) => (
            <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
              <div><p className="text-sm font-bold">{g.name}</p><p className="text-[10px] text-gray-500">{g.members?.length || 0} Mitglieder{g.is_premium ? " · Premium" : ""}</p></div>
              <button className="px-3 py-1.5 bg-cyan-500/10 rounded-lg text-cyan-400 text-xs font-bold">Beitreten</button>
            </div>
          ))}
          <button onClick={() => action("/api/utilities/groups/create", { name: "Meine Gruppe", description: "Neue Gruppe" })}
            className="w-full py-3 bg-white/5 rounded-xl text-xs font-bold text-gray-400">+ Neue Gruppe erstellen</button>
        </>)}

        {/* VCARD, WISHLIST, SCANNER, PASSWORDS, VPN, CLOUD — simplified */}
        {active === "vcard" && (
          <div className="space-y-3">
            {data.vcard ? (
              <div className="p-5 rounded-2xl bg-gradient-to-br from-pink-900/20 to-purple-900/20 border border-pink-500/20">
                <p className="text-lg font-bold">{data.vcard.name}</p>
                <p className="text-xs text-gray-400">{data.vcard.title}</p>
                <div className="mt-3 space-y-1 text-[11px] text-gray-500">
                  {data.vcard.phone && <p>Tel: {data.vcard.phone}</p>}
                  {data.vcard.email && <p>Email: {data.vcard.email}</p>}
                  {data.vcard.website && <p>Web: {data.vcard.website}</p>}
                </div>
              </div>
            ) : (
              <button onClick={() => action("/api/utilities/vcard/create", { name: "Max Mustermann", title: "CEO", phone: "+49 123 456", email: "max@bidblitz.com" })}
                className="w-full py-4 bg-pink-500 text-white rounded-xl font-bold text-sm">Visitenkarte erstellen</button>
            )}
          </div>
        )}

        {active === "wishlist" && (
          <div className="space-y-3">
            {data.wishes?.map((w, i) => (
              <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex justify-between">
                <div><p className="text-sm font-bold">{w.title}</p><p className="text-[10px] text-gray-500">{w.list_name}{w.price ? ` · ${w.price} EUR` : ""}</p></div>
                {w.bought ? <Check size={16} className="text-green-400" /> : <Heart size={16} className="text-red-400" />}
              </div>
            ))}
            <button onClick={() => action("/api/utilities/wishlist/add", { title: "AirPods Pro 3", price: 279, list_name: "Geburtstag" })}
              className="w-full py-3 bg-white/5 rounded-xl text-xs text-gray-400">+ Wunsch hinzufuegen</button>
          </div>
        )}

        {active === "vpn" && (
          <div className="space-y-4 text-center py-6">
            <Globe size={48} className="mx-auto text-emerald-400" />
            <h2 className="text-lg font-bold">BlitzVPN</h2>
            <p className="text-sm text-gray-400">Sicher & anonym surfen</p>
            <button onClick={() => action("/api/utilities/vpn/connect")} className="px-8 py-4 bg-emerald-500 text-black rounded-xl font-bold mx-auto" data-testid="vpn-connect">Verbinden</button>
            <button onClick={() => action("/api/utilities/vpn/subscribe")} className="w-full py-3 bg-white/5 rounded-xl text-xs text-gray-400">Premium 4.99 EUR/Mo</button>
          </div>
        )}

        {active === "cloud" && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20">
              <div className="flex justify-between mb-2"><span className="text-xs text-gray-400">Verbrauch</span><span className="text-xs font-bold">{data.cloud?.used_mb || 0} / {data.cloud?.limit_mb || 5000} MB</span></div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${((data.cloud?.used_mb || 0) / (data.cloud?.limit_mb || 5000)) * 100}%` }} /></div>
            </div>
            <button onClick={() => action("/api/utilities/cloud/subscribe")} className="w-full py-3 bg-blue-500 text-white rounded-xl font-bold text-sm">Upgrade auf 50GB — 2.99 EUR/Mo</button>
          </div>
        )}

        {active === "scanner" && (
          <div className="space-y-3">
            {data.scans?.map((s, i) => (
              <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/5"><p className="text-sm">{s.name} · {s.pages} Seite(n)</p></div>
            ))}
            <button onClick={() => action("/api/utilities/scanner/save")} className="w-full py-4 bg-orange-500 text-black rounded-xl font-bold text-sm">Dokument scannen</button>
          </div>
        )}

        {active === "passwords" && (
          <div className="space-y-3">
            {data.passwords?.map((p, i) => (
              <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center gap-3">
                <Lock size={16} className="text-indigo-400" />
                <div><p className="text-sm font-bold">{p.site}</p><p className="text-[10px] text-gray-500">{p.username}</p></div>
              </div>
            ))}
            <button onClick={() => action("/api/utilities/passwords/save", { site: "example.com", username: "max@bidblitz.com", password: "test123" })}
              className="w-full py-3 bg-white/5 rounded-xl text-xs text-gray-400">+ Passwort speichern</button>
          </div>
        )}
      </div>
      {msg && <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-20 left-4 right-4 p-3 rounded-xl text-sm text-center z-50 font-medium" style={{ background: sec.color + "30", borderColor: sec.color + "50", color: sec.color, border: "1px solid" }}>{msg}</motion.div>}
    </div>
  );
}
