/**
 * TaxiDriverOnboardingModal — Apply-as-driver application modal.
 * Wraps a 7-field form (name/email/phone/license/vehicle/city/message)
 * + success state. Submits to POST /api/taxi/driver/onboard.
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API = process.env.REACT_APP_BACKEND_URL;
const VEHICLE_TYPES = ["standard", "premium", "van"];
const VEHICLE_LABEL = { standard: "Standard", premium: "Premium", van: "Van" };

const EMPTY_FORM = {
  name: "", email: "", phone: "", license_number: "",
  vehicle_type: "standard", city: "", message: "",
};

export default function TaxiDriverOnboardingModal({
  isOpen, onClose, onboardingType, // 'business' | 'private'
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setForm(EMPTY_FORM);
    setSuccess(false);
    setError("");
    setSubmitting(false);
  };

  const close = () => {
    if (submitting) return;
    onClose();
    setTimeout(reset, 300);
  };

  const setField = (k) => (e) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    if (!form.name || !form.email || !form.phone || !form.license_number) {
      setError("Bitte alle Pflichtfelder ausfüllen");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/taxi/driver/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, driver_type: onboardingType }),
      });
      if (res.ok) {
        setSuccess(true);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.detail || "Fehler bei der Bewerbung");
      }
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    "w-full px-4 py-3 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={close}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0A0A0F] border border-white/10 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6"
          >
            {!success ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-white">Als Fahrer bewerben</h2>
                    <p className="text-xs text-gray-400 mt-1">
                      {onboardingType === "business" ? "Unternehmer-Taxi" : "Privat-Taxi"}
                    </p>
                  </div>
                  <button
                    onClick={close}
                    disabled={submitting}
                    className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                    data-testid="driver-onboard-close"
                  >
                    <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">Vollständiger Name</label>
                    <input
                      type="text"
                      placeholder="Max Mustermann"
                      value={form.name}
                      onChange={setField("name")}
                      disabled={submitting}
                      className={inputCls}
                      data-testid="driver-onboard-name"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-2">E-Mail</label>
                    <input
                      type="email"
                      placeholder="max@example.com"
                      value={form.email}
                      onChange={setField("email")}
                      disabled={submitting}
                      className={inputCls}
                      data-testid="driver-onboard-email"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-2">Telefonnummer</label>
                    <input
                      type="tel"
                      placeholder="+49 123 456789"
                      value={form.phone}
                      onChange={setField("phone")}
                      disabled={submitting}
                      className={inputCls}
                      data-testid="driver-onboard-phone"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-2">Führerscheinnummer</label>
                    <input
                      type="text"
                      placeholder="B1234567890"
                      value={form.license_number}
                      onChange={setField("license_number")}
                      disabled={submitting}
                      className={inputCls}
                      data-testid="driver-onboard-license"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-2">Fahrzeugtyp</label>
                    <div className="grid grid-cols-3 gap-2">
                      {VEHICLE_TYPES.map((type) => (
                        <button
                          key={type}
                          onClick={() => setForm((p) => ({ ...p, vehicle_type: type }))}
                          disabled={submitting}
                          className={`py-2 px-3 rounded-xl text-xs font-medium transition-all ${
                            form.vehicle_type === type
                              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                              : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
                          }`}
                          data-testid={`driver-vehicle-${type}`}
                        >
                          {VEHICLE_LABEL[type]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-2">Stadt (optional)</label>
                    <input
                      type="text"
                      placeholder="z.B. Berlin"
                      value={form.city}
                      onChange={setField("city")}
                      disabled={submitting}
                      className={inputCls}
                      data-testid="driver-onboard-city"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-2">Nachricht (optional)</label>
                    <textarea
                      placeholder="Zusätzliche Informationen..."
                      value={form.message}
                      onChange={setField("message")}
                      disabled={submitting}
                      rows={3}
                      className={`${inputCls} resize-none`}
                      data-testid="driver-onboard-message"
                    />
                  </div>

                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">
                      {error}
                    </div>
                  )}

                  <button
                    onClick={submit}
                    disabled={submitting}
                    className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl font-semibold text-black disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
                    data-testid="driver-onboard-submit"
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Wird gesendet...
                      </span>
                    ) : "Bewerbung absenden"}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Bewerbung erfolgreich!</h3>
                <p className="text-sm text-gray-400 mb-6">
                  Wir prüfen deine Angaben und melden uns innerhalb von 24 Stunden.
                </p>
                <button
                  onClick={close}
                  className="px-6 py-3 bg-cyan-500 rounded-xl font-semibold text-black hover:bg-cyan-400 transition-colors"
                >
                  Schließen
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
