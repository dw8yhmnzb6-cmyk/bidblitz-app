import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleDollarSign, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "";

const COPY = {
  de: {
    title: "Finanz-Sandbox",
    subtitle: "Testmodell für Käufe, Refunds und Revenue Share – ohne echte Geldbewegung.",
    active: "Sandbox aktiv",
    locked: "Sandbox gesperrt",
    configured: "Revenue Share konfiguriert",
    unconfigured: "Revenue Share nicht konfiguriert",
    developerShare: "Entwickleranteil",
    purchases: "Testkäufe",
    refunds: "Test-Refunds",
    netGross: "Netto-Testumsatz",
    developerNet: "Entwickler-Testanteil",
    platformNet: "Plattform-Testanteil",
    noMoney: "Keine echte Zahlung, keine Wallet-Abbuchung und keine Auszahlung wird durch diese Ansicht ausgelöst.",
    loadError: "Finanz-Sandbox konnte nicht geladen werden.",
    retry: "Neu laden",
  },
  en: {
    title: "Finance sandbox",
    subtitle: "Test model for purchases, refunds and revenue share — without real money movement.",
    active: "Sandbox enabled",
    locked: "Sandbox locked",
    configured: "Revenue share configured",
    unconfigured: "Revenue share not configured",
    developerShare: "Developer share",
    purchases: "Test purchases",
    refunds: "Test refunds",
    netGross: "Net test gross",
    developerNet: "Developer test share",
    platformNet: "Platform test share",
    noMoney: "No real payment, wallet debit or payout is triggered by this view.",
    loadError: "Finance sandbox could not be loaded.",
    retry: "Reload",
  },
  sq: {
    title: "Sandbox financiar",
    subtitle: "Model prove për blerje, rimbursime dhe ndarje të të ardhurave — pa lëvizje reale parash.",
    active: "Sandbox aktiv",
    locked: "Sandbox i bllokuar",
    configured: "Ndarja e të ardhurave e konfiguruar",
    unconfigured: "Ndarja e të ardhurave nuk është konfiguruar",
    developerShare: "Pjesa e zhvilluesit",
    purchases: "Blerje prove",
    refunds: "Rimbursime prove",
    netGross: "Xhiro neto prove",
    developerNet: "Pjesa neto e zhvilluesit",
    platformNet: "Pjesa neto e platformës",
    noMoney: "Kjo pamje nuk kryen pagesë reale, zbritje nga wallet-i ose pagesë ndaj zhvilluesit.",
    loadError: "Sandbox-i financiar nuk u ngarkua.",
    retry: "Ringarko",
  },
};

function euro(cents, locale) {
  const language = locale === "de" ? "de-DE" : locale === "sq" ? "sq-AL" : "en-US";
  return new Intl.NumberFormat(language, {
    style: "currency",
    currency: "EUR",
  }).format(Number(cents || 0) / 100);
}

export default function GamesFinanceSandboxCard({ locale = "en", mode = "developer" }) {
  const c = COPY[locale] || COPY.en;
  const endpoint = useMemo(
    () => mode === "admin"
      ? `${BACKEND}/api/admin/game-studio/finance/summary`
      : `${BACKEND}/api/games/finance/me`,
    [mode],
  );
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(endpoint, { credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || c.loadError);
      setData(body);
    } catch (loadError) {
      setData(null);
      setError(loadError?.message || c.loadError);
    } finally {
      setLoading(false);
    }
  }, [endpoint, c.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  const sharePercent = Number(data?.developer_share_bps || 0) / 100;

  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-[#0a1d36] p-5" data-testid={`games-finance-sandbox-${mode}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <CircleDollarSign size={19} className="text-cyan-300" />{c.title}
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-white/50">{c.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data && <span className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
            data.sandbox_enabled
              ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-100"
              : "border-amber-300/25 bg-amber-300/10 text-amber-100"
          }`}>
            {data.sandbox_enabled ? c.active : c.locked}
          </span>}
          {data && <span className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
            data.configured
              ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
              : "border-white/15 bg-white/5 text-white/55"
          }`}>
            {data.configured ? c.configured : c.unconfigured}
          </span>}
        </div>
      </div>

      {loading && <p className="mt-4 flex items-center gap-2 text-xs text-white/50"><Loader2 size={14} className="animate-spin" />{c.title}…</p>}
      {error && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-300/25 bg-rose-400/10 p-3">
        <p role="alert" className="text-xs text-rose-100">{error}</p>
        <button type="button" onClick={load} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[10px] text-white/75">
          <RefreshCw size={12} />{c.retry}
        </button>
      </div>}

      {data && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          [c.developerShare, data.developer_share_bps ? `${sharePercent.toFixed(2)}%` : "—"],
          [c.purchases, Number(data.purchase_count || 0).toLocaleString(locale)],
          [c.refunds, Number(data.refund_count || 0).toLocaleString(locale)],
          [c.netGross, euro(data.net_gross_eur_cents, locale)],
          [c.developerNet, euro(data.net_developer_eur_cents, locale)],
          [c.platformNet, euro(data.net_platform_eur_cents, locale)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
            <p className="text-[10px] text-white/45">{label}</p>
            <p className="mt-2 break-words text-lg font-black text-white">{value}</p>
          </div>
        ))}
      </div>}

      <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-cyan-50/55">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-cyan-300" />{c.noMoney}
      </p>
    </section>
  );
}
