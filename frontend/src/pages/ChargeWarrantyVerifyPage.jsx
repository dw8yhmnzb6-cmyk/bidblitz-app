import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { api } from "../services/api";

export default function ChargeWarrantyVerifyPage({ registrationId, signature, onNavigate }) {
  const [state, setState] = useState({ loading: true, data: null, error: "" });

  const verify = useCallback(async () => {
    if (!registrationId || !signature) {
      setState({ loading: false, data: null, error: "Garantiepass ist unvollständig." });
      return;
    }
    try {
      const response = await api.verifyChargeWarrantyPass(registrationId, signature);
      setState({ loading: false, data: response?.pass || null, error: "" });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message || "Garantiepass konnte nicht verifiziert werden." });
    }
  }, [registrationId, signature]);

  useEffect(() => {
    verify();
  }, [verify]);

  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#06101B]" data-testid="charge-warranty-verify-loading">
        <Loader2 size={28} className="animate-spin text-[#6EE7F9]" />
      </div>
    );
  }

  if (!state.data) {
    return (
      <div className="min-h-screen bg-[#06101B] px-4 py-12 text-white" data-testid="charge-warranty-verify-invalid">
        <div className="mx-auto max-w-xl rounded-[30px] border border-red-400/20 bg-red-500/10 p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-400/10 text-red-300">
            <XCircle size={28} />
          </div>
          <h1 className="mt-4 text-2xl font-black">Garantiepass ungültig</h1>
          <p className="mt-3 text-sm leading-6 text-red-100/80">{state.error}</p>
          <button
            onClick={() => onNavigate?.("/")}
            className="mt-6 h-11 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-black"
          >
            Zur Startseite
          </button>
        </div>
      </div>
    );
  }

  const pass = state.data;
  const active = pass.status === "active";

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#06101B_0%,#0C1623_44%,#F3EFE7_44%,#F3EFE7_100%)] px-4 py-8" data-testid="charge-warranty-verify-page">
      <div className="mx-auto max-w-2xl">
        <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(110,231,249,0.22),transparent_30%),linear-gradient(135deg,#08131D,#10283B)] p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#6EE7F9]/10 text-[#6EE7F9]">
              <ShieldCheck size={27} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6EE7F9]">BidBlitz Charge Care</p>
              <h1 className="mt-1 text-3xl font-black">Garantiepass verifiziert</h1>
              <p className="mt-2 text-sm text-slate-300">Dieser Pass wurde kryptografisch von BidBlitz Charge bestätigt.</p>
            </div>
            <CheckCircle2 size={26} className="shrink-0 text-emerald-300" />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Info label="Pass ID" value={pass.pass_id} />
            <Info label="Registrierung" value={pass.registration_id} />
            <Info label="Produkt" value={pass.product_name} />
            <Info label="Händler" value={pass.merchant_name} />
            <Info label="Seriennummer" value={pass.serial_number_masked} />
            <Info label="Garantie" value={pass.coverage_label} />
            <Info label="Nachweis" value={pass.evidence_label || "Manuell erfasst"} />
            <Info label="Gültig bis" value={pass.valid_until} />
            <Info label="Status" value={pass.status_label || pass.status} accent={active} />
          </div>
        </section>

        <section className="mt-5 rounded-[28px] border border-[#D9CFC0] bg-[#F8F3EA] p-5 text-slate-800">
          <h2 className="text-lg font-black">Datenschutz</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Die öffentliche Verifikation bestätigt den digitalen BidBlitz-Charge-Garantiepass und zeigt, welche Nachweise mit ihm verknüpft sind.
            Sie ist keine unabhängige Echtheitsprüfung des physischen Produkts. Kundennamen, E-Mail-Adressen, Rechnungen und Reklamationsverläufe werden nicht angezeigt.
          </p>
          <button
            onClick={() => onNavigate?.("/")}
            className="mt-5 h-11 w-full rounded-2xl bg-[#0A1626] text-sm font-black text-[#D8FCFF]"
            data-testid="charge-warranty-verify-home"
          >
            BidBlitz öffnen
          </button>
        </section>
      </div>
    </div>
  );
}

function Info({ label, value, accent = false }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${accent ? "border-emerald-300/20 bg-emerald-400/10" : "border-white/10 bg-white/5"}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className={`mt-2 break-words text-sm font-black ${accent ? "text-emerald-200" : "text-white"}`}>{value || "—"}</p>
    </div>
  );
}
