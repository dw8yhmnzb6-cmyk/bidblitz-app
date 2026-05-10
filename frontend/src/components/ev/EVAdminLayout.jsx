/**
 * EVAdminLayout — Admin shell with full CRUD + OCPP control commands.
 * Tabs: Übersicht | Betreiber | Stationen | Hardware | Tarife | Auszahlungen | Sessions
 *
 * Features:
 *  - Live stats (total/online v1.6/online v2.0.1, active sessions, lifetime revenue)
 *  - Operators: status freigeben/sperren + commission-override
 *  - Stations table with protocol badge + Reset/Unlock/Availability + (2.0.1) Trigger
 *  - Hardware vendors & charge-points & tariffs CRUD inline
 *  - Payouts approval flow
 *  - Sessions filter (status)
 */
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, RotateCcw, Unlock, Power, Zap, FileSearch, RefreshCw } from "lucide-react";

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
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || `${r.status}`);
  return data;
}
async function apiPut(path, body) {
  const r = await fetch(`${API}${path}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || `${r.status}`);
  return data;
}

function StatTile({ label, value, color = "cyan", testid }) {
  const colorMap = {
    cyan: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400/80",
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400/80",
    purple: "bg-purple-500/10 border-purple-500/20 text-purple-400/80",
    amber: "bg-amber-500/10 border-amber-500/20 text-amber-400/80",
  };
  return (
    <div className={`p-4 rounded-2xl border ${colorMap[color] || colorMap.cyan}`} data-testid={testid}>
      <p className="text-[10px] uppercase tracking-wider font-semibold mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function ProtocolBadge({ protocol }) {
  const is201 = String(protocol || "").startsWith("ocpp2");
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
      is201 ? "bg-purple-500/20 text-purple-300" : "bg-cyan-500/20 text-cyan-300"
    }`} data-testid="ev-protocol-badge">
      {is201 ? "OCPP 2.0.1" : "OCPP 1.6J"}
    </span>
  );
}

function StatusBadge({ status, kind = "session" }) {
  const map = {
    active: "bg-emerald-500/20 text-emerald-400",
    Available: "bg-emerald-500/20 text-emerald-400",
    Charging: "bg-cyan-500/20 text-cyan-300",
    Occupied: "bg-cyan-500/20 text-cyan-300",
    completed: "bg-emerald-500/20 text-emerald-400",
    suspended: "bg-red-500/20 text-red-400",
    Faulted: "bg-red-500/20 text-red-400",
    cancelled: "bg-amber-500/20 text-amber-400",
    rejected: "bg-red-500/20 text-red-400",
    failed: "bg-red-500/20 text-red-400",
    pending: "bg-yellow-500/20 text-yellow-400",
    requested: "bg-yellow-500/20 text-yellow-400",
    approved: "bg-blue-500/20 text-blue-400",
    paid: "bg-emerald-500/20 text-emerald-400",
  };
  return (
    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${map[status] || "bg-gray-500/20 text-gray-300"}`}>
      {status || "—"}
    </span>
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
  const [sessionFilter, setSessionFilter] = useState("");
  const [stationSearch, setStationSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(null); // 'vendor'|'station'|'tariff'

  const reload = async () => {
    setBusy(true);
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
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { reload(); }, []);

  // ─── Operators ─────────────────────────────────────────────────────────────
  const setOpStatus = async (operator_id, status) => {
    try {
      await apiPost(`/api/ev/admin/operators/${operator_id}/status`, { status });
      toast.success(`Betreiber → ${status}`);
      reload();
    } catch (e) { toast.error(e.message); }
  };
  const setOpCommission = async (operator_id) => {
    const pct = prompt("Provision in % (0-50):");
    if (pct === null) return;
    try {
      await apiPost(`/api/ev/admin/operators/${operator_id}/commission`, { commission_pct: parseFloat(pct) });
      toast.success("Provision aktualisiert");
      reload();
    } catch (e) { toast.error(e.message); }
  };

  // ─── Payouts ───────────────────────────────────────────────────────────────
  const decidePayout = async (payout_id, decision) => {
    try {
      await apiPost(`/api/ev/admin/payouts/${payout_id}/decision`, { decision });
      toast.success(`Auszahlung → ${decision}`);
      reload();
    } catch (e) { toast.error(e.message); }
  };

  // ─── Stations OCPP control ────────────────────────────────────────────────
  const cpReset = async (cp, kind = "Soft") => {
    if (!window.confirm(`Reset (${kind}) an ${cp.charge_point_id} senden?`)) return;
    try {
      await apiPost(`/api/ev/admin/cp/${cp.charge_point_id}/reset?kind=${kind}`, {});
      toast.success("Reset gesendet");
    } catch (e) { toast.error(e.message); }
  };
  const cpUnlock = async (cp) => {
    const c = parseInt(prompt("Connector-ID zum Entriegeln:", "1") || "0", 10);
    if (!c) return;
    try {
      await apiPost(`/api/ev/admin/cp/${cp.charge_point_id}/unlock/${c}`, {});
      toast.success("Connector entriegelt");
    } catch (e) { toast.error(e.message); }
  };
  const cpAvailability = async (cp, mode) => {
    try {
      await apiPost(`/api/ev/admin/cp/${cp.charge_point_id}/availability?mode=${mode}`, {});
      toast.success(`→ ${mode}`);
      reload();
    } catch (e) { toast.error(e.message); }
  };
  const cpTrigger = async (cp) => {
    const messages = ["Heartbeat", "BootNotification", "StatusNotification", "MeterValues"];
    const m = prompt(`Trigger Message [${messages.join("/")}]:`, "Heartbeat");
    if (!m || !messages.includes(m)) return;
    try {
      await apiPost(`/api/ev/admin/cp/${cp.charge_point_id}/v201/trigger`, { requestedMessage: m });
      toast.success(`TriggerMessage(${m}) gesendet`);
    } catch (e) { toast.error(e.message); }
  };

  // ─── Filters ───────────────────────────────────────────────────────────────
  const filteredStations = stations.filter((s) => {
    if (!stationSearch) return true;
    const q = stationSearch.toLowerCase();
    return (s.charge_point_id || "").toLowerCase().includes(q) ||
           (s.name || "").toLowerCase().includes(q) ||
           (s.location?.city || "").toLowerCase().includes(q);
  });
  const filteredSessions = sessionFilter
    ? sessions.filter((s) => s.status === sessionFilter)
    : sessions;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-20">
      <div className="px-5 pt-12 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate("/")}
            className="text-gray-400 text-sm hover:text-white transition-colors"
            data-testid="ev-admin-back"
          >← Zurück</button>
          <button
            onClick={reload}
            disabled={busy}
            className="ml-auto p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50"
            data-testid="ev-admin-reload"
            title="Aktualisieren"
          >
            <RefreshCw className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} />
          </button>
        </div>
        <h1 className="text-2xl font-bold mt-3">EV Charging — Admin</h1>

        <div className="flex gap-2 overflow-x-auto mt-5 pb-2 scrollbar-hide">
          {TABS.map((t) => (
            <button
              key={t.key}
              data-testid={`ev-admin-tab-${t.key}`}
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
          {/* OVERVIEW ─────────────────────────────────────────────────────── */}
          {tab === "overview" && overview && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3" data-testid="ev-admin-overview">
                <StatTile label="Stationen" value={overview.charge_points} testid="stat-cp" />
                <StatTile label="Online (Total)" value={overview.online} color="emerald" testid="stat-online" />
                <StatTile label="Aktiv jetzt" value={overview.active_sessions} color="purple" testid="stat-active" />
                <StatTile label="Online OCPP 1.6" value={overview.online_v16 ?? 0} color="cyan" />
                <StatTile label="Online OCPP 2.0.1" value={overview.online_v201 ?? 0} color="purple" />
                <StatTile label="Heute beendet" value={overview.sessions_today} color="amber" />
                <StatTile label="Lifetime Umsatz" value={`€${Number(overview.lifetime_revenue_eur || 0).toFixed(2)}`} color="emerald" />
                <StatTile label="Lifetime kWh" value={`${Number(overview.lifetime_kwh || 0).toFixed(1)}`} />
                <StatTile label="Offene Auszahlungen" value={payouts.filter((p) => p.status === "requested").length} color="amber" />
              </div>
            </>
          )}

          {/* OPERATORS ────────────────────────────────────────────────────── */}
          {tab === "operators" && (
            <>
              <p className="text-xs text-gray-500">{operators.length} Betreiber registriert</p>
              {operators.length === 0 && <EmptyState text="Noch keine Betreiber registriert" />}
              {operators.map((op) => (
                <div key={op.operator_id} className="p-4 rounded-2xl bg-white/5 border border-white/10" data-testid={`ev-operator-${op.operator_id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{op.company_name}</p>
                      <p className="text-xs text-gray-400 truncate">{op.user_email} · {op.iban || "ohne IBAN"}</p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Provision: {op.commission_pct == null ? "Default 12%" : `${op.commission_pct}%`}
                        {op.vat_id && <> · USt-ID: {op.vat_id}</>}
                      </p>
                    </div>
                    <StatusBadge status={op.status} />
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {op.status !== "active" && (
                      <ActionBtn onClick={() => setOpStatus(op.operator_id, "active")} color="emerald">Freigeben</ActionBtn>
                    )}
                    {op.status !== "suspended" && (
                      <ActionBtn onClick={() => setOpStatus(op.operator_id, "suspended")} color="red">Sperren</ActionBtn>
                    )}
                    <ActionBtn onClick={() => setOpCommission(op.operator_id)} color="white">Provision</ActionBtn>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* STATIONS — table view + control commands ────────────────────── */}
          {tab === "stations" && (
            <>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Suche ID / Name / Stadt"
                  value={stationSearch}
                  onChange={(e) => setStationSearch(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-cyan-500"
                  data-testid="ev-station-search"
                />
                <button
                  onClick={() => setShowCreate("station")}
                  className="px-3 py-2 rounded-xl bg-cyan-500 text-black text-xs font-bold flex items-center gap-1.5"
                  data-testid="ev-station-add"
                >
                  <Plus className="w-4 h-4" /> Neu
                </button>
              </div>
              <p className="text-xs text-gray-500">{filteredStations.length} / {stations.length} Stationen</p>
              {showCreate === "station" && (
                <CreateStationForm
                  vendors={vendors}
                  tariffs={tariffs}
                  operators={operators}
                  onClose={() => setShowCreate(null)}
                  onSaved={() => { setShowCreate(null); reload(); }}
                />
              )}
              {filteredStations.length === 0 && !showCreate && (
                <EmptyState text="Keine Stationen — füge eine neue hinzu" />
              )}
              {filteredStations.map((s) => (
                <div key={s.charge_point_id} className="p-4 rounded-2xl bg-white/5 border border-white/10" data-testid={`ev-station-${s.charge_point_id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold truncate">{s.name || s.charge_point_id}</p>
                        <ProtocolBadge protocol={s.protocol} />
                        <span className={`text-[10px] font-bold ${s.online_now ? "text-emerald-400" : "text-gray-500"}`}>
                          {s.online_now ? "● ONLINE" : "○ OFFLINE"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 truncate">
                        {s.charge_point_id} · {s.location?.city || "—"}
                        {s.vendor && <> · {s.vendor} {s.model || ""}</>}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Status: {s.status || "—"}
                        {s.last_heartbeat && <> · letzte Aktivität: {new Date(s.last_heartbeat).toLocaleString("de-DE")}</>}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <ActionBtn onClick={() => cpReset(s, "Soft")} color="amber" icon={RotateCcw}>Soft Reset</ActionBtn>
                    <ActionBtn onClick={() => cpReset(s, "Hard")} color="red" icon={RotateCcw}>Hard Reset</ActionBtn>
                    <ActionBtn onClick={() => cpUnlock(s)} color="white" icon={Unlock}>Unlock</ActionBtn>
                    <ActionBtn onClick={() => cpAvailability(s, "Operative")} color="emerald" icon={Power}>Aktiv</ActionBtn>
                    <ActionBtn onClick={() => cpAvailability(s, "Inoperative")} color="red" icon={Power}>Wartung</ActionBtn>
                    {String(s.protocol || "").startsWith("ocpp2") && (
                      <ActionBtn onClick={() => cpTrigger(s)} color="purple" icon={Zap}>Trigger</ActionBtn>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* VENDORS ──────────────────────────────────────────────────────── */}
          {tab === "vendors" && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">{vendors.length} Hardware-Hersteller</p>
                <button
                  onClick={() => setShowCreate("vendor")}
                  className="px-3 py-2 rounded-xl bg-cyan-500 text-black text-xs font-bold flex items-center gap-1.5"
                  data-testid="ev-vendor-add"
                >
                  <Plus className="w-4 h-4" /> Hersteller
                </button>
              </div>
              {showCreate === "vendor" && (
                <CreateVendorForm
                  onClose={() => setShowCreate(null)}
                  onSaved={() => { setShowCreate(null); reload(); }}
                />
              )}
              {vendors.length === 0 && !showCreate && (
                <EmptyState text="Keine Hersteller registriert" />
              )}
              {vendors.map((v) => (
                <div key={v.vendor_id} className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <p className="font-semibold">{v.name}</p>
                  <p className="text-xs text-gray-400">OCPP: {(v.ocpp_versions || []).join(", ") || "—"}</p>
                  {v.contact_email && <p className="text-[11px] text-gray-500 mt-1">{v.contact_email}</p>}
                  {v.website && (
                    <a href={v.website} target="_blank" rel="noopener noreferrer" className="text-[11px] text-cyan-400 hover:underline">
                      {v.website}
                    </a>
                  )}
                </div>
              ))}
            </>
          )}

          {/* TARIFFS ──────────────────────────────────────────────────────── */}
          {tab === "tariffs" && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">{tariffs.length} Tarife</p>
                <button
                  onClick={() => setShowCreate("tariff")}
                  className="px-3 py-2 rounded-xl bg-cyan-500 text-black text-xs font-bold flex items-center gap-1.5"
                  data-testid="ev-tariff-add"
                >
                  <Plus className="w-4 h-4" /> Tarif
                </button>
              </div>
              {showCreate === "tariff" && (
                <CreateTariffForm
                  onClose={() => setShowCreate(null)}
                  onSaved={() => { setShowCreate(null); reload(); }}
                />
              )}
              {tariffs.length === 0 && !showCreate && (
                <EmptyState text="Keine Tarife angelegt" />
              )}
              {tariffs.map((t) => (
                <div key={t.tariff_id} className="p-4 rounded-2xl bg-white/5 border border-white/10" data-testid={`ev-tariff-${t.tariff_id}`}>
                  <p className="font-semibold">{t.name}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    €{Number(t.price_per_kwh).toFixed(2)}/kWh
                    {t.price_per_minute > 0 && <> · €{Number(t.price_per_minute).toFixed(3)}/min</>}
                    · Sess. €{Number(t.session_fee || 0).toFixed(2)}
                    · MwSt {t.vat_rate ?? 19}%
                  </p>
                  {t.minimum_fee > 0 && (
                    <p className="text-[11px] text-gray-500 mt-1">Min. €{Number(t.minimum_fee).toFixed(2)}</p>
                  )}
                </div>
              ))}
            </>
          )}

          {/* PAYOUTS ──────────────────────────────────────────────────────── */}
          {tab === "payouts" && (
            <>
              <p className="text-xs text-gray-500">{payouts.length} Auszahlungen</p>
              {payouts.length === 0 && <EmptyState text="Keine Auszahlungsanträge" />}
              {payouts.map((p) => (
                <div key={p.payout_id} className="p-4 rounded-2xl bg-white/5 border border-white/10" data-testid={`ev-payout-${p.payout_id}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-lg">€{Number(p.amount || 0).toFixed(2)}</p>
                      <p className="text-xs text-gray-400">{p.iban || "—"} · Op {p.operator_id}</p>
                      {p.requested_at && <p className="text-[11px] text-gray-500 mt-0.5">{new Date(p.requested_at).toLocaleString("de-DE")}</p>}
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  {p.status === "requested" && (
                    <div className="flex gap-2 mt-3">
                      <ActionBtn onClick={() => decidePayout(p.payout_id, "approved")} color="blue">Genehmigen</ActionBtn>
                      <ActionBtn onClick={() => decidePayout(p.payout_id, "rejected")} color="red">Ablehnen</ActionBtn>
                    </div>
                  )}
                  {p.status === "approved" && (
                    <ActionBtn onClick={() => decidePayout(p.payout_id, "paid")} color="emerald">Als bezahlt markieren</ActionBtn>
                  )}
                </div>
              ))}
            </>
          )}

          {/* SESSIONS — filterable list ────────────────────────────────── */}
          {tab === "sessions" && (
            <>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {[
                  { v: "", label: "Alle" },
                  { v: "active", label: "Aktiv" },
                  { v: "completed", label: "Abgeschlossen" },
                  { v: "stopping", label: "Stop läuft" },
                  { v: "cancelled", label: "Abgebrochen" },
                  { v: "failed", label: "Fehler" },
                ].map((f) => (
                  <button
                    key={f.v}
                    onClick={() => setSessionFilter(f.v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                      sessionFilter === f.v ? "bg-cyan-500 text-black" : "bg-white/5 border border-white/10 text-gray-300"
                    }`}
                    data-testid={`ev-session-filter-${f.v || "all"}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500">{filteredSessions.length} / {sessions.length} Sessions</p>
              {filteredSessions.length === 0 && <EmptyState text="Keine Sessions gefunden" />}
              {filteredSessions.map((s) => (
                <div key={s.session_id} className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm truncate">{s.session_id}</p>
                        <StatusBadge status={s.status} />
                      </div>
                      <p className="text-xs text-gray-400 mt-1 truncate">
                        {s.charge_point_id} · Stecker {s.connector_id} · {s.user_email || s.id_tag || "—"}
                      </p>
                      {s.started_at && (
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {new Date(s.started_at).toLocaleString("de-DE")}
                          {s.duration_min && <> · {Math.round(s.duration_min)} Min</>}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-cyan-400">€{Number(s.final_cost || s.current_cost || 0).toFixed(2)}</p>
                      <p className="text-xs text-gray-400">{Number(s.kwh_charged || 0).toFixed(2)} kWh</p>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────
function EmptyState({ text }) {
  return (
    <div className="p-8 rounded-2xl bg-white/5 border border-dashed border-white/10 text-center">
      <FileSearch className="w-8 h-8 text-gray-500 mx-auto mb-2" />
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  );
}

function ActionBtn({ onClick, color = "white", icon: Icon, children }) {
  const map = {
    emerald: "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25",
    red: "bg-red-500/15 text-red-400 hover:bg-red-500/25",
    blue: "bg-blue-500/15 text-blue-400 hover:bg-blue-500/25",
    purple: "bg-purple-500/15 text-purple-400 hover:bg-purple-500/25",
    amber: "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25",
    cyan: "bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25",
    white: "bg-white/10 text-gray-200 hover:bg-white/20",
  };
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-lg font-semibold inline-flex items-center gap-1.5 transition-colors ${map[color]}`}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
    </button>
  );
}

// ── Create forms ───────────────────────────────────────────────────────────
function FormShell({ title, onClose, children }) {
  return (
    <div className="p-5 rounded-2xl bg-cyan-500/5 border border-cyan-500/30">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-cyan-300">{title}</h3>
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-white">✕ Schließen</button>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">{label}</span>
      {children}
    </label>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white outline-none focus:border-cyan-500"
    />
  );
}

function Select({ children, ...props }) {
  return (
    <select
      {...props}
      className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white outline-none focus:border-cyan-500"
    >
      {children}
    </select>
  );
}

function CreateVendorForm({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: "", contact_email: "", website: "", ocpp_versions: ["1.6"] });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!form.name) return toast.error("Name fehlt");
    setBusy(true);
    try {
      await apiPost("/api/ev/admin/hardware-vendors", form);
      toast.success("Hersteller angelegt");
      onSaved();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <FormShell title="Neuen Hersteller anlegen" onClose={onClose}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Name *"><Input data-testid="vendor-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Kontakt-E-Mail"><Input data-testid="vendor-email" type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></Field>
        <Field label="Website"><Input data-testid="vendor-website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></Field>
        <Field label="OCPP-Versionen (komma)">
          <Input data-testid="vendor-ocpp" value={form.ocpp_versions.join(",")} onChange={(e) => setForm({ ...form, ocpp_versions: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
        </Field>
      </div>
      <button onClick={submit} disabled={busy} className="mt-4 w-full py-2.5 rounded-xl bg-cyan-500 text-black font-bold text-sm disabled:opacity-50" data-testid="vendor-save">
        {busy ? "Speichern…" : "Anlegen"}
      </button>
    </FormShell>
  );
}

function CreateStationForm({ vendors, tariffs, operators, onClose, onSaved }) {
  const [form, setForm] = useState({
    charge_point_id: "",
    name: "",
    vendor_id: "",
    tariff_id: "",
    operator_user_id: "",
    protocol: "ocpp1.6",
    location: { city: "", street: "", lat: "", lng: "" },
    connectors: [{ connector_id: 1, type: "Type2", max_power_kw: 22 }],
  });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!form.charge_point_id || !form.name) return toast.error("ID und Name nötig");
    setBusy(true);
    try {
      const body = {
        ...form,
        location: {
          ...form.location,
          lat: form.location.lat ? parseFloat(form.location.lat) : null,
          lng: form.location.lng ? parseFloat(form.location.lng) : null,
        },
      };
      await apiPost("/api/ev/admin/charge-points", body);
      toast.success("Station angelegt");
      onSaved();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <FormShell title="Neue Ladestation anlegen" onClose={onClose}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Charge-Point ID *"><Input data-testid="cp-id" value={form.charge_point_id} onChange={(e) => setForm({ ...form, charge_point_id: e.target.value })} placeholder="CP-DE-001" /></Field>
        <Field label="Name *"><Input data-testid="cp-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Hersteller">
          <Select data-testid="cp-vendor" value={form.vendor_id} onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}>
            <option value="">— wählen —</option>
            {vendors.map((v) => <option key={v.vendor_id} value={v.vendor_id}>{v.name}</option>)}
          </Select>
        </Field>
        <Field label="Tarif">
          <Select data-testid="cp-tariff" value={form.tariff_id} onChange={(e) => setForm({ ...form, tariff_id: e.target.value })}>
            <option value="">— wählen —</option>
            {tariffs.map((t) => <option key={t.tariff_id} value={t.tariff_id}>{t.name} (€{Number(t.price_per_kwh).toFixed(2)}/kWh)</option>)}
          </Select>
        </Field>
        <Field label="Betreiber">
          <Select data-testid="cp-operator" value={form.operator_user_id} onChange={(e) => setForm({ ...form, operator_user_id: e.target.value })}>
            <option value="">— Plattform —</option>
            {operators.filter((o) => o.status === "active").map((o) => <option key={o.operator_id} value={o.user_id}>{o.company_name}</option>)}
          </Select>
        </Field>
        <Field label="OCPP Protokoll">
          <Select data-testid="cp-protocol" value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value })}>
            <option value="ocpp1.6">OCPP 1.6J</option>
            <option value="ocpp2.0.1">OCPP 2.0.1</option>
          </Select>
        </Field>
        <Field label="Stadt"><Input data-testid="cp-city" value={form.location.city} onChange={(e) => setForm({ ...form, location: { ...form.location, city: e.target.value } })} /></Field>
        <Field label="Straße"><Input data-testid="cp-street" value={form.location.street} onChange={(e) => setForm({ ...form, location: { ...form.location, street: e.target.value } })} /></Field>
        <Field label="Latitude"><Input data-testid="cp-lat" value={form.location.lat} onChange={(e) => setForm({ ...form, location: { ...form.location, lat: e.target.value } })} placeholder="52.5200" /></Field>
        <Field label="Longitude"><Input data-testid="cp-lng" value={form.location.lng} onChange={(e) => setForm({ ...form, location: { ...form.location, lng: e.target.value } })} placeholder="13.4050" /></Field>
      </div>
      <button onClick={submit} disabled={busy} className="mt-4 w-full py-2.5 rounded-xl bg-cyan-500 text-black font-bold text-sm disabled:opacity-50" data-testid="cp-save">
        {busy ? "Speichern…" : "Anlegen"}
      </button>
    </FormShell>
  );
}

function CreateTariffForm({ onClose, onSaved }) {
  const [form, setForm] = useState({
    name: "",
    currency: "EUR",
    price_per_kwh: 0.45,
    price_per_minute: 0,
    session_fee: 0.5,
    idle_fee_per_minute: 0,
    minimum_fee: 0,
    vat_rate: 19,
  });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!form.name) return toast.error("Name fehlt");
    setBusy(true);
    try {
      await apiPost("/api/ev/admin/tariffs", {
        ...form,
        price_per_kwh: parseFloat(form.price_per_kwh),
        price_per_minute: parseFloat(form.price_per_minute),
        session_fee: parseFloat(form.session_fee),
        idle_fee_per_minute: parseFloat(form.idle_fee_per_minute),
        minimum_fee: parseFloat(form.minimum_fee),
        vat_rate: parseFloat(form.vat_rate),
      });
      toast.success("Tarif angelegt");
      onSaved();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <FormShell title="Neuen Tarif anlegen" onClose={onClose}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Name *"><Input data-testid="tariff-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Standard 22 kW" /></Field>
        <Field label="Währung">
          <Select data-testid="tariff-currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
            <option>EUR</option><option>CHF</option><option>USD</option>
          </Select>
        </Field>
        <Field label="€ pro kWh *"><Input data-testid="tariff-kwh" type="number" step="0.001" value={form.price_per_kwh} onChange={(e) => setForm({ ...form, price_per_kwh: e.target.value })} /></Field>
        <Field label="€ pro Minute"><Input data-testid="tariff-min" type="number" step="0.001" value={form.price_per_minute} onChange={(e) => setForm({ ...form, price_per_minute: e.target.value })} /></Field>
        <Field label="Session-Gebühr"><Input data-testid="tariff-sess" type="number" step="0.01" value={form.session_fee} onChange={(e) => setForm({ ...form, session_fee: e.target.value })} /></Field>
        <Field label="Idle-Gebühr/min"><Input data-testid="tariff-idle" type="number" step="0.01" value={form.idle_fee_per_minute} onChange={(e) => setForm({ ...form, idle_fee_per_minute: e.target.value })} /></Field>
        <Field label="Mindestgebühr"><Input data-testid="tariff-min-fee" type="number" step="0.01" value={form.minimum_fee} onChange={(e) => setForm({ ...form, minimum_fee: e.target.value })} /></Field>
        <Field label="MwSt %"><Input data-testid="tariff-vat" type="number" step="0.1" value={form.vat_rate} onChange={(e) => setForm({ ...form, vat_rate: e.target.value })} /></Field>
      </div>
      <button onClick={submit} disabled={busy} className="mt-4 w-full py-2.5 rounded-xl bg-cyan-500 text-black font-bold text-sm disabled:opacity-50" data-testid="tariff-save">
        {busy ? "Speichern…" : "Anlegen"}
      </button>
    </FormShell>
  );
}
