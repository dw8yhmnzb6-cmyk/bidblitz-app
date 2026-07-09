import { useEffect, useState } from "react";
import { Fingerprint, Hand, Loader2, LockKeyhole, ShieldCheck, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useI18n } from "../../store";

import { api } from "../../services/api";

export function WalletPaymentPinCard() {
  const { t } = useI18n();
  const [status, setStatus] = useState(null);
  const [verifyPin, setVerifyPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);

  const loadStatus = async () => {
    try {
      const data = await api.getCustomerPaymentPinStatus();
      setStatus(data);
    } catch (error) {
      toast.error(error.message || t("wallet.pin_status_load_failed"));
    }
  };

  useEffect(() => { loadStatus(); }, []);

  const savePin = async () => {
    if (newPin.length !== 4 || confirmPin.length !== 4) {
      toast.error(t("wallet.pin_must_be_4_digits"));
      return;
    }
    if (newPin !== confirmPin) {
      toast.error(t("wallet.pin_confirm_mismatch"));
      return;
    }
    setBusy(true);
    try {
      if (status?.has_pin) {
        await api.resetCustomerPaymentPin({ current_pin: currentPin, new_pin: newPin, confirm_pin: confirmPin });
        toast.success(t("wallet.pin_updated"));
      } else {
        await api.setCustomerPaymentPin({ pin: newPin, confirm_pin: confirmPin, current_pin: currentPin || undefined });
        toast.success(t("wallet.pin_set"));
      }
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      await loadStatus();
    } catch (error) {
      toast.error(error.message || t("wallet.pin_save_failed"));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (verifyPin.length !== 4) {
      toast.error(t("wallet.pin_enter_4_digits"));
      return;
    }
    setBusy(true);
    try {
      const data = await api.verifyCustomerPaymentPin({ pin: verifyPin });
      setStatus((prev) => ({ ...(prev || {}), ...data }));
      toast[data.ok ? "success" : "error"](data.ok ? t("wallet.pin_verified") : data.locked ? t("wallet.pin_locked") : t("wallet.pin_invalid"));
      setVerifyPin("");
    } catch (error) {
      toast.error(error.message || t("wallet.pin_verify_failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      className="rounded-[26px] border p-4 sm:p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"
      style={{ background: "#ffffff", borderColor: "rgba(15,23,42,0.12)" }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onViewportEnter={() => {
        document.body.setAttribute('data-cookie-banner-block', 'true');
      }}
      onViewportLeave={() => {
        document.body.removeAttribute('data-cookie-banner-block');
      }}
      data-testid="wallet-payment-pin-card"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-2xl bg-[#00C2FF]/10 border border-[#00C2FF]/15 flex items-center justify-center shrink-0"><LockKeyhole size={18} className="text-[#0095cc]" /></div>
        <div>
          <p className="text-[13px] font-semibold text-slate-950" data-testid="wallet-pin-card-title">{t("wallet.payment_pin")}</p>
          <p className="text-[11px] leading-relaxed text-slate-700">{t("wallet.payment_pin_desc")}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <StatusPill label={t("common.status")} value={status?.has_pin ? t("common.active") : t("wallet.not_set")} testId="wallet-pin-status" />
        <StatusPill label={t("wallet.lock_label")} value={status?.locked ? t("wallet.locked_for_seconds", { seconds: status?.retry_after_sec || 0 }) : t("wallet.free_status")} testId="wallet-pin-lock-status" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
        <input value={currentPin} onChange={(event) => setCurrentPin(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder={t("wallet.current_pin")} inputMode="numeric" className="min-h-[48px] rounded-2xl border border-slate-300 bg-slate-100 px-3 py-2 text-center text-base font-semibold tracking-[0.14em] sm:tracking-[0.28em] text-slate-950 placeholder:text-slate-500 focus:border-[#00C2FF] focus:bg-white focus:outline-none" style={{ WebkitTextFillColor: '#0f172a' }} data-testid="wallet-pin-current-input" />
        <input value={newPin} onChange={(event) => setNewPin(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder={t("wallet.new_pin")} inputMode="numeric" className="min-h-[48px] rounded-2xl border border-slate-300 bg-slate-100 px-3 py-2 text-center text-base font-semibold tracking-[0.14em] sm:tracking-[0.28em] text-slate-950 placeholder:text-slate-500 focus:border-[#00C2FF] focus:bg-white focus:outline-none" style={{ WebkitTextFillColor: '#0f172a' }} data-testid="wallet-pin-new-input" />
        <input value={confirmPin} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder={t("common.confirm")} inputMode="numeric" className="min-h-[48px] rounded-2xl border border-slate-300 bg-slate-100 px-3 py-2 text-center text-base font-semibold tracking-[0.14em] sm:tracking-[0.28em] text-slate-950 placeholder:text-slate-500 focus:border-[#00C2FF] focus:bg-white focus:outline-none" style={{ WebkitTextFillColor: '#0f172a' }} data-testid="wallet-pin-confirm-input" />
      </div>
      <div className="flex gap-2 mb-3">
        <button type="button" onClick={savePin} disabled={busy} className="flex-1 min-h-[48px] rounded-2xl bg-[#00C2FF] py-2.5 text-sm font-bold text-slate-950 shadow-[0_12px_30px_rgba(0,194,255,0.28)] disabled:opacity-50" data-testid="wallet-pin-save-button">{busy ? <Loader2 size={15} className="mx-auto animate-spin" /> : status?.has_pin ? t("wallet.pin_update_action") : t("wallet.pin_set_action")}</button>
      </div>
      <div className="rounded-2xl border border-slate-300 bg-slate-100 p-3 sm:p-4">
        <p className="text-[10px] uppercase tracking-[0.1em] text-slate-600 mb-2">{t("common.quick_check")}</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input value={verifyPin} onChange={(event) => setVerifyPin(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder={t("wallet.verify_pin")} inputMode="numeric" className="flex-1 min-h-[48px] rounded-2xl border border-slate-300 bg-white px-3 py-2 text-center text-base font-semibold tracking-[0.14em] sm:tracking-[0.28em] text-slate-950 placeholder:text-slate-500 focus:border-[#00D26A] focus:outline-none" style={{ WebkitTextFillColor: '#0f172a' }} data-testid="wallet-pin-verify-input" />
          <button type="button" onClick={verify} disabled={busy} className="min-h-[48px] rounded-2xl border border-[#00B85C] bg-[#00D26A] px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50" data-testid="wallet-pin-verify-button">{t("common.check")}</button>
        </div>
      </div>
    </motion.div>
  );
}

export function WalletBioPayCard() {
  const { t } = useI18n();
  const [data, setData] = useState({ profiles: [], recent_sessions: [], facepay_enabled: false, can_use_staff_biotime: false });
  const [templateToken, setTemplateToken] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [modality, setModality] = useState("palm");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const response = await api.getBioPayMe();
      setData(response);
    } catch (error) {
      toast.error(error.message || t("wallet.biopay_status_load_failed"));
    }
  };

  useEffect(() => { load(); }, []);

  const enroll = async () => {
    if ((templateToken || "").trim().length < 8) {
      toast.error(t("wallet.enter_valid_palm_token"));
      return;
    }
    setBusy(true);
    try {
      await api.enrollBioPay({ template_token: templateToken.trim(), modality, nickname: modality === "palm" ? "PalmPay" : "FacePay" });
      toast.success(t("wallet.biopay_enabled", { mode: modality === "palm" ? "PalmPay" : "FacePay" }));
      setTemplateToken("");
      await load();
    } catch (error) {
      toast.error(error.message || t("wallet.biopay_enrollment_failed"));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if ((verifyToken || "").trim().length < 8) {
      toast.error(t("wallet.enter_valid_token"));
      return;
    }
    setBusy(true);
    try {
      const response = await api.verifyBioPaySelf({ template_token: verifyToken.trim(), modality });
      toast[response.ok ? "success" : "error"](response.ok ? t("wallet.biopay_verified", { mode: modality === "palm" ? "PalmPay" : "FacePay" }) : t("wallet.biopay_not_recognized"));
      setVerifyToken("");
      await load();
    } catch (error) {
      toast.error(error.message || t("wallet.biopay_verification_failed"));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (profileId) => {
    setBusy(true);
    try {
      await api.revokeBioPayProfile(profileId);
      toast.success(t("wallet.biopay_profile_disabled"));
      await load();
    } catch (error) {
      toast.error(error.message || t("wallet.profile_remove_failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div className="rounded-[26px] border p-4 sm:p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]" style={{ background: "#ffffff", borderColor: "rgba(15,23,42,0.12)" }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onViewportEnter={() => {
      document.body.setAttribute('data-cookie-banner-block', 'true');
    }} onViewportLeave={() => {
      document.body.removeAttribute('data-cookie-banner-block');
    }} data-testid="wallet-biopay-card">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-2xl bg-[#7df4d2]/10 border border-[#7df4d2]/15 flex items-center justify-center shrink-0"><Hand size={18} className="text-[#0f9f74]" /></div>
        <div>
          <p className="text-[13px] font-semibold text-slate-950">PalmPay / BioPay</p>
          <p className="text-[11px] leading-relaxed text-slate-700">{t("wallet.biopay_desc")}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <StatusPill label="PalmPay" value={data.profiles.some((profile) => profile.modality === "palm") ? t("common.active") : t("wallet.not_active")} testId="wallet-biopay-palm-status" />
        <StatusPill label="FacePay" value={data.facepay_enabled ? t("wallet.flag_active") : t("wallet.flag_off")} testId="wallet-biopay-face-status" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[120px,1fr] gap-2 mb-2">
        <select value={modality} onChange={(event) => setModality(event.target.value)} className="min-h-[48px] rounded-2xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-950 focus:border-[#7df4d2] focus:bg-white focus:outline-none" style={{ WebkitTextFillColor: '#0f172a', color: '#0f172a' }} data-testid="wallet-biopay-modality-select">
          <option value="palm">PalmPay</option>
          <option value="face" disabled={!data.facepay_enabled}>FacePay</option>
        </select>
        <input value={templateToken} onChange={(event) => setTemplateToken(event.target.value.trim())} placeholder={t("wallet.register_template_token")} className="min-h-[48px] rounded-2xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-950 placeholder:text-slate-500 focus:border-[#7df4d2] focus:bg-white focus:outline-none" style={{ WebkitTextFillColor: '#0f172a' }} data-testid="wallet-biopay-enroll-token-input" />
      </div>
      <div className="flex gap-2 mb-3">
        <button type="button" onClick={enroll} disabled={busy} className="flex-1 min-h-[48px] rounded-2xl bg-[#52E0B9] py-2.5 text-sm font-bold text-slate-950 shadow-[0_12px_30px_rgba(82,224,185,0.28)] disabled:opacity-50" data-testid="wallet-biopay-enroll-button">{busy ? <Loader2 size={15} className="mx-auto animate-spin" /> : t("wallet.enable_biopay")}</button>
      </div>
      <div className="rounded-2xl border border-slate-300 bg-slate-100 p-3 mb-3">
        <div className="flex items-center gap-2 mb-2"><Fingerprint size={14} className="text-[#0f9f74]" /><p className="text-[10px] uppercase tracking-[0.1em] text-slate-600">{t("common.quick_check")}</p></div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input value={verifyToken} onChange={(event) => setVerifyToken(event.target.value.trim())} placeholder={t("wallet.verify_template_token")} className="flex-1 min-h-[48px] rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 placeholder:text-slate-500 focus:border-[#7df4d2] focus:outline-none" style={{ WebkitTextFillColor: '#0f172a' }} data-testid="wallet-biopay-verify-token-input" />
          <button type="button" onClick={verify} disabled={busy} className="min-h-[48px] rounded-2xl border border-[#39C89F] bg-[#52E0B9] px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50" data-testid="wallet-biopay-verify-button">{t("common.check")}</button>
        </div>
      </div>
      <div className="space-y-2" data-testid="wallet-biopay-profiles-list">
        {data.profiles.length === 0 ? <p className="text-[10px] text-slate-500">{t("wallet.no_biopay_profile")}</p> : data.profiles.map((profile) => (
          <div key={profile.profile_id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <ShieldCheck size={14} className="text-[#0f9f74]" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-slate-950" data-testid={`wallet-biopay-profile-${profile.profile_id}`}>{profile.modality === "palm" ? "PalmPay" : "FacePay"} · {profile.token_preview}</p>
              <p className="text-[9px] text-slate-500">{profile.enrolled_at ? t("wallet.active_since", { date: String(profile.enrolled_at).slice(0, 16).replace("T", " ") }) : t("common.active")}</p>
            </div>
            <button type="button" onClick={() => revoke(profile.profile_id)} className="rounded-xl border border-red-400/20 bg-red-50 p-2 text-red-500" data-testid={`wallet-biopay-revoke-${profile.profile_id}`}><Trash2 size={12} /></button>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

const StatusPill = ({ label, value, testId }) => (
  <div className="rounded-2xl border border-slate-300 bg-slate-100 p-3" data-testid={testId}>
    <p className="text-[9px] uppercase tracking-[0.1em] text-slate-600">{label}</p>
    <p className="mt-1 text-[12px] font-semibold text-slate-950">{value}</p>
  </div>
);