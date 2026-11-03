import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, CreditCard, Loader2, ShieldCheck } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL || ""}/api/games/developer`;

const COPY = {
  de: {
    title: "Entwicklerplan",
    active: "Aktiv",
    inactive: "Noch kein aktiver Veröffentlichungsplan",
    games: "veröffentlichte Spiele",
    limit: "Limit",
    billingOff: "Online-Abrechnung ist noch nicht freigeschaltet. Es wird keine Zahlung simuliert.",
    billingOn: "Abrechnung ist verfügbar.",
    starter: "Starter",
    studio: "Studio",
    pricePending: "Preis noch nicht verbindlich festgelegt",
    perPlan: "Veröffentlichungsplan",
    loadError: "Entwicklerplan konnte nicht geladen werden.",
  },
  en: {
    title: "Developer plan",
    active: "Active",
    inactive: "No active publication plan yet",
    games: "published games",
    limit: "Limit",
    billingOff: "Online billing is not enabled yet. No payment is simulated.",
    billingOn: "Billing is available.",
    starter: "Starter",
    studio: "Studio",
    pricePending: "Price not finalized yet",
    perPlan: "Publication plan",
    loadError: "Could not load developer plan.",
  },
  sq: {
    title: "Plani i zhvilluesit",
    active: "Aktiv",
    inactive: "Ende nuk ka plan aktiv publikimi",
    games: "lojëra të publikuara",
    limit: "Kufiri",
    billingOff: "Pagesa online ende nuk është aktivizuar. Nuk simulohet asnjë pagesë.",
    billingOn: "Pagesa është e disponueshme.",
    starter: "Starter",
    studio: "Studio",
    pricePending: "Çmimi ende nuk është përcaktuar përfundimisht",
    perPlan: "Plan publikimi",
    loadError: "Plani i zhvilluesit nuk u ngarkua.",
  },
};

function priceLabel(plan, c) {
  if (!plan?.price_eur_cents) return c.pricePending;
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(plan.price_eur_cents / 100);
}

export default function GamesDeveloperPlanCard({ locale = "en" }) {
  const c = COPY[locale] || COPY.en;
  const [status, setStatus] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [statusResponse, plansResponse] = await Promise.all([
        fetch(`${API}/me`, { credentials: "include" }),
        fetch(`${API}/plans`, { credentials: "include" }),
      ]);
      if (!statusResponse.ok || !plansResponse.ok) throw new Error(c.loadError);
      const [statusBody, plansBody] = await Promise.all([statusResponse.json(), plansResponse.json()]);
      setStatus(statusBody);
      setPlans(Array.isArray(plansBody.plans) ? plansBody.plans : []);
    } catch {
      setError(c.loadError);
    } finally {
      setLoading(false);
    }
  }, [c.loadError]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="mt-5 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[.03] p-4 text-xs text-white/55"><Loader2 size={15} className="animate-spin" />{c.title}…</div>;

  return (
    <section className="mt-5 rounded-3xl border border-cyan-200/15 bg-gradient-to-br from-[#12365d] to-[#0a1f38] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-[11px] font-bold tracking-[.18em] text-cyan-200">BIDBLITZ GAMES</p><h2 className="mt-1 text-lg font-bold">{c.title}</h2></div>
        {status?.active
          ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100"><BadgeCheck size={14} />{c.active}</span>
          : <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/55">{c.inactive}</span>}
      </div>

      {error ? <p role="alert" className="mt-3 text-xs text-rose-200">{error}</p> : <>
        {status?.entitlement && <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
          <div className="rounded-xl bg-white/[.04] p-3"><span className="text-white/45">{c.perPlan}</span><b className="mt-1 block text-white/90">{c[status.entitlement.plan] || status.entitlement.plan}</b></div>
          <div className="rounded-xl bg-white/[.04] p-3"><span className="text-white/45">{c.games}</span><b className="mt-1 block text-white/90">{status.published_games || 0}</b></div>
          <div className="rounded-xl bg-white/[.04] p-3"><span className="text-white/45">{c.limit}</span><b className="mt-1 block text-white/90">{status.max_published_games || 0}</b></div>
        </div>}

        {!status?.active && <div className="mt-4 grid gap-3 sm:grid-cols-2">{plans.map((plan) => <article key={plan.id} className="rounded-2xl border border-white/10 bg-white/[.03] p-4"><div className="flex items-center justify-between gap-2"><b>{c[plan.id] || plan.id}</b><ShieldCheck size={16} className="text-cyan-300" /></div><p className="mt-2 text-xs text-white/50">{c.limit}: {plan.max_published_games}</p><p className="mt-1 text-xs text-white/70">{priceLabel(plan, c)}</p></article>)}</div>}

        <p className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs leading-relaxed ${status?.billing_ready ? "border-emerald-300/20 bg-emerald-300/5 text-emerald-100" : "border-amber-200/15 bg-amber-200/5 text-amber-100/80"}`}><CreditCard size={15} className="mt-0.5 shrink-0" />{status?.billing_ready ? c.billingOn : c.billingOff}</p>
      </>}
    </section>
  );
}
