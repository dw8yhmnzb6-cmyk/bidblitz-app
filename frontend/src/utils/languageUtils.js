/**
 * Centralized Language Mapping Utility
 * 
 * This file contains the official language mappings for the application.
 * Use this for consistent language variant handling across all components.
 */

// Language variant mappings
// Maps regional/variant codes to their base language codes
export const langMapping = {
  'us': 'en',     // US English -> English
  'gb': 'en',     // British English -> English
  'xk': 'sq',     // Kosovo -> Albanian
  'ae': 'ar',     // UAE -> Arabic
  'sa': 'ar',     // Saudi Arabia -> Arabic
  'at': 'de',     // Austria -> German
  'ch': 'de',     // Switzerland -> German
  'be': 'fr',     // Belgium -> French
  'ca': 'fr',     // Canada -> French (for French-speaking)
  'mx': 'es',     // Mexico -> Spanish
  'ar': 'es',     // Argentina -> Spanish
  'br': 'pt',     // Brazil -> Portuguese
};

/**
 * Get the mapped language code for regional variants
 * @param {string} lang - The original language code (e.g., 'xk', 'ae')
 * @returns {string} - The mapped base language code (e.g., 'sq', 'ar')
 */
export const getMappedLanguage = (lang) => langMapping[lang] || lang;

/**
 * Get the appropriate language key for translations
 * Falls back to the mapped language if translation doesn't exist
 * @param {string} lang - The original language code
 * @param {object} translations - The translations object to check
 * @returns {string} - The language key to use
 */
export const getLanguageKey = (lang, translations = {}) => {
  // First check if direct translation exists
  if (translations[lang]) {
    return lang;
  }
  
  // Then check mapped language
  const mappedLang = getMappedLanguage(lang);
  if (translations[mappedLang]) {
    return mappedLang;
  }
  
  // Fall back to German (default)
  return 'de';
};

/**
 * List of all supported languages with their display names and flags
 */
export const supportedLanguages = {
  de: { name: 'Deutsch', flag: '🇩🇪' },
  en: { name: 'English', flag: '🇬🇧' },
  sq: { name: 'Shqip', flag: '🇦🇱' },
  xk: { name: 'Kosovë', flag: '🇽🇰' },
  tr: { name: 'Türkçe', flag: '🇹🇷' },
  fr: { name: 'Français', flag: '🇫🇷' },
  ar: { name: 'العربية', flag: '🇸🇦' },
  ae: { name: 'الإمارات', flag: '🇦🇪' },
  es: { name: 'Español', flag: '🇪🇸' },
  it: { name: 'Italiano', flag: '🇮🇹' },
  pt: { name: 'Português', flag: '🇵🇹' },
  nl: { name: 'Nederlands', flag: '🇳🇱' },
  pl: { name: 'Polski', flag: '🇵🇱' },
  zh: { name: '中文', flag: '🇨🇳' },
  ja: { name: '日本語', flag: '🇯🇵' },
};

export default { 
  langMapping, 
  getMappedLanguage, 
  getLanguageKey, 
  supportedLanguages 
};
