import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Code2, Plus, Copy, Check, Trash2, Loader2, Key, Shield, AlertCircle, X, ExternalLink
} from "lucide-react";
import { adminApi, Skeleton } from "./adminHelpers";

export default function AdminPaySdkTab() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ merchant_email: "", label: "Default" });
  const [saving, setSaving] = useState(false);
  const [justCreated, setJustCreated] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await adminApi("/api/pay/admin/keys"); setKeys(d.keys || []); }
    catch (e) { setError(e.message); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.merchant_email) { setError("Merchant-E-Mail erforderlich"); return; }
    setSaving(true); setError("");
    try {
      const d = await adminApi("/api/pay/admin/keys/create", { method: "POST", body: JSON.stringify(form) });
      setJustCreated(d.keys);
      setShowNew(false); setForm({ merchant_email: "", label: "Default" });
      load();
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  const revoke = async (key_id) => {
    if (!window.confirm("Key widerrufen? Widerruf kann nicht rückgängig gemacht werden.")) return;
    try { await adminApi(`/api/pay/admin/keys/${key_id}/revoke`, { method: "POST" }); load(); }
    catch (e) { setError(e.message); }
  };

  const copy = (txt, id) => {
    navigator.clipboard.writeText(txt);
    setCopied(id); setTimeout(() => setCopied(""), 1500);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} data-testid="admin-pay-sdk-tab">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Code2 size={14} className="text-[#00E89D]" />
          <p className="text-[10px] text-[#444] uppercase tracking-[0.12em] font-semibold">
            BidBlitz Pay — Händler SDK Keys ({keys.length})
          </p>
        </div>
        <motion.button data-testid="pay-new-key-btn" whileTap={{ scale: 0.95 }} onClick={() => setShowNew(!showNew)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-[#00E89D]/10 text-[#00E89D] border border-[#00E89D]/15">
          <Plus size={11} /> Key erstellen
        </motion.button>
      </div>

      {error && <p className="text-[10px] text-red-400 mb-2 px-3 py-1.5 rounded bg-red-500/5 border border-red-500/15">{error}</p>}

      {/* Just-created key — ONE TIME SECRET DISPLAY */}
      <AnimatePresence>
        {justCreated && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden rounded-2xl mb-3"
            style={{ background: "rgba(255,184,0,0.04)", border: "1px solid rgba(255,184,0,0.25)" }}>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="text-[#FFB800]" />
                <p className="text-[11px] font-bold text-[#FFB800]">Secret-Key wird nur EINMAL angezeigt — jetzt sicher speichern!</p>
                <button onClick={() => setJustCreated(null)} className="ml-auto p-1" data-testid="close-just-created"><X size={14} className="text-white/40" /></button>
              </div>
              <div>
                <p className="text-[9px] text-white/40 uppercase tracking-wider mb-1">Public Key (client-side, z.B. pay.js)</p>
                <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-black/40">
                  <code className="text-[11px] text-[#00E89D] font-mono flex-1 break-all" data-testid="new-pk">{justCreated.public_key}</code>
                  <button onClick={() => copy(justCreated.public_key, "pk")} className="p-1.5 rounded hover:bg-white/5" data-testid="copy-pk">
                    {copied === "pk" ? <Check size={12} className="text-[#00E89D]" /> : <Copy size={12} className="text-white/50" />}
                  </button>
                </div>
              </div>
              <div>
                <p className="text-[9px] text-white/40 uppercase tracking-wider mb-1">Secret Key (server-side, Webhook-Signatur)</p>
                <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-black/40">
                  <code className="text-[11px] text-[#FF6B6B] font-mono flex-1 break-all" data-testid="new-sk">{justCreated.secret_key}</code>
                  <button onClick={() => copy(justCreated.secret_key, "sk")} className="p-1.5 rounded hover:bg-white/5" data-testid="copy-sk">
                    {copied === "sk" ? <Check size={12} className="text-[#00E89D]" /> : <Copy size={12} className="text-white/50" />}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create form */}
      <AnimatePresence>
        {showNew && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden rounded-2xl mb-3" style={{ background: "rgba(0,232,157,0.03)", border: "1px solid rgba(0,232,157,0.12)" }}>
            <div className="p-4 space-y-2.5">
              <input value={form.merchant_email} onChange={e => setForm({ ...form, merchant_email: e.target.value })}
                placeholder="Merchant E-Mail (muss existieren)"
                className="w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05] text-[12px] text-white/90 outline-none"
                data-testid="pay-merchant-email" />
              <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })}
                placeholder="Label (z.B. Production, Staging)"
                className="w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05] text-[12px] text-white/90 outline-none"
                data-testid="pay-label" />
              <div className="flex gap-2">
                <motion.button onClick={create} disabled={saving} whileTap={{ scale: 0.97 }}
                  className="flex-1 py-2.5 rounded-xl text-[11px] font-semibold bg-[#00E89D]/10 text-[#00E89D] border border-[#00E89D]/15 disabled:opacity-50 flex items-center justify-center gap-1.5"
                  data-testid="pay-key-save">
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <><Key size={12} /> Keys generieren</>}
                </motion.button>
                <motion.button onClick={() => setShowNew(false)} whileTap={{ scale: 0.97 }}
                  className="px-4 py-2.5 rounded-xl text-[11px] font-medium text-[#444] bg-white/[0.02] border border-white/[0.04]">
                  Abbrechen
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Docs Snippet */}
      <div className="rounded-2xl p-4 mb-3" style={{ background: "rgba(0,194,255,0.03)", border: "1px solid rgba(0,194,255,0.1)" }}>
        <div className="flex items-center gap-2 mb-2">
          <ExternalLink size={12} className="text-[#00C2FF]" />
          <p className="text-[11px] font-bold text-[#00C2FF]">Integration-Snippet</p>
        </div>
        <pre className="text-[10px] font-mono text-white/60 overflow-x-auto leading-relaxed">{`<script src="https://bidblitz.ae/api/pay.js"></script>
<div id="pay-btn"></div>
<script>
  BidBlitzPay.mount("#pay-btn", {
    publicKey: "pk_live_xxx",
    amount: 29.90, currency: "EUR",
    orderId: "ORDER-123",
    description: "Bestellung #123",
    successUrl: location.origin + "/thanks",
    cancelUrl: location.origin + "/cart",
    webhookUrl: "https://merchant.com/api/webhook",
    onSuccess: data => console.log("paid", data),
  });
</script>`}</pre>
      </div>

      {/* Keys list */}
      {loading ? (
        <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-20" />)}</div>
      ) : keys.length === 0 ? (
        <div className="text-center py-12">
          <Key size={40} className="mx-auto text-[#333] mb-3" />
          <p className="text-[12px] text-[#555]">Noch keine API-Keys erstellt</p>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map(k => (
            <motion.div key={k.key_id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-3"
              style={{ background: "rgba(255,255,255,0.018)", border: `1px solid ${k.revoked ? "rgba(255,71,87,0.15)" : "rgba(255,255,255,0.04)"}`, opacity: k.revoked ? 0.5 : 1 }}
              data-testid={`pay-key-${k.key_id}`}>
              <div className="flex items-start justify-between mb-1.5">
                <div>
                  <p className="text-[12px] font-bold text-white/85">{k.merchant_name || k.merchant_email}</p>
                  <p className="text-[10px] text-[#555]">{k.label} · {k.merchant_email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {k.revoked ? (
                    <span className="text-[9px] px-2 py-0.5 rounded bg-red-500/15 text-red-400 font-bold uppercase">Widerrufen</span>
                  ) : (
                    <span className="text-[9px] px-2 py-0.5 rounded bg-[#00E89D]/15 text-[#00E89D] font-bold uppercase">Aktiv</span>
                  )}
                  {!k.revoked && (
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => revoke(k.key_id)}
                      className="p-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                      data-testid={`pay-revoke-${k.key_id}`}>
                      <Trash2 size={11} className="text-[#FF6B6B]" />
                    </motion.button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 bg-black/30 mb-1">
                <code className="text-[10px] text-[#00E89D] font-mono flex-1 truncate">{k.public_key}</code>
                <button onClick={() => copy(k.public_key, k.key_id)} className="p-1 rounded hover:bg-white/5">
                  {copied === k.key_id ? <Check size={10} className="text-[#00E89D]" /> : <Copy size={10} className="text-white/40" />}
                </button>
              </div>
              <div className="flex items-center gap-4 text-[9px] text-white/35 mt-1">
                <span><Shield size={8} className="inline" /> {k.total_sessions || 0} Sessions</span>
                <span>€{(k.total_paid || 0).toFixed(2)} umgesetzt</span>
                <span className="ml-auto text-white/25">{new Date(k.created_at).toLocaleDateString("de-DE")}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
