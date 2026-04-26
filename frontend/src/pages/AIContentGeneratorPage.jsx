/**
 * AIContentGeneratorPage - For merchants/advertisers to generate marketing copy
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, Copy, Loader2, Check, Wand2 } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

const CONTENT_TYPES = [
  { id: "listing", label: "Verzeichnis-Eintrag", emoji: "📋", desc: "Beschreibung für deinen Eintrag" },
  { id: "ad_headline", label: "Werbe-Headline", emoji: "🎯", desc: "Kurze, knackige Überschrift" },
  { id: "ad_body", label: "Werbe-Text", emoji: "📢", desc: "Längerer Anzeigentext" },
  { id: "email", label: "Email-Marketing", emoji: "✉️", desc: "Newsletter & Kampagnen" },
  { id: "push", label: "Push-Benachrichtigung", emoji: "🔔", desc: "Klickstarke Notification" },
];

const TONES = [
  { id: "professional", label: "Professionell" },
  { id: "casual", label: "Locker" },
  { id: "playful", label: "Verspielt" },
  { id: "urgent", label: "Dringend" },
];

const LANGS = [
  { id: "de", label: "Deutsch" },
  { id: "en", label: "English" },
  { id: "sq", label: "Shqip" },
  { id: "tr", label: "Türkçe" },
];

export default function AIContentGeneratorPage({ onBack }) {
  const [contentType, setContentType] = useState("listing");
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("");
  const [keywords, setKeywords] = useState("");
  const [tone, setTone] = useState("professional");
  const [language, setLanguage] = useState("de");
  const [busy, setBusy] = useState(false);
  const [variations, setVariations] = useState([]);
  const [copiedIdx, setCopiedIdx] = useState(null);

  const generate = async () => {
    if (!businessName.trim()) {
      toast.error("Bitte Geschäftsname eingeben");
      return;
    }
    setBusy(true);
    setVariations([]);
    try {
      const r = await fetch(`${API}/api/ai/content/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content_type: contentType,
          business_name: businessName.trim(),
          category: category.trim() || null,
          keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
          tone,
          language,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || "Fehler");
      setVariations(j.variations || [j.text]);
    } catch (e) {
      toast.error(e.message || "Generierung fehlgeschlagen");
    }
    setBusy(false);
  };

  const copyText = async (text, idx) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      toast.success("Kopiert!");
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch {
      toast.error("Konnte nicht kopieren");
    }
  };

  return (
    <div data-testid="ai-content-page" className="min-h-screen pb-24 bg-[#050505]"
      style={{ background: "radial-gradient(circle at 50% 0%, rgba(168,85,247,0.18), transparent 50%), #050505" }}>
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#050505]/90 border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-4 py-3">
          <motion.button onClick={onBack} data-testid="ai-content-back"
            className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center"
            whileTap={{ scale: 0.92 }}>
            <ArrowLeft size={15} className="text-white/70" />
          </motion.button>
          <h1 className="text-[14px] font-bold text-white flex items-center gap-1.5">
            <Wand2 size={14} className="text-purple-400" />
            AI Content Generator
          </h1>
          <div className="w-9" />
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Hero */}
        <div className="rounded-3xl p-5 text-center"
             style={{ background: "linear-gradient(135deg,#A855F7,#EC4899)" }}>
          <Sparkles size={28} className="mx-auto text-white mb-1" />
          <h2 className="text-[18px] font-black text-white">Texte in Sekunden</h2>
          <p className="text-[12px] text-white/85 mt-1">
            KI schreibt Marketing-Copy für dein Business
          </p>
        </div>

        {/* Content Type */}
        <div>
          <p className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-2">Was schreiben wir?</p>
          <div className="grid grid-cols-2 gap-2">
            {CONTENT_TYPES.map((ct) => (
              <button
                key={ct.id}
                data-testid={`content-type-${ct.id}`}
                onClick={() => setContentType(ct.id)}
                className={`text-left p-3 rounded-2xl border transition-all ${
                  contentType === ct.id
                    ? "bg-purple-500/20 border-purple-400/60"
                    : "bg-white/[0.04] border-white/[0.06]"
                }`}
              >
                <div className="text-[20px] mb-1">{ct.emoji}</div>
                <p className="text-[12px] font-bold text-white leading-tight">{ct.label}</p>
                <p className="text-[10px] text-white/50 mt-0.5 leading-tight">{ct.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Form Inputs */}
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5 block">
              Geschäftsname *
            </label>
            <input
              data-testid="ai-content-business"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="z.B. Pizza Roma Berlin"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[13px] text-white placeholder-white/40 focus:outline-none focus:border-purple-400/50"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5 block">
              Kategorie / Branche
            </label>
            <input
              data-testid="ai-content-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="z.B. Italienisches Restaurant"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[13px] text-white placeholder-white/40 focus:outline-none focus:border-purple-400/50"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5 block">
              Keywords (kommagetrennt)
            </label>
            <input
              data-testid="ai-content-keywords"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="frische Zutaten, Steinofen, Lieferservice"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[13px] text-white placeholder-white/40 focus:outline-none focus:border-purple-400/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5 block">
                Tonalität
              </label>
              <select
                data-testid="ai-content-tone"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[13px] text-white focus:outline-none focus:border-purple-400/50"
              >
                {TONES.map((t) => (
                  <option key={t.id} value={t.id} className="bg-[#0a0a0a]">{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5 block">
                Sprache
              </label>
              <select
                data-testid="ai-content-language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[13px] text-white focus:outline-none focus:border-purple-400/50"
              >
                {LANGS.map((l) => (
                  <option key={l.id} value={l.id} className="bg-[#0a0a0a]">{l.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <motion.button
          data-testid="ai-content-generate"
          onClick={generate}
          disabled={busy || !businessName.trim()}
          whileTap={{ scale: 0.97 }}
          className="w-full py-4 rounded-2xl font-black text-[14px] text-white flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ background: "linear-gradient(135deg,#A855F7,#EC4899)" }}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
          {busy ? "KI generiert..." : "3 Varianten generieren"}
        </motion.button>

        {/* Results */}
        {variations.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-white/50 uppercase tracking-wider">Deine Varianten</p>
            {variations.map((v, i) => (
              <motion.div
                key={i}
                data-testid={`ai-content-result-${i}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3.5"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">
                    Variante {i + 1}
                  </span>
                  <button
                    data-testid={`ai-content-copy-${i}`}
                    onClick={() => copyText(v, i)}
                    className="w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center"
                    aria-label="Kopieren"
                  >
                    {copiedIdx === i
                      ? <Check size={12} className="text-emerald-400" />
                      : <Copy size={12} className="text-white/60" />}
                  </button>
                </div>
                <p className="text-[13px] text-white leading-relaxed whitespace-pre-wrap">{v}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
