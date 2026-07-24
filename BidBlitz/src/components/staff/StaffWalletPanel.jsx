/**
 * Staff Wallet Panel — Merchant View
 * Bonus vergeben, Trinkgeld-Pott verteilen, Balances anzeigen
 */
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, Plus, Coins, Loader2, Landmark, X, Banknote, CheckCircle2, AlertCircle, CreditCard } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

const BONUS_TYPES = [
  { id: "shift_bonus", label: "Schicht-Bonus" },
  { id: "punctuality", label: "Pünktlichkeit" },
  { id: "extra_shift", label: "Extra-Schicht" },
  { id: "performance", label: "Performance" },
  { id: "manual", label: "Manuell" },
];

export default function StaffWalletPanel({ members = [] }) {
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);

  // Bonus modal
  const [showBonus, setShowBonus] = useState(false);
  const [bonusForm, setBonusForm] = useState({ staff_id: "", type: "shift_bonus", amount_eur: 10, note: "" });

  // Tip modal
  const [showTip, setShowTip] = useState(false);
  const [tipForm, setTipForm] = useState({ total_amount_eur: 100, distribution: "equal_hours", note: "" });

  // Payout/Bank modal
  const [payoutTarget, setPayoutTarget] = useState(null); // {staff_id, name, balance}
  const [bankForm, setBankForm] = useState({ iban: "", account_holder: "", bic: "" });
  const [bankExisting, setBankExisting] = useState(null);
  const [bankLoading, setBankLoading] = useState(false);
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState("sepa_manual");

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/staff/wallet/balances`, { credentials: "include" });
      if (r.ok) setBalances((await r.json()).rows || []);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const grantBonus = async () => {
    if (!bonusForm.staff_id) return toast.error("Mitarbeiter wählen");
    if (bonusForm.amount_eur <= 0) return toast.error("Betrag > 0");
    const r = await fetch(`${API}/api/staff/wallet/bonus`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bonusForm),
    });
    if (r.ok) {
      toast.success("Bonus vergeben");
      setShowBonus(false);
      load();
    } else {
      toast.error("Fehler");
    }
  };

  const createTipPot = async () => {
    const r = await fetch(`${API}/api/staff/wallet/tips/pot`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tipForm),
    });
    const data = await r.json();
    if (r.ok) {
      toast.success(`Pott verteilt an ${data.recipients} Mitarbeiter`);
      setShowTip(false);
      load();
    } else {
      toast.error(data.detail || "Verteilung fehlgeschlagen");
    }
  };

  const requestPayout = async (staffId) => {
    const r = await fetch(`${API}/api/staff/wallet/payout`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staff_id: staffId }),
    });
    if (r.ok) {
      const d = await r.json();
      toast.success(`${d.marked_paid} Buchung(en) als ausgezahlt markiert`);
      load();
    }
  };

  const total = balances.reduce((s, r) => s + (r.balance_eur || 0), 0);

  return (
    <div data-testid="staff-wallet-panel" className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl p-4 bg-gradient-to-br from-[#10B981]/15 to-transparent border border-[#10B981]/30">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-[#10B981]" />
            <h3 className="text-sm font-bold">Wallet — Bonus & Trinkgeld</h3>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/40 uppercase">Offen gesamt</p>
            <p className="text-xl font-bold">€{total.toFixed(2)}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setShowBonus(true)}
            data-testid="staff-wallet-grant-bonus-btn"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#10B981] text-black text-xs font-semibold"
          >
            <Plus size={12} /> Bonus vergeben
          </button>
          <button
            onClick={() => setShowTip(true)}
            data-testid="staff-wallet-tip-pot-btn"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold"
          >
            <Coins size={12} /> Trinkgeld-Pott
          </button>
        </div>
      </div>

      {/* Balances Table */}
      {loading ? (
        <div className="py-6 flex justify-center"><Loader2 size={18} className="animate-spin text-white/40" /></div>
      ) : (
        <div className="rounded-2xl bg-white/[0.02] border border-white/5 overflow-x-auto">
          <table className="w-full text-xs" data-testid="staff-wallet-balances-table">
            <thead>
              <tr className="text-left border-b border-white/10 text-white/50">
                <th className="px-3 py-2">Mitarbeiter</th>
                <th className="px-3 py-2 text-right">Bonus</th>
                <th className="px-3 py-2 text-right">Trinkgeld</th>
                <th className="px-3 py-2 text-right">Offen</th>
                <th className="px-3 py-2 text-center">Stripe</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {balances.filter((r) => r.balance_eur > 0 || r.tips_credited_eur > 0).map((r) => (
                <tr key={r.staff_id} className="border-b border-white/5 last:border-0">
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2 text-right text-white/70">€{r.bonus_credited_eur.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right text-white/70">€{r.tips_credited_eur.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-bold text-[#10B981]">€{r.balance_eur.toFixed(2)}</td>
                  <td className="px-3 py-2 text-center">
                    <ConnectStatusPill staffId={r.staff_id} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.balance_eur > 0 && (
                      <button
                        onClick={() => requestPayout(r.staff_id)}
                        data-testid={`payout-${r.staff_id}-btn`}
                        className="text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-white/10"
                      >
                        Auszahlen
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {balances.filter((r) => r.balance_eur > 0 || r.tips_credited_eur > 0).length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-white/40 text-xs">Noch keine Bonus-/Trinkgeld-Buchungen</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Bonus Modal */}
      {showBonus && (
        <Modal onClose={() => setShowBonus(false)} title="Bonus vergeben">
          <select
            value={bonusForm.staff_id}
            onChange={(e) => setBonusForm({ ...bonusForm, staff_id: e.target.value })}
            data-testid="staff-bonus-staff-select"
            className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm mb-2"
          >
            <option value="">— Mitarbeiter wählen —</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select
            value={bonusForm.type}
            onChange={(e) => setBonusForm({ ...bonusForm, type: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm mb-2"
          >
            {BONUS_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <input
            type="number"
            step="0.01"
            value={bonusForm.amount_eur}
            onChange={(e) => setBonusForm({ ...bonusForm, amount_eur: parseFloat(e.target.value) || 0 })}
            placeholder="Betrag in €"
            className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm mb-2"
          />
          <input
            type="text"
            value={bonusForm.note}
            onChange={(e) => setBonusForm({ ...bonusForm, note: e.target.value })}
            placeholder="Notiz (optional)"
            className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm mb-3"
          />
          <button onClick={grantBonus} data-testid="staff-bonus-submit-btn" className="w-full py-2.5 rounded-lg bg-[#10B981] text-black font-semibold text-sm">
            Bonus gutschreiben
          </button>
        </Modal>
      )}

      {/* Tip Modal */}
      {showTip && (
        <Modal onClose={() => setShowTip(false)} title="Trinkgeld-Pott verteilen">
          <input
            type="number"
            step="0.01"
            value={tipForm.total_amount_eur}
            onChange={(e) => setTipForm({ ...tipForm, total_amount_eur: parseFloat(e.target.value) || 0 })}
            placeholder="Gesamtbetrag €"
            className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm mb-2"
          />
          <select
            value={tipForm.distribution}
            onChange={(e) => setTipForm({ ...tipForm, distribution: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm mb-2"
          >
            <option value="equal_hours">Nach gearbeiteten Stunden</option>
            <option value="equal_staff">Gleichmäßig pro Person</option>
          </select>
          <input
            type="text"
            value={tipForm.note}
            onChange={(e) => setTipForm({ ...tipForm, note: e.target.value })}
            placeholder="Notiz (optional)"
            className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm mb-3"
          />
          <button onClick={createTipPot} data-testid="staff-tip-submit-btn" className="w-full py-2.5 rounded-lg bg-[#F59E0B] text-black font-semibold text-sm">
            Pott verteilen
          </button>
        </Modal>
      )}
    </div>
  );
}

function Modal({ onClose, title, children }) {
  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-3xl p-5">
        <h3 className="text-base font-bold mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function ConnectStatusPill({ staffId }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/api/staff/wallet/connect/status/${staffId}?live=false`, { credentials: "include" });
        if (r.ok) setStatus(await r.json());
      } catch (e) {}
    })();
  }, [staffId]);

  const startOnboarding = async (e) => {
    e.stopPropagation();
    setBusy(true);
    try {
      const origin = window.location.origin;
      const return_url = `${origin}/merchant/staff?stripe_return=1&staff=${staffId}`;
      const r = await fetch(`${API}/api/staff/wallet/connect/onboard`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_id: staffId, return_url, refresh_url: return_url }),
      });
      const d = await r.json();
      if (r.ok && d.onboarding_url) {
        // Open in new tab so manager keeps the dashboard
        window.open(d.onboarding_url, "_blank", "noopener");
        toast.success("Onboarding-Link geöffnet. Sende den Link auch an den Mitarbeiter.");
        // Copy to clipboard
        try { await navigator.clipboard.writeText(d.onboarding_url); toast("Link kopiert"); } catch {}
      } else {
        toast.error(d.detail || "Onboarding fehlgeschlagen");
      }
    } catch (e) { toast.error("Netzwerkfehler"); }
    setBusy(false);
  };

  if (!status?.connected) {
    return (
      <button
        onClick={startOnboarding}
        disabled={busy}
        data-testid={`connect-onboard-${staffId}`}
        className="text-[10px] px-2 py-1 rounded bg-[#635BFF]/15 text-[#A0AEFF] font-semibold border border-[#635BFF]/30 hover:bg-[#635BFF]/25 disabled:opacity-60"
        title="Stripe Connect Express Onboarding starten"
      >
        {busy ? "…" : "+ Connect"}
      </button>
    );
  }
  const payouts = !!status.payouts_enabled;
  const submitted = !!status.details_submitted;
  if (payouts) {
    return (
      <span data-testid={`connect-status-${staffId}-active`} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-[#10D981]/15 text-[#10D981] font-semibold">
        <CheckCircle2 size={10} /> Aktiv
      </span>
    );
  }
  if (submitted) {
    return (
      <span data-testid={`connect-status-${staffId}-review`} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-[#A855F7]/15 text-[#A855F7] font-semibold">
        <Loader2 size={10} className="animate-spin" /> Prüfung
      </span>
    );
  }
  return (
    <button
      onClick={startOnboarding}
      disabled={busy}
      data-testid={`connect-incomplete-${staffId}`}
      className="text-[10px] px-2 py-1 rounded bg-[#F5A524]/15 text-[#F5A524] font-semibold border border-[#F5A524]/30"
      title="Setup fortsetzen"
    >
      <AlertCircle size={10} className="inline mr-0.5" /> Unvollst.
    </button>
  );
}
