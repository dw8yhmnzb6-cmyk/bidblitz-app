/**
 * MerchantQrTablesPage
 * --------------------
 * Merchant control panel for QR-Tisch-Bestellung:
 *  1. QR-Einstellungen (instant/waiter, scopes food/drinks)
 *  2. Tische verwalten + drucken (rotierende Tokens, QR-PNG via qrcode.react)
 *  3. Live-Bestellungen — pending/accepted/completed, Accept/Reject/Complete
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { motion } from "framer-motion";
import {
  ArrowLeft, RefreshCw, Printer, Check, X as XIcon, Plus, RotateCw, Settings, ListChecks,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const credJson = { credentials: "include", headers: { "Content-Type": "application/json" } };
const cred = { credentials: "include" };

async function readJson(res) { try { return await res.json(); } catch { return null; } }

const tabs = [
  { id: "tables", label: "Tische", icon: <ListChecks size={14} /> },
  { id: "orders", label: "Bestellungen", icon: <RefreshCw size={14} /> },
  { id: "settings", label: "Einstellungen", icon: <Settings size={14} /> },
];

export default function MerchantQrTablesPage({ onBack, user }) {
  const merchantId =
    user?.merchant_id ||
    user?.user_id ||
    user?.id ||
    (typeof window !== "undefined" ? localStorage.getItem("bb_merchant_id") : null) ||
    "";

  const [tab, setTab] = useState("tables");
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState({
    acceptance_mode: "instant",
    scopes: ["food", "drinks"],
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [newTable, setNewTable] = useState({ label: "", capacity: 4 });

  const loadTables = useCallback(async () => {
    if (!merchantId) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`${API}/api/merchant/qr-tables/${merchantId}`, cred);
      const data = await readJson(res);
      if (res.ok) setTables(data?.tables || []);
      else setErr(data?.detail || "Fehler beim Laden der Tische");
    } finally { setLoading(false); }
  }, [merchantId]);

  const loadOrders = useCallback(async () => {
    if (!merchantId) return;
    const res = await fetch(`${API}/api/merchant/qr-orders/${merchantId}?limit=200`, cred);
    const data = await readJson(res);
    if (res.ok) setOrders(data?.orders || []);
  }, [merchantId]);

  const loadSettings = useCallback(async () => {
    // We don't have a GET endpoint — derive from /resolve if any table exists, else keep defaults.
    // Safe no-op for now; values are upserted via POST /qr-settings.
  }, []);

  useEffect(() => { loadTables(); }, [loadTables]);
  useEffect(() => {
    if (tab !== "orders") return;
    loadOrders();
    const t = setInterval(loadOrders, 5000);
    return () => clearInterval(t);
  }, [tab, loadOrders]);
  useEffect(() => { loadSettings(); }, [loadSettings]);

  const createTable = async () => {
    if (!newTable.label.trim() || !merchantId) return;
    const res = await fetch(`${API}/api/merchant/qr-tables`, {
      ...credJson, method: "POST",
      body: JSON.stringify({ merchant_id: merchantId, label: newTable.label, capacity: Number(newTable.capacity) || 4 }),
    });
    const data = await readJson(res);
    if (res.ok && data?.ok) {
      setNewTable({ label: "", capacity: 4 });
      loadTables();
    } else {
      setErr(data?.detail || "Anlegen fehlgeschlagen");
    }
  };

  const rotateToken = async (tableId) => {
    const res = await fetch(`${API}/api/merchant/qr-tables/${tableId}/rotate`, { ...credJson, method: "POST" });
    if (res.ok) loadTables();
  };

  const saveSettings = async () => {
    const res = await fetch(`${API}/api/merchant/qr-settings`, {
      ...credJson, method: "POST",
      body: JSON.stringify({ merchant_id: merchantId, ...settings }),
    });
    const data = await readJson(res);
    if (!res.ok) setErr(data?.detail || "Speichern fehlgeschlagen");
  };

  const orderAction = async (order_id, action) => {
    const res = await fetch(`${API}/api/merchant/qr-orders/${order_id}/${action}`, { ...credJson, method: "POST" });
    if (res.ok) loadOrders();
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24" data-testid="merchant-qr-tables-page">
      <div className="sticky top-0 z-30 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center" data-testid="qr-tables-back">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold">QR-Tisch-Bestellung</h1>
            <p className="text-[10px] text-white/40">Tische scannen · Wallet-Bezahlung · Live-Bestellliste</p>
          </div>
          <button onClick={() => { loadTables(); loadOrders(); }} className="px-3 py-1.5 rounded-lg bg-white/5 text-xs flex items-center gap-1.5">
            <RefreshCw size={12} /> Aktualisieren
          </button>
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-2 flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              data-testid={`qr-tab-${t.id}`}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold ${
                tab === t.id ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30" : "bg-white/5 text-white/60 border border-white/5"
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      {err && (
        <div className="max-w-3xl mx-auto px-4 mt-3">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-xs text-red-300" data-testid="qr-error">
            {err}
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 pt-4">
        {tab === "tables" && (
          <TablesTab
            tables={tables}
            loading={loading}
            newTable={newTable}
            setNewTable={setNewTable}
            createTable={createTable}
            rotateToken={rotateToken}
          />
        )}
        {tab === "orders" && (
          <OrdersTab orders={orders} onAction={orderAction} />
        )}
        {tab === "settings" && (
          <SettingsTab settings={settings} setSettings={setSettings} onSave={saveSettings} />
        )}
      </div>
    </div>
  );
}

function TablesTab({ tables, loading, newTable, setNewTable, createTable, rotateToken }) {
  return (
    <div className="space-y-4">
      <div className="bg-[#0C0C0C] border border-white/5 rounded-2xl p-4">
        <p className="text-[11px] uppercase tracking-wider text-white/40 mb-2">Neuer Tisch</p>
        <div className="flex gap-2">
          <input
            value={newTable.label}
            onChange={(e) => setNewTable((p) => ({ ...p, label: e.target.value }))}
            placeholder="z.B. Tisch 5"
            className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm outline-none"
            data-testid="qr-new-table-label"
          />
          <input
            type="number" min={1} max={50}
            value={newTable.capacity}
            onChange={(e) => setNewTable((p) => ({ ...p, capacity: e.target.value }))}
            className="w-20 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-sm outline-none text-center"
            data-testid="qr-new-table-capacity"
          />
          <button
            onClick={createTable}
            disabled={!newTable.label.trim()}
            className="px-3 py-2 rounded-lg bg-cyan-500 text-black text-sm font-bold flex items-center gap-1 disabled:opacity-40"
            data-testid="qr-new-table-create"
          >
            <Plus size={14} /> Anlegen
          </button>
        </div>
      </div>

      {loading && tables.length === 0 && (
        <p className="text-xs text-white/40 text-center py-8">Lade Tische...</p>
      )}
      {!loading && tables.length === 0 && (
        <div className="text-center py-12 bg-[#0C0C0C] border border-white/5 rounded-2xl">
          <p className="text-sm text-white/60">Noch keine Tische angelegt</p>
          <p className="text-xs text-white/30 mt-1">Erstelle deinen ersten QR-Tisch oben.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {tables.map((t) => (
          <TableCard key={t.table_id} table={t} onRotate={() => rotateToken(t.table_id)} />
        ))}
      </div>
    </div>
  );
}

function TableCard({ table, onRotate }) {
  const ref = useRef(null);
  const url = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/order/qr/${table.qr_token}`;
  }, [table.qr_token]);

  const printQR = () => {
    if (!ref.current) return;
    const svg = ref.current.querySelector("svg");
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const w = window.open("", "_blank", "width=520,height=720");
    if (!w) return;
    w.document.write(`
      <html><head><title>QR ${table.label}</title>
      <style>
        body{font-family:Outfit,Arial,sans-serif;text-align:center;padding:32px;color:#000}
        h1{margin:0 0 4px}
        p{margin:0 0 16px;color:#444;font-size:13px}
        .qr{display:inline-block;padding:20px;border:2px solid #000;border-radius:16px}
        .footer{margin-top:18px;font-size:11px;color:#666}
      </style></head><body>
      <h1>${table.label}</h1>
      <p>Scannen Sie den QR-Code um zu bestellen</p>
      <div class="qr">${xml}</div>
      <div class="footer">${url}</div>
      <script>setTimeout(()=>window.print(),200)</script>
      </body></html>
    `);
    w.document.close();
  };

  const expired = table.qr_token_expires_at &&
    new Date(table.qr_token_expires_at) < new Date(Date.now() - 60_000);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0C0C0C] border border-white/5 rounded-2xl p-4"
      data-testid={`qr-table-card-${table.table_id}`}
    >
      <div className="flex items-start gap-3">
        <div ref={ref} className="bg-white p-2 rounded-lg shrink-0">
          <QRCodeSVG value={url} size={96} level="M" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{table.label}</p>
          <p className="text-[10px] text-white/40">{table.capacity} Plätze · ID {table.table_id.slice(-6)}</p>
          {expired ? (
            <p className="text-[10px] text-amber-400 mt-1">Token älter — Sliding-Window aktiv</p>
          ) : (
            <p className="text-[10px] text-emerald-400 mt-1">QR aktiv</p>
          )}
          <div className="flex gap-1.5 mt-2">
            <button
              onClick={printQR}
              className="flex-1 px-2 py-1.5 rounded-lg bg-cyan-500/15 text-cyan-300 text-[11px] font-semibold flex items-center justify-center gap-1"
              data-testid={`qr-print-${table.table_id}`}
            >
              <Printer size={11} /> Drucken
            </button>
            <button
              onClick={onRotate}
              className="px-2 py-1.5 rounded-lg bg-white/5 text-[11px] font-semibold flex items-center gap-1"
              data-testid={`qr-rotate-${table.table_id}`}
            >
              <RotateCw size={11} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function OrdersTab({ orders, onAction }) {
  const groups = useMemo(() => {
    const g = { pending: [], accepted: [], completed: [], rejected: [] };
    orders.forEach((o) => { (g[o.status] || (g[o.status] = [])).push(o); });
    return g;
  }, [orders]);

  return (
    <div className="space-y-4">
      <Section title="Wartet auf Bestätigung" items={groups.pending} actions={["accept", "reject"]} onAction={onAction} highlight />
      <Section title="Aktiv (In Zubereitung)" items={groups.accepted} actions={["complete"]} onAction={onAction} />
      <Section title="Abgeschlossen" items={groups.completed} actions={[]} onAction={onAction} dim />
      <Section title="Abgelehnt" items={groups.rejected} actions={[]} onAction={onAction} dim />
    </div>
  );
}

function Section({ title, items, actions, onAction, highlight, dim }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className={`text-[11px] uppercase tracking-wider mb-2 ${highlight ? "text-cyan-300" : "text-white/40"}`}>
        {title} · {items.length}
      </p>
      <div className="space-y-2">
        {items.map((o) => (
          <div
            key={o.order_id}
            className={`bg-[#0C0C0C] border ${highlight ? "border-cyan-500/30" : "border-white/5"} rounded-2xl p-3 ${dim ? "opacity-60" : ""}`}
            data-testid={`qr-order-${o.order_id}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-bold">{o.table_label || `Tisch ${o.table_id?.slice(-4)}`}</p>
                <p className="text-[10px] text-white/40 font-mono">{o.order_id}</p>
              </div>
              <p className="text-base font-bold text-cyan-400">€{Number(o.total).toFixed(2)}</p>
            </div>
            <ul className="text-xs text-white/70 space-y-0.5 mb-2">
              {(o.items || []).map((it, idx) => (
                <li key={idx} className="flex justify-between">
                  <span>{it.qty}× {it.name}{it.note ? ` · "${it.note}"` : ""}</span>
                  <span className="text-white/40 tabular-nums">€{Number(it.line_total).toFixed(2)}</span>
                </li>
              ))}
            </ul>
            {o.note && <p className="text-[11px] italic text-amber-300 mb-2">📝 {o.note}</p>}
            {actions.length > 0 && (
              <div className="flex gap-2">
                {actions.includes("accept") && (
                  <button onClick={() => onAction(o.order_id, "accept")} className="flex-1 py-2 rounded-lg bg-emerald-500 text-black text-xs font-bold flex items-center justify-center gap-1" data-testid={`qr-accept-${o.order_id}`}>
                    <Check size={12} /> Annehmen
                  </button>
                )}
                {actions.includes("reject") && (
                  <button onClick={() => onAction(o.order_id, "reject")} className="flex-1 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold flex items-center justify-center gap-1" data-testid={`qr-reject-${o.order_id}`}>
                    <XIcon size={12} /> Ablehnen + Rückerstatten
                  </button>
                )}
                {actions.includes("complete") && (
                  <button onClick={() => onAction(o.order_id, "complete")} className="flex-1 py-2 rounded-lg bg-cyan-500 text-black text-xs font-bold flex items-center justify-center gap-1" data-testid={`qr-complete-${o.order_id}`}>
                    <Check size={12} /> Abschließen
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsTab({ settings, setSettings, onSave }) {
  const toggleScope = (s) => {
    setSettings((p) => ({
      ...p,
      scopes: p.scopes.includes(s) ? p.scopes.filter((x) => x !== s) : [...p.scopes, s],
    }));
  };
  return (
    <div className="space-y-4">
      <div className="bg-[#0C0C0C] border border-white/5 rounded-2xl p-4">
        <p className="text-[11px] uppercase tracking-wider text-white/40 mb-2">Annahme-Modus</p>
        <div className="flex gap-2">
          {[
            { id: "instant", label: "Automatisch", desc: "Sofort bestätigt" },
            { id: "waiter", label: "Manuell (Kellner)", desc: "Annehmen / Ablehnen vor Abrechnung" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setSettings((p) => ({ ...p, acceptance_mode: m.id }))}
              data-testid={`qr-mode-${m.id}`}
              className={`flex-1 p-3 rounded-xl text-left ${
                settings.acceptance_mode === m.id ? "bg-cyan-500/15 border border-cyan-500/40" : "bg-white/5 border border-white/5"
              }`}
            >
              <p className="text-sm font-semibold">{m.label}</p>
              <p className="text-[10px] text-white/40 mt-0.5">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#0C0C0C] border border-white/5 rounded-2xl p-4">
        <p className="text-[11px] uppercase tracking-wider text-white/40 mb-2">Aktive Bereiche</p>
        <div className="flex gap-2">
          {[
            { id: "food", label: "🍽️ Speisen" },
            { id: "drinks", label: "🥤 Getränke" },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => toggleScope(s.id)}
              data-testid={`qr-scope-${s.id}`}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold ${
                settings.scopes.includes(s.id) ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30" : "bg-white/5 text-white/50 border border-white/5"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <button onClick={onSave} className="w-full py-3 bg-cyan-500 text-black rounded-2xl font-bold" data-testid="qr-settings-save">
        Einstellungen speichern
      </button>
    </div>
  );
}
