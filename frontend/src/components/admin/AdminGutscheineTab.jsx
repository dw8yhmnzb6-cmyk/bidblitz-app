import { motion, AnimatePresence } from "framer-motion";
import { Ticket, Euro, Loader2, X } from "lucide-react";

export default function AdminGutscheineTab({
  coupons,
  showCreateCoupon, setShowCreateCoupon,
  couponForm, setCouponForm,
  couponLoading, handleCreateCoupon, handleDeleteCoupon,
  showGrant, setShowGrant,
  grantForm, setGrantForm,
  grantLoading, handleGrantBalance,
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex gap-2">
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowCreateCoupon(true)}
          className="flex-1 py-3 rounded-xl bg-[#A855F7] text-white font-bold text-xs flex items-center justify-center gap-1.5"
          data-testid="create-coupon-btn">
          <Ticket size={14} /> Gutschein erstellen
        </motion.button>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowGrant(true)}
          className="flex-1 py-3 rounded-xl bg-[#00C2FF] text-black font-bold text-xs flex items-center justify-center gap-1.5"
          data-testid="grant-balance-btn">
          <Euro size={14} /> Guthaben vergeben
        </motion.button>
      </div>

      <AnimatePresence>
        {showCreateCoupon && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.15)" }}>
              <h4 className="text-sm font-bold text-white">Neuer Gutschein</h4>
              <div className="grid grid-cols-2 gap-2">
                <select value={couponForm.coupon_type} onChange={e => setCouponForm(p => ({ ...p, coupon_type: e.target.value }))}
                  className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white outline-none" data-testid="coupon-type">
                  <option value="eur">EUR Guthaben</option>
                  <option value="coins">Coins</option>
                  <option value="bid_credits">Bid Credits</option>
                  <option value="blz">BLZ Token</option>
                  <option value="kids_abo">Kids Abo (Monate)</option>
                  <option value="premium_month">Premium (Monate)</option>
                </select>
                <input type="number" placeholder="Wert" value={couponForm.value}
                  onChange={e => setCouponForm(p => ({ ...p, value: e.target.value }))}
                  className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white outline-none" data-testid="coupon-value" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="Code (auto)" value={couponForm.code}
                  onChange={e => setCouponForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white outline-none" data-testid="coupon-code" />
                <input type="number" placeholder="Max. Einlösungen" value={couponForm.max_uses}
                  onChange={e => setCouponForm(p => ({ ...p, max_uses: e.target.value }))}
                  className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white outline-none" />
              </div>
              <input type="text" placeholder="Beschreibung" value={couponForm.description}
                onChange={e => setCouponForm(p => ({ ...p, description: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white outline-none" />
              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.95 }} onClick={handleCreateCoupon} disabled={couponLoading || !couponForm.value}
                  className="flex-1 py-3 rounded-xl bg-[#A855F7] text-white font-bold text-xs disabled:opacity-30 flex items-center justify-center gap-1"
                  data-testid="save-coupon-btn">
                  {couponLoading ? <Loader2 size={14} className="animate-spin" /> : "Erstellen"}
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowCreateCoupon(false)}
                  className="px-4 py-3 rounded-xl bg-white/5 text-xs text-[#888]">Abbrechen</motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGrant && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(0,194,255,0.05)", border: "1px solid rgba(0,194,255,0.15)" }}>
              <h4 className="text-sm font-bold text-white">Guthaben vergeben</h4>
              <input type="email" placeholder="E-Mail des Users *" value={grantForm.user_email}
                onChange={e => setGrantForm(p => ({ ...p, user_email: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white outline-none" data-testid="grant-email" />
              <div className="grid grid-cols-2 gap-2">
                <select value={grantForm.grant_type} onChange={e => setGrantForm(p => ({ ...p, grant_type: e.target.value }))}
                  className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white outline-none" data-testid="grant-type">
                  <option value="eur">EUR</option>
                  <option value="coins">Coins</option>
                  <option value="bid_credits">Bid Credits</option>
                  <option value="blz">BLZ Token</option>
                </select>
                <input type="number" placeholder="Betrag *" value={grantForm.amount}
                  onChange={e => setGrantForm(p => ({ ...p, amount: e.target.value }))}
                  className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white outline-none" data-testid="grant-amount" />
              </div>
              <input type="text" placeholder="Grund (optional)" value={grantForm.reason}
                onChange={e => setGrantForm(p => ({ ...p, reason: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white outline-none" />
              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.95 }} onClick={handleGrantBalance}
                  disabled={grantLoading || !grantForm.user_email || !grantForm.amount}
                  className="flex-1 py-3 rounded-xl bg-[#00C2FF] text-black font-bold text-xs disabled:opacity-30 flex items-center justify-center gap-1"
                  data-testid="send-grant-btn">
                  {grantLoading ? <Loader2 size={14} className="animate-spin" /> : "Vergeben"}
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowGrant(false)}
                  className="px-4 py-3 rounded-xl bg-white/5 text-xs text-[#888]">Abbrechen</motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {coupons.length === 0 ? (
        <div className="text-center py-12">
          <Ticket size={40} className="mx-auto text-[#333] mb-3" />
          <p className="text-[#666] text-sm">Keine Gutscheine erstellt</p>
        </div>
      ) : coupons.map((c, i) => (
        <motion.div key={c.coupon_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03 }}
          className={`rounded-2xl p-4 border ${c.active ? "bg-white/[0.02] border-white/[0.06]" : "bg-red-500/5 border-red-500/10 opacity-50"}`}
          data-testid={`coupon-${c.coupon_id}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-[#A855F7]/20 text-[#A855F7] text-[11px] font-mono font-bold tracking-wider">{c.code}</span>
              <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${c.active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                {c.active ? "AKTIV" : "DEAKTIVIERT"}
              </span>
            </div>
            {c.active && (
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleDeleteCoupon(c.coupon_id)}
                className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20" data-testid={`delete-coupon-${c.coupon_id}`}>
                <X size={12} className="text-red-400" />
              </motion.button>
            )}
          </div>
          <p className="text-xs text-white/80 mb-1">{c.description || `${c.value} ${c.coupon_type}`}</p>
          <div className="flex items-center gap-3 text-[10px] text-[#666]">
            <span>Typ: {c.coupon_type.toUpperCase()}</span>
            <span>Wert: {c.value}</span>
            <span>Eingelöst: {c.used_count}/{c.max_uses}</span>
            <span>Ablauf: {c.expires_at ? new Date(c.expires_at).toLocaleDateString("de-DE") : "—"}</span>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
