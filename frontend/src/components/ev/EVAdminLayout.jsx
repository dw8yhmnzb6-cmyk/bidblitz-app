/**
 * EVAdminLayout — shared admin shell with internal tab routing.
 * The 5 named admin pages (Overview/Operators/HardwareVendors/Tariffs/Payouts)
 * are thin wrappers around this component with a defaultTab prop.
 */
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

const TABS = [
  { key: "overview", label: "Übersicht" },
  { key: "operators", label: "Betreiber" },
  { key: "stations", label: "Stationen" },
  { key: "vendors", label: "Hardware" },
  { key: "tariffs", label: "Tarife" },
  { key: "payouts", label: "Auszahlungen" },
  { key: "sessions", label: "Sessions" },
];

async function apiGet(path) {
  const r = await fetch(`${API}${path}`, { credentials: "include" });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}
async function apiPost(path, body) {
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!r.ok) throw new Error((await r.json()).detail || `${r.status}`);
  return r.json();
}

function StatTile({ label, value, color = "cyan" }) {
  return (
    <div className={`p-4 rounded-2xl bg-${color}-500/10 border border-${color}-500/20`}>
      <p className={`text-[10px] text-${color}-400/80 uppercase tracking-wider font-semibold mb-1`}>{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

export default function EVAdminLayout({ defaultTab = "overview", onNavigate }) {
  const [tab, setTab] = useState(defaultTab);
  const [overview, setOverview] = useState(null);
  const [operators, setOperators] = useState([]);
  const [stations, setStations] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [tariffs, setTariffs] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [sessions, setSessions] = useState([]);

  const reload = async () => {
    try {
      const [ov, op, st, ve, ta, po, se] = await Promise.all([
        apiGet("/api/ev/admin/overview"),
        apiGet("/api/ev/admin/operators"),
        apiGet("/api/ev/admin/charge-points"),
        apiGet("/api/ev/admin/hardware-vendors"),
        apiGet("/api/ev/admin/tariffs"),
        apiGet("/api/ev/admin/payouts"),
        apiGet("/api/ev/admin/sessions"),
      ]);
      setOverview(ov);
      setOperators(op.operators || []);
      setStations(st.charge_points || []);
      setVendors(ve.vendors || []);
      setTariffs(ta.tariffs || []);
      setPayouts(po.payouts || []);
      setSessions(se.sessions || []);
    } catch (e) {
      toast.error(`Daten laden fehlgeschlagen: ${e.message}`);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const setOpStatus = async (operator_id, status) => {
    try {
      await apiPost(`/api/ev/admin/operators/${operator_id}/status`, { status });
      toast.success(`Betreiber → ${status}`);
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const setOpCommission = async (operator_id) => {
    const pct = prompt("Provision in % (0-50):");
    if (pct === null) return;
    try {
      await apiPost(`/api/ev/admin/operators/${operator_id}/commission`,
                    { commission_pct: parseFloat(pct) });
      toast.success("Provision aktualisiert");
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const decidePayout = async (payout_id, decision) => {
    try {
      await apiPost(`/api/ev/admin/payouts/${payout_id}/decision`, { decision });
      toast.success(`Auszahlung → ${decision}`);
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <div className="px-5 pt-12 pb-6 max-w-5xl mx-auto">
        <button onClick={() => onNavigate("/")} className="text-gray-400 text-sm" data-testid="ev-admin-back">← Zurück</button>
        <h1 className="text-2xl font-bold mt-3">EV Charging — Admin</h1>

        <div className="flex gap-2 overflow-x-auto mt-5 pb-2 scrollbar-hide">
          {TABS.map((t) => (
            <button
              key={t.key}
              data-testid={`ev-admin-tab-${t.key}`}
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
          {tab === "overview" && overview && (
            <div className="grid grid-cols-2 gap-3" data-testid="ev-admin-overview">
              <StatTile label="Stationen" value={overview.charge_points} />
              <StatTile label="Online" value={overview.online} color="emerald" />
              <StatTile label="Aktiv jetzt" value={overview.active_sessions} color="purple" />
              <StatTile label="Heute beendet" value={overview.sessions_today} />
              <StatTile label="Lifetime Umsatz" value={`€${overview.lifetime_revenue_eur.toFixed(2)}`} color="emerald" />
              <StatTile label="Lifetime kWh" value={`${overview.lifetime_kwh.toFixed(1)}`} />
            </div>
          )}

          {tab === "operators" && operators.map((op) => (
            <div key={op.operator_id} className="p-4 rounded-2xl bg-white/5 border border-white/10" data-testid={`ev-operator-${op.operator_id}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{op.company_name}</p>
                  <p className="text-xs text-gray-400">{op.user_email} · {op.iban || "ohne IBAN"}</p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Provision: {op.commission_pct == null ? "Default 12%" : `${op.commission_pct}%`}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                  op.status === "active" ? "bg-emerald-500/20 text-emerald-400" :
                  op.status === "suspended" ? "bg-red-500/20 text-red-400" :
                  "bg-yellow-500/20 text-yellow-400"
                }`}>{op.status}</span>
              </div>
              <div className="flex gap-2 mt-3 flex-wrap">
                {op.status !== "active" && (
                  <button onClick={() => setOpStatus(op.operator_id, "active")} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">Freigeben</button>
                )}
                {op.status !== "suspended" && (
                  <button onClick={() => setOpStatus(op.operator_id, "suspended")} className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400">Sperren</button>
                )}
                <button onClick={() => setOpCommission(op.operator_id)} className="text-xs px-3 py-1.5 rounded-lg bg-white/10">Provision setzen</button>
              </div>
            </div>
          ))}

          {tab === "stations" && stations.map((s) => (
            <div key={s.charge_point_id} className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <p className="font-semibold">{s.name || s.charge_point_id}</p>
              <p className="text-xs text-gray-400">{s.charge_point_id} · {s.location?.city}</p>
              <p className="text-[11px] text-gray-500 mt-1">
                {s.online_now ? "🟢 online" : "⚪️ offline"} · Status: {s.status}
              </p>
            </div>
          ))}

          {tab === "vendors" && vendors.map((v) => (
            <div key={v.vendor_id} className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <p className="font-semibold">{v.name}</p>
              <p className="text-xs text-gray-400">OCPP: {(v.ocpp_versions || []).join(", ")}</p>
              {v.contact_email && <p className="text-[11px] text-gray-500 mt-1">{v.contact_email}</p>}
            </div>
          ))}

          {tab === "tariffs" && tariffs.map((t) => (
            <div key={t.tariff_id} className="p-4 rounded-2xl bg-white/5 border border-white/10" data-testid={`ev-tariff-${t.tariff_id}`}>
              <p className="font-semibold">{t.name}</p>
              <p className="text-xs text-gray-400">
                €{Number(t.price_per_kwh).toFixed(2)}/kWh · €{Number(t.session_fee || 0).toFixed(2)} Sess.
                · MwSt {t.vat_rate ?? 19}%
              </p>
            </div>
          ))}

          {tab === "payouts" && payouts.map((p) => (
            <div key={p.payout_id} className="p-4 rounded-2xl bg-white/5 border border-white/10" data-testid={`ev-payout-${p.payout_id}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">€{p.amount.toFixed(2)}</p>
                  <p className="text-xs text-gray-400">{p.iban} · Op {p.operator_id}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                  p.status === "paid" ? "bg-emerald-500/20 text-emerald-400" :
                  p.status === "approved" ? "bg-blue-500/20 text-blue-400" :
                  p.status === "rejected" ? "bg-red-500/20 text-red-400" :
                  "bg-yellow-500/20 text-yellow-400"
                }`}>{p.status}</span>
              </div>
              {p.status === "requested" && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => decidePayout(p.payout_id, "approved")} className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400">Genehmigen</button>
                  <button onClick={() => decidePayout(p.payout_id, "rejected")} className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400">Ablehnen</button>
                </div>
              )}
              {p.status === "approved" && (
                <button onClick={() => decidePayout(p.payout_id, "paid")} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 mt-3">Als bezahlt markieren</button>
              )}
            </div>
          ))}

          {tab === "sessions" && sessions.map((s) => (
            <div key={s.session_id} className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex justify-between">
                <p className="font-semibold">{s.session_id}</p>
                <span className="text-[10px] text-gray-500">{s.status}</span>
              </div>
              <p className="text-xs text-gray-400">{s.charge_point_id} · {Number(s.kwh_charged || 0).toFixed(2)} kWh · €{Number(s.final_cost || s.current_cost || 0).toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
