import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, X, Check, Settings } from 'lucide-react';

const STORAGE_KEY = 'bidblitz_cookie_consent_v1';

/**
 * DSGVO/UAE-konformer Cookie-Banner.
 * - Necessary cookies (Session/JWT) sind immer aktiv (technisch notwendig)
 * - Analytics + Crash-Monitoring opt-in
 * - User kann Einwilligung jederzeit widerrufen via /datenschutz
 *
 * Dispatched events:
 *   - 'cookie-consent-changed' on window with detail = consent object
 */
export function getCookieConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setCookieConsent(consent) {
  const full = {
    necessary: true,
    analytics: false,
    crash: false,
    marketing: false,
    timestamp: new Date().toISOString(),
    ...consent,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(full));
  window.dispatchEvent(new CustomEvent('cookie-consent-changed', { detail: full }));
  return full;
}

export default function CookieBanner({ onNavigate }) {
  const [show, setShow] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [opts, setOpts] = useState({ analytics: false, crash: false, marketing: false });

  useEffect(() => {
    const stored = getCookieConsent();
    if (!stored) setShow(true);
  }, []);

  const accept = (which) => {
    let payload;
    if (which === 'all') payload = { necessary: true, analytics: true, crash: true, marketing: true };
    else if (which === 'necessary') payload = { necessary: true, analytics: false, crash: false, marketing: false };
    else payload = { necessary: true, ...opts };
    setCookieConsent(payload);
    setShow(false);
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-x-0 bottom-0 z-[10000] p-3 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[420px] sm:p-0"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
        data-testid="cookie-banner"
      >
        <div className="max-w-3xl mx-auto bg-[#0A0A0F]/98 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl sm:max-w-none">
          <div className="flex items-start gap-3 mb-3">
            <Cookie size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-white mb-1">🍪 Wir respektieren deine Privatsphäre</h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                BidBlitz nutzt nur technisch notwendige Cookies (Session). Mit deiner Einwilligung helfen
                Analytics-Cookies uns die App zu verbessern.{' '}
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('/datenschutz')}
                    className="text-blue-400 underline"
                    data-testid="cookie-banner-privacy-link"
                  >
                    Datenschutzerklärung
                  </button>
                )}
              </p>
            </div>
          </div>

          {showDetails && (
            <div className="space-y-2 mb-3 pl-7" data-testid="cookie-banner-details">
              <label className="flex items-center justify-between gap-2 text-xs">
                <span className="text-gray-300">
                  <strong className="text-white">Notwendig</strong> — Login-Session, CSRF-Schutz
                </span>
                <span className="text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                  <Check size={12} /> AKTIV
                </span>
              </label>
              <label className="flex items-center justify-between gap-2 text-xs cursor-pointer">
                <span className="text-gray-300">
                  <strong className="text-white">Analytics</strong> — Anonyme Nutzungsstatistik
                </span>
                <input
                  type="checkbox"
                  checked={opts.analytics}
                  onChange={(e) => setOpts({ ...opts, analytics: e.target.checked })}
                  data-testid="cookie-opt-analytics"
                />
              </label>
              <label className="flex items-center justify-between gap-2 text-xs cursor-pointer">
                <span className="text-gray-300">
                  <strong className="text-white">Crash-Monitoring</strong> — Sentry Bug-Reports
                </span>
                <input
                  type="checkbox"
                  checked={opts.crash}
                  onChange={(e) => setOpts({ ...opts, crash: e.target.checked })}
                  data-testid="cookie-opt-crash"
                />
              </label>
              <label className="flex items-center justify-between gap-2 text-xs cursor-pointer">
                <span className="text-gray-300">
                  <strong className="text-white">Marketing</strong> — Personalisierte Empfehlungen
                </span>
                <input
                  type="checkbox"
                  checked={opts.marketing}
                  onChange={(e) => setOpts({ ...opts, marketing: e.target.checked })}
                  data-testid="cookie-opt-marketing"
                />
              </label>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => accept('necessary')}
              data-testid="cookie-banner-reject"
              className="flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg"
            >
              Nur notwendige
            </button>
            <button
              onClick={() => setShowDetails(!showDetails)}
              data-testid="cookie-banner-customize"
              className="flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg flex items-center justify-center gap-1"
            >
              <Settings size={12} />
              {showDetails ? 'Schließen' : 'Anpassen'}
            </button>
            {showDetails && (
              <button
                onClick={() => accept('selected')}
                data-testid="cookie-banner-save"
                className="flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg"
              >
                Auswahl speichern
              </button>
            )}
            <button
              onClick={() => accept('all')}
              data-testid="cookie-banner-accept-all"
              className="flex-1 sm:flex-initial px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black rounded-lg"
            >
              Alle akzeptieren
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
