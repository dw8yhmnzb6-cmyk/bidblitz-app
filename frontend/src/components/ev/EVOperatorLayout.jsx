/**
 * EVOperatorLayout — operator dashboard with full feature set.
 * Tabs: Dashboard | Stationen | Sessions | Umsatz | Auszahlungen | Mitarbeiter
 *
 * Features:
 *  - Dashboard stats (stations / sessions / kWh / brutto / commission)
 *  - Stations table with protocol badge + Reset/Unlock for own stations
 *  - Sessions list filterable by status
 *  - Revenue breakdown
 *  - Payouts request + history
 *  - Staff (RFID-Karten) management (add/remove)
 */
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, RotateCcw, Unlock, Power, RefreshCw, UserPlus, Trash2 } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "stations", label: "Meine Stationen" },
  { key: "sessions", label: "Sessions" },
  { key: "revenue", label: "Umsatz" },
  { key: "payouts", label: "Auszahlungen" },
  { key: "staff", label: "Mitarbeiter" },
];

async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, { credentials: "include", ...opts });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || `${r.status}`);
  return r.json();
}

function ProtocolBadge({ protocol }) {
  const is201 = String(protocol || "").startsWith("ocpp2");
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
      is201 ? "bg-purple-500/20 text-purple-300" : "bg-cyan-500/20 text-cyan-300"
    }`}>
      {is201 ? "OCPP 2.0.1" : "OCPP 1.6J"}
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    active: "bg-emerald-500/20 text-emerald-400",
    completed: "bg-emerald-500/20 text-emerald-400",
    pending: "bg-yellow-500/20 text-yellow-400",
    requested: "bg-yellow-500/20 text-yellow-400",
    approved: "bg-blue-500/20 text-blue-400",
    paid: "bg-emerald-500/20 text-emerald-400",
    rejected: "bg-red-500/20 text-red-400",
    suspended: "bg-red-500/20 text-red-400",
    cancelled: "bg-amber-500/20 text-amber-400",
    failed: "bg-red-500/20 text-red-400",
  };
  return (
    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${map[status] || "bg-gray-500/20 text-gray-300"}`}>
      {status || "—"}
    </span>
  );
}

function Tile({ label, value, color = "cyan" }) {
  const map = {
    cyan: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400/80",
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400/80",
    purple: "bg-purple-500/10 border-purple-500/20 text-purple-400/80",
    amber: "bg-amber-500/10 border-amber-500/20 text-amber-400/80",
  };
  return (
    <div className={`p-4 rounded-2xl border ${map[color] || map.cyan}`}>
      <p className="text-[10px] uppercase tracking-wider font-semibold mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function ActionBtn({ onClick, color = "white", icon: Icon, children, disabled }) {
  const map = {
    emerald: "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25",
    red: "bg-red-500/15 text-red-400 hover:bg-red-500/25",
    blue: "bg-blue-500/15 text-blue-400 hover:bg-blue-500/25",
    amber: "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25",
    white: "bg-white/10 text-gray-200 hover:bg-white/20",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-xs px-3 py-1.5 rounded-lg font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 ${map[color]}`}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
    </button>
  );
}

export default function EVOperatorLayout({ defaultTab = "dashboard", onNavigate }) {
  const [tab, setTab] = useState(defaultTab);
  const [profile, setProfile] = useState(null);
  const [stations, setStations] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [revenue, setRevenue] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [showRegister, setShowRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sessionFilter, setSessionFilter] = useState("");
  const [showAddStaff, setShowAddStaff] = useState(false);

  const reload = async () => {
    setBusy(true);
    try {
      const me = await api("/api/ev/operator/me").catch(() => null);
      setProfile(me);
      if (!me) {
        setShowRegister(true);
        return;
      }
      const [st, ss, rv, po, sf] = await Promise.all([
        api("/api/ev/operator/stations"),
        api("/api/ev/operator/sessions"),
        api("/api/ev/operator/revenue"),
        api("/api/ev/operator/payouts"),
        api("/api/ev/operator/staff").catch(() => ({ staff: [] })),
      ]);
      setStations(st.stations || []);
      setSessions(ss.sessions || []);
      setRevenue(rv);
      setPayouts(po.payouts || []);
      setStaff(sf.staff || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
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
    } catch (e) { toast.error(e.message); }
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
    } catch (e) { toast.error(e.message); }
  };

  // Operator station control commands (own stations)
  const cpReset = async (cp) => {
    if (!window.confirm(`Soft-Reset an ${cp.charge_point_id} senden?`)) return;
    try {
      await api(`/api/ev/admin/cp/${cp.charge_point_id}/reset?kind=Soft`, { method: "POST" });
      toast.success("Reset gesendet");
    } catch (e) { toast.error(e.message); }
  };
  const cpUnlock = async (cp) => {
    const c = parseInt(prompt("Connector-ID:", "1") || "0", 10);
    if (!c) return;
    try {
      await api(`/api/ev/admin/cp/${cp.charge_point_id}/unlock/${c}`, { method: "POST" });
      toast.success("Connector entriegelt");
    } catch (e) { toast.error(e.message); }
  };

  // Staff
  const addStaff = async (form) => {
    try {
      await api("/api/ev/operator/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      toast.success("Mitarbeiter hinzugefügt");
      setShowAddStaff(false);
      reload();
    } catch (e) { toast.error(e.message); }
  };

  if (showRegister) {
    return <RegisterForm onSubmit={register} onCancel={() => onNavigate("/")} />;
  }
  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center">
        <p className="text-gray-400">Lade…</p>
      </div>
    );
  }

  const filteredSessions = sessionFilter
    ? sessions.filter((s) => s.status === sessionFilter)
    : sessions;
  const onlineCount = stations.filter((s) => s.online).length;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-20">
      <div className="px-5 pt-12 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate("/")}
            className="text-gray-400 text-sm hover:text-white transition-colors"
            data-testid="ev-op-back"
          >← Zurück</button>
          <button
            onClick={reload}
            disabled={busy}
            className="ml-auto p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50"
            title="Aktualisieren"
            data-testid="ev-op-reload"
          >
            <RefreshCw className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} />
          </button>
        </div>
        <h1 className="text-2xl font-bold mt-3" data-testid="ev-op-company">{profile.company_name}</h1>
        <p className="text-xs text-gray-400 mt-1">
          Status: <span className={profile.status === "active" ? "text-emerald-400" : "text-yellow-400"}>{profile.status}</span>
          {" "}· Provision: {profile.commission_pct == null ? "Default" : `${profile.commission_pct}%`}
          {profile.iban && <> · IBAN {profile.iban}</>}
        </p>

        <div className="flex gap-2 overflow-x-auto mt-5 pb-2 scrollbar-hide">
          {TABS.map((t) => (
            <button
              key={t.key}
              data-testid={`ev-op-tab-${t.key}`}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                tab === t.key
                  ? "bg-cyan-500 text-black"
                  : "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          {/* DASHBOARD ─────────────────────────────────────────────── */}
          {tab === "dashboard" && revenue && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3" data-testid="ev-op-dashboard">
              <Tile label="Stationen" value={stations.length} />
              <Tile label="Online jetzt" value={onlineCount} color="emerald" />
              <Tile label="Aktive Sessions" value={sessions.filter((s) => s.status === "active").length} color="purple" />
              <Tile label="Sessions Total" value={revenue.summary?.session_count ?? 0} />
              <Tile label="kWh" value={Number(revenue.summary?.total_kwh ?? 0).toFixed(1)} color="amber" />
              <Tile label="Brutto-Umsatz" value={`€${Number(revenue.summary?.total_revenue ?? 0).toFixed(2)}`} color="emerald" />
            </div>
          )}

          {/* STATIONS ───────────────────────────────────────────────── */}
          {tab === "stations" && (
            <>
              <p className="text-xs text-gray-500">{stations.length} Stationen · {onlineCount} online</p>
              {stations.length === 0 && (
                <div className="p-8 rounded-2xl bg-white/5 border border-dashed border-white/10 text-center">
                  <p className="text-sm text-gray-400">Noch keine Stationen zugewiesen.</p>
                  <p className="text-xs text-gray-500 mt-1">Kontaktiere BidBlitz Admin zum Onboarding.</p>
                </div>
              )}
              {stations.map((s) => (
                <div key={s.charge_point_id} className="p-4 rounded-2xl bg-white/5 border border-white/10" data-testid={`ev-op-station-${s.charge_point_id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold truncate">{s.name || s.charge_point_id}</p>
                        <ProtocolBadge protocol={s.protocol} />
                        <span className={`text-[10px] font-bold ${s.online ? "text-emerald-400" : "text-gray-500"}`}>
                          {s.online ? "● ONLINE" : "○ OFFLINE"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{s.charge_point_id} · {s.location?.city || "—"}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">Status: {s.status}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <ActionBtn onClick={() => cpReset(s)} color="amber" icon={RotateCcw} disabled={!s.online}>Reset</ActionBtn>
                    <ActionBtn onClick={() => cpUnlock(s)} color="white" icon={Unlock} disabled={!s.online}>Unlock</ActionBtn>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* SESSIONS ───────────────────────────────────────────────── */}
          {tab === "sessions" && (
            <>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {[
                  { v: "", label: "Alle" },
                  { v: "active", label: "Aktiv" },
                  { v: "completed", label: "Abgeschlossen" },
                  { v: "cancelled", label: "Abgebrochen" },
                ].map((f) => (
                  <button
                    key={f.v}
                    onClick={() => setSessionFilter(f.v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                      sessionFilter === f.v ? "bg-cyan-500 text-black" : "bg-white/5 border border-white/10 text-gray-300"
                    }`}
                    data-testid={`ev-op-sess-filter-${f.v || "all"}`}
                  >{f.label}</button>
                ))}
              </div>
              <p className="text-xs text-gray-500">{filteredSessions.length} / {sessions.length}</p>
              {filteredSessions.map((s) => (
                <div key={s.session_id} className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm truncate">{s.session_id}</p>
                        <StatusBadge status={s.status} />
                      </div>
                      <p className="text-xs text-gray-400 mt-1 truncate">
                        {s.charge_point_id} · Stecker {s.connector_id}
                      </p>
                      {s.started_at && (
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {new Date(s.started_at).toLocaleString("de-DE")}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">€{Number(s.final_cost || 0).toFixed(2)}</p>
                      <p className="text-[11px] text-emerald-400">Anteil €{Number(s.operator_share || 0).toFixed(2)}</p>
                      <p className="text-[11px] text-gray-400">{Number(s.kwh_charged || 0).toFixed(2)} kWh</p>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* REVENUE ────────────────────────────────────────────────── */}
          {tab === "revenue" && revenue && (
            <>
              <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/20">
                <p className="text-xs text-cyan-400/80 uppercase tracking-wider font-semibold mb-2">Lifetime Brutto-Umsatz</p>
                <p className="text-4xl font-bold">€{Number(revenue.summary?.total_revenue ?? 0).toFixed(2)}</p>
                <p className="text-xs text-gray-400 mt-2">
                  Aus {revenue.summary?.session_count ?? 0} Sessions · {Number(revenue.summary?.total_kwh ?? 0).toFixed(2)} kWh
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Tile label="Pro Session ⌀" value={`€${revenue.summary?.session_count ? (revenue.summary.total_revenue / revenue.summary.session_count).toFixed(2) : "0.00"}`} />
                <Tile label="Pro kWh ⌀" value={`€${revenue.summary?.total_kwh ? (revenue.summary.total_revenue / revenue.summary.total_kwh).toFixed(2) : "0.00"}`} color="amber" />
              </div>
              <p className="text-[11px] text-gray-500 mt-2">Provision wird beim Settlement automatisch abgezogen. Effektiver Anteil ergibt sich aus deiner aktuellen Provisionsrate.</p>
            </>
          )}

          {/* PAYOUTS ────────────────────────────────────────────────── */}
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
              {payouts.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-6">Noch keine Auszahlungen</p>
              )}
              {payouts.map((p) => (
                <div key={p.payout_id} className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">€{Number(p.amount).toFixed(2)}</p>
                      <p className="text-xs text-gray-400">{p.iban || "—"}</p>
                      {p.requested_at && (
                        <p className="text-[11px] text-gray-500 mt-0.5">{new Date(p.requested_at).toLocaleString("de-DE")}</p>
                      )}
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  {p.external_ref && <p className="text-[10px] text-emerald-400 mt-1">SEPA-Ref: {p.external_ref}</p>}
                </div>
              ))}
            </>
          )}

          {/* STAFF ─────────────────────────────────────────────────── */}
          {tab === "staff" && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">{staff.length} Mitarbeiter / RFID-Karten</p>
                <button
                  onClick={() => setShowAddStaff(true)}
                  className="px-3 py-2 rounded-xl bg-cyan-500 text-black text-xs font-bold flex items-center gap-1.5"
                  data-testid="ev-op-staff-add"
                >
                  <UserPlus className="w-4 h-4" /> Hinzufügen
                </button>
              </div>
              {showAddStaff && (
                <AddStaffForm onSubmit={addStaff} onCancel={() => setShowAddStaff(false)} />
              )}
              {staff.length === 0 && !showAddStaff && (
                <div className="p-8 rounded-2xl bg-white/5 border border-dashed border-white/10 text-center">
                  <p className="text-sm text-gray-400">Noch keine Mitarbeiter eingetragen</p>
                  <p className="text-xs text-gray-500 mt-1">RFID-Karten / E-Mail-Tokens für Ladevorgänge</p>
                </div>
              )}
              {staff.map((s) => (
                <div key={s.id_tag || s.email} className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <p className="font-semibold text-sm">{s.name || s.email || s.id_tag}</p>
                  <p className="text-xs text-gray-400">{s.email} · ID-Tag: {s.id_tag}</p>
                  {s.created_at && (
                    <p className="text-[11px] text-gray-500 mt-0.5">{new Date(s.created_at).toLocaleString("de-DE")}</p>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AddStaffForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({ name: "", email: "", id_tag: "" });
  return (
    <div className="p-5 rounded-2xl bg-cyan-500/5 border border-cyan-500/30">
      <h3 className="text-sm font-bold text-cyan-300 mb-3">Mitarbeiter / RFID-Karte hinzufügen</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input data-testid="staff-name" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm outline-none focus:border-cyan-500" />
        <input data-testid="staff-email" type="email" placeholder="E-Mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm outline-none focus:border-cyan-500" />
        <input data-testid="staff-tag" placeholder="RFID id_tag" value={form.id_tag} onChange={(e) => setForm({ ...form, id_tag: e.target.value })} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm outline-none focus:border-cyan-500" />
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={() => onSubmit(form)} disabled={!form.id_tag} className="flex-1 py-2 rounded-lg bg-cyan-500 text-black text-sm font-bold disabled:opacity-50" data-testid="staff-save">Speichern</button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-white/10 text-sm">Abbrechen</button>
      </div>
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
