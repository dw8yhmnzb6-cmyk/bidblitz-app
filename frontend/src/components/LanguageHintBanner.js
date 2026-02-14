/**
 * Language Hint Banner - Shows when language is not German
 * Helps users who accidentally changed their language
 */
import { memo, useState, useEffect } from 'react';
import { Globe, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { languageList } from '../i18n/translations';

const LanguageHintBanner = memo(() => {
  const { language, changeLanguage } = useLanguage();
  const [dismissed, setDismissed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  
  useEffect(() => {
    // Show hint if language is not German and not dismissed this session
    const wasDismissed = sessionStorage.getItem('language_hint_dismissed');
    if (language !== 'de' && !wasDismissed) {
      // Delay showing to not be too intrusive
      const timer = setTimeout(() => setShowHint(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [language]);
  
  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('language_hint_dismissed', 'true');
  };
  
  const handleSwitchToGerman = () => {
    changeLanguage('de');
    localStorage.setItem('language', 'de');
    setDismissed(true);
    // Reload to apply
    window.location.reload();
  };
  
  // Don't show if German, dismissed, or not ready
  if (language === 'de' || dismissed || !showHint) {
    return null;
  }
  
  const currentLangInfo = languageList[language];
  
  return (
    <div 
      className="fixed top-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-72 z-40 
        animate-in slide-in-from-top-5 duration-300"
      data-testid="language-hint-banner"
    >
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Globe className="w-4 h-4" />
            <span className="font-medium text-sm">Sprache / Language</span>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-3">
          <p className="text-gray-700 text-sm mb-2">
            <span className="text-lg mr-1">{currentLangInfo?.flag}</span>
            <strong>{currentLangInfo?.name}</strong>
          </p>
          
          <div className="flex gap-2">
            <button
              onClick={handleSwitchToGerman}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 
                bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold 
                text-xs rounded-lg hover:from-amber-600 hover:to-orange-600 transition-colors"
            >
              🇩🇪 Deutsch
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg 
                hover:bg-gray-200 transition-colors font-medium"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

LanguageHintBanner.displayName = 'LanguageHintBanner';

export default LanguageHintBanner;
