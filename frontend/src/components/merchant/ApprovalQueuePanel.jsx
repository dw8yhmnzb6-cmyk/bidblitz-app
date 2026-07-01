import { useState } from "react";
import { motion } from "framer-motion";
import { Check, X, ShieldCheck, Loader2 } from "lucide-react";

const typeLabels = {
  wallet_topup: "Wallet Top-up",
  refund: "Refund",
  gift_card_create: "Gift Card",
  manual_wallet_adjustment: "Manual Wallet Adjustment",
  customer_account_change: "Customer Account Change",
  secure_payment: "Secure Payment",
  biopay_payment: "BioPay Payment",
};

const sensitiveKeys = new Set(["customer_id", "email", "recipient_email", "full_name", "name", "balance"]);

function maskEmail(value) {
  const raw = String(value || "");
  const [local, domain] = raw.split("@");
  if (!local || !domain) return "••••";
  return `${local.slice(0, 2)}•••@${domain}`;
}

function safePayloadPairs(payload = {}) {
  const rows = [];
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (key === "change_payload" && value && typeof value === "object") {
      rows.push(["change_fields", Object.keys(value).filter((field) => !sensitiveKeys.has(field)).join(", ") || "restricted"]);
      return;
    }
    if (sensitiveKeys.has(key)) {
      if (key.includes("email")) rows.push([key, maskEmail(value)]);
      return;
    }
    if (typeof value === "object") return;
    rows.push([key, String(value || "—")]);
  });
  return rows.slice(0, 6);
}

export const ApprovalQueuePanel = ({ approvals = [], onDecision, decidingId }) => {
  const [notes, setNotes] = useState({});

  return (
    <motion.div
      className="rounded-2xl p-3 backdrop-blur-xl"
      style={{ background: "rgba(8,12,20,0.7)", border: "1px solid rgba(255,255,255,0.04)" }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      data-testid="merchant-approval-execution-panel"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold">Executable Approval Queue</p>
          <p className="text-[9px] text-white/30">Top-ups, Refunds und Account-Änderungen werden bei Approval direkt ausgeführt.</p>
        </div>
        <div className="rounded-xl bg-[#00D26A]/10 border border-[#00D26A]/20 px-2 py-1 text-[9px] font-bold text-[#00D26A]" data-testid="merchant-approval-pending-count">
          {approvals.length} offen
        </div>
      </div>

      {approvals.length === 0 ? (
        <p className="text-[10px] text-white/15 text-center py-4" data-testid="merchant-approval-empty-state">Keine offenen Freigaben</p>
      ) : (
        <div className="space-y-2" data-testid="merchant-security-approval-list">
          {approvals.map((item) => {
            const pending = decidingId === item.approval_id;
            const payloadRows = safePayloadPairs(item.payload || {});
            return (
              <div
                key={item.approval_id}
                className="rounded-xl p-3"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
                data-testid={`merchant-security-approval-${item.approval_id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={13} className="text-[#00C2FF]" />
                      <p className="text-[11px] font-bold text-white/85" data-testid={`merchant-approval-type-${item.approval_id}`}>{typeLabels[item.approval_type] || item.approval_type}</p>
                    </div>
                    <p className="mt-1 text-[9px] text-white/35" data-testid={`merchant-approval-reason-${item.approval_id}`}>{item.reason}</p>
                    <p className="mt-1 text-[8px] text-white/20 font-mono" data-testid={`merchant-approval-id-${item.approval_id}`}>{item.approval_id}</p>
                  </div>
                  <p className="text-[11px] font-bold text-[#FFB800]" data-testid={`merchant-approval-amount-${item.approval_id}`}>€{Number(item.amount || 0).toFixed(2)}</p>
                </div>

                {payloadRows.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2" data-testid={`merchant-approval-payload-${item.approval_id}`}>
                    {payloadRows.map(([key, value]) => (
                      <div key={`${item.approval_id}-${key}`} className="rounded-lg bg-black/15 border border-white/[0.03] px-2 py-1.5">
                        <p className="text-[8px] uppercase tracking-widest text-white/25">{key}</p>
                        <p className="text-[9px] text-white/70 truncate">{value}</p>
                      </div>
                    ))}
                  </div>
                )}

                <textarea
                  value={notes[item.approval_id] || ""}
                  onChange={(event) => setNotes((prev) => ({ ...prev, [item.approval_id]: event.target.value }))}
                  placeholder="Manager-Notiz optional"
                  rows={2}
                  className="mt-3 w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2 text-[10px] text-white/80 outline-none placeholder:text-white/20"
                  data-testid={`merchant-approval-note-${item.approval_id}`}
                />

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onDecision(item.approval_id, "approved", notes[item.approval_id] || "")}
                    disabled={pending}
                    className="rounded-lg bg-[#00D26A]/15 px-3 py-2 text-[10px] font-bold text-[#00D26A] disabled:opacity-60 flex items-center justify-center gap-1.5"
                    data-testid={`merchant-approval-approve-${item.approval_id}`}
                  >
                    {pending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Approve & Execute
                  </button>
                  <button
                    type="button"
                    onClick={() => onDecision(item.approval_id, "rejected", notes[item.approval_id] || "")}
                    disabled={pending}
                    className="rounded-lg bg-[#FF5A5A]/15 px-3 py-2 text-[10px] font-bold text-[#FF8B8B] disabled:opacity-60 flex items-center justify-center gap-1.5"
                    data-testid={`merchant-approval-reject-${item.approval_id}`}
                  >
                    {pending ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />} Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};