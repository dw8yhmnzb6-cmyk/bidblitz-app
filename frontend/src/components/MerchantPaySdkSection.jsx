import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Code2, Plus, Copy, Check, Trash2, Loader2, Key,
  AlertCircle, X, ExternalLink, TrendingUp, Activity,
  Euro, Clock, CheckCircle2, ArrowDownRight,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

async function apiCall(path, opts = {}) {
  const r = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || `HTTP ${r.status}`);
  return d;
}

export default function MerchantPaySdkSection() {
  const [keys, setKeys] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [summary, setSummary] = useState({ total: 0, paid_count: 0, paid_amount: 0, pending_count: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [label, setLabel] = useState("Production");
  const [saving, setSaving] = useState(false);
  const [justCreated, setJustCreated] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const [k, s] = await Promise.all([apiCall("/api/pay/my-keys"), apiCall("/api/pay/my-sessions?limit=30")]);
      setKeys(k.keys || []);
      setSessions(s.sessions || []);
      setSummary(s.summary || { total: 0, paid_count: 0, paid_amount: 0, pending_count: 0 });
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setSaving(true); setErr("");
    try {
      const d = await apiCall("/api/pay/my-keys/create", { method: "POST", body: JSON.stringify({ label }) });
      setJustCreated(d.keys);
      setShowNew(false); setLabel("Production");
      load();
    } catch (e) { setErr(e.message); }
    setSaving(false);
  };

  const revoke = async (key_id) => {
    if (!window.confirm("Key widerrufen? Alle laufenden Sessions mit diesem Key brechen sofort ab.")) return;
    try { await apiCall(`/api/pay/my-keys/${key_id}/revoke`, { method: "POST" }); load(); }
    catch (e) { setErr(e.message); }
  };

  const copy = (txt, id) => {
    navigator.clipboard.writeText(txt);
    setCopied(id); setTimeout(() => setCopied(""), 1500);
  };

  const activeKeys = keys.filter(k => !k.revoked);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-[#00E89D]" /></div>;
  }

  return (
    <div className="space-y-4" data-testid="merchant-pay-sdk-section">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard icon={Key} label="Aktive Keys" value={activeKeys.length} color="#00E89D" />
        <StatCard icon={Activity} label="Sessions" value={summary.total} color="#00C2FF" />
        <StatCard icon={CheckCircle2} label="Bezahlt" value={summary.paid_count} color="#00D26A" />
        <StatCard icon={Euro} label="Umsatz" value={`€${summary.paid_amount.toFixed(2)}`} color="#FFB800" isValue />
      </div>

      {/* Integration snippet */}
      <div className="rounded-2xl p-4" style={{ background: "rgba(0,194,255,0.03)", border: "1px solid rgba(0,194,255,0.12)" }}>
        <div className="flex items-center gap-2 mb-2">
          <Code2 size={13} className="text-[#00C2FF]" />
          <p className="text-[11px] font-bold text-[#00C2FF]">Integration in 3 Zeilen</p>
        </div>
        <pre className="text-[10px] font-mono text-white/55 overflow-x-auto leading-relaxed">{`<script src="${API}/api/pay.js"></script>
<div id="pay-btn"></div>
<script>
  BidBlitzPay.mount("#pay-btn", {
    publicKey: "${activeKeys[0]?.public_key || "pk_live_..."}",
    amount: 29.90, currency: "EUR",
    orderId: "ORDER-123",
    successUrl: location.origin + "/thanks",
    onSuccess: data => console.log("bezahlt", data),
  });
</script>`}</pre>
      </div>

      {/* Just-created key banner */}
      <AnimatePresence>
        {justCreated && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden rounded-2xl"
            style={{ background: "rgba(255,184,0,0.04)", border: "1px solid rgba(255,184,0,0.25)" }}
            data-testid="merch-just-created">
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="text-[#FFB800]" />
                <p className="text-[11px] font-bold text-[#FFB800] flex-1">Secret-Key wird nur EINMAL angezeigt — jetzt kopieren!</p>
                <button onClick={() => setJustCreated(null)} className="p-1" data-testid="merch-close-new-key"><X size={14} className="text-white/40" /></button>
              </div>
              <KeyRow label="Public Key" value={justCreated.public_key} color="#00E89D" onCopy={() => copy(justCreated.public_key, "new-pk")} copied={copied === "new-pk"} testId="merch-new-pk" />
              <KeyRow label="Secret Key (server-side)" value={justCreated.secret_key} color="#FF6B6B" onCopy={() => copy(justCreated.secret_key, "new-sk")} copied={copied === "new-sk"} testId="merch-new-sk" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keys list + create */}
      <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-bold text-white/70 uppercase tracking-wider">Meine API-Keys</p>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowNew(!showNew)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-[#00E89D]/10 text-[#00E89D] border border-[#00E89D]/15"
            data-testid="merch-new-key-btn">
            <Plus size={11} /> Neuer Key
          </motion.button>
        </div>

        {err && <p className="text-[10px] text-red-400 mb-2 px-3 py-1.5 rounded bg-red-500/5 border border-red-500/15" data-testid="merch-err">{err}</p>}

        <AnimatePresence>
          {showNew && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-3">
              <div className="p-3 rounded-xl space-y-2" style={{ background: "rgba(0,232,157,0.05)", border: "1px solid rgba(0,232,157,0.15)" }}>
                <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Label (z.B. Production, Staging)"
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05] text-[12px] text-white/90 outline-none"
                  data-testid="merch-key-label" />
                <div className="flex gap-2">
                  <motion.button onClick={create} disabled={saving} whileTap={{ scale: 0.97 }}
                    className="flex-1 py-2 rounded-xl text-[11px] font-semibold bg-[#00E89D]/15 text-[#00E89D] border border-[#00E89D]/20 disabled:opacity-50 flex items-center justify-center gap-1.5"
                    data-testid="merch-key-save">
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <><Key size={12} /> Keys generieren</>}
                  </motion.button>
                  <motion.button onClick={() => setShowNew(false)} whileTap={{ scale: 0.97 }}
                    className="px-3 py-2 rounded-xl text-[11px] text-[#666] bg-white/[0.02] border border-white/[0.04]">Abbrechen</motion.button>
                </div>
                <p className="text-[9px] text-white/35">Max. 5 aktive Keys. Widerrufe ungenutzte, bevor du neue erstellst.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {keys.length === 0 ? (
          <div className="text-center py-8">
            <Key size={32} className="mx-auto text-[#333] mb-2" />
            <p className="text-[11px] text-[#555]">Noch keine Keys erstellt</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {keys.map(k => (
              <div key={k.key_id} className="rounded-xl p-2.5"
                style={{ background: "rgba(0,0,0,0.2)", border: `1px solid ${k.revoked ? "rgba(255,71,87,0.15)" : "rgba(255,255,255,0.04)"}`, opacity: k.revoked ? 0.5 : 1 }}
                data-testid={`merch-key-${k.key_id}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-white/80">{k.label}</span>
                    {k.revoked ? (
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-bold uppercase">Widerrufen</span>
                    ) : (
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-[#00E89D]/15 text-[#00E89D] font-bold uppercase">Aktiv</span>
                    )}
                  </div>
                  {!k.revoked && (
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => revoke(k.key_id)}
                      className="p-1 rounded hover:bg-red-500/10" data-testid={`merch-revoke-${k.key_id}`}>
                      <Trash2 size={10} className="text-[#FF6B6B]" />
                    </motion.button>
                  )}
                </div>
                <div className="flex items-center gap-2 px-2 py-1 rounded bg-black/30">
                  <code className="text-[10px] text-[#00E89D] font-mono flex-1 truncate">{k.public_key}</code>
                  <button onClick={() => copy(k.public_key, k.key_id)} className="p-0.5 rounded hover:bg-white/5" data-testid={`merch-copy-${k.key_id}`}>
                    {copied === k.key_id ? <Check size={10} className="text-[#00E89D]" /> : <Copy size={10} className="text-white/40" />}
                  </button>
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[9px] text-white/30">
                  <span>{k.total_sessions || 0} Sessions</span>
                  <span>€{(k.total_paid || 0).toFixed(2)} Umsatz</span>
                  <span className="ml-auto">{new Date(k.created_at).toLocaleDateString("de-DE")}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent sessions */}
      <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-bold text-white/70 uppercase tracking-wider">Letzte Sessions</p>
          <motion.button whileTap={{ scale: 0.95 }} onClick={load}
            className="text-[10px] text-white/40 flex items-center gap-1" data-testid="merch-reload-sessions">
            <TrendingUp size={10} /> Aktualisieren
          </motion.button>
        </div>
        {sessions.length === 0 ? (
          <div className="text-center py-6">
            <Clock size={28} className="mx-auto text-[#333] mb-2" />
            <p className="text-[11px] text-[#555]">Noch keine Sessions</p>
            <p className="text-[9px] text-[#444] mt-1">Sobald Kunden deinen Checkout nutzen, erscheinen sie hier</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {sessions.map(s => {
              const statusCol = s.status === "paid" ? "#00E89D" : s.status === "pending" ? "#FFB800" : "#FF6B6B";
              const StatusIcon = s.status === "paid" ? CheckCircle2 : s.status === "pending" ? Clock : X;
              return (
                <div key={s.session_id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg"
                  style={{ background: "rgba(0,0,0,0.2)" }} data-testid={`merch-session-${s.session_id}`}>
                  <StatusIcon size={13} style={{ color: statusCol }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-white/80">€{s.amount.toFixed(2)}</span>
                      <span className="text-[8px] px-1 py-0.5 rounded font-bold uppercase" style={{ background: `${statusCol}15`, color: statusCol }}>
                        {s.status}
                      </span>
                    </div>
                    <p className="text-[9px] text-white/35 truncate">
                      {s.order_id || s.description || s.session_id.slice(0, 12) + "..."}
                      {s.paid_by_email && <> · <ArrowDownRight size={7} className="inline" /> {s.paid_by_email}</>}
                    </p>
                  </div>
                  <span className="text-[9px] text-white/25 shrink-0">
                    {new Date(s.created_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Docs link */}
      <a href={`${API}/api/pay.js`} target="_blank" rel="noreferrer"
        className="flex items-center justify-center gap-1.5 text-[10px] text-white/35 hover:text-[#00E89D] py-2"
        data-testid="merch-docs-link">
        <ExternalLink size={10} /> pay.js SDK ansehen
      </a>
    </div>
  );
}

const StatCard = ({ icon: Icon, label, value, color, isValue }) => (
  <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
    <div className="flex items-center gap-1.5 mb-1.5">
      <Icon size={10} style={{ color }} />
      <span className="text-[8px] text-white/35 uppercase tracking-wider font-semibold">{label}</span>
    </div>
    <p className={`${isValue ? "text-sm" : "text-base"} font-black text-white/90 font-outfit`}>{value}</p>
  </div>
);

const KeyRow = ({ label, value, color, onCopy, copied, testId }) => (
  <div>
    <p className="text-[9px] text-white/40 uppercase tracking-wider mb-1">{label}</p>
    <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 bg-black/40">
      <code className="text-[11px] font-mono flex-1 break-all" style={{ color }} data-testid={testId}>{value}</code>
      <button onClick={onCopy} className="p-1 rounded hover:bg-white/5">
        {copied ? <Check size={11} className="text-[#00E89D]" /> : <Copy size={11} className="text-white/50" />}
      </button>
    </div>
  </div>
);
