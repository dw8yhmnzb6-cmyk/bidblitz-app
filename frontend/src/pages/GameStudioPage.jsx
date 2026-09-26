import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, ChevronRight, Gamepad2, Globe2, Layers3, Loader2, Pencil, Plus, Save, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import { useI18n } from "../store/I18nContext";

const API = `${process.env.REACT_APP_BACKEND_URL || ""}/api/game-studio/drafts`;
const LANGUAGES = [
  ["de", "Deutsch"], ["en", "English"], ["sq", "Shqip"], ["fr", "Français"], ["es", "Español"],
  ["pt", "Português"], ["it", "Italiano"], ["nl", "Nederlands"], ["pl", "Polski"], ["cs", "Čeština"],
  ["sk", "Slovenčina"], ["hu", "Magyar"], ["ro", "Română"], ["bg", "Български"], ["el", "Ελληνικά"],
  ["hr", "Hrvatski"], ["sr", "Srpski"], ["bs", "Bosanski"], ["sl", "Slovenščina"], ["mk", "Македонски"],
  ["tr", "Türkçe"], ["ru", "Русский"], ["uk", "Українська"], ["sv", "Svenska"], ["da", "Dansk"],
  ["nb", "Norsk bokmål"], ["fi", "Suomi"], ["ar", "العربية"], ["he", "עברית"], ["fa", "فارسی"],
  ["hi", "हिन्दी"], ["bn", "বাংলা"], ["ur", "اردو"], ["zh-Hans", "简体中文"], ["zh-Hant", "繁體中文"],
  ["ja", "日本語"], ["ko", "한국어"], ["id", "Bahasa Indonesia"], ["vi", "Tiếng Việt"], ["th", "ไทย"],
];
const EMPTY = { title: "", description: "", category: "Puzzle", languages: ["de", "en"], rights_confirmed: false };
const COPY = {
  de: { back: "Zurück", eyebrow: "BIDBLITZ GAMES · ENTWICKLERBEREICH", title: "Deine Spiele. Eine Bühne für die Welt.", subtitle: "Lege dein Spiel als Entwurf an und verwalte es sicher in deinem BidBlitz-Konto.", create: "Neues Spiel anlegen", draft: "Entwürfe", languages: "Spielsprachen", phase: "Plattform im Aufbau", status: "Privater Entwurf", emptyTitle: "Dein Studio ist bereit.", emptyText: "Beginne mit Titel, Beschreibung und den Sprachen deines Spiels.", edit: "Bearbeiten", remove: "Löschen", formTitle: "Spielentwurf", name: "Spieltitel", description: "Beschreibung", category: "Kategorie", rights: "Ich bestätige, dass ich die erforderlichen Rechte an diesem Spiel habe.", save: "Entwurf speichern", cancel: "Abbrechen", loadError: "Entwürfe konnten nicht geladen werden.", saveError: "Entwurf konnte nicht gespeichert werden.", deleteError: "Entwurf konnte nicht gelöscht werden.", loginError: "Bitte melde dich mit deinem BidBlitz-Konto an.", confirmDelete: "Diesen Entwurf wirklich löschen?", saved: "Entwurf gespeichert.", privacy: "Nur du kannst deine Entwürfe sehen. Veröffentlichung und Gebühren sind noch nicht aktiv.", noMoney: "Hier werden keine Einsätze oder Zahlungen ausgelöst.", retry: "Erneut laden" },
  en: { back: "Back", eyebrow: "BIDBLITZ GAMES · DEVELOPER STUDIO", title: "Your games. A stage for the world.", subtitle: "Create a game draft and manage it securely in your BidBlitz account.", create: "Create game draft", draft: "Drafts", languages: "Game languages", phase: "Platform in progress", status: "Private draft", emptyTitle: "Your studio is ready.", emptyText: "Start with your game's title, description and languages.", edit: "Edit", remove: "Delete", formTitle: "Game draft", name: "Game title", description: "Description", category: "Category", rights: "I confirm that I hold the necessary rights to this game.", save: "Save draft", cancel: "Cancel", loadError: "Could not load drafts.", saveError: "Could not save draft.", deleteError: "Could not delete draft.", loginError: "Please sign in to your BidBlitz account.", confirmDelete: "Delete this draft?", saved: "Draft saved.", privacy: "Only you can see your drafts. Publishing and fees are not active yet.", noMoney: "No wagers or payments happen here.", retry: "Try again" },
  sq: { back: "Kthehu", eyebrow: "BIDBLITZ GAMES · STUDIO E ZHVILLUESIT", title: "Lojërat e tua. Një skenë për botën.", subtitle: "Krijo një projekt loje dhe menaxhoje në llogarinë tënde BidBlitz.", create: "Krijo lojë", draft: "Projektet", languages: "Gjuhët e lojës", phase: "Platforma në zhvillim", status: "Projekt privat", emptyTitle: "Studioja jote është gati.", emptyText: "Fillo me titullin, përshkrimin dhe gjuhët e lojës.", edit: "Ndrysho", remove: "Fshi", formTitle: "Projekt loje", name: "Titulli i lojës", description: "Përshkrimi", category: "Kategoria", rights: "Konfirmoj se kam të drejtat e nevojshme për këtë lojë.", save: "Ruaj projektin", cancel: "Anulo", loadError: "Projektet nuk u ngarkuan.", saveError: "Projekti nuk u ruajt.", deleteError: "Projekti nuk u fshi.", loginError: "Hyr në llogarinë tënde BidBlitz.", confirmDelete: "Ta fshij këtë projekt?", saved: "Projekti u ruajt.", privacy: "Vetëm ti i sheh projektet. Publikimi dhe tarifat nuk janë aktivë.", noMoney: "Këtu nuk kryhen pagesa ose baste.", retry: "Provo sërish" },
};

async function request(url, options = {}) {
  const response = await fetch(url, { credentials: "include", ...options });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw Object.assign(new Error(typeof body.detail === "string" ? body.detail : "Request failed"), { status: response.status });
  }
  return response.json();
}

export default function GameStudioPage({ onBack }) {
  const { lang } = useI18n();
  const c = COPY[lang?.split("-")[0]] || COPY.en;
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await request(API);
      setDrafts(data.drafts || []);
    } catch (err) {
      setError(err.status === 401 ? c.loginError : c.loadError);
    } finally { setLoading(false); }
  }, [c.loginError, c.loadError]);

  useEffect(() => { load(); }, [load]);

  const start = (draft) => {
    setError(""); setNotice("");
    setEditing(draft?.id || "new");
    setForm(draft ? { title: draft.title, description: draft.description, category: draft.category,
      languages: [...draft.languages], rights_confirmed: draft.rights_confirmed } : { ...EMPTY, languages: [...EMPTY.languages] });
  };

  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const id = editing === "new" ? null : editing;
      await request(id ? `${API}/${encodeURIComponent(id)}` : API, {
        method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      setEditing(null);
      setNotice(c.saved);
      await load();
    } catch (err) { setError(err.status === 401 ? c.loginError : c.saveError); }
    finally { setBusy(false); }
  };

  const remove = async (draft) => {
    if (busy || !window.confirm(c.confirmDelete)) return;
    setBusy(true); setError("");
    try {
      await request(`${API}/${encodeURIComponent(draft.id)}`, { method: "DELETE" });
      setDrafts((items) => items.filter((item) => item.id !== draft.id));
    } catch (err) { setError(err.status === 401 ? c.loginError : c.deleteError); }
    finally { setBusy(false); }
  };

  const toggleLanguage = (code) => setForm((current) => ({
    ...current,
    languages: current.languages.includes(code) ? current.languages.filter((item) => item !== code) : [...current.languages, code],
  }));

  const field = "w-full rounded-2xl border border-white/10 bg-[#071b36]/80 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/10";
  return (
    <main className="min-h-screen bg-[#061329] text-white" data-testid="game-studio-page">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_78%_8%,rgba(33,180,255,.15),transparent_35%),radial-gradient(circle_at_5%_70%,rgba(67,71,196,.12),transparent_40%)]" />
      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-7">
        <header className="flex items-center justify-between gap-3">
          <button onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"><ArrowLeft size={17} />{c.back}</button>
          <div className="flex items-center gap-2 text-sm font-black tracking-[.15em]"><span className="rounded-xl bg-cyan-300 px-2 py-1 text-[#061329]">B</span>BIDBLITZ <span className="text-cyan-300">GAMES</span></div>
        </header>

        <section className="relative mt-8 overflow-hidden rounded-[30px] border border-cyan-200/15 bg-gradient-to-br from-[#113d73] via-[#14294c] to-[#091c35] p-6 shadow-[0_28px_70px_rgba(0,0,0,.28)] sm:p-10">
          <div className="pointer-events-none absolute -right-8 top-0 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="relative max-w-[650px]">
            <p className="mb-4 text-[11px] font-bold tracking-[.2em] text-cyan-200">{c.eyebrow}</p>
            <h1 className="text-3xl font-black leading-tight sm:text-5xl">{c.title}</h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-sky-100/70 sm:text-base">{c.subtitle}</p>
            <button onClick={() => start()} disabled={loading || busy || drafts.length >= 100} className="mt-7 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#8df8ff] to-[#04d4ea] px-6 py-3 font-bold text-[#05162a] shadow-[0_12px_30px_rgba(3,213,235,.25)] disabled:opacity-50"><Plus size={19} />{c.create}<ArrowUpRight size={17} /></button>
          </div>
          <div className="pointer-events-none absolute -bottom-14 -right-8 hidden h-52 w-52 rotate-12 rounded-[45px] border border-cyan-100/15 bg-gradient-to-br from-cyan-200/25 via-sky-500/20 to-indigo-500/20 shadow-2xl sm:block"><Gamepad2 className="absolute left-14 top-14 h-24 w-24 text-cyan-100/70" strokeWidth={1.1} /></div>
        </section>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[[Layers3, c.draft, drafts.length], [Globe2, c.languages, LANGUAGES.length], [ShieldCheck, c.phase, "01"]].map(([Icon, label, value]) => <div key={label} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#10213a]/80 p-4"><div className="rounded-xl bg-cyan-300/10 p-3 text-cyan-300"><Icon size={20} /></div><div><p className="text-xl font-bold">{value}</p><p className="text-xs text-white/50">{label}</p></div></div>)}
        </div>

        <div className="mt-9 flex items-center justify-between"><h2 className="flex items-center gap-2 text-xl font-bold"><Sparkles size={20} className="text-cyan-300" />{c.draft}</h2><span className="text-xs text-white/40">{drafts.length} / 100</span></div>
        {error && <div role="alert" className="mt-4 rounded-xl border border-rose-300/30 bg-rose-400/10 p-4 text-sm text-rose-100">{error} <button onClick={load} className="ml-3 underline">{c.retry}</button></div>}
        {notice && <div role="status" className="mt-4 rounded-xl border border-emerald-300/30 bg-emerald-400/10 p-4 text-sm text-emerald-100">{notice}</div>}
        {loading ? <div className="mt-8 flex items-center gap-3 text-white/60"><Loader2 className="animate-spin" size={20} />{c.draft}…</div> : drafts.length === 0 ?
          <div className="mt-5 rounded-3xl border border-dashed border-white/15 bg-white/[.03] px-6 py-12 text-center"><Gamepad2 size={42} className="mx-auto text-cyan-300/70" /><h3 className="mt-4 text-lg font-bold">{c.emptyTitle}</h3><p className="mt-2 text-sm text-white/50">{c.emptyText}</p></div> :
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{drafts.map((draft) => <article key={draft.id} className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#15345a] to-[#0c1c33] p-5 shadow-xl"><div className="mb-5 flex h-32 items-center justify-center rounded-2xl bg-[radial-gradient(circle_at_50%_30%,rgba(53,211,244,.35),transparent_50%),linear-gradient(135deg,#123b73,#202057)]"><Gamepad2 size={60} strokeWidth={1.2} className="text-cyan-200/80" /></div><span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold text-cyan-200">{c.status}</span><h3 className="mt-4 truncate text-lg font-bold">{draft.title}</h3><p className="mt-2 line-clamp-2 min-h-10 text-sm text-white/55">{draft.description}</p><div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-white/50"><span>{draft.category} · {draft.languages.length} {c.languages.toLowerCase()}</span><ChevronRight size={16} /></div><div className="mt-4 flex gap-2"><button onClick={() => start(draft)} disabled={busy} className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-cyan-300 px-3 py-2 text-xs font-bold text-[#061329] disabled:opacity-50"><Pencil size={14} />{c.edit}</button><button onClick={() => remove(draft)} disabled={busy} className="inline-flex items-center justify-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/70 hover:border-rose-300/40 disabled:opacity-50"><Trash2 size={14} />{c.remove}</button></div></article>)}</div>}

        <p className="mt-9 text-xs leading-relaxed text-white/40"><ShieldCheck size={14} className="mr-1 inline" />{c.privacy} {c.noMoney}</p>
      </div>

      {editing && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation"><div role="dialog" aria-modal="true" aria-label={c.formTitle} className="max-h-[93vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-cyan-200/15 bg-[#0c203d] p-6 shadow-2xl sm:rounded-3xl sm:p-8"><div className="mb-6 flex items-center justify-between"><h2 className="text-xl font-bold">{c.formTitle}</h2><button type="button" onClick={() => setEditing(null)} className="rounded-xl p-2 text-white/60 hover:bg-white/10" aria-label={c.cancel}><X size={20} /></button></div>{error && <div role="alert" className="mb-4 rounded-xl border border-rose-300/30 bg-rose-400/10 p-3 text-sm text-rose-100">{error}</div>}<form onSubmit={save} className="space-y-5"><label className="block text-sm font-medium">{c.name}<input required minLength={3} maxLength={80} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={`${field} mt-2`} /></label><label className="block text-sm font-medium">{c.description}<textarea required minLength={30} maxLength={2000} rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${field} mt-2 resize-y`} /></label><label className="block text-sm font-medium">{c.category}<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={`${field} mt-2`}>{["Puzzle", "Arcade", "Strategy", "Sports"].map((item) => <option key={item}>{item}</option>)}</select></label><fieldset><legend className="mb-2 text-sm font-medium">{c.languages}</legend><div className="max-h-40 overflow-auto rounded-2xl border border-white/10 bg-[#071b36]/80 p-3"><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{LANGUAGES.map(([code, name]) => <label key={code} className="flex min-w-0 cursor-pointer items-center gap-2 rounded-xl p-2 text-xs text-white/70 hover:bg-white/5"><input type="checkbox" checked={form.languages.includes(code)} onChange={() => toggleLanguage(code)} className="accent-cyan-300" /><span className="truncate">{name}</span></label>)}</div></div></fieldset><label className="flex items-start gap-3 rounded-xl border border-white/10 p-3 text-xs leading-relaxed text-white/75"><input required type="checkbox" checked={form.rights_confirmed} onChange={(e) => setForm({ ...form, rights_confirmed: e.target.checked })} className="mt-0.5 accent-cyan-300" />{c.rights}</label><div className="flex gap-3 pt-2"><button type="button" onClick={() => setEditing(null)} className="flex-1 rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold">{c.cancel}</button><button type="submit" disabled={busy || !form.languages.length || !form.rights_confirmed} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-[#061329] disabled:opacity-40">{busy ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}{c.save}</button></div></form></div></div>}
    </main>
  );
}
