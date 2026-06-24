/**
 * TaxiPromoManagerPage — Admin/Merchant UI for Taxi Promo Codes.
 *
 * Lists DB-managed promo codes + redemption stats; allows create/edit/archive.
 * Built-in codes (NEUKUNDE10 etc.) are read-only — shown as system entries.
 */
import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Plus, Loader2, Tag, Trash2, Edit2, X, CheckCircle2, AlertCircle,
  TrendingUp, Users, Wallet,
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, { credentials: "include", ...opts });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || `HTTP ${r.status}`);
  return d;
}

const BUILTIN_LABELS = {
  NEUKUNDE10: { label: "10% Rabatt für Neukunden (max 5€)", type: "percent", value: 10, max_off: 5, builtin: true },
  BIDBLITZ5:  { label: "5€ Willkommens-Gutschrift", type: "fixed", value: 5, builtin: true },
  FREUNDE:    { label: "15% Freundschaftsrabatt (max 8€)", type: "percent", value: 15, max_off: 8, builtin: true },
  PROMO2026:  { label: "20% Aktion 2026 (max 10€)", type: "percent", value: 20, max_off: 10, builtin: true },
};

export default function TaxiPromoManagerPage({ onBack }) {
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // promo object | "new"

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api("/api/taxi/admin/promos?include_archived=true");
      setPromos(d.promos || []);
    } catch (e) {
      toast.error(e.message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const archive = async (code) => {
    if (!window.confirm(`Promo "${code}" archivieren?`)) return;
    try {
      await api(`/api/taxi/admin/promos/${code}`, { method: "DELETE" });
      toast.success("Archiviert");
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const dbCodes = new Set(promos.map((p) => p.code));
  const allItems = [
    ...promos,
    ...Object.entries(BUILTIN_LABELS)
      .filter(([code]) => !dbCodes.has(code))
      .map(([code, cfg]) => ({ code, active: true, ...cfg })),
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-lg border-b border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 max-w-4xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onBack} data-testid="promo-back-btn" className="p-2 -ml-2 rounded-xl hover:bg-slate-100">
              <ArrowLeft size={20} className="text-slate-700" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Promo-Codes</h1>
              <p className="text-xs text-slate-500">Rabatt-Aktionen verwalten</p>
            </div>
          </div>
          <button
            onClick={() => setEditing("new")}
            data-testid="promo-new-btn"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-slate-900 text-white text-xs font-bold hover:bg-slate-700 transition shadow-sm"
          >
            <Plus size={14} /> Neu
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-5 space-y-3">
        {loading && (
          <div className="flex justify-center py-14"><Loader2 size={26} className="animate-spin text-cyan-500" /></div>
        )}
        {!loading && allItems.length === 0 && (
          <div className="py-14 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 mx-auto flex items-center justify-center mb-3">
              <Tag size={22} className="text-slate-400" />
            </div>
            <p className="text-base font-bold text-slate-900">Keine Promo-Codes</p>
            <p className="text-sm text-slate-500 mt-1">Lege deine erste Aktion an.</p>
          </div>
        )}
        {!loading && allItems.map((p) => (
          <PromoRow
            key={p.code}
            promo={p}
            onEdit={() => !p.builtin && setEditing(p)}
            onArchive={() => !p.builtin && archive(p.code)}
            onShowStats={() => setEditing({ ...p, _statsOnly: true })}
          />
        ))}
      </div>

      {editing && (
        <PromoEditorSheet
          mode={editing === "new" ? "new" : editing._statsOnly ? "stats" : "edit"}
          promo={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function PromoRow({ promo, onEdit, onArchive, onShowStats }) {
  const isInactive = promo.active === false;
  const tone = promo.builtin ? "bg-amber-50 border-amber-100 text-amber-700" :
               isInactive ? "bg-slate-50 border-slate-100 text-slate-400" :
               "bg-emerald-50 border-emerald-100 text-emerald-700";
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      data-testid={`promo-row-${promo.code}`}
      className={`rounded-2xl border bg-white shadow-sm p-4 ${isInactive ? "opacity-70" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white text-[11px] font-bold tracking-wider tabular-nums">
              {promo.code}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${tone}`}>
              {promo.builtin ? "System" : isInactive ? "Archiviert" : "Aktiv"}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-900 truncate">{promo.label}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {promo.type === "percent" && `${promo.value}% Rabatt${promo.max_off ? ` · max €${promo.max_off}` : ""}`}
            {promo.type === "fixed" && `€${promo.value} Festbetrag`}
            {promo.type === "free_ride" && `Bis €${promo.value} Fahrt frei`}
            {" · "}{promo.max_uses_per_user || 1}× pro User
            {promo.expires_at && ` · Gültig bis ${new Date(promo.expires_at).toLocaleDateString("de-DE")}`}
          </p>
          {(promo.redemptions > 0 || promo.discount_total > 0) && (
            <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-600">
              <span className="flex items-center gap-1"><TrendingUp size={11} /> {promo.redemptions || 0} Einlösungen</span>
              <span className="flex items-center gap-1"><Wallet size={11} /> €{(promo.discount_total || 0).toFixed(2)} Rabatt</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            onClick={onShowStats}
            data-testid={`promo-stats-${promo.code}`}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition"
            title="Statistik"
          >
            <TrendingUp size={14} className="text-slate-600" />
          </button>
          {!promo.builtin && (
            <>
              <button
                onClick={onEdit}
                data-testid={`promo-edit-${promo.code}`}
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition"
              >
                <Edit2 size={14} className="text-slate-600" />
              </button>
              {!isInactive && (
                <button
                  onClick={onArchive}
                  data-testid={`promo-archive-${promo.code}`}
                  className="w-9 h-9 rounded-xl bg-red-50 hover:bg-red-100 flex items-center justify-center transition"
                >
                  <Trash2 size={14} className="text-red-500" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function PromoEditorSheet({ mode, promo, onClose, onSaved }) {
  const isNew = mode === "new";
  const isStats = mode === "stats";
  const [form, setForm] = useState(() => ({
    code: promo?.code || "",
    type: promo?.type || "percent",
    value: promo?.value ?? 10,
    max_off: promo?.max_off ?? "",
    max_uses_per_user: promo?.max_uses_per_user ?? 1,
    label: promo?.label || "",
    expires_at: promo?.expires_at || "",
    active: promo?.active !== false,
  }));
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (isStats && promo?.code) {
      (async () => {
        try {
          const d = await api(`/api/taxi/admin/promos/${promo.code}/stats`);
          setStats(d);
        } catch (e) { toast.error(e.message); }
      })();
    }
  }, [isStats, promo?.code]);

  const save = async () => {
    if (!form.code.trim()) { toast.error("Code fehlt"); return; }
    setBusy(true);
    try {
      const body = {
        type: form.type,
        value: parseFloat(form.value),
        max_off: form.max_off ? parseFloat(form.max_off) : null,
        max_uses_per_user: parseInt(form.max_uses_per_user, 10),
        label: form.label,
        expires_at: form.expires_at || null,
        active: !!form.active,
      };
      if (isNew) {
        await api("/api/taxi/admin/promos", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: form.code.trim().toUpperCase(), ...body }),
        });
        toast.success(`Code ${form.code.toUpperCase()} angelegt`);
      } else {
        await api(`/api/taxi/admin/promos/${promo.code}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        toast.success("Code aktualisiert");
      }
      onSaved?.();
    } catch (e) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/50 backdrop-blur-md flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <motion.div
        initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        data-testid="promo-editor-sheet"
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
      >
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
              {isNew ? "Neue Aktion" : isStats ? "Statistik" : "Bearbeiten"}
            </p>
            <h2 className="text-lg font-bold text-slate-900">
              {isNew ? "Promo-Code anlegen" : promo?.code}
            </h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
            <X size={16} className="text-slate-700" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {isStats ? (
            <StatsView promo={promo} stats={stats} />
          ) : (
            <>
              {isNew && (
                <Field label="Code">
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="z.B. SOMMER25"
                    maxLength={32}
                    data-testid="promo-form-code"
                    className="form-input uppercase tracking-wider font-bold"
                  />
                </Field>
              )}
              <Field label="Beschreibung">
                <input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="z.B. Sommer-Aktion 25% Rabatt"
                  data-testid="promo-form-label"
                  className="form-input"
                />
              </Field>
              <Field label="Rabatt-Typ">
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  data-testid="promo-form-type"
                  className="form-input"
                >
                  <option value="percent">Prozent (%)</option>
                  <option value="fixed">Fester Betrag (€)</option>
                  <option value="free_ride">Freie Fahrt bis €X</option>
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={form.type === "percent" ? "Rabatt %" : "Betrag €"}>
                  <input
                    type="number" inputMode="decimal"
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    data-testid="promo-form-value"
                    className="form-input"
                  />
                </Field>
                {form.type === "percent" && (
                  <Field label="Max € (optional)">
                    <input
                      type="number" inputMode="decimal"
                      value={form.max_off}
                      onChange={(e) => setForm({ ...form, max_off: e.target.value })}
                      data-testid="promo-form-max-off"
                      className="form-input"
                    />
                  </Field>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Max pro User">
                  <input
                    type="number" min="1" max="999"
                    value={form.max_uses_per_user}
                    onChange={(e) => setForm({ ...form, max_uses_per_user: e.target.value })}
                    data-testid="promo-form-max-uses"
                    className="form-input"
                  />
                </Field>
                <Field label="Gültig bis">
                  <input
                    type="date"
                    value={form.expires_at ? form.expires_at.slice(0, 10) : ""}
                    onChange={(e) => setForm({ ...form, expires_at: e.target.value ? new Date(e.target.value).toISOString() : "" })}
                    data-testid="promo-form-expires"
                    className="form-input"
                  />
                </Field>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  data-testid="promo-form-active"
                  className="w-4 h-4"
                />
                <span className="text-sm font-semibold text-slate-700">Aktiv</span>
              </label>
              <button
                onClick={save}
                disabled={busy}
                data-testid="promo-form-save"
                className="w-full py-3.5 rounded-xl bg-gradient-to-b from-cyan-500 to-cyan-600 text-white text-sm font-bold shadow-md hover:shadow-lg active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {isNew ? "Anlegen" : "Speichern"}
              </button>
            </>
          )}
        </div>
      </motion.div>
      <style>{`
        .form-input { width:100%; padding:.65rem .85rem; border-radius:.75rem; background:#F8FAFC; border:1px solid #E2E8F0; font-size:.875rem; color:#0F172A; outline:none; transition:all .15s; }
        .form-input:focus { background:white; border-color:#0EA5E9; box-shadow:0 0 0 3px rgba(14,165,233,.12); }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-700 mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function StatsView({ promo, stats }) {
  if (!stats) return <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-cyan-500" /></div>;
  const s = stats.summary || {};
  const recent = stats.recent || [];
  return (
    <div className="space-y-4" data-testid="promo-stats-view">
      <div className="grid grid-cols-3 gap-2">
        <Stat icon={TrendingUp} label="Einlösungen" value={s.redemptions || 0} />
        <Stat icon={Wallet} label="Rabatt €" value={`€${(s.discount_total || 0).toFixed(2)}`} />
        <Stat icon={Users} label="Nutzer" value={s.unique_users || 0} />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">Letzte Einlösungen</p>
        {recent.length === 0 && <p className="text-xs text-slate-500 py-2">Noch keine Einlösungen</p>}
        <ul className="space-y-1">
          {recent.map((r, i) => (
            <li key={r.id || i} className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-700 truncate">{r.ride_id ? `Ride ${r.ride_id}` : "Anonym"}</span>
              <span className="text-slate-500 tabular-nums">€{(r.discount || 0).toFixed(2)} · {new Date(r.redeemed_at).toLocaleDateString("de-DE")}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
      <Icon size={13} className="text-slate-400 mb-1" />
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-base font-bold text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}
