import { useEffect, useState } from "react";
import { Fingerprint, Hand, Loader2, LockKeyhole, ShieldCheck, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { api } from "../../services/api";

export function WalletPaymentPinCard() {
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
      toast.error(error.message || "PIN-Status konnte nicht geladen werden");
    }
  };

  useEffect(() => { loadStatus(); }, []);

  const savePin = async () => {
    if (newPin.length !== 4 || confirmPin.length !== 4) {
      toast.error("PIN muss 4-stellig sein");
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("PIN-Bestätigung stimmt nicht");
      return;
    }
    setBusy(true);
    try {
      if (status?.has_pin) {
        await api.resetCustomerPaymentPin({ current_pin: currentPin, new_pin: newPin, confirm_pin: confirmPin });
        toast.success("Payment PIN aktualisiert");
      } else {
        await api.setCustomerPaymentPin({ pin: newPin, confirm_pin: confirmPin, current_pin: currentPin || undefined });
        toast.success("Payment PIN gesetzt");
      }
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      await loadStatus();
    } catch (error) {
      toast.error(error.message || "PIN konnte nicht gespeichert werden");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (verifyPin.length !== 4) {
      toast.error("Bitte 4-stellige PIN eingeben");
      return;
    }
    setBusy(true);
    try {
      const data = await api.verifyCustomerPaymentPin({ pin: verifyPin });
      setStatus((prev) => ({ ...(prev || {}), ...data }));
      toast[data.ok ? "success" : "error"](data.ok ? "PIN verifiziert" : data.locked ? "PIN temporär gesperrt" : "PIN ungültig");
      setVerifyPin("");
    } catch (error) {
      toast.error(error.message || "PIN-Prüfung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div className="rounded-2xl border p-4" style={{ background: "rgba(255,255,255,0.015)", borderColor: "rgba(0,194,255,0.08)" }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} data-testid="wallet-payment-pin-card">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-2xl bg-[#00C2FF]/10 border border-[#00C2FF]/15 flex items-center justify-center"><LockKeyhole size={18} className="text-[#00C2FF]" /></div>
        <div>
          <p className="text-[12px] font-semibold text-white">Payment PIN</p>
          <p className="text-[10px] text-slate-500">4-stellige PIN für sichere Zahlungen und High-Risk Freigaben.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <StatusPill label="Status" value={status?.has_pin ? "Aktiv" : "Nicht gesetzt"} testId="wallet-pin-status" />
        <StatusPill label="Lock" value={status?.locked ? `Gesperrt ${status?.retry_after_sec || 0}s` : "Frei"} testId="wallet-pin-lock-status" />
      </div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <input value={currentPin} onChange={(event) => setCurrentPin(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Aktuelle PIN" inputMode="numeric" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-sm tracking-[0.35em]" data-testid="wallet-pin-current-input" />
        <input value={newPin} onChange={(event) => setNewPin(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Neue PIN" inputMode="numeric" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-sm tracking-[0.35em]" data-testid="wallet-pin-new-input" />
        <input value={confirmPin} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Bestätigen" inputMode="numeric" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-sm tracking-[0.35em]" data-testid="wallet-pin-confirm-input" />
      </div>
      <div className="flex gap-2 mb-3">
        <button type="button" onClick={savePin} disabled={busy} className="flex-1 rounded-xl bg-[#00C2FF] py-2.5 text-sm font-bold text-white disabled:opacity-50" data-testid="wallet-pin-save-button">{busy ? <Loader2 size={15} className="mx-auto animate-spin" /> : status?.has_pin ? "PIN aktualisieren" : "PIN setzen"}</button>
      </div>
      <div className="rounded-xl border border-white/8 bg-black/10 p-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-2">Schnell prüfen</p>
        <div className="flex gap-2">
          <input value={verifyPin} onChange={(event) => setVerifyPin(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="PIN prüfen" inputMode="numeric" className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-sm tracking-[0.35em]" data-testid="wallet-pin-verify-input" />
          <button type="button" onClick={verify} disabled={busy} className="rounded-xl border border-[#00D26A]/20 bg-[#00D26A]/10 px-4 py-2 text-sm font-bold text-[#00D26A] disabled:opacity-50" data-testid="wallet-pin-verify-button">Prüfen</button>
        </div>
      </div>
    </motion.div>
  );
}

export function WalletBioPayCard() {
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
      toast.error(error.message || "BioPay-Status konnte nicht geladen werden");
    }
  };

  useEffect(() => { load(); }, []);

  const enroll = async () => {
    if ((templateToken || "").trim().length < 8) {
      toast.error("Bitte gültigen PalmPay-Token eingeben");
      return;
    }
    setBusy(true);
    try {
      await api.enrollBioPay({ template_token: templateToken.trim(), modality, nickname: modality === "palm" ? "PalmPay" : "FacePay" });
      toast.success(`${modality === "palm" ? "PalmPay" : "FacePay"} aktiviert`);
      setTemplateToken("");
      await load();
    } catch (error) {
      toast.error(error.message || "BioPay-Enrolment fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if ((verifyToken || "").trim().length < 8) {
      toast.error("Bitte gültigen Token eingeben");
      return;
    }
    setBusy(true);
    try {
      const response = await api.verifyBioPaySelf({ template_token: verifyToken.trim(), modality });
      toast[response.ok ? "success" : "error"](response.ok ? `${modality === "palm" ? "PalmPay" : "FacePay"} verifiziert` : "BioPay nicht erkannt");
      setVerifyToken("");
      await load();
    } catch (error) {
      toast.error(error.message || "BioPay-Verifikation fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (profileId) => {
    setBusy(true);
    try {
      await api.revokeBioPayProfile(profileId);
      toast.success("BioPay-Profil deaktiviert");
      await load();
    } catch (error) {
      toast.error(error.message || "Profil konnte nicht entfernt werden");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div className="rounded-2xl border p-4" style={{ background: "rgba(255,255,255,0.015)", borderColor: "rgba(125,244,210,0.12)" }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} data-testid="wallet-biopay-card">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-2xl bg-[#7df4d2]/10 border border-[#7df4d2]/15 flex items-center justify-center"><Hand size={18} className="text-[#7df4d2]" /></div>
        <div>
          <p className="text-[12px] font-semibold text-white">PalmPay / BioPay</p>
          <p className="text-[10px] text-slate-500">Nur verschlüsselte Template-Token. Keine biometrischen Bilder.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <StatusPill label="PalmPay" value={data.profiles.some((profile) => profile.modality === "palm") ? "Aktiv" : "Nicht aktiv"} testId="wallet-biopay-palm-status" />
        <StatusPill label="FacePay" value={data.facepay_enabled ? "Flag aktiv" : "Flag aus"} testId="wallet-biopay-face-status" />
      </div>
      <div className="grid grid-cols-[120px,1fr] gap-2 mb-2">
        <select value={modality} onChange={(event) => setModality(event.target.value)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" data-testid="wallet-biopay-modality-select">
          <option value="palm">PalmPay</option>
          <option value="face" disabled={!data.facepay_enabled}>FacePay</option>
        </select>
        <input value={templateToken} onChange={(event) => setTemplateToken(event.target.value.trim())} placeholder="Template-Token registrieren" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" data-testid="wallet-biopay-enroll-token-input" />
      </div>
      <div className="flex gap-2 mb-3">
        <button type="button" onClick={enroll} disabled={busy} className="flex-1 rounded-xl bg-[#7df4d2] py-2.5 text-sm font-bold text-black disabled:opacity-50" data-testid="wallet-biopay-enroll-button">{busy ? <Loader2 size={15} className="mx-auto animate-spin" /> : "BioPay aktivieren"}</button>
      </div>
      <div className="rounded-xl border border-white/8 bg-black/10 p-3 mb-3">
        <div className="flex items-center gap-2 mb-2"><Fingerprint size={14} className="text-[#7df4d2]" /><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Schnell prüfen</p></div>
        <div className="flex gap-2">
          <input value={verifyToken} onChange={(event) => setVerifyToken(event.target.value.trim())} placeholder="Template-Token prüfen" className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" data-testid="wallet-biopay-verify-token-input" />
          <button type="button" onClick={verify} disabled={busy} className="rounded-xl border border-[#7df4d2]/20 bg-[#7df4d2]/10 px-4 py-2 text-sm font-bold text-[#7df4d2] disabled:opacity-50" data-testid="wallet-biopay-verify-button">Prüfen</button>
        </div>
      </div>
      <div className="space-y-2" data-testid="wallet-biopay-profiles-list">
        {data.profiles.length === 0 ? <p className="text-[10px] text-slate-500">Noch kein BioPay-Profil aktiv.</p> : data.profiles.map((profile) => (
          <div key={profile.profile_id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2">
            <ShieldCheck size={14} className="text-[#7df4d2]" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-white" data-testid={`wallet-biopay-profile-${profile.profile_id}`}>{profile.modality === "palm" ? "PalmPay" : "FacePay"} · {profile.token_preview}</p>
              <p className="text-[9px] text-slate-500">{profile.enrolled_at ? `Aktiv seit ${String(profile.enrolled_at).slice(0, 16).replace("T", " ")}` : "Aktiv"}</p>
            </div>
            <button type="button" onClick={() => revoke(profile.profile_id)} className="rounded-xl border border-red-400/20 bg-red-400/10 p-2 text-red-300" data-testid={`wallet-biopay-revoke-${profile.profile_id}`}><Trash2 size={12} /></button>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

const StatusPill = ({ label, value, testId }) => (
  <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3" data-testid={testId}>
    <p className="text-[9px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
    <p className="mt-1 text-[12px] font-semibold text-white">{value}</p>
  </div>
);