/**
 * BidBlitz — KYC Verification Flow
 * 4-stage wizard: Start → Upload → Review → Status
 * Wraps the existing backend /api/kyc/* endpoints (single-shot multipart submit).
 */
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Shield, Upload, Camera, CheckCircle2, XCircle, Clock,
  Loader2, AlertCircle, Image as ImageIcon, ChevronRight, RefreshCw,
  CreditCard, FileText, User, Calendar, Globe, Hash,
} from "lucide-react";
import { KYC_ACCEPT_ATTR, getKycImageValidationMessage, isAlreadySubmittedKycError, isSupportedKycImage } from "../utils/kycUpload";

const API = process.env.REACT_APP_BACKEND_URL;

// ── Country list (most common — ISO 2 + label) ──
const COUNTRIES = [
  { code: "DE", label: "Deutschland" },
  { code: "AT", label: "Österreich" },
  { code: "CH", label: "Schweiz" },
  { code: "FR", label: "Frankreich" },
  { code: "IT", label: "Italien" },
  { code: "ES", label: "Spanien" },
  { code: "NL", label: "Niederlande" },
  { code: "BE", label: "Belgien" },
  { code: "GB", label: "Vereinigtes Königreich" },
  { code: "US", label: "USA" },
  { code: "AE", label: "VAE" },
  { code: "PL", label: "Polen" },
  { code: "TR", label: "Türkei" },
  { code: "AL", label: "Albanien" },
  { code: "XK", label: "Kosovo" },
];

// ────────────────────────────────────────────────────────────────────────
// Main component — orchestrates the 4 stages
// ────────────────────────────────────────────────────────────────────────
export default function KYCFlow({ onBack, onComplete }) {
  const [stage, setStage] = useState("loading"); // loading|start|upload|review|status
  const [statusData, setStatusData] = useState(null);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    date_of_birth: "",
    country: "DE",
    id_type: "national_id",  // backend allowed: national_id | passport | driver_license
    id_number: "",
    address: "",
  });
  const [files, setFiles] = useState({ front: null, back: null, selfie: null });
  const [previews, setPreviews] = useState({ front: null, back: null, selfie: null });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // On mount, load existing KYC status — show status page if already submitted
  useEffect(() => { loadStatus(); }, []);

  const loadStatus = async () => {
    try {
      const r = await fetch(`${API}/api/kyc/status`, { credentials: "include" });
      if (!r.ok) {
        setStage("start");
        return;
      }
      const d = await r.json();
      setStatusData(d);
      // Already done? show status. Otherwise start
      if (["approved", "pending", "rejected"].includes(d.kyc_status)) {
        setStage("status");
      } else {
        setStage("start");
      }
    } catch {
      setStage("start");
    }
  };

  const onFileSelect = (slot) => (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      setError("Datei zu groß (max. 10 MB)");
      return;
    }
    if (!isSupportedKycImage(f)) {
      setError(getKycImageValidationMessage());
      return;
    }
    setError(null);
    setFiles((p) => ({ ...p, [slot]: f }));
    const url = URL.createObjectURL(f);
    setPreviews((p) => ({ ...p, [slot]: url }));
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("id_front", files.front);
      fd.append("id_back", files.back);
      fd.append("selfie", files.selfie);
      fd.append("document_type", form.id_type);
      // Pass extra metadata as fields the backend accepts (or stores in user doc later)
      fd.append("first_name", form.first_name);
      fd.append("last_name", form.last_name);
      fd.append("date_of_birth", form.date_of_birth);
      fd.append("country", form.country);
      fd.append("id_number", form.id_number);
      fd.append("address", form.address);

      const r = await fetch(`${API}/api/kyc/submit`, {
        method: "POST", credentials: "include", body: fd,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        let errMsg = "Übermittlung fehlgeschlagen";
        if (typeof d.detail === "string") errMsg = d.detail;
        else if (Array.isArray(d.detail)) errMsg = d.detail.map((item) => item?.msg || item?.message || JSON.stringify(item)).join(" ");
        else if (d.detail && typeof d.detail.message === "string") errMsg = d.detail.message;
        else if (d.detail && typeof d.detail.msg === "string") errMsg = d.detail.msg;
        if (isAlreadySubmittedKycError(errMsg)) {
          await loadStatus();
          setSubmitting(false);
          return;
        }
        setError(errMsg);
        setSubmitting(false);
        return;
      }
      // Refresh status page
      await loadStatus();
      onComplete?.();
    } catch (e) {
      setError("Netzwerkfehler — bitte erneut versuchen");
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white" data-testid="kyc-flow">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#0a0a0f]/95 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <motion.button
          data-testid="kyc-back"
          whileTap={{ scale: 0.9 }}
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
          <ArrowLeft size={16} />
        </motion.button>
        <div className="flex items-center gap-2 flex-1">
          <Shield size={18} className="text-[#00C2FF]" />
          <h1 className="text-base font-bold">KYC Verifizierung</h1>
        </div>
        {stage !== "status" && stage !== "loading" && (
          <span className="text-[10px] text-white/40 font-medium">
            {stage === "start" ? "1/3" : stage === "upload" ? "2/3" : "3/3"}
          </span>
        )}
      </div>

      <AnimatePresence mode="wait">
        {stage === "loading" && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#00C2FF]" />
          </motion.div>
        )}

        {stage === "start" && (
          <KYCStartPage key="start" onStart={() => setStage("upload")} />
        )}

        {stage === "upload" && (
          <KYCUploadPage
            key="upload"
            form={form}
            setForm={setForm}
            files={files}
            previews={previews}
            onFileSelect={onFileSelect}
            error={error}
            setError={setError}
            onContinue={() => {
              // Validate
              if (!form.first_name || !form.last_name || !form.date_of_birth ||
                  !form.country || !form.id_type || !form.id_number) {
                setError("Bitte alle Felder ausfüllen");
                return;
              }
              if (!files.front || !files.back || !files.selfie) {
                setError("Bitte alle 3 Fotos hochladen");
                return;
              }
              setError(null);
              setStage("review");
            }}
          />
        )}

        {stage === "review" && (
          <KYCReviewPage
            key="review"
            form={form}
            previews={previews}
            submitting={submitting}
            error={error}
            onBack={() => setStage("upload")}
            onSubmit={submit}
          />
        )}

        {stage === "status" && (
          <KYCStatusPage
            key="status"
            status={statusData}
            onRetry={() => { setStatusData(null); setStage("start"); }}
            onBack={onBack}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Stage 1 — Start Page
// ────────────────────────────────────────────────────────────────────────
function KYCStartPage({ onStart }) {
  return (
    <motion.div data-testid="kyc-start-page"
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="p-5 max-w-md mx-auto pb-24">
      <div className="text-center mb-7">
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="w-20 h-20 mx-auto mb-5 rounded-3xl flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, rgba(0,194,255,0.15) 0%, rgba(168,85,247,0.15) 100%)",
            border: "1px solid rgba(0,194,255,0.20)",
          }}>
          <Shield size={36} className="text-[#00C2FF]" />
        </motion.div>
        <h2 className="text-2xl font-bold mb-2">Identität verifizieren</h2>
        <p className="text-sm text-white/50 leading-relaxed">
          Schalte Karten, hohe Limits und alle Premium-Features frei.
          Dauert weniger als 3 Minuten.
        </p>
      </div>

      <div className="space-y-3 mb-7">
        {[
          { icon: CreditCard, label: "Virtuelle Debit-Karten erstellen", color: "#00C2FF" },
          { icon: Shield, label: "Höhere Wallet-Limits (bis 50.000 €/Tag)", color: "#A855F7" },
          { icon: CheckCircle2, label: "Stripe Issuing & Crypto-Funktionen", color: "#00D26A" },
        ].map((b, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.07 }}
            className="flex items-center gap-3 p-3 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: `${b.color}15`, border: `1px solid ${b.color}25` }}>
              <b.icon size={16} style={{ color: b.color }} />
            </div>
            <span className="text-sm text-white/80 font-medium">{b.label}</span>
          </motion.div>
        ))}
      </div>

      <div className="rounded-2xl p-4 mb-5" style={{ background: "rgba(255,184,0,0.06)", border: "1px solid rgba(255,184,0,0.15)" }}>
        <p className="text-xs text-[#FFB800] font-semibold mb-1">Was du brauchst:</p>
        <ul className="text-xs text-white/60 space-y-1 leading-relaxed">
          <li>• Personalausweis oder Reisepass (Vorder- + Rückseite)</li>
          <li>• Selfie mit Ausweis in der Hand</li>
          <li>• Gute Beleuchtung, keine Spiegelungen</li>
        </ul>
      </div>

      <motion.button
        data-testid="kyc-start-btn"
        whileTap={{ scale: 0.97 }}
        onClick={onStart}
        className="w-full py-4 rounded-2xl bg-[#00C2FF] text-black font-bold flex items-center justify-center gap-2"
        style={{ boxShadow: "0 8px 32px rgba(0,194,255,0.35)" }}>
        Verifizierung starten
        <ChevronRight size={18} />
      </motion.button>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Stage 2 — Upload Page (form + 3 file uploads)
// ────────────────────────────────────────────────────────────────────────
function KYCFormField({ form, setForm, label, icon: Icon, name, type = "text", placeholder, options }) {
  return (
  <div className="mb-3">
    <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1.5 flex items-center gap-1.5">
      <Icon size={10} /> {label}
    </label>
    {options ? (
      <select
        value={form[name]}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        data-testid={`kyc-input-${name}`}
        className="w-full px-3.5 py-3 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-[#00C2FF] outline-none">
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#0a0a0f]">{o.label}</option>
        ))}
      </select>
    ) : (
      <input
        type={type}
        value={form[name]}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        placeholder={placeholder}
        data-testid={`kyc-input-${name}`}
        className="w-full px-3.5 py-3 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-[#00C2FF] outline-none placeholder:text-white/25"
      />
    )}
  </div>
  );
}

function KYCUploadPage({ form, setForm, files, previews, onFileSelect, error, setError, onContinue }) {

  return (
    <motion.div data-testid="kyc-upload-page"
      initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
      className="p-5 max-w-md mx-auto pb-32">
      <h2 className="text-xl font-bold mb-1">Persönliche Daten</h2>
      <p className="text-xs text-white/45 mb-5">Genau wie auf deinem Ausweis.</p>

      {/* Personal info */}
      <div className="grid grid-cols-2 gap-2.5">
        <KYCFormField form={form} setForm={setForm} label="Vorname" icon={User} name="first_name" placeholder="Max" />
        <KYCFormField form={form} setForm={setForm} label="Nachname" icon={User} name="last_name" placeholder="Mustermann" />
      </div>
      <KYCFormField form={form} setForm={setForm} label="Geburtsdatum" icon={Calendar} name="date_of_birth" type="date" />
      <KYCFormField form={form} setForm={setForm} label="Land" icon={Globe} name="country"
        options={COUNTRIES.map((c) => ({ value: c.code, label: c.label }))} />

      <KYCFormField form={form} setForm={setForm} label="Ausweisart" icon={FileText} name="id_type"
        options={[
          { value: "national_id", label: "Personalausweis" },
          { value: "passport", label: "Reisepass" },
          { value: "driver_license", label: "Führerschein" },
        ]} />
      <KYCFormField form={form} setForm={setForm} label="Ausweis-Nummer" icon={Hash} name="id_number" placeholder="LX12345678" />
      <KYCFormField form={form} setForm={setForm} label="Adresse (optional)" icon={Globe} name="address" placeholder="Straße, PLZ Ort" />

      {/* Document Uploads */}
      <h3 className="text-sm font-bold mt-6 mb-3 flex items-center gap-2">
        <Camera size={14} className="text-[#00C2FF]" /> Foto-Upload
      </h3>

      {[
        { slot: "front", label: "Ausweis Vorderseite", icon: FileText },
        { slot: "back", label: "Ausweis Rückseite", icon: FileText },
        { slot: "selfie", label: "Selfie mit Ausweis in der Hand", icon: Camera },
      ].map(({ slot, label, icon: Icon }) => (
        <FileUpload
          key={slot} slot={slot} label={label} Icon={Icon}
          file={files[slot]} preview={previews[slot]}
          onChange={onFileSelect(slot)}
        />
      ))}

      {error && (
        <div data-testid="kyc-upload-error"
          className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 mt-4">
          <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      <motion.button
        data-testid="kyc-continue-btn"
        whileTap={{ scale: 0.97 }}
        onClick={onContinue}
        className="w-full py-4 rounded-2xl bg-[#00C2FF] text-black font-bold flex items-center justify-center gap-2 mt-6"
        style={{ boxShadow: "0 8px 32px rgba(0,194,255,0.35)" }}>
        Weiter zur Überprüfung
        <ChevronRight size={18} />
      </motion.button>
    </motion.div>
  );
}

function FileUpload({ slot, label, Icon, file, preview, onChange }) {
  const inputRef = useRef(null);
  return (
    <div className="mb-3">
      <input ref={inputRef} type="file" accept={KYC_ACCEPT_ATTR}
        onChange={onChange} className="hidden"
        data-testid={`kyc-file-input-${slot}`} />
      <motion.button
        type="button"
        whileTap={{ scale: 0.98 }}
        onClick={() => inputRef.current?.click()}
        data-testid={`kyc-upload-${slot}`}
        className="w-full rounded-2xl overflow-hidden relative group"
        style={{
          background: preview ? "transparent" : "rgba(255,255,255,0.025)",
          border: preview ? "2px solid rgba(0,194,255,0.40)" : "2px dashed rgba(255,255,255,0.12)",
          minHeight: "100px",
        }}>
        {preview ? (
          <div className="relative">
            <img src={preview} alt={label} className="w-full max-h-44 object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-3">
              <div className="flex items-center gap-2 text-white">
                <CheckCircle2 size={14} className="text-[#00D26A]" />
                <span className="text-xs font-semibold">{label}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(0,194,255,0.10)", border: "1px solid rgba(0,194,255,0.20)" }}>
              <Icon size={20} className="text-[#00C2FF]" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-semibold text-white/90">{label}</p>
              <p className="text-[10px] text-white/40">Tap zum Hochladen · max 10 MB</p>
            </div>
            <Upload size={14} className="text-white/40" />
          </div>
        )}
      </motion.button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Stage 3 — Review Page
// ────────────────────────────────────────────────────────────────────────
function KYCReviewRow({ label, value }) {
  return (
  <div className="flex justify-between py-2.5 border-b border-white/5">
    <span className="text-xs text-white/40">{label}</span>
    <span className="text-xs text-white/90 font-semibold text-right max-w-[60%] break-words">{value || "—"}</span>
  </div>
  );
}

function KYCReviewPage({ form, previews, submitting, error, onBack, onSubmit }) {
  const country = COUNTRIES.find((c) => c.code === form.country)?.label || form.country;
  const idType = { national_id: "Personalausweis", passport: "Reisepass", driver_license: "Führerschein" }[form.id_type] || form.id_type;

  return (
    <motion.div data-testid="kyc-review-page"
      initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
      className="p-5 max-w-md mx-auto pb-32">
      <h2 className="text-xl font-bold mb-1">Daten prüfen</h2>
      <p className="text-xs text-white/45 mb-5">Letzter Schritt — alles korrekt?</p>

      <div className="rounded-2xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <KYCReviewRow label="Vorname" value={form.first_name} />
        <KYCReviewRow label="Nachname" value={form.last_name} />
        <KYCReviewRow label="Geburtsdatum" value={form.date_of_birth} />
        <KYCReviewRow label="Land" value={country} />
        <KYCReviewRow label="Ausweisart" value={idType} />
        <KYCReviewRow label="Ausweis-Nr." value={form.id_number} />
        {form.address && <KYCReviewRow label="Adresse" value={form.address} />}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {["front", "back", "selfie"].map((slot) => (
          <div key={slot} className="rounded-xl overflow-hidden border border-white/10 aspect-square">
            {previews[slot] ? (
              <img src={previews[slot]} alt={slot} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-white/5">
                <ImageIcon size={20} className="text-white/30" />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-xl p-3 mb-4" style={{ background: "rgba(0,194,255,0.06)", border: "1px solid rgba(0,194,255,0.15)" }}>
        <p className="text-xs text-[#00C2FF] leading-relaxed">
          Mit dem Absenden bestätigst du, dass die Angaben korrekt sind. Wir prüfen
          deine Identität automatisch via KI — Ergebnis innerhalb weniger Minuten.
        </p>
      </div>

      {error && (
        <div data-testid="kyc-review-error"
          className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
          <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      <div className="flex gap-2">
        <motion.button
          data-testid="kyc-review-back"
          whileTap={{ scale: 0.97 }}
          onClick={onBack}
          disabled={submitting}
          className="flex-1 py-4 rounded-2xl bg-white/5 text-white/70 font-bold disabled:opacity-50">
          Zurück
        </motion.button>
        <motion.button
          data-testid="kyc-submit-btn"
          whileTap={{ scale: 0.97 }}
          onClick={onSubmit}
          disabled={submitting}
          className="flex-1 py-4 rounded-2xl bg-[#00D26A] text-black font-bold flex items-center justify-center gap-2 disabled:opacity-70"
          style={{ boxShadow: "0 8px 32px rgba(0,210,106,0.35)" }}>
          {submitting ? <><Loader2 size={16} className="animate-spin" /> Sende...</> : <>Absenden <CheckCircle2 size={18} /></>}
        </motion.button>
      </div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Stage 4 — Status Page
// ────────────────────────────────────────────────────────────────────────
function KYCStatusPage({ status, onRetry, onBack }) {
  if (!status) return null;
  const s = status.kyc_status;
  const config = {
    approved: {
      icon: CheckCircle2, color: "#00D26A", bg: "rgba(0,210,106,0.10)", border: "rgba(0,210,106,0.25)",
      title: "Verifiziert",
      message: "Deine Identität wurde erfolgreich verifiziert. Alle Premium-Features sind jetzt freigeschaltet.",
    },
    pending: {
      icon: Clock, color: "#FFB800", bg: "rgba(255,184,0,0.10)", border: "rgba(255,184,0,0.25)",
      title: "In Prüfung",
      message: "Deine Verifizierung läuft. KI-Prüfung benötigt meist nur wenige Minuten — manuelle Prüfung bis zu 48h.",
    },
    rejected: {
      icon: XCircle, color: "#FF4060", bg: "rgba(255,64,96,0.10)", border: "rgba(255,64,96,0.25)",
      title: "Abgelehnt",
      message: status.rejection_reason || "Verifizierung fehlgeschlagen. Bitte erneut einreichen mit klareren Fotos.",
    },
  }[s] || {
    icon: Shield, color: "#888", bg: "rgba(136,136,136,0.10)", border: "rgba(136,136,136,0.25)",
    title: "Nicht gestartet", message: "Bitte starte die Verifizierung, um Premium-Features freizuschalten.",
  };
  const Icon = config.icon;

  return (
    <motion.div data-testid="kyc-status-page"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="p-5 max-w-md mx-auto pb-24">
      <div className="rounded-3xl p-6 text-center mb-5" style={{ background: config.bg, border: `1px solid ${config.border}` }}>
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 12 }}
          className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
          style={{ background: `${config.color}20`, border: `1px solid ${config.color}40` }}>
          <Icon size={32} style={{ color: config.color }} />
        </motion.div>
        <h2 className="text-xl font-bold mb-2" style={{ color: config.color }}>{config.title}</h2>
        <p className="text-sm text-white/70 leading-relaxed">{config.message}</p>
      </div>

      {/* Capabilities matrix */}
      {status.can_use_features && (
        <div className="rounded-2xl p-4 mb-5" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <p className="text-[10px] uppercase tracking-wider text-white/40 mb-3 font-semibold">Freigeschaltete Funktionen</p>
          {Object.entries(status.can_use_features).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between py-1.5">
              <span className="text-xs text-white/70 capitalize">{k.replace(/_/g, " ")}</span>
              {v ? <CheckCircle2 size={14} className="text-[#00D26A]" /> : <XCircle size={14} className="text-white/20" />}
            </div>
          ))}
        </div>
      )}

      {status.ai_confidence != null && (
        <div className="rounded-xl p-3 mb-5" style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)" }}>
          <p className="text-[10px] uppercase tracking-wider text-[#A855F7] mb-1 font-semibold">KI-Konfidenz</p>
          <p className="text-lg font-bold">{Math.round(status.ai_confidence * 100)}%</p>
        </div>
      )}

      <div className="flex gap-2">
        {s === "rejected" && (
          <motion.button
            data-testid="kyc-retry-btn"
            whileTap={{ scale: 0.97 }}
            onClick={onRetry}
            className="flex-1 py-4 rounded-2xl bg-[#00C2FF] text-black font-bold flex items-center justify-center gap-2">
            <RefreshCw size={16} /> Erneut versuchen
          </motion.button>
        )}
        <motion.button
          data-testid="kyc-status-back"
          whileTap={{ scale: 0.97 }}
          onClick={onBack}
          className={`${s === "rejected" ? "" : "flex-1"} py-4 px-6 rounded-2xl bg-white/5 text-white/70 font-bold`}>
          Zurück
        </motion.button>
      </div>
    </motion.div>
  );
}
