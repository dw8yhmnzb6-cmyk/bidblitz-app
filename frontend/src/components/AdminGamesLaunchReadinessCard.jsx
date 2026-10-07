import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Rocket } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL || ""}/api/admin/game-studio/launch-readiness`;

const COPY = {
  de: {
    title: "Launch-Readiness",
    subtitle: "Read-only. Aktiviert weder Production noch Billing.",
    loading: "Launch-Readiness wird geprüft…",
    error: "Launch-Readiness konnte nicht geladen werden.",
    nonMonetary: "Nicht-monetärer Launch",
    commercial: "Kommerzieller Launch",
    ready: "Bereit",
    blocked: "Blockiert",
    blockers: "Offene Blocker",
    technical_preflight: "Technischer Preflight",
    human_translation_review: "Menschliche Sprachprüfung",
    physical_device_acceptance: "Physische Geräteabnahme",
    production_approval: "Production-Freigabe",
    billing_provider: "Billing-Anbieter",
  },
  en: {
    title: "Launch readiness",
    subtitle: "Read-only. Does not enable production or billing.",
    loading: "Checking launch readiness…",
    error: "Could not load launch readiness.",
    nonMonetary: "Non-monetary launch",
    commercial: "Commercial launch",
    ready: "Ready",
    blocked: "Blocked",
    blockers: "Open blockers",
    technical_preflight: "Technical preflight",
    human_translation_review: "Human translation review",
    physical_device_acceptance: "Physical-device acceptance",
    production_approval: "Production approval",
    billing_provider: "Billing provider",
  },
  sq: {
    title: "Gatishmëria për publikim",
    subtitle: "Vetëm lexim. Nuk aktivizon Production ose Billing.",
    loading: "Po kontrollohet gatishmëria…",
    error: "Gatishmëria nuk u ngarkua.",
    nonMonetary: "Publikim pa pagesa",
    commercial: "Publikim komercial",
    ready: "Gati",
    blocked: "Bllokuar",
    blockers: "Bllokuesit e hapur",
    technical_preflight: "Kontrolli teknik",
    human_translation_review: "Kontrolli njerëzor i gjuhëve",
    physical_device_acceptance: "Pranimi në pajisje fizike",
    production_approval: "Miratimi Production",
    billing_provider: "Ofruesi i pagesave",
  },
};

function Status({ ok, ready, blocked }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] font-semibold ${ok ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" : "border-amber-300/25 bg-amber-300/10 text-amber-100"}`}>
      {ok ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}{ok ? ready : blocked}
    </span>
  );
}

export default function AdminGamesLaunchReadinessCard({ locale = "en" }) {
  const c = COPY[locale] || COPY.en;
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");

  useEffect(() => {
    const controller = new AbortController();
    fetch(API, { credentials: "include", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.detail || "launch-readiness");
        return body;
      })
      .then((body) => {
        if (controller.signal.aborted) return;
        setData(body);
        setState("ready");
      })
      .catch((error) => {
        if (!controller.signal.aborted && error.name !== "AbortError") setState("error");
      });
    return () => controller.abort();
  }, []);

  return (
    <section className="mt-6 rounded-3xl border border-cyan-200/15 bg-[#0a1d36] p-5" data-testid="games-launch-readiness-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold"><Rocket size={19} className="text-cyan-300" />{c.title}</h2>
          <p className="mt-1 text-xs text-white/45">{c.subtitle}</p>
        </div>
      </div>

      {state === "loading" && <p className="mt-4 flex items-center gap-2 text-sm text-white/55"><Loader2 size={15} className="animate-spin" />{c.loading}</p>}
      {state === "error" && <p role="alert" className="mt-4 text-sm text-rose-200">{c.error}</p>}

      {state === "ready" && data && <>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{c.nonMonetary}</p>
              <Status ok={Boolean(data.non_monetary_launch_ready)} ready={c.ready} blocked={c.blocked} />
            </div>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{c.commercial}</p>
              <Status ok={Boolean(data.commercial_launch_ready)} ready={c.ready} blocked={c.blocked} />
            </div>
          </article>
        </div>

        <div className="mt-4">
          <p className="text-xs font-semibold text-white/65">{c.blockers}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(data.blockers || []).length
              ? data.blockers.map((blocker) => <span key={blocker} className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[10px] text-amber-100">{c[blocker] || blocker}</span>)
              : <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[10px] text-emerald-100">{c.ready}</span>}
          </div>
        </div>
      </>}
    </section>
  );
}
