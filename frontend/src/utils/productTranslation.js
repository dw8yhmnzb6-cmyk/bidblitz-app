/**
 * Get translated product name based on current language
 * Falls back to German (de) or the original name if translation not available
 */
export const getProductName = (product, language) => {
  if (!product) return '';
  
  // Check for translations object
  const translations = product.name_translations;
  if (translations && translations[language]) {
    return translations[language];
  }
  
  // Fallback to German translation
  if (translations && translations.de) {
    return translations.de;
  }
  
  // Final fallback to original name
  return product.name || '';
};

/**
 * Get translated product description based on current language
 * Falls back to German (de) or the original description if translation not available
 */
export const getProductDescription = (product, language) => {
  if (!product) return '';
  
  // Check for translations object
  const translations = product.description_translations;
  if (translations && translations[language]) {
    return translations[language];
  }
  
  // Fallback to German translation
  if (translations && translations.de) {
    return translations.de;
  }
  
  // Final fallback to original description
  return product.description || '';
};

/**
 * Check if product has translation for a specific language
 */
export const hasTranslation = (product, language) => {
  if (!product) return false;
  
  const nameTranslations = product.name_translations;
  return nameTranslations && nameTranslations[language];
};

/**
 * Get all available languages for a product
 */
export const getAvailableLanguages = (product) => {
  if (!product || !product.name_translations) return ['de'];
  return Object.keys(product.name_translations);
};
