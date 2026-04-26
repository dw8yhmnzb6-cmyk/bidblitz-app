/**
 * BidBlitz V2 - KYC Verification Modal
 * 3-step ID verification:
 *  1. Document type selection
 *  2. Front + Back photo of ID
 *  3. Selfie holding the ID
 * Submits to /api/kyc/submit and shows AI verdict.
 */
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Camera, ChevronRight, ChevronLeft, Check, X, Upload,
  Loader2, CreditCard, BookOpen, Car, AlertCircle, Sparkles, RefreshCw,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const DOC_TYPES = [
  { id: "national_id",     label: "Personalausweis",  icon: CreditCard, desc: "EU-Ausweis (Vorder- + Rückseite)" },
  { id: "passport",        label: "Reisepass",         icon: BookOpen,   desc: "Datenseite mit Foto" },
  { id: "drivers_license", label: "Führerschein",      icon: Car,        desc: "Vorder- + Rückseite" },
];

const KYCVerificationModal = ({ open, onClose, onComplete }) => {
  const [step, setStep] = useState(0); // 0=doc, 1=front, 2=back, 3=selfie, 4=submit, 5=result
  const [docType, setDocType] = useState("national_id");
  const [frontFile, setFrontFile] = useState(null);
  const [backFile, setBackFile] = useState(null);
  const [selfieFile, setSelfieFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const frontInput = useRef(null);
  const backInput = useRef(null);
  const selfieInput = useRef(null);

  if (!open) return null;

  const reset = () => {
    setStep(0); setFrontFile(null); setBackFile(null);
    setSelfieFile(null); setResult(null); setError("");
  };

  const handleSubmit = async () => {
    if (!frontFile || !backFile || !selfieFile) {
      setError("Bitte alle 3 Fotos hochladen");
      return;
    }
    setSubmitting(true); setError("");
    try {
      const fd = new FormData();
      fd.append("id_front", frontFile);
      fd.append("id_back", backFile);
      fd.append("selfie", selfieFile);
      fd.append("document_type", docType);
      const res = await fetch(`${API}/api/kyc/submit`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || "Verifizierung fehlgeschlagen");
      setResult(d);
      setStep(5);
      if (d.status === "approved") {
        setTimeout(() => onComplete?.(d), 2000);
      }
    } catch (e) {
      setError(e.message);
    }
    setSubmitting(false);
  };

  const PhotoStep = ({ title, subtitle, file, setFile, inputRef, hint, testId, icon: Icon }) => (
    <div className="space-y-4" data-testid={`kyc-step-${testId}`}>
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00C2FF]/20 to-[#A855F7]/20 flex items-center justify-center mx-auto mb-2">
          <Icon size={26} className="text-[#00C2FF]" />
        </div>
        <h2 className="text-[16px] font-bold text-white">{title}</h2>
        <p className="text-[11px] text-gray-400 mt-1 px-2">{subtitle}</p>
      </div>

      {file ? (
        <div className="relative">
          <img src={URL.createObjectURL(file)} alt="preview"
            className="w-full aspect-[3/2] object-cover rounded-2xl border border-white/10"/>
          <button onClick={() => setFile(null)}
            data-testid={`kyc-${testId}-remove`}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 backdrop-blur flex items-center justify-center">
            <X size={14} className="text-white" />
          </button>
        </div>
      ) : (
        <div>
          <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden"
            data-testid={`kyc-${testId}-input`}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setFile(f);
            }}/>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => inputRef.current?.click()}
            data-testid={`kyc-${testId}-camera`}
            className="w-full aspect-[3/2] rounded-2xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-2 bg-white/[0.02]">
            <Camera size={28} className="text-[#00C2FF]" />
            <p className="text-[12px] font-bold text-white">Foto aufnehmen</p>
            <p className="text-[10px] text-gray-500">Tippen zum Öffnen der Kamera</p>
          </motion.button>
          {hint && <p className="text-[10px] text-amber-400 text-center mt-2 px-2">💡 {hint}</p>}
        </div>
      )}
    </div>
  );

  const StepIndicator = () => (
    <div className="flex items-center gap-1 mb-4">
      {[1, 2, 3, 4].map((n) => (
        <div key={n} className={`flex-1 h-1 rounded-full ${step >= n ? 'bg-gradient-to-r from-[#00C2FF] to-[#A855F7]' : 'bg-white/10'}`}/>
      ))}
    </div>
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
        data-testid="kyc-modal">
        <motion.div
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30 }}
          className="bg-[#0A0A0F] w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl border-t sm:border border-white/10 max-h-[92vh] overflow-y-auto">

          {/* Header */}
          <div className="sticky top-0 bg-[#0A0A0F]/95 backdrop-blur p-4 border-b border-white/5 flex items-center gap-3 z-10">
            {step > 0 && step < 5 && (
              <button onClick={() => setStep(s => s - 1)} data-testid="kyc-back"
                className="p-2 rounded-xl bg-white/5"><ChevronLeft size={16} /></button>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-[#00D26A]" />
                <h1 className="text-[14px] font-bold">Identitätsprüfung</h1>
              </div>
              <p className="text-[10px] text-gray-500">
                {step === 0 ? "Dokumenttyp wählen"
                : step === 1 ? "Vorderseite"
                : step === 2 ? "Rückseite"
                : step === 3 ? "Selfie mit Ausweis"
                : step === 4 ? "Wird geprüft…"
                : "Ergebnis"}
              </p>
            </div>
            <button onClick={onClose} data-testid="kyc-close"
              className="p-2 rounded-xl bg-white/5"><X size={16} /></button>
          </div>

          <div className="p-4">
            {step < 4 && <StepIndicator />}

            {/* Step 0: doc type */}
            {step === 0 && (
              <div className="space-y-3" data-testid="kyc-step-doctype">
                <p className="text-[12px] text-gray-400 mb-3">
                  Welches Dokument möchtest du für die Verifizierung benutzen?
                </p>
                {DOC_TYPES.map(d => {
                  const Icon = d.icon;
                  const sel = docType === d.id;
                  return (
                    <button key={d.id}
                      data-testid={`kyc-doctype-${d.id}`}
                      onClick={() => setDocType(d.id)}
                      className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-colors text-left ${sel ? 'bg-[#00C2FF]/10 border-[#00C2FF]/40' : 'bg-white/5 border-white/10'}`}>
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${sel ? 'bg-[#00C2FF]/30' : 'bg-white/5'}`}>
                        <Icon size={20} className={sel ? "text-[#00C2FF]" : "text-gray-400"} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[14px] font-bold">{d.label}</p>
                        <p className="text-[10px] text-gray-500">{d.desc}</p>
                      </div>
                      {sel && <Check size={18} className="text-[#00C2FF]" />}
                    </button>
                  );
                })}
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setStep(1)}
                  data-testid="kyc-doctype-next"
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#00C2FF] to-[#A855F7] text-white font-bold text-[14px] flex items-center justify-center gap-2 mt-4">
                  Weiter <ChevronRight size={16} />
                </motion.button>
              </div>
            )}

            {step === 1 && (
              <>
                <PhotoStep
                  title="Vorderseite des Ausweises"
                  subtitle="Mache ein scharfes Foto der Vorderseite — alle Ecken sichtbar, kein Blitz-Reflex."
                  file={frontFile} setFile={setFrontFile} inputRef={frontInput}
                  hint="Lege den Ausweis auf eine dunkle, einfarbige Fläche."
                  testId="front" icon={CreditCard}/>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setStep(2)}
                  disabled={!frontFile} data-testid="kyc-front-next"
                  className="w-full py-3.5 mt-4 rounded-2xl bg-gradient-to-r from-[#00C2FF] to-[#A855F7] text-white font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-40">
                  Weiter <ChevronRight size={16} />
                </motion.button>
              </>
            )}

            {step === 2 && (
              <>
                <PhotoStep
                  title="Rückseite des Ausweises"
                  subtitle="Foto der Rückseite — auch bei Reisepass: einfach gleiche Seite zweimal hochladen."
                  file={backFile} setFile={setBackFile} inputRef={backInput}
                  hint="MRZ-Streifen muss klar lesbar sein."
                  testId="back" icon={CreditCard}/>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setStep(3)}
                  disabled={!backFile} data-testid="kyc-back-next"
                  className="w-full py-3.5 mt-4 rounded-2xl bg-gradient-to-r from-[#00C2FF] to-[#A855F7] text-white font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-40">
                  Weiter <ChevronRight size={16} />
                </motion.button>
              </>
            )}

            {step === 3 && (
              <>
                <PhotoStep
                  title="Selfie mit Ausweis"
                  subtitle="Halte den Ausweis neben dein Gesicht. Beide Gesicht und Ausweis müssen klar zu sehen sein."
                  file={selfieFile} setFile={setSelfieFile} inputRef={selfieInput}
                  hint="Tageslicht oder helle Lampe, keine Sonnenbrille / Mütze."
                  testId="selfie" icon={Camera}/>

                {error && (
                  <div className="mt-3 flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-[11px] text-red-300">
                    <AlertCircle size={14} className="mt-0.5 flex-shrink-0" /><span>{error}</span>
                  </div>
                )}

                <motion.button whileTap={{ scale: 0.97 }} onClick={handleSubmit}
                  disabled={!selfieFile || submitting} data-testid="kyc-submit"
                  className="w-full py-4 mt-4 rounded-2xl bg-gradient-to-r from-[#00D26A] to-[#06B6D4] text-black font-black text-[14px] flex items-center justify-center gap-2 disabled:opacity-40">
                  {submitting ? <><Loader2 className="animate-spin" size={16} /> AI prüft…</>
                              : <><Sparkles size={16} /> Jetzt verifizieren</>}
                </motion.button>
                <p className="text-[10px] text-gray-500 text-center mt-3">
                  🔒 Deine Daten werden verschlüsselt gespeichert und nur für die Verifizierung verwendet.
                </p>
              </>
            )}

            {/* Step 5: result */}
            {step === 5 && result && (
              <div className="text-center space-y-4 py-4" data-testid="kyc-result">
                {result.status === "approved" && (
                  <>
                    <div className="w-20 h-20 rounded-full bg-[#00D26A]/20 border-2 border-[#00D26A] flex items-center justify-center mx-auto">
                      <Check size={36} className="text-[#00D26A]" strokeWidth={3} />
                    </div>
                    <h2 className="text-[18px] font-black text-white">Verifiziert! ✅</h2>
                    <p className="text-[12px] text-gray-400 px-4">
                      Hi {result.extracted?.name || "Hallo"}, deine Identität wurde bestätigt.
                      Du kannst jetzt alle Funktionen nutzen.
                    </p>
                    <div className="bg-[#00D26A]/5 border border-[#00D26A]/20 rounded-xl p-3">
                      <p className="text-[10px] text-gray-500 mb-1">AI-Konfidenz</p>
                      <p className="text-[24px] font-black text-[#00D26A] tabular-nums">{result.ai_confidence}%</p>
                    </div>
                  </>
                )}
                {result.status === "pending" && (
                  <>
                    <div className="w-20 h-20 rounded-full bg-[#FFB800]/20 border-2 border-[#FFB800] flex items-center justify-center mx-auto">
                      <Loader2 size={32} className="text-[#FFB800]" />
                    </div>
                    <h2 className="text-[18px] font-black text-white">In Prüfung 🔍</h2>
                    <p className="text-[12px] text-gray-400 px-4">
                      Unsere AI war sich nicht 100% sicher. Ein Mitarbeiter prüft die Dokumente
                      manuell. Du erhältst die Bestätigung innerhalb von 24h.
                    </p>
                  </>
                )}
                {result.status === "rejected" && (
                  <>
                    <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center mx-auto">
                      <X size={36} className="text-red-400" strokeWidth={3} />
                    </div>
                    <h2 className="text-[18px] font-black text-white">Abgelehnt</h2>
                    <p className="text-[12px] text-gray-400 px-4">{result.message}</p>
                    <motion.button whileTap={{ scale: 0.97 }} onClick={reset}
                      data-testid="kyc-retry"
                      className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-[12px] font-bold flex items-center justify-center gap-2">
                      <RefreshCw size={14} /> Erneut versuchen
                    </motion.button>
                  </>
                )}
                {result.status !== "rejected" && (
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => { onComplete?.(result); onClose(); }}
                    data-testid="kyc-done"
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#00C2FF] to-[#A855F7] text-white font-bold text-[14px]">
                    Weiter zu BidBlitz
                  </motion.button>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default KYCVerificationModal;
