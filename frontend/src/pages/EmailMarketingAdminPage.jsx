/**
 * BidBlitz V2 - Email Marketing Admin
 * Kampagnen erstellen, senden, Verlauf, Templates, Statistiken
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Mail, Send, Users, Target, Eye, CheckCircle,
  AlertCircle, Clock, BarChart3, Plus, FileText, Zap, X, ChevronDown
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const TARGETS = [
  { id: "all", label: "Alle Nutzer", icon: Users, desc: "Gesamte Nutzerbasis" },
  { id: "active", label: "Aktive Nutzer", icon: Zap, desc: "Nutzer mit Guthaben > 0€" },
  { id: "merchants", label: "Händler", icon: Target, desc: "Alle Händler-Konten" },
  { id: "premium", label: "Premium & VIP", icon: BarChart3, desc: "Premium- und VIP-Nutzer" },
];

const QUICK_TEMPLATES = [
  { name: "Willkommen", subject: "Willkommen bei BidBlitz!", text: "Vielen Dank für Ihre Registrierung! Entdecken Sie jetzt alle Features der BidBlitz Super App — von Zahlungen über Auktionen bis hin zu Mobilität und mehr." },
  { name: "Flash Sale", subject: "Flash Sale: 50% auf Auktions-Credits!", text: "Nur heute: Sichern Sie sich Auktions-Credits zum halben Preis. Bieten Sie mit und gewinnen Sie Top-Produkte. Aktion endet um Mitternacht!" },
  { name: "Neues Feature", subject: "Neu: Scooter-Abos jetzt verfügbar!", text: "Ab sofort können Sie Wochen-, Monats- oder Jahres-Abos für unsere E-Scooter buchen. Keine Entsperrgebühr, tägliche Freiminuten und günstigere Minutenpreise." },
  { name: "Cashback", subject: "5% Extra-Cashback dieses Wochenende!", text: "Dieses Wochenende erhalten Sie 5% Extra-Cashback auf alle Zahlungen, Buchungen und Einkäufe in der BidBlitz App. Gilt für Hotels, Restaurants, Flüge und mehr!" },
  { name: "Empfehlung", subject: "Freunde einladen & €10 verdienen", text: "Laden Sie Freunde zu BidBlitz ein und erhalten Sie €10 Guthaben für jede erfolgreiche Registrierung. Ihr Freund bekommt ebenfalls €5 Startguthaben." },
];

export default function EmailMarketingAdminPage({ onBack }) {
  const [tab, setTab] = useState("compose");
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);

  // Compose state
  const [subject, setSubject] = useState("");
  const [plainText, setPlainText] = useState("");
  const [target, setTarget] = useState("all");
  const [testEmail, setTestEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => { if (tab === "history") loadCampaigns(); }, [tab]);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/email-marketing/campaigns`, { credentials: "include" });
      if (r.ok) { const d = await r.json(); setCampaigns(d.campaigns || []); }
    } catch {} setLoading(false);
  };

  const sendCampaign = async (isTest = false) => {
    if (!subject || !plainText) return;
    setSending(true); setResult(null);
    try {
      const body = { subject, plain_text: plainText, target, test_email: isTest ? testEmail : "" };
      const r = await fetch(`${API}/api/email-marketing/campaign/send`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (r.ok) {
        setResult({ ok: true, data: d });
        if (!isTest) { setSubject(""); setPlainText(""); }
      } else {
        setResult({ ok: false, error: d.detail || "Fehler" });
      }
    } catch (e) { setResult({ ok: false, error: e.message }); }
    setSending(false);
  };

  const applyTemplate = (tpl) => {
    setSubject(tpl.subject);
    setPlainText(tpl.text);
  };

  const totalSent = campaigns.reduce((s, c) => s + (c.sent || 0), 0);
  const totalFailed = campaigns.reduce((s, c) => s + (c.failed || 0), 0);

  return (
    <div className="min-h-screen pb-24" style={{ background: "#F0F4FA" }}>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack} className="p-2 rounded-xl bg-gray-100" data-testid="em-back">
            <ArrowLeft size={18} className="text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <Mail size={20} className="text-blue-500" />
            <h1 className="text-base font-bold text-gray-900">E-Mail Marketing</h1>
          </div>
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-gray-100">
          {[
            { id: "compose", label: "Erstellen", icon: Plus },
            { id: "templates", label: "Vorlagen", icon: FileText },
            { id: "history", label: "Verlauf", icon: Clock },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${tab === t.id ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"}`}
              data-testid={`em-tab-${t.id}`}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* ═══ COMPOSE ═══ */}
        {tab === "compose" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Zielgruppe */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-2 block">Zielgruppe</label>
              <div className="grid grid-cols-2 gap-2">
                {TARGETS.map(t => (
                  <button key={t.id} onClick={() => setTarget(t.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${target === t.id ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white"}`}
                    data-testid={`em-target-${t.id}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <t.icon size={14} className={target === t.id ? "text-blue-500" : "text-gray-400"} />
                      <span className={`text-xs font-semibold ${target === t.id ? "text-blue-700" : "text-gray-700"}`}>{t.label}</span>
                    </div>
                    <p className="text-[10px] text-gray-400">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Betreff */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Betreff</label>
              <input value={subject} onChange={e => setSubject(e.target.value)}
                placeholder="Z.B. Flash Sale: 50% Rabatt!"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-blue-400"
                data-testid="em-subject" />
            </div>

            {/* Inhalt */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Nachricht</label>
              <textarea value={plainText} onChange={e => setPlainText(e.target.value)}
                placeholder="Ihre Nachricht an die Nutzer..."
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-blue-400 resize-none"
                rows={6} data-testid="em-content" />
              <div className="text-right text-[10px] text-gray-400 mt-1">{plainText.length} Zeichen</div>
            </div>

            {/* Vorschau */}
            {subject && plainText && (
              <div className="rounded-xl overflow-hidden border border-gray-200">
                <div className="px-3 py-2 bg-gray-50 text-[10px] font-semibold text-gray-500 flex items-center gap-1"><Eye size={12} /> VORSCHAU</div>
                <div className="p-4 bg-[#0A0A0F] rounded-b-xl">
                  <div className="text-center mb-3"><span className="text-lg font-bold" style={{ color: "#00C2FF" }}>BidBlitz</span></div>
                  <h3 className="text-white text-sm font-semibold mb-2">{subject}</h3>
                  <p className="text-gray-400 text-xs leading-relaxed">{plainText}</p>
                  <div className="text-center mt-4">
                    <span className="inline-block px-4 py-2 rounded-lg text-xs font-bold" style={{ background: "#00C2FF", color: "#000" }}>Jetzt öffnen</span>
                  </div>
                </div>
              </div>
            )}

            {/* Test senden */}
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <label className="text-xs font-semibold text-gray-600 mb-2 block">Test-E-Mail senden</label>
              <div className="flex gap-2">
                <input value={testEmail} onChange={e => setTestEmail(e.target.value)}
                  placeholder="test@email.com" className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-xs outline-none" data-testid="em-test-email" />
                <button onClick={() => sendCampaign(true)} disabled={sending || !testEmail || !subject}
                  className="px-4 py-2 rounded-lg bg-gray-900 text-white text-xs font-medium disabled:opacity-40"
                  data-testid="em-test-send">Test</button>
              </div>
            </div>

            {/* Ergebnis */}
            <AnimatePresence>
              {result && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className={`p-3 rounded-xl flex items-start gap-2 ${result.ok ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                  {result.ok ? <CheckCircle size={16} className="text-green-500 mt-0.5" /> : <AlertCircle size={16} className="text-red-500 mt-0.5" />}
                  <div className="text-xs">
                    {result.ok ? (
                      result.data?.mode === "test"
                        ? <span className="text-green-700">Test-E-Mail an <b>{result.data.sent_to}</b> gesendet</span>
                        : <span className="text-green-700">Kampagne gesendet: <b>{result.data?.campaign?.sent || 0}</b> erfolgreich, <b>{result.data?.campaign?.failed || 0}</b> fehlgeschlagen</span>
                    ) : <span className="text-red-700">{result.error}</span>}
                  </div>
                  <button onClick={() => setResult(null)} className="ml-auto"><X size={14} className="text-gray-400" /></button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Kampagne senden */}
            <button onClick={() => sendCampaign(false)} disabled={sending || !subject || !plainText}
              className="w-full py-3 rounded-xl bg-blue-500 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-blue-600 transition-all"
              data-testid="em-send">
              {sending ? <Zap size={16} className="animate-spin" /> : <Send size={16} />}
              {sending ? "Wird gesendet..." : `An ${TARGETS.find(t => t.id === target)?.label || "Alle"} senden`}
            </button>
          </motion.div>
        )}

        {/* ═══ TEMPLATES ═══ */}
        {tab === "templates" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <p className="text-xs text-gray-500">Klicke auf eine Vorlage um sie zu übernehmen</p>
            {QUICK_TEMPLATES.map((tpl, i) => (
              <button key={i} onClick={() => { applyTemplate(tpl); setTab("compose"); }}
                className="w-full text-left p-4 rounded-xl bg-white border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
                data-testid={`em-tpl-${i}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-800">{tpl.name}</span>
                  <FileText size={14} className="text-gray-400" />
                </div>
                <p className="text-xs font-medium text-blue-600 mb-1">{tpl.subject}</p>
                <p className="text-[10px] text-gray-500 line-clamp-2">{tpl.text}</p>
              </button>
            ))}
          </motion.div>
        )}

        {/* ═══ HISTORY ═══ */}
        {tab === "history" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Kampagnen", value: campaigns.length, color: "#3B82F6" },
                { label: "Gesendet", value: totalSent, color: "#10B981" },
                { label: "Fehlgeschlagen", value: totalFailed, color: "#EF4444" },
              ].map(s => (
                <div key={s.label} className="p-3 rounded-xl bg-white border border-gray-100 text-center">
                  <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[10px] text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>

            {loading ? (
              <div className="flex justify-center py-10"><Zap size={24} className="animate-spin text-blue-400" /></div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-10"><Mail size={40} className="mx-auto mb-3 text-gray-300" /><p className="text-sm text-gray-400">Noch keine Kampagnen</p></div>
            ) : campaigns.map((c, i) => (
              <div key={i} className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800">{c.subject}</h3>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(c.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">{c.target}</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1 text-green-600"><CheckCircle size={12} /> {c.sent} gesendet</span>
                  {c.failed > 0 && <span className="flex items-center gap-1 text-red-500"><AlertCircle size={12} /> {c.failed} fehlgeschlagen</span>}
                  <span className="text-gray-400 ml-auto">{c.total_recipients} Empfänger</span>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
