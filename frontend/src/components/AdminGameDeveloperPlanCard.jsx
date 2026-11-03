import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, CreditCard, Loader2, ShieldX } from "lucide-react";

const ROOT = `${process.env.REACT_APP_BACKEND_URL || ""}/api/admin/game-studio/developer-entitlements/by-draft`;

const COPY = {
  de: {
    title: "Entwicklerplan", noPlan: "Kein aktiver Plan", active: "Aktiv",
    starter: "Starter", studio: "Studio", ref: "Zahlungs-/Vertragsreferenz",
    refPlaceholder: "z. B. Rechnung, Vertrag oder Zahlungs-ID", grant: "Plan freischalten",
    revoke: "Plan widerrufen", loadError: "Entwicklerplan konnte nicht geladen werden.",
    saveError: "Entwicklerplan konnte nicht geändert werden.", invalidRef: "Bitte eine überprüfbare Referenz mit mindestens 6 Zeichen angeben.",
    limit: "Veröffentlichungslimit",
  },
  en: {
    title: "Developer plan", noPlan: "No active plan", active: "Active",
    starter: "Starter", studio: "Studio", ref: "Payment / contract reference",
    refPlaceholder: "e.g. invoice, contract or payment ID", grant: "Activate plan",
    revoke: "Revoke plan", loadError: "Could not load developer plan.",
    saveError: "Could not change developer plan.", invalidRef: "Enter a verifiable reference with at least 6 characters.",
    limit: "Publication limit",
  },
  sq: {
    title: "Plani i zhvilluesit", noPlan: "Nuk ka plan aktiv", active: "Aktiv",
    starter: "Starter", studio: "Studio", ref: "Referenca e pagesës / kontratës",
    refPlaceholder: "p.sh. faturë, kontratë ose ID pagese", grant: "Aktivizo planin",
    revoke: "Çaktivizo planin", loadError: "Plani nuk u ngarkua.",
    saveError: "Plani nuk u ndryshua.", invalidRef: "Vendos një referencë të verifikueshme me të paktën 6 shenja.",
    limit: "Kufiri i publikimit",
  },
};

async function read(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Request failed");
  return body;
}

export default function AdminGameDeveloperPlanCard({ draftId, locale = "en" }) {
  const c = COPY[locale] || COPY.en;
  const [status, setStatus] = useState(null);
  const [plan, setPlan] = useState("starter");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(`${ROOT}/${encodeURIComponent(draftId)}`, { credentials: "include" });
      setStatus(await read(response));
    } catch (loadError) {
      setError(loadError?.message || c.loadError);
    }
  }, [draftId, c.loadError]);

  useEffect(() => { load(); }, [load]);

  const grant = async () => {
    const clean = reference.trim();
    if (clean.length < 6) { setError(c.invalidRef); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(`${ROOT}/${encodeURIComponent(draftId)}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, payment_reference: clean, note: "Verified by Games operator" }),
      });
      await read(response);
      setReference("");
      await load();
    } catch (saveError) {
      setError(saveError?.message || c.saveError);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch(`${ROOT}/${encodeURIComponent(draftId)}`, {
        method: "DELETE", credentials: "include",
      });
      await read(response);
      await load();
    } catch (saveError) {
      setError(saveError?.message || c.saveError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-4 rounded-2xl border border-white/10 bg-white/[.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-[10px] font-bold tracking-[.18em] text-cyan-200">BIDBLITZ GAMES</p><h3 className="mt-1 text-sm font-bold">{c.title}</h3></div>
        {status?.active
          ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-1 text-[10px] text-emerald-100"><BadgeCheck size={12} />{c.active}</span>
          : <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-white/45">{c.noPlan}</span>}
      </div>

      {status?.active && <div className="mt-3 flex items-center justify-between rounded-xl bg-white/[.04] p-3 text-xs"><span>{c[status.entitlement?.plan] || status.entitlement?.plan}</span><span className="text-white/50">{c.limit}: {status.max_published_games || 0}</span></div>}

      {!status?.active && <div className="mt-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">{["starter", "studio"].map((value) => <button key={value} type="button" onClick={() => setPlan(value)} aria-pressed={plan === value} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${plan === value ? "border-cyan-300 bg-cyan-300 text-[#061329]" : "border-white/10 bg-white/[.03] text-white/65"}`}>{c[value]}</button>)}</div>
        <label className="block text-xs text-white/65">{c.ref}<input value={reference} onChange={(event) => setReference(event.target.value)} maxLength={200} placeholder={c.refPlaceholder} className="mt-2 w-full rounded-xl border border-white/10 bg-[#06182d] px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-300/60" /></label>
        <button type="button" onClick={grant} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-xs font-bold text-[#061329] disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}{c.grant}</button>
      </div>}

      {status?.active && <button type="button" onClick={revoke} disabled={busy} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-300/25 bg-rose-300/10 px-4 py-2.5 text-xs font-semibold text-rose-100 disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldX size={14} />}{c.revoke}</button>}
      {error && <p role="alert" className="mt-3 text-xs text-rose-200">{error}</p>}
    </section>
  );
}
