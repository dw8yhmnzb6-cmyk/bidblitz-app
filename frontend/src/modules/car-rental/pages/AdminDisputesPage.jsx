/**
 * BidBlitz V2 - Admin Car Rental Disputes Page
 */
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, AlertTriangle, Loader2, Check, X, Send, MessageCircle,
  ChevronRight, Clock, CheckCircle, XCircle
} from "lucide-react";
import {
  getAdminDisputes, getAdminDispute, adminResolveDispute, addDisputeMessage
} from "../api";
import { useI18n } from "../../../store/I18nContext";

const STATUS_CFG = {
  open: { label: "Offen", color: "#FFB800" },
  resolved: { label: "Gelöst", color: "#00D26A" },
  rejected: { label: "Abgelehnt", color: "#FF4757" },
  escalated: { label: "Eskaliert", color: "#A855F7" },
};

export default function AdminDisputesPage({ onBack }) {
  const { t } = useI18n();
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(null);
  const [activeDispute, setActiveDispute] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [resolveForm, setResolveForm] = useState({ resolution: "", status: "resolved", admin_notes: "" });
  const [resolving, setResolving] = useState(false);

  useEffect(() => { loadList(); }, [filter]);

  const loadList = async () => {
    setLoading(true);
    try {
      const data = await getAdminDisputes(filter);
      setDisputes(data.disputes || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const openDetail = async (disputeId) => {
    setDetailLoading(true);
    try {
      const data = await getAdminDispute(disputeId);
      setActiveDispute(data.dispute);
    } catch (err) { console.error(err); }
    setDetailLoading(false);
  };

  const sendMsg = async () => {
    if (!msgText.trim() || !activeDispute) return;
    setSending(true);
    try {
      await addDisputeMessage(activeDispute.dispute_id, msgText);
      setMsgText("");
      openDetail(activeDispute.dispute_id);
    } catch (err) { alert(err.message); }
    setSending(false);
  };

  const handleResolve = async () => {
    if (!activeDispute) return;
    setResolving(true);
    try {
      await adminResolveDispute(activeDispute.dispute_id, resolveForm.resolution, resolveForm.status, resolveForm.admin_notes);
      setShowResolve(false);
      openDetail(activeDispute.dispute_id);
      loadList();
    } catch (err) { alert(err.message); }
    setResolving(false);
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
  const fmtTime = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    const h = Math.floor((Date.now() - dt) / 3600000);
    if (h < 1) return `${Math.floor(h * 60)} Min.`;
    if (h < 24) return `${h} Std.`;
    return dt.toLocaleDateString("de-DE");
  };

  // Detail view
  if (activeDispute) {
    const st = STATUS_CFG[activeDispute.status] || STATUS_CFG.open;
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white flex flex-col">
        <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setActiveDispute(null)}
              className="p-2 rounded-xl bg-white/5 border border-white/10" data-testid="dispute-detail-back">
              <ArrowLeft size={20} />
            </motion.button>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold truncate">#{activeDispute.dispute_id}</h2>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: `${st.color}20`, color: st.color }}>{st.label}</span>
                <span className="text-[10px] text-[#666]">{activeDispute.reason}</span>
              </div>
            </div>
            {activeDispute.status === "open" && (
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setShowResolve(true); setResolveForm({ resolution: "", status: "resolved", admin_notes: "" }); }}
                className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium"
                data-testid="resolve-dispute-btn">
                <Check size={14} />
              </motion.button>
            )}
          </div>
          {/* Info bar */}
          <div className="mt-2 flex gap-3 text-[10px] text-[#666]">
            <span>Kunde: {activeDispute.customer_id?.slice(0, 8)}</span>
            <span>Vendor: {activeDispute.vendor_id?.slice(0, 8)}</span>
            <span>Erstellt: {fmtDate(activeDispute.created_at)}</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {detailLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-[#00C2FF]" /></div>
          ) : (activeDispute.messages || []).map((msg, i) => {
            const isAdmin = msg.sender_role === "admin";
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  isAdmin
                    ? "bg-purple-500/20 text-white rounded-br-md border border-purple-500/30"
                    : msg.sender_role === "vendor"
                    ? "bg-[#00C2FF]/10 text-white rounded-bl-md border border-[#00C2FF]/20"
                    : "bg-white/5 text-white rounded-bl-md border border-white/10"
                }`}>
                  <p className="text-[10px] font-medium mb-0.5 opacity-60">{msg.sender_name} ({msg.sender_role})</p>
                  <p className="text-sm leading-relaxed">{msg.message}</p>
                  <p className="text-[10px] mt-1 text-[#555]">{fmtTime(msg.created_at)}</p>
                </div>
              </motion.div>
            );
          })}
          {activeDispute.resolution && (
            <div className="bg-green-500/5 rounded-2xl p-4 border border-green-500/20">
              <p className="text-xs font-semibold text-green-400 mb-1">Lösung</p>
              <p className="text-sm text-[#888]">{activeDispute.resolution}</p>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="sticky bottom-0 bg-[#0A0A0F]/95 backdrop-blur-xl border-t border-white/5 p-4">
          <div className="flex gap-2">
            <input type="text" value={msgText} onChange={e => setMsgText(e.target.value)}
              placeholder="Admin-Nachricht..."
              className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none"
              onKeyDown={e => e.key === "Enter" && sendMsg()} data-testid="dispute-msg-input" />
            <motion.button whileTap={{ scale: 0.9 }} onClick={sendMsg}
              disabled={!msgText.trim() || sending}
              className="p-3 rounded-xl bg-purple-500 text-white disabled:opacity-50" data-testid="dispute-send-btn">
              {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </motion.button>
          </div>
        </div>

        {/* Resolve Modal */}
        {showResolve && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center" onClick={() => setShowResolve(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }}
              onClick={e => e.stopPropagation()} className="w-full max-w-lg bg-[#111118] rounded-t-3xl p-6">
              <h3 className="text-lg font-bold mb-4">Streitfall lösen</h3>
              <div className="space-y-3 mb-6">
                <div>
                  <label className="text-xs text-[#666] mb-2 block">Status</label>
                  <div className="flex gap-2">
                    {[{ v: "resolved", l: "Gelöst", c: "#00D26A" }, { v: "rejected", l: "Abgelehnt", c: "#FF4757" }].map(s => (
                      <motion.button key={s.v} whileTap={{ scale: 0.95 }}
                        onClick={() => setResolveForm(f => ({ ...f, status: s.v }))}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium ${resolveForm.status === s.v ? `border-2` : "bg-white/5 border border-white/10"}`}
                        style={resolveForm.status === s.v ? { borderColor: s.c, background: `${s.c}15`, color: s.c } : {}}>
                        {s.l}
                      </motion.button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#666] mb-1 block">Lösung / Begründung *</label>
                  <textarea value={resolveForm.resolution}
                    onChange={e => setResolveForm(f => ({ ...f, resolution: e.target.value }))}
                    rows={3} placeholder="Beschreibe die Entscheidung..."
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none resize-none"
                    data-testid="resolve-text" />
                </div>
                <div>
                  <label className="text-xs text-[#666] mb-1 block">Admin-Notizen (intern)</label>
                  <input type="text" value={resolveForm.admin_notes}
                    onChange={e => setResolveForm(f => ({ ...f, admin_notes: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none"
                    placeholder="Interne Notiz..." />
                </div>
              </div>
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleResolve}
                disabled={!resolveForm.resolution.trim() || resolving}
                className="w-full py-4 rounded-xl bg-green-500 text-black font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                data-testid="confirm-resolve-btn">
                {resolving ? <Loader2 size={20} className="animate-spin" /> : <><CheckCircle size={20} /> Entscheidung speichern</>}
              </motion.button>
            </motion.div>
          </div>
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24">
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3 p-4">
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
            className="p-2 rounded-xl bg-white/5 border border-white/10" data-testid="admin-disputes-back">
            <ArrowLeft size={20} />
          </motion.button>
          <div>
            <h1 className="text-lg font-bold">Streitfälle</h1>
            <p className="text-xs text-[#666]">{disputes.length} Fälle</p>
          </div>
        </div>
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
          {[{ id: null, label: "Alle" }, { id: "open", label: "Offen" }, { id: "resolved", label: "Gelöst" }, { id: "rejected", label: "Abgelehnt" }].map(t => (
            <motion.button key={t.id || "all"} whileTap={{ scale: 0.95 }}
              onClick={() => setFilter(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap ${filter === t.id ? "bg-[#00C2FF] text-black" : "bg-white/5 text-[#888]"}`}>
              {t.label}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#00C2FF]" /></div>
        ) : disputes.length === 0 ? (
          <div className="text-center py-20">
            <AlertTriangle size={48} className="mx-auto text-[#333] mb-4" />
            <p className="text-white/70">Keine Streitfälle</p>
          </div>
        ) : disputes.map((d, idx) => {
          const st = STATUS_CFG[d.status] || STATUS_CFG.open;
          return (
            <motion.div key={d.dispute_id} initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
              onClick={() => openDetail(d.dispute_id)}
              className="bg-[#111118] rounded-2xl p-4 border border-white/5 cursor-pointer active:scale-[0.98] transition-transform"
              data-testid={`dispute-${d.dispute_id}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0 mr-3">
                  <h3 className="font-semibold text-sm">{d.reason}</h3>
                  <p className="text-xs text-[#666] truncate">{d.description?.slice(0, 80)}</p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0"
                  style={{ background: `${st.color}20`, color: st.color }}>{st.label}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#555]">
                <span>Von: {d.filed_by_name} ({d.filed_by_role})</span>
                <span>{d.messages?.length || 0} Nachrichten · {fmtDate(d.created_at)}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
