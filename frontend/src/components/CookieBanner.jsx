import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, X, Check, Settings } from 'lucide-react';
import { useI18n } from '../store';

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
  const { t } = useI18n();
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

  const isCompactMobile = !showDetails;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-x-0 bottom-0 z-[10000] p-3 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[420px] sm:p-0"
        style={{ paddingBottom: 'var(--app-cookie-banner-offset, calc(5rem + env(safe-area-inset-bottom, 0px)))' }}
        data-testid="cookie-banner"
      >
        <div className={`max-w-3xl mx-auto bg-[#0A0A0F]/90 backdrop-blur-md border border-white/10 rounded-2xl p-2 sm:p-5 shadow-2xl sm:max-w-none overflow-y-auto sm:max-h-none ${showDetails ? 'max-h-[42vh]' : 'max-h-[6.25rem] sm:max-h-none overflow-hidden'}`}>
          {isCompactMobile && (
            <div className="sm:hidden" data-testid="cookie-banner-mobile-mini">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                  <Cookie size={13} className="text-amber-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold text-white truncate">
                    {t('cookie.title') || 'Wir respektieren deine Privatsphäre'}
                  </p>
                  <p className="text-[9px] text-white/55 truncate">
                    {t('cookie.necessary_desc') || 'Login-Session, CSRF-Schutz'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-[0.82fr_1.18fr] gap-1.5 mt-2">
                <button
                  onClick={() => setShowDetails(true)}
                  data-testid="cookie-banner-customize"
                  className="h-8 px-2 py-1 text-[9px] font-semibold bg-white/6 hover:bg-white/10 text-gray-200 rounded-lg flex items-center justify-center gap-1"
                >
                  <Settings size={10} />
                  {t('common.customize') || 'Anpassen'}
                </button>
                <button
                  onClick={() => accept('all')}
                  data-testid="cookie-banner-accept-all"
                  className="h-8 px-2 py-1 text-[9px] font-bold bg-amber-500 hover:bg-amber-600 text-black rounded-lg"
                >
                  {t('cookie.accept_all') || 'Alle akzeptieren'}
                </button>
              </div>
            </div>
          )}

          <div className={`${isCompactMobile ? 'hidden sm:flex' : 'flex'} items-start gap-2.5 mb-2`}>
            <Cookie size={16} className={`text-amber-400 flex-shrink-0 mt-0.5 sm:w-5 sm:h-5 ${showDetails ? 'block' : 'hidden sm:block'}`} />
            <div className="flex-1">
              <h3 className={`text-[12px] sm:text-[13px] font-bold text-white mb-0.5 line-clamp-1 ${showDetails ? 'block' : 'hidden sm:block'}`}>🍪 {t('cookie.title') || 'Wir respektieren deine Privatsphäre'}</h3>
              <p className={`text-[11px] text-gray-300 leading-snug ${showDetails ? 'block' : 'hidden sm:block'}`}>
                {t('cookie.desc') || 'BidBlitz nutzt nur technisch notwendige Cookies (Session). Mit deiner Einwilligung helfen Analytics-Cookies uns die App zu verbessern.'}{' '}
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('/datenschutz')}
                    className="text-blue-400 underline"
                    data-testid="cookie-banner-privacy-link"
                  >
                    {t('cookie.privacy_link') || 'Datenschutzerklärung'}
                  </button>
                )}
              </p>
              {!showDetails && <p className="hidden sm:block text-[10px] text-white/60">{t('cookie.necessary_desc') || 'Login-Session, CSRF-Schutz'}</p>}
            </div>
          </div>

          {showDetails && (
            <div className="space-y-2 mb-3 pl-7" data-testid="cookie-banner-details">
              <label className="flex items-center justify-between gap-2 text-xs">
                <span className="text-gray-300">
                  <strong className="text-white">{t('cookie.necessary') || 'Notwendig'}</strong> — {t('cookie.necessary_desc') || 'Login-Session, CSRF-Schutz'}
                </span>
                <span className="text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                  <Check size={12} /> {t('common.active') || 'AKTIV'}
                </span>
              </label>
              <label className="flex items-center justify-between gap-2 text-xs cursor-pointer">
                <span className="text-gray-300">
                  <strong className="text-white">{t('cookie.analytics') || 'Analytics'}</strong> — {t('cookie.analytics_desc') || 'Anonyme Nutzungsstatistik'}
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
                  <strong className="text-white">{t('cookie.crash') || 'Crash-Monitoring'}</strong> — {t('cookie.crash_desc') || 'Sentry Bug-Reports'}
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
                  <strong className="text-white">{t('cookie.marketing') || 'Marketing'}</strong> — {t('cookie.marketing_desc') || 'Personalisierte Empfehlungen'}
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

          <div className={`${isCompactMobile ? 'hidden sm:flex' : 'grid grid-cols-[0.9fr_0.95fr_1.15fr] sm:flex'} gap-1.5 sm:flex-wrap`}>
            <button
              onClick={() => accept('necessary')}
              data-testid="cookie-banner-reject"
              className="min-h-[34px] px-2 py-1 text-[9px] sm:text-[11px] font-semibold bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg leading-tight"
            >
              <span className="sm:hidden">Nur nötig</span>
              <span className="hidden sm:inline">{t('cookie.necessary_only') || 'Nur notwendige'}</span>
            </button>
            <button
              onClick={() => setShowDetails(!showDetails)}
              data-testid="cookie-banner-customize"
              className="min-h-[34px] px-2 py-1 text-[9px] sm:text-[11px] font-semibold bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg flex items-center justify-center gap-1 leading-tight"
            >
              <Settings size={11} />
              {showDetails ? (t('common.close') || 'Schließen') : (t('common.customize') || 'Anpassen')}
            </button>
            {showDetails && (
              <button
                onClick={() => accept('selected')}
                data-testid="cookie-banner-save"
                className="min-h-[34px] px-2 py-1 text-[9px] sm:text-[11px] font-semibold bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg"
              >
                {t('common.save_selection') || 'Auswahl speichern'}
              </button>
            )}
            <button
              onClick={() => accept('all')}
              data-testid="cookie-banner-accept-all"
              className="min-h-[34px] px-2 py-1 text-[9px] sm:text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-black rounded-lg leading-tight"
            >
              <span className="sm:hidden">Akzeptieren</span>
              <span className="hidden sm:inline">{t('cookie.accept_all') || 'Alle akzeptieren'}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
