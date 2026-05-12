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
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, RefreshCw, Printer, Check, X as XIcon, Plus, RotateCw, Settings, ListChecks,
  UtensilsCrossed, Image as ImageIcon, Trash2, Save,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const credJson = { credentials: "include", headers: { "Content-Type": "application/json" } };
const cred = { credentials: "include" };

async function readJson(res) { try { return await res.json(); } catch { return null; } }

const tabs = [
  { id: "tables", label: "Tische", icon: <ListChecks size={14} /> },
  { id: "menu", label: "Speisekarte", icon: <UtensilsCrossed size={14} /> },
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
        {tab === "menu" && (
          <MenuTab merchantId={merchantId} />
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

// ─── MenuTab: visual menu editor with image upload + tags + modifiers ────

const TAG_OPTIONS = [
  { id: "popular", label: "🔥 Beliebt" },
  { id: "vegan", label: "🌱 Vegan" },
  { id: "vegetarian", label: "🥦 Vegetarisch" },
  { id: "spicy", label: "🌶️ Scharf" },
  { id: "healthy", label: "💚 Gesund" },
  { id: "new", label: "✨ Neu" },
];
const ALLERGEN_OPTIONS = [
  { id: "gluten", label: "🌾 Gluten" },
  { id: "milk", label: "🥛 Milch" },
  { id: "egg", label: "🥚 Ei" },
  { id: "nuts", label: "🥜 Nüsse" },
  { id: "soy", label: "🌱 Soja" },
  { id: "fish", label: "🐟 Fisch" },
  { id: "shellfish", label: "🦐 Krustent." },
  { id: "sesame", label: "🌰 Sesam" },
  { id: "sulfites", label: "🍷 Sulfite" },
  { id: "celery", label: "🌿 Sellerie" },
];

const buildImg = (u) => (!u ? null : (u.startsWith("/") ? `${API}${u}` : u));

function MenuTab({ merchantId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);  // item or null

  const load = useCallback(async () => {
    if (!merchantId) return;
    setLoading(true);
    const res = await fetch(`${API}/api/merchant/menu/${merchantId}`, cred);
    const data = await readJson(res);
    if (res.ok) setItems(data?.items || []);
    setLoading(false);
  }, [merchantId]);

  useEffect(() => { load(); }, [load]);

  const delItem = async (item_id) => {
    if (!window.confirm("Artikel wirklich löschen?")) return;
    const res = await fetch(`${API}/api/merchant/menu/items/${merchantId}/${item_id}`, {
      ...credJson, method: "DELETE",
    });
    if (res.ok) load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wider text-white/40">{items.length} Artikel</p>
        <button onClick={() => setEditing({})}
          className="px-3 py-2 rounded-xl bg-cyan-500 text-black text-xs font-bold flex items-center gap-1"
          data-testid="qr-menu-new">
          <Plus size={12}/> Neuer Artikel
        </button>
      </div>
      {loading && items.length === 0 && (
        <p className="text-xs text-white/40 text-center py-8">Lade...</p>
      )}
      {!loading && items.length === 0 && (
        <div className="text-center py-12 bg-[#0C0C0C] border border-white/5 rounded-2xl">
          <UtensilsCrossed size={28} className="mx-auto text-white/20 mb-2"/>
          <p className="text-sm text-white/60">Speisekarte ist leer</p>
          <p className="text-xs text-white/30 mt-1">Lege deinen ersten Artikel an.</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {items.map((it) => (
          <button key={it.item_id} onClick={() => setEditing(it)}
            className="bg-[#0C0C0C] border border-white/5 rounded-xl p-2.5 flex gap-2.5 text-left hover:border-white/15"
            data-testid={`qr-menu-edit-${it.item_id}`}>
            <div className="w-16 h-16 rounded-lg bg-white/5 shrink-0 overflow-hidden flex items-center justify-center">
              {it.image_url ? (
                <img src={buildImg(it.image_url)} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon size={20} className="text-white/20"/>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{it.name}</p>
              <p className="text-[10px] text-white/40">{it.category} · {it.scope === "food" ? "Speisen" : "Getränke"}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm font-bold text-cyan-400">€{Number(it.price).toFixed(2)}</span>
                {(it.tags || []).length > 0 && (
                  <span className="text-[9px] text-white/40">{(it.tags || []).slice(0,2).join(", ")}</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
      <AnimatePresence>
        {editing !== null && (
          <ItemEditor
            initial={editing}
            merchantId={merchantId}
            onClose={() => setEditing(null)}
            onSaved={() => { load(); setEditing(null); }}
            onDelete={editing?.item_id ? () => { delItem(editing.item_id); setEditing(null); } : null}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ItemEditor({ initial, merchantId, onClose, onSaved, onDelete }) {
  const [f, setF] = useState({
    item_id: initial?.item_id || undefined,
    name: initial?.name || "",
    description: initial?.description || "",
    price: initial?.price ?? "",
    category: initial?.category || "Hauptgericht",
    scope: initial?.scope || "food",
    image_url: initial?.image_url || "",
    tags: initial?.tags || [],
    allergens: initial?.allergens || [],
    calories: initial?.calories ?? "",
    is_popular: initial?.is_popular || false,
    is_available: initial?.is_available !== false,
    sort_order: initial?.sort_order || 0,
    modifier_groups: initial?.modifier_groups || [],
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API}/api/merchant/menu/upload-image`, {
        method: "POST", credentials: "include", body: fd,
      });
      const data = await readJson(res);
      if (!res.ok) {
        setErr(data?.detail || "Upload fehlgeschlagen");
      } else {
        setF((p) => ({ ...p, image_url: data.url }));
      }
    } finally { setUploading(false); }
  };

  const save = async () => {
    if (!f.name.trim() || !f.price) { setErr("Name + Preis erforderlich"); return; }
    setSaving(true);
    setErr(null);
    const payload = {
      merchant_id: merchantId,
      ...f,
      price: parseFloat(f.price),
      calories: f.calories === "" ? null : parseInt(f.calories, 10),
      sort_order: parseInt(f.sort_order || 0, 10),
    };
    const res = await fetch(`${API}/api/merchant/menu/items`, {
      ...credJson, method: "POST", body: JSON.stringify(payload),
    });
    const data = await readJson(res);
    if (!res.ok) {
      setErr(data?.detail || "Speichern fehlgeschlagen");
      setSaving(false);
    } else {
      onSaved(data?.item);
    }
  };

  const toggleTag = (id) => setF((p) => ({ ...p, tags: p.tags.includes(id) ? p.tags.filter(x=>x!==id) : [...p.tags, id] }));
  const toggleAllergen = (id) => setF((p) => ({ ...p, allergens: p.allergens.includes(id) ? p.allergens.filter(x=>x!==id) : [...p.allergens, id] }));

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      className="fixed inset-0 z-50 bg-black/70 flex items-end" onClick={onClose}>
      <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}}
        onClick={(e)=>e.stopPropagation()}
        className="w-full bg-[#0e0e0e] rounded-t-3xl max-h-[92vh] overflow-y-auto p-5"
        data-testid="qr-item-editor">
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4"/>
        <h2 className="text-lg font-bold mb-4">{f.item_id ? "Artikel bearbeiten" : "Neuer Artikel"}</h2>

        {err && <p className="mb-3 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-2">{err}</p>}

        {/* Image */}
        <div className="mb-4">
          <p className="text-[11px] uppercase tracking-wider text-white/40 mb-2">Bild</p>
          {f.image_url ? (
            <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-white/5">
              <img src={buildImg(f.image_url)} alt="" className="w-full h-full object-cover" />
              <button onClick={()=>setF((p)=>({...p,image_url:""}))}
                className="absolute top-2 right-2 w-8 h-8 bg-black/70 rounded-full flex items-center justify-center"
                data-testid="qr-item-img-clear"><XIcon size={14}/></button>
            </div>
          ) : (
            <div className="aspect-[16/10] rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-1 p-3">
              <ImageIcon size={24} className="text-white/30 mb-1"/>
              <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-cyan-500 text-black text-xs font-bold">
                {uploading ? "Lade hoch..." : "Bild hochladen"}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={(e)=>upload(e.target.files?.[0])}
                  data-testid="qr-item-img-upload"/>
              </label>
              <p className="text-[10px] text-white/30 mt-1">oder URL einfügen ↓</p>
            </div>
          )}
          <input value={f.image_url} onChange={(e)=>setF((p)=>({...p,image_url:e.target.value}))}
            placeholder="https://... (oder /api/qr/menu/image/...)"
            className="mt-2 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs outline-none"
            data-testid="qr-item-img-url"/>
        </div>

        {/* Name + Price */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Field label="Name" required>
            <input value={f.name} onChange={(e)=>setF((p)=>({...p,name:e.target.value}))}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm outline-none"
              data-testid="qr-item-name"/>
          </Field>
          <Field label="Preis (€)" required>
            <input type="number" step="0.10" min="0" value={f.price}
              onChange={(e)=>setF((p)=>({...p,price:e.target.value}))}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm outline-none"
              data-testid="qr-item-price"/>
          </Field>
        </div>

        <Field label="Beschreibung">
          <textarea value={f.description} onChange={(e)=>setF((p)=>({...p,description:e.target.value.slice(0,400)}))}
            rows={2}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm outline-none resize-none"
            data-testid="qr-item-desc"/>
        </Field>

        <div className="grid grid-cols-3 gap-2 my-3">
          <Field label="Kategorie">
            <input value={f.category} onChange={(e)=>setF((p)=>({...p,category:e.target.value}))}
              className="w-full px-2 py-2 bg-white/5 border border-white/10 rounded-lg text-xs outline-none"
              data-testid="qr-item-cat"/>
          </Field>
          <Field label="Bereich">
            <select value={f.scope} onChange={(e)=>setF((p)=>({...p,scope:e.target.value}))}
              className="w-full px-2 py-2 bg-white/5 border border-white/10 rounded-lg text-xs outline-none">
              <option value="food">Speisen</option>
              <option value="drinks">Getränke</option>
            </select>
          </Field>
          <Field label="Kalorien">
            <input type="number" min="0" value={f.calories}
              onChange={(e)=>setF((p)=>({...p,calories:e.target.value}))}
              className="w-full px-2 py-2 bg-white/5 border border-white/10 rounded-lg text-xs outline-none"/>
          </Field>
        </div>

        <Field label="Tags">
          <div className="flex flex-wrap gap-1.5">
            {TAG_OPTIONS.map((tg) => (
              <button key={tg.id} onClick={()=>toggleTag(tg.id)}
                data-testid={`qr-item-tag-${tg.id}`}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                  f.tags.includes(tg.id) ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "bg-white/5 text-white/60 border border-white/10"
                }`}>{tg.label}</button>
            ))}
          </div>
        </Field>

        <Field label="Allergene">
          <div className="flex flex-wrap gap-1.5">
            {ALLERGEN_OPTIONS.map((al) => (
              <button key={al.id} onClick={()=>toggleAllergen(al.id)}
                data-testid={`qr-item-allergen-${al.id}`}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                  f.allergens.includes(al.id) ? "bg-red-500/15 text-red-200 border border-red-500/30" : "bg-white/5 text-white/60 border border-white/10"
                }`}>{al.label}</button>
            ))}
          </div>
        </Field>

        {/* Actions */}
        <div className="flex gap-2 mt-5 pt-3 border-t border-white/10">
          {onDelete && (
            <button onClick={onDelete} className="px-3 py-2.5 rounded-xl bg-red-500/15 text-red-300 text-sm font-bold flex items-center gap-1" data-testid="qr-item-delete">
              <Trash2 size={14}/>
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/10 text-sm font-bold">Abbrechen</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-cyan-500 text-black text-sm font-bold flex items-center justify-center gap-1 disabled:opacity-50"
            data-testid="qr-item-save">
            <Save size={14}/> {saving ? "Speichert..." : "Speichern"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </p>
      {children}
    </div>
  );
}
