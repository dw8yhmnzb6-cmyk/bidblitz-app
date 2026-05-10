/**
 * EVOperatorLayout — operator dashboard with tabs.
 * The 5 named operator pages are thin wrappers that mount this with defaultTab.
 */
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

const TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "stations", label: "Meine Stationen" },
  { key: "sessions", label: "Sessions" },
  { key: "revenue", label: "Umsatz" },
  { key: "payouts", label: "Auszahlungen" },
];

async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, { credentials: "include", ...opts });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || `${r.status}`);
  return r.json();
}

export default function EVOperatorLayout({ defaultTab = "dashboard", onNavigate }) {
  const [tab, setTab] = useState(defaultTab);
  const [profile, setProfile] = useState(null);
  const [stations, setStations] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [revenue, setRevenue] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [showRegister, setShowRegister] = useState(false);

  const reload = async () => {
    try {
      const me = await api("/api/ev/operator/me").catch(() => null);
      setProfile(me);
      if (!me) {
        setShowRegister(true);
        return;
      }
      const [st, ss, rv, po] = await Promise.all([
        api("/api/ev/operator/stations"),
        api("/api/ev/operator/sessions"),
        api("/api/ev/operator/revenue"),
        api("/api/ev/operator/payouts"),
      ]);
      setStations(st.stations || []);
      setSessions(ss.sessions || []);
      setRevenue(rv);
      setPayouts(po.payouts || []);
    } catch (e) {
      toast.error(e.message);
    }
  };

  useEffect(() => { reload(); }, []);

  const register = async (data) => {
    try {
      await api("/api/ev/operator/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      toast.success("Antrag eingereicht — wartet auf Admin-Freigabe");
      setShowRegister(false);
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const requestPayout = async () => {
    const amt = parseFloat(prompt("Auszahlungsbetrag (EUR):") || "0");
    if (!amt || amt <= 0) return;
    try {
      await api("/api/ev/operator/payouts/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt }),
      });
      toast.success("Auszahlungsantrag gesendet");
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (showRegister) {
    return (
      <RegisterForm onSubmit={register} onCancel={() => onNavigate("/")} />
    );
  }
  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center">
        <p className="text-gray-400">Lade…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-20">
      <div className="px-5 pt-12 max-w-5xl mx-auto">
        <button onClick={() => onNavigate("/")} className="text-gray-400 text-sm" data-testid="ev-op-back">← Zurück</button>
        <h1 className="text-2xl font-bold mt-3" data-testid="ev-op-company">{profile.company_name}</h1>
        <p className="text-xs text-gray-400 mt-1">
          Status: <span className={profile.status === "active" ? "text-emerald-400" : "text-yellow-400"}>{profile.status}</span>
          {" "}· Provision: {profile.commission_pct == null ? "Default" : `${profile.commission_pct}%`}
        </p>

        <div className="flex gap-2 overflow-x-auto mt-5 pb-2 scrollbar-hide">
          {TABS.map((t) => (
            <button
              key={t.key}
              data-testid={`ev-op-tab-${t.key}`}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap ${
                tab === t.key
                  ? "bg-cyan-500 text-black"
                  : "bg-white/5 border border-white/10 text-gray-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          {tab === "dashboard" && revenue && (
            <div className="grid grid-cols-2 gap-3" data-testid="ev-op-dashboard">
              <Tile label="Stationen" value={revenue.stations} />
              <Tile label="Sessions" value={revenue.summary?.session_count ?? 0} />
              <Tile label="kWh gesamt" value={Number(revenue.summary?.total_kwh ?? 0).toFixed(1)} />
              <Tile label="Brutto-Umsatz" value={`€${Number(revenue.summary?.total_revenue ?? 0).toFixed(2)}`} color="emerald" />
            </div>
          )}

          {tab === "stations" && stations.map((s) => (
            <div key={s.charge_point_id} className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <p className="font-semibold">{s.name || s.charge_point_id}</p>
              <p className="text-xs text-gray-400">{s.charge_point_id} · {s.location?.city}</p>
              <p className="text-[11px] text-gray-500 mt-1">{s.online ? "🟢 online" : "⚪️ offline"} · {s.status}</p>
            </div>
          ))}

          {tab === "sessions" && sessions.map((s) => (
            <div key={s.session_id} className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex justify-between">
                <p className="font-semibold text-sm">{s.session_id}</p>
                <span className="text-[10px] text-gray-500">{s.status}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {s.charge_point_id} · {Number(s.kwh_charged || 0).toFixed(2)} kWh ·
                Brutto €{Number(s.final_cost || 0).toFixed(2)} ·
                Anteil €{Number(s.operator_share || 0).toFixed(2)}
              </p>
            </div>
          ))}

          {tab === "revenue" && revenue && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/20">
              <p className="text-xs text-cyan-400/80 uppercase tracking-wider font-semibold mb-2">Lifetime</p>
              <p className="text-4xl font-bold">€{Number(revenue.summary?.total_revenue ?? 0).toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-2">
                Aus {revenue.summary?.session_count ?? 0} Sessions · {Number(revenue.summary?.total_kwh ?? 0).toFixed(2)} kWh
              </p>
            </div>
          )}

          {tab === "payouts" && (
            <>
              <button
                onClick={requestPayout}
                disabled={profile.status !== "active"}
                className="w-full py-3 rounded-xl bg-cyan-500 text-black font-semibold disabled:opacity-50"
                data-testid="ev-op-request-payout"
              >
                Auszahlung anfordern
              </button>
              {payouts.map((p) => (
                <div key={p.payout_id} className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">€{p.amount.toFixed(2)}</p>
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                      p.status === "paid" ? "bg-emerald-500/20 text-emerald-400" :
                      p.status === "approved" ? "bg-blue-500/20 text-blue-400" :
                      p.status === "rejected" ? "bg-red-500/20 text-red-400" :
                      "bg-yellow-500/20 text-yellow-400"
                    }`}>{p.status}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{p.iban}</p>
                  {p.external_ref && <p className="text-[10px] text-emerald-400 mt-1">SEPA-Ref: {p.external_ref}</p>}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, color = "cyan" }) {
  return (
    <div className={`p-4 rounded-2xl bg-${color}-500/10 border border-${color}-500/20`}>
      <p className={`text-[10px] text-${color}-400/80 uppercase tracking-wider font-semibold mb-1`}>{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function RegisterForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({
    company_name: "", contact_email: "", iban: "", address: "", vat_id: "",
  });
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white p-5 max-w-lg mx-auto">
      <button onClick={onCancel} className="text-gray-400 text-sm">← Zurück</button>
      <h1 className="text-2xl font-bold mt-3">Als EV-Betreiber registrieren</h1>
      <p className="text-sm text-gray-400 mt-2">Nach Antrag prüft BidBlitz dein Profil und schaltet dich frei.</p>
      <div className="space-y-3 mt-6">
        {[
          ["company_name", "Firmenname *"],
          ["contact_email", "Kontakt-E-Mail *"],
          ["iban", "IBAN (für Auszahlungen)"],
          ["vat_id", "USt-ID"],
          ["address", "Adresse"],
        ].map(([k, label]) => (
          <div key={k}>
            <label className="text-xs text-gray-400 uppercase tracking-wider">{label}</label>
            <input
              data-testid={`ev-op-register-${k}`}
              value={form[k]}
              onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
              className="w-full mt-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:border-cyan-500"
            />
          </div>
        ))}
        <button
          onClick={() => onSubmit(form)}
          disabled={!form.company_name || !form.contact_email}
          className="w-full mt-3 py-4 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-bold disabled:opacity-50"
          data-testid="ev-op-register-submit"
        >
          Antrag senden
        </button>
      </div>
    </div>
  );
}
