/**
 * Partner Portal Components Index
 * Export all partner-related components
 */

export { default as PartnerLogin } from './PartnerLogin';
export { default as PartnerDashboard } from './PartnerDashboard';
export { default as PartnerPayouts } from './PartnerPayouts';
export { default as PartnerScanner } from './PartnerScanner';
export { default as PartnerStaff } from './PartnerStaff';
export { default as PartnerVouchers } from './PartnerVouchers';
export { default as PartnerStatistics } from './PartnerStatistics';
export { default as PartnerProfile } from './PartnerProfile';
export { default as PartnerVerification } from './PartnerVerification';

// Marketing Components
export { 
  PartnerReferral,
  PartnerQRCodes,
  PartnerFlashSales,
  PartnerSocialSharing,
  PartnerRatingsOverview
} from './PartnerMarketing';

export { translations, createTranslator, availableLanguages, getLangKey } from './partnerTranslations';
