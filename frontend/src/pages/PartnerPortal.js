/**
 * Partner Portal - Multi-Business Registration, QR Scanner & Voucher Management
 * Supports: Restaurants, Bars, Gas Stations, Cinemas, Retail, Wellness, Fitness, etc.
 * Features: Statistics with Charts, Wise Bank Transfer Payouts, Document Verification, Staff Management
 */
import { useState, useEffect, useRef } from 'react';
import { 
  QrCode, Scan, Check, X, Euro, History, LogOut, Camera, Loader2, 
  AlertCircle, CheckCircle, Building2, MapPin, Phone, Mail, Globe,
  FileText, CreditCard, User, Plus, Ticket, BarChart3, Clock,
  ChevronRight, Upload, Store, TrendingUp, Shield, ExternalLink,
  PieChart, Trash2, Eye, Download, Users, Languages, Pencil, Share2,
  Wallet, Hash
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { Html5Qrcode } from 'html5-qrcode';
import axios from 'axios';

// Import refactored components
import PartnerPayouts from '../components/partner/PartnerPayouts';
import PartnerScanner from '../components/partner/PartnerScanner';
import PartnerStaff from '../components/partner/PartnerStaff';
import PartnerVouchers from '../components/partner/PartnerVouchers';
import PartnerStatistics from '../components/partner/PartnerStatistics';
import PartnerProfile from '../components/partner/PartnerProfile';
import PartnerVerification from '../components/partner/PartnerVerification';
import PartnerBudget from '../components/partner/PartnerBudget';
import PartnerDashboardExpanded from '../components/partner/PartnerDashboardExpanded';

// Import marketing components
import { 
  PartnerReferral, 
  PartnerQRCodes, 
  PartnerFlashSales, 
  PartnerSocialSharing,
  PartnerRatingsOverview 
} from '../components/partner/PartnerMarketing';

// Import centralized translations
import { translations as partnerTranslations, getLangKey } from '../components/partner/partnerTranslations';

const API = process.env.REACT_APP_BACKEND_URL;

// Business Types
const BUSINESS_TYPES = [
  { id: 'restaurant', name: 'Restaurant', icon: '🍕' },
  { id: 'bar', name: 'Bar & Club', icon: '🍺' },
  { id: 'cafe', name: 'Café', icon: '☕' },
  { id: 'gas_station', name: 'Tankstelle', icon: '⛽' },
  { id: 'cinema', name: 'Kino', icon: '🎬' },
  { id: 'retail', name: 'Einzelhandel', icon: '🛒' },
  { id: 'wellness', name: 'Wellness & Spa', icon: '💆' },
  { id: 'fitness', name: 'Fitness-Studio', icon: '🏋️' },
  { id: 'beauty', name: 'Friseur & Beauty', icon: '💇' },
  { id: 'hotel', name: 'Hotel & Unterkunft', icon: '🏨' },
  { id: 'entertainment', name: 'Unterhaltung', icon: '🎯' },
  { id: 'supermarket', name: 'Supermarkt', icon: '🛍️' },
  { id: 'pharmacy', name: 'Apotheke', icon: '💊' },
  { id: 'other', name: 'Sonstiges', icon: '🏪' },
];

export default function PartnerPortal() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState('');
  const [partner, setPartner] = useState(null);
  const [view, setView] = useState('login'); // login, register, scanner, vouchers, dashboard, create-voucher, statistics, payouts, profile, verification, staff, marketing
  const [userRole, setUserRole] = useState('admin'); // 'admin' or 'counter'
  const [isStaff, setIsStaff] = useState(false);
  const [language, setLanguage] = useState(() => localStorage.getItem('partner_language') || 'de');
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('partner_remember') === 'true');
  const [marketingTab, setMarketingTab] = useState('referral'); // referral, qr, flash, social, ratings
  
  // Available languages - 19 languages
  const languages = [
    { code: 'ae', name: 'الإمارات', flag: '🇦🇪' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'sq', name: 'Shqip', flag: '🇦🇱' },
    { code: 'xk', name: 'Kosovë', flag: '🇽🇰' },
    { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'us', name: 'English (US)', flag: '🇺🇸' },
    { code: 'pt', name: 'Português', flag: '🇵🇹' },
    { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
    { code: 'pl', name: 'Polski', flag: '🇵🇱' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'ko', name: '한국어', flag: '🇰🇷' },
    { code: 'el', name: 'Ελληνικά', flag: '🇬🇷' },
  ];
  
  // Map language codes to translation keys
  const getLangKey = (code) => {
    const map = { ae: 'ar', us: 'en', xk: 'sq' };
    return map[code] || code;
  };
  
  // Translations
  const t = (key) => {
    const translations = {
      de: {
        login: 'Anmelden',
        register: 'Registrieren',
        email: 'E-Mail',
        password: 'Passwort',
        dashboard: 'Dashboard',
        scanner: 'Scanner',
        pay: 'Pay',
        vouchers: 'Gutscheine',
        statistics: 'Statistiken',
        payouts: 'Auszahlungen',
        verification: 'Verifizierung',
        profile: 'Profil',
        staff: 'Mitarbeiter',
        logout: 'Abmelden',
        available: 'Verfügbar',
        pending: 'Ausstehend',
        redeemed: 'Eingelöst',
        sold: 'Verkauft',
        commission: 'Provision',
        staffLogin: 'Mitarbeiter-Login',
        adminLogin: 'Admin-Login',
        createStaff: 'Mitarbeiter erstellen',
        counter: 'Theke',
        admin: 'Admin',
        name: 'Name',
        role: 'Rolle',
        active: 'Aktiv',
        inactive: 'Inaktiv',
        delete: 'Löschen',
        save: 'Speichern',
        cancel: 'Abbrechen',
        scanQR: 'QR-Code scannen',
        enterCode: 'Code eingeben',
        processPayment: 'Zahlung verarbeiten',
        amount: 'Betrag',
        success: 'Erfolgreich',
        error: 'Fehler',
        noAccess: 'Kein Zugriff',
        counterOnly: 'Diese Ansicht ist nur für Thekenmitarbeiter.',
        language: 'Sprache',
        welcome: 'Willkommen',
        notPartner: 'Noch kein Partner?',
        applyNow: 'Jetzt bewerben',
        counterInfo: 'Theken-Mitarbeiter Login - Eingeschränkter Zugang nur für Scanner und Zahlungsfunktionen.',
        voucherSystem: 'Gutschein-System',
        recentRedemptions: 'Letzte Einlösungen',
        noRedemptions: 'Noch keine Einlösungen',
        value: 'Wert',
        scanVoucher: 'Gutschein scannen',
        startCamera: 'Kamera starten',
        manualEntry: 'Manuelle Eingabe',
        voucherCode: 'Gutschein-Code',
        validate: 'Prüfen',
        validVoucher: 'Gültiger Gutschein',
        invalidVoucher: 'Ungültiger Gutschein',
        redeemNow: 'Jetzt einlösen',
        myVouchers: 'Meine Gutscheine',
        createVoucher: 'Gutschein erstellen',
        voucherName: 'Name',
        description: 'Beschreibung',
        price: 'Preis',
        quantity: 'Menge',
        validUntil: 'Gültig bis',
        terms: 'Bedingungen',
        noVouchers: 'Noch keine Gutscheine',
        stripeConnect: 'Banküberweisung',
        stripeDescription: 'Verbinden Sie Ihr Bankkonto für automatische Auszahlungen per SEPA-Überweisung.',
        stripeAdvantages: 'Vorteile:',
        instantPayouts: 'Schnelle Überweisungen (1-2 Werktage)',
        secureBanking: 'Sichere IBAN-Verifizierung',
        transparentFees: 'Keine Gebühren für EUR',
        detailedReports: 'Detaillierte Berichte',
        connectStripe: 'Bankkonto verbinden',
        payoutHistory: 'Auszahlungsverlauf',
        noPayouts: 'Noch keine Auszahlungen',
        requestPayout: 'Auszahlung anfordern',
        bankDetails: 'Bankdaten',
        iban: 'IBAN',
        taxId: 'Steuer-ID',
        saveBankDetails: 'Bankdaten speichern',
        uploadLogo: 'Logo hochladen',
        verificationStatus: 'Verifizierungsstatus',
        uploadDocument: 'Dokument hochladen',
        documentType: 'Dokumententyp',
        // Wise Bank Transfer translations
        bankTransfer: 'Banküberweisung',
        enterBankDetails: 'Bankdaten eingeben',
        accountHolder: 'Kontoinhaber',
        connectBank: 'Bankkonto verbinden',
        bankConnected: 'Bankkonto verbunden',
        disconnectBank: 'Bankkonto trennen',
        connect: 'Verbinden',
        cancel: 'Abbrechen',
        minPayout: 'Mindestbetrag für Auszahlung',
        bankAdvantages: 'Vorteile:',
        fastTransfer: 'Schnelle Überweisungen (1-2 Werktage)',
        noFees: 'Keine Gebühren für EUR-Überweisungen',
        secureIban: 'Sichere IBAN-Verifizierung',
        minAmount: 'Mindestbetrag nur €10',
        ibanHint: 'Ihre IBAN finden Sie auf Ihrer Bankkarte oder im Online-Banking',
        payNow: 'Jetzt auszahlen',
        payoutAmount: 'Auszahlungsbetrag',
        maxAmount: 'Max',
        completed: 'Abgeschlossen',
        processing: 'In Bearbeitung',
        pendingStatus: 'Ausstehend',
        bidblitzPay: 'BidBlitz Pay',
        customerPayments: 'Kunden-Zahlungen akzeptieren',
        scanCustomerQR: 'Kunden QR-Code scannen',
        enterPaymentCode: 'Zahlungscode eingeben',
        customerBalance: 'Kundenguthaben',
        charge: 'Belasten',
        paymentSuccess: 'Zahlung erfolgreich',
        staffManagement: 'Mitarbeiterverwaltung',
        addStaff: 'Mitarbeiter hinzufügen',
        staffEmail: 'E-Mail',
        staffPassword: 'Passwort',
        roleDescription: 'Rollen-Beschreibung',
        adminFullAccess: 'Vollzugriff auf alle Funktionen',
        counterLimitedAccess: 'Nur Scanner & Zahlungen',
        rememberMe: 'Angemeldet bleiben',
        businessType: 'Geschäftsart',
        businessName: 'Geschäftsname',
        address: 'Adresse',
        city: 'Stadt',
        postalCode: 'PLZ',
        country: 'Land',
        phone: 'Telefon',
        website: 'Website',
        contactPerson: 'Ansprechpartner',
        step: 'Schritt',
        next: 'Weiter',
        back: 'Zurück',
        submit: 'Absenden',
        // Statistics translations
        created: 'Erstellt',
        financialOverview: 'Finanzübersicht',
        totalRevenue: 'Gesamtumsatz',
        commissionPaid: 'Provision bezahlt',
        paidOut: 'Ausgezahlt',
        voucherStatus: 'Gutschein-Status',
        topVouchers: 'Top Gutscheine',
        revenue: 'Umsatz',
        redemptionsChart: 'Einlösungen (letzte 30 Tage)',
        // Profile translations
        accountInfo: 'Kontoinformationen',
        other: 'Sonstiges',
        settings: 'Einstellungen',
        // Verification translations
        verified: 'Verifiziert',
        inReview: 'In Prüfung',
        moreInfoRequired: 'Weitere Informationen erforderlich',
        notVerified: 'Nicht verifiziert',
        verifiedDescription: 'Ihr Konto ist vollständig verifiziert.',
        inReviewDescription: 'Ihre Dokumente werden geprüft.',
        notVerifiedDescription: 'Bitte laden Sie die erforderlichen Dokumente hoch.',
        businessRegistration: 'Gewerbeanmeldung',
        taxCertificate: 'Steuerbescheinigung',
        idDocument: 'Personalausweis/Reisepass',
        bankStatement: 'Kontoauszug',
        selectFile: 'Datei auswählen',
        uploadedDocuments: 'Hochgeladene Dokumente',
        approved: 'Genehmigt',
        rejected: 'Abgelehnt',
        noDocuments: 'Noch keine Dokumente hochgeladen',
        verificationInfo: 'Wichtige Hinweise',
        verificationHint1: 'Alle Dokumente müssen gut lesbar sein',
        verificationHint2: 'Die Prüfung dauert in der Regel 1-3 Werktage',
        verificationHint3: 'Bei Fragen kontaktieren Sie unseren Support'
      },
      en: {
        login: 'Login',
        register: 'Register',
        email: 'Email',
        password: 'Password',
        dashboard: 'Dashboard',
        scanner: 'Scanner',
        pay: 'Pay',
        vouchers: 'Vouchers',
        statistics: 'Statistics',
        payouts: 'Payouts',
        verification: 'Verification',
        profile: 'Profile',
        staff: 'Staff',
        logout: 'Logout',
        available: 'Available',
        pending: 'Pending',
        redeemed: 'Redeemed',
        sold: 'Sold',
        commission: 'Commission',
        staffLogin: 'Staff Login',
        adminLogin: 'Admin Login',
        createStaff: 'Create Staff',
        counter: 'Counter',
        admin: 'Admin',
        name: 'Name',
        role: 'Role',
        active: 'Active',
        inactive: 'Inactive',
        delete: 'Delete',
        save: 'Save',
        cancel: 'Cancel',
        scanQR: 'Scan QR Code',
        enterCode: 'Enter Code',
        processPayment: 'Process Payment',
        amount: 'Amount',
        success: 'Success',
        error: 'Error',
        noAccess: 'No Access',
        counterOnly: 'This view is for counter staff only.',
        language: 'Language',
        welcome: 'Welcome',
        notPartner: 'Not a partner yet?',
        applyNow: 'Apply now',
        counterInfo: 'Counter staff login - Limited access to scanner and payment functions only.',
        voucherSystem: 'Voucher System',
        recentRedemptions: 'Recent Redemptions',
        noRedemptions: 'No redemptions yet',
        value: 'Value',
        scanVoucher: 'Scan Voucher',
        startCamera: 'Start Camera',
        manualEntry: 'Manual Entry',
        voucherCode: 'Voucher Code',
        validate: 'Validate',
        validVoucher: 'Valid Voucher',
        invalidVoucher: 'Invalid Voucher',
        redeemNow: 'Redeem Now',
        myVouchers: 'My Vouchers',
        createVoucher: 'Create Voucher',
        voucherName: 'Name',
        description: 'Description',
        price: 'Price',
        quantity: 'Quantity',
        validUntil: 'Valid Until',
        terms: 'Terms',
        noVouchers: 'No vouchers yet',
        stripeConnect: 'Bank Transfer',
        stripeDescription: 'Connect your bank account for automatic payouts via SEPA transfer.',
        stripeAdvantages: 'Advantages:',
        instantPayouts: 'Fast transfers (1-2 business days)',
        secureBanking: 'Secure IBAN verification',
        transparentFees: 'No fees for EUR',
        detailedReports: 'Detailed reports',
        connectStripe: 'Connect bank account',
        payoutHistory: 'Payout History',
        noPayouts: 'No payouts yet',
        requestPayout: 'Request Payout',
        bankDetails: 'Bank Details',
        iban: 'IBAN',
        taxId: 'Tax ID',
        saveBankDetails: 'Save Bank Details',
        uploadLogo: 'Upload Logo',
        verificationStatus: 'Verification Status',
        uploadDocument: 'Upload Document',
        documentType: 'Document Type',
        // Wise Bank Transfer translations
        bankTransfer: 'Bank Transfer',
        enterBankDetails: 'Enter Bank Details',
        accountHolder: 'Account Holder',
        connectBank: 'Connect Bank Account',
        bankConnected: 'Bank Account Connected',
        disconnectBank: 'Disconnect Bank Account',
        connect: 'Connect',
        cancel: 'Cancel',
        minPayout: 'Minimum payout amount',
        bankAdvantages: 'Advantages:',
        fastTransfer: 'Fast transfers (1-2 business days)',
        noFees: 'No fees for EUR transfers',
        secureIban: 'Secure IBAN verification',
        minAmount: 'Minimum amount only €10',
        ibanHint: 'You can find your IBAN on your bank card or in online banking',
        payNow: 'Pay out now',
        payoutAmount: 'Payout amount',
        maxAmount: 'Max',
        completed: 'Completed',
        processing: 'Processing',
        pendingStatus: 'Pending',
        bidblitzPay: 'BidBlitz Pay',
        customerPayments: 'Accept Customer Payments',
        scanCustomerQR: 'Scan Customer QR Code',
        enterPaymentCode: 'Enter Payment Code',
        customerBalance: 'Customer Balance',
        charge: 'Charge',
        paymentSuccess: 'Payment Successful',
        staffManagement: 'Staff Management',
        addStaff: 'Add Staff',
        staffEmail: 'Email',
        staffPassword: 'Password',
        roleDescription: 'Role Description',
        adminFullAccess: 'Full access to all features',
        counterLimitedAccess: 'Scanner & payments only',
        rememberMe: 'Remember me',
        businessType: 'Business Type',
        businessName: 'Business Name',
        address: 'Address',
        city: 'City',
        postalCode: 'Postal Code',
        country: 'Country',
        phone: 'Phone',
        website: 'Website',
        contactPerson: 'Contact Person',
        step: 'Step',
        next: 'Next',
        back: 'Back',
        submit: 'Submit',
        // Statistics translations
        created: 'Created',
        financialOverview: 'Financial Overview',
        totalRevenue: 'Total Revenue',
        commissionPaid: 'Commission Paid',
        paidOut: 'Paid Out',
        voucherStatus: 'Voucher Status',
        topVouchers: 'Top Vouchers',
        revenue: 'Revenue',
        redemptionsChart: 'Redemptions (last 30 days)',
        // Profile translations
        accountInfo: 'Account Information',
        other: 'Other',
        settings: 'Settings',
        // Verification translations
        verified: 'Verified',
        inReview: 'In Review',
        moreInfoRequired: 'More Information Required',
        notVerified: 'Not Verified',
        verifiedDescription: 'Your account is fully verified.',
        inReviewDescription: 'Your documents are being reviewed.',
        notVerifiedDescription: 'Please upload the required documents.',
        businessRegistration: 'Business Registration',
        taxCertificate: 'Tax Certificate',
        idDocument: 'ID Document/Passport',
        bankStatement: 'Bank Statement',
        selectFile: 'Select File',
        uploadedDocuments: 'Uploaded Documents',
        approved: 'Approved',
        rejected: 'Rejected',
        noDocuments: 'No documents uploaded yet',
        verificationInfo: 'Important Notes',
        verificationHint1: 'All documents must be clearly legible',
        verificationHint2: 'Review typically takes 1-3 business days',
        verificationHint3: 'Contact our support if you have questions'
      },
      fr: {
        login: 'Connexion',
        register: "S'inscrire",
        email: 'E-mail',
        password: 'Mot de passe',
        dashboard: 'Tableau de bord',
        scanner: 'Scanner',
        pay: 'Payer',
        vouchers: 'Bons',
        statistics: 'Statistiques',
        payouts: 'Paiements',
        verification: 'Vérification',
        profile: 'Profil',
        staff: 'Personnel',
        logout: 'Déconnexion',
        available: 'Disponible',
        pending: 'En attente',
        redeemed: 'Utilisé',
        sold: 'Vendu',
        commission: 'Commission',
        staffLogin: 'Connexion Personnel',
        adminLogin: 'Connexion Admin',
        createStaff: 'Créer employé',
        counter: 'Comptoir',
        admin: 'Admin',
        name: 'Nom',
        role: 'Rôle',
        active: 'Actif',
        inactive: 'Inactif',
        delete: 'Supprimer',
        save: 'Enregistrer',
        cancel: 'Annuler',
        scanQR: 'Scanner QR Code',
        enterCode: 'Entrer le code',
        processPayment: 'Traiter le paiement',
        amount: 'Montant',
        success: 'Succès',
        error: 'Erreur',
        noAccess: "Pas d'accès",
        counterOnly: 'Cette vue est réservée au personnel du comptoir.',
        language: 'Langue',
        welcome: 'Bienvenue',
        notPartner: 'Pas encore partenaire?',
        applyNow: 'Postuler maintenant',
        counterInfo: 'Connexion employé - Accès limité au scanner et aux paiements.',
        voucherSystem: 'Système de bons',
        recentRedemptions: 'Dernières utilisations',
        noRedemptions: 'Pas encore de utilisations',
        value: 'Valeur',
        scanVoucher: 'Scanner bon',
        startCamera: 'Démarrer caméra',
        manualEntry: 'Entrée manuelle',
        voucherCode: 'Code bon',
        validate: 'Valider',
        validVoucher: 'Bon valide',
        invalidVoucher: 'Bon invalide',
        redeemNow: 'Utiliser maintenant',
        myVouchers: 'Mes bons',
        createVoucher: 'Créer bon',
        voucherName: 'Nom',
        description: 'Description',
        price: 'Prix',
        quantity: 'Quantité',
        validUntil: "Valide jusqu'au",
        terms: 'Conditions',
        noVouchers: 'Pas encore de bons',
        stripeConnect: 'Virement bancaire',
        stripeDescription: 'Connectez votre compte bancaire pour des paiements automatiques via SEPA.',
        stripeAdvantages: 'Avantages:',
        instantPayouts: 'Virements rapides (1-2 jours ouvrés)',
        secureBanking: 'Vérification IBAN sécurisée',
        transparentFees: 'Sans frais pour EUR',
        detailedReports: 'Rapports détaillés',
        connectStripe: 'Connecter compte bancaire',
        payoutHistory: 'Historique des paiements',
        noPayouts: 'Pas encore de paiements',
        requestPayout: 'Demander paiement',
        bankDetails: 'Coordonnées bancaires',
        iban: 'IBAN',
        taxId: 'Numéro fiscal',
        saveBankDetails: 'Enregistrer coordonnées',
        uploadLogo: 'Télécharger logo',
        verificationStatus: 'Statut de vérification',
        uploadDocument: 'Télécharger document',
        documentType: 'Type de document',
        // Wise Bank Transfer translations
        bankTransfer: 'Virement bancaire',
        enterBankDetails: 'Entrer coordonnées bancaires',
        accountHolder: 'Titulaire du compte',
        connectBank: 'Connecter compte bancaire',
        bankConnected: 'Compte bancaire connecté',
        disconnectBank: 'Déconnecter compte',
        connect: 'Connecter',
        cancel: 'Annuler',
        minPayout: 'Montant minimum de paiement',
        bankAdvantages: 'Avantages:',
        fastTransfer: 'Virements rapides (1-2 jours ouvrés)',
        noFees: 'Sans frais pour virements EUR',
        secureIban: 'Vérification IBAN sécurisée',
        minAmount: 'Montant minimum seulement €10',
        ibanHint: 'Vous trouverez votre IBAN sur votre carte bancaire ou dans votre banque en ligne',
        payNow: 'Payer maintenant',
        payoutAmount: 'Montant du paiement',
        maxAmount: 'Max',
        completed: 'Terminé',
        processing: 'En cours',
        pendingStatus: 'En attente',
        bidblitzPay: 'BidBlitz Pay',
        customerPayments: 'Accepter paiements clients',
        scanCustomerQR: 'Scanner QR client',
        enterPaymentCode: 'Entrer code de paiement',
        customerBalance: 'Solde client',
        charge: 'Facturer',
        paymentSuccess: 'Paiement réussi',
        staffManagement: 'Gestion du personnel',
        addStaff: 'Ajouter employé',
        staffEmail: 'E-mail',
        staffPassword: 'Mot de passe',
        roleDescription: 'Description du rôle',
        adminFullAccess: 'Accès complet',
        counterLimitedAccess: 'Scanner et paiements uniquement',
        rememberMe: 'Se souvenir de moi',
        businessType: "Type d'entreprise",
        businessName: "Nom d'entreprise",
        address: 'Adresse',
        city: 'Ville',
        postalCode: 'Code postal',
        country: 'Pays',
        phone: 'Téléphone',
        website: 'Site web',
        contactPerson: 'Personne de contact',
        step: 'Étape',
        next: 'Suivant',
        back: 'Retour',
        submit: 'Soumettre'
      },
      es: {
        login: 'Iniciar sesión',
        register: 'Registrarse',
        email: 'Correo',
        password: 'Contraseña',
        dashboard: 'Panel',
        scanner: 'Escáner',
        pay: 'Pagar',
        vouchers: 'Vales',
        statistics: 'Estadísticas',
        payouts: 'Pagos',
        verification: 'Verificación',
        profile: 'Perfil',
        staff: 'Personal',
        logout: 'Cerrar sesión',
        available: 'Disponible',
        pending: 'Pendiente',
        redeemed: 'Canjeado',
        sold: 'Vendido',
        commission: 'Comisión',
        staffLogin: 'Inicio Personal',
        adminLogin: 'Inicio Admin',
        createStaff: 'Crear empleado',
        counter: 'Mostrador',
        admin: 'Admin',
        name: 'Nombre',
        role: 'Rol',
        active: 'Activo',
        inactive: 'Inactivo',
        delete: 'Eliminar',
        save: 'Guardar',
        cancel: 'Cancelar',
        scanQR: 'Escanear QR',
        enterCode: 'Ingresar código',
        processPayment: 'Procesar pago',
        amount: 'Monto',
        success: 'Éxito',
        error: 'Error',
        noAccess: 'Sin acceso',
        counterOnly: 'Esta vista es solo para personal de mostrador.',
        language: 'Idioma',
        welcome: 'Bienvenido',
        notPartner: '¿Aún no eres socio?',
        applyNow: 'Aplicar ahora',
        counterInfo: 'Inicio de empleado - Acceso limitado al escáner y pagos.',
        voucherSystem: 'Sistema de vales',
        recentRedemptions: 'Canjes recientes',
        noRedemptions: 'Sin canjes aún',
        value: 'Valor',
        scanVoucher: 'Escanear vale',
        startCamera: 'Iniciar cámara',
        manualEntry: 'Entrada manual',
        voucherCode: 'Código de vale',
        validate: 'Validar',
        validVoucher: 'Vale válido',
        invalidVoucher: 'Vale inválido',
        redeemNow: 'Canjear ahora',
        myVouchers: 'Mis vales',
        createVoucher: 'Crear vale',
        voucherName: 'Nombre',
        description: 'Descripción',
        price: 'Precio',
        quantity: 'Cantidad',
        validUntil: 'Válido hasta',
        terms: 'Términos',
        noVouchers: 'Sin vales aún',
        stripeConnect: 'Transferencia bancaria',
        stripeDescription: 'Conecta tu cuenta bancaria para pagos automáticos vía SEPA.',
        stripeAdvantages: 'Ventajas:',
        instantPayouts: 'Transferencias rápidas (1-2 días hábiles)',
        secureBanking: 'Verificación IBAN segura',
        transparentFees: 'Sin comisiones para EUR',
        detailedReports: 'Informes detallados',
        connectStripe: 'Conectar cuenta bancaria',
        payoutHistory: 'Historial de pagos',
        noPayouts: 'Sin pagos aún',
        requestPayout: 'Solicitar pago',
        bankDetails: 'Datos bancarios',
        iban: 'IBAN',
        taxId: 'ID fiscal',
        saveBankDetails: 'Guardar datos',
        uploadLogo: 'Subir logo',
        verificationStatus: 'Estado de verificación',
        uploadDocument: 'Subir documento',
        documentType: 'Tipo de documento',
        // Wise Bank Transfer translations
        bankTransfer: 'Transferencia bancaria',
        enterBankDetails: 'Ingresar datos bancarios',
        accountHolder: 'Titular de la cuenta',
        connectBank: 'Conectar cuenta bancaria',
        bankConnected: 'Cuenta bancaria conectada',
        disconnectBank: 'Desconectar cuenta',
        connect: 'Conectar',
        cancel: 'Cancelar',
        minPayout: 'Monto mínimo de pago',
        bankAdvantages: 'Ventajas:',
        fastTransfer: 'Transferencias rápidas (1-2 días hábiles)',
        noFees: 'Sin comisiones para transferencias EUR',
        secureIban: 'Verificación IBAN segura',
        minAmount: 'Monto mínimo solo €10',
        ibanHint: 'Encontrará su IBAN en su tarjeta bancaria o en la banca online',
        payNow: 'Pagar ahora',
        payoutAmount: 'Monto del pago',
        maxAmount: 'Máx',
        completed: 'Completado',
        processing: 'Procesando',
        pendingStatus: 'Pendiente',
        bidblitzPay: 'BidBlitz Pay',
        customerPayments: 'Aceptar pagos de clientes',
        scanCustomerQR: 'Escanear QR del cliente',
        enterPaymentCode: 'Ingresar código de pago',
        customerBalance: 'Saldo del cliente',
        charge: 'Cobrar',
        paymentSuccess: 'Pago exitoso',
        staffManagement: 'Gestión de personal',
        addStaff: 'Agregar empleado',
        staffEmail: 'Correo',
        staffPassword: 'Contraseña',
        roleDescription: 'Descripción del rol',
        adminFullAccess: 'Acceso completo',
        counterLimitedAccess: 'Solo escáner y pagos',
        rememberMe: 'Recordarme',
        businessType: 'Tipo de negocio',
        businessName: 'Nombre del negocio',
        address: 'Dirección',
        city: 'Ciudad',
        postalCode: 'Código postal',
        country: 'País',
        phone: 'Teléfono',
        website: 'Sitio web',
        contactPerson: 'Persona de contacto',
        step: 'Paso',
        next: 'Siguiente',
        back: 'Atrás',
        submit: 'Enviar'
      },
      tr: {
        login: 'Giriş',
        register: 'Kayıt Ol',
        email: 'E-posta',
        password: 'Şifre',
        dashboard: 'Panel',
        scanner: 'Tarayıcı',
        pay: 'Öde',
        vouchers: 'Kuponlar',
        statistics: 'İstatistikler',
        payouts: 'Ödemeler',
        verification: 'Doğrulama',
        profile: 'Profil',
        staff: 'Personel',
        logout: 'Çıkış',
        available: 'Mevcut',
        pending: 'Bekleyen',
        redeemed: 'Kullanılan',
        sold: 'Satılan',
        commission: 'Komisyon',
        staffLogin: 'Personel Girişi',
        adminLogin: 'Admin Girişi',
        createStaff: 'Personel Oluştur',
        counter: 'Kasa',
        admin: 'Admin',
        name: 'Ad',
        role: 'Rol',
        active: 'Aktif',
        inactive: 'Pasif',
        delete: 'Sil',
        save: 'Kaydet',
        cancel: 'İptal',
        scanQR: 'QR Tara',
        enterCode: 'Kod Gir',
        processPayment: 'Ödeme İşle',
        amount: 'Tutar',
        success: 'Başarılı',
        error: 'Hata',
        noAccess: 'Erişim Yok',
        counterOnly: 'Bu görünüm sadece kasa personeli içindir.',
        language: 'Dil',
        welcome: 'Hoş geldiniz',
        notPartner: 'Henüz ortak değil misiniz?',
        applyNow: 'Şimdi başvur',
        counterInfo: 'Kasa personeli girişi - Sadece tarayıcı ve ödeme erişimi.',
        voucherSystem: 'Kupon Sistemi',
        recentRedemptions: 'Son Kullanımlar',
        noRedemptions: 'Henüz kullanım yok',
        value: 'Değer',
        scanVoucher: 'Kupon Tara',
        startCamera: 'Kamera Başlat',
        manualEntry: 'Manuel Giriş',
        voucherCode: 'Kupon Kodu',
        validate: 'Doğrula',
        validVoucher: 'Geçerli Kupon',
        invalidVoucher: 'Geçersiz Kupon',
        redeemNow: 'Şimdi Kullan',
        myVouchers: 'Kuponlarım',
        createVoucher: 'Kupon Oluştur',
        voucherName: 'Ad',
        description: 'Açıklama',
        price: 'Fiyat',
        quantity: 'Miktar',
        validUntil: 'Geçerlilik',
        terms: 'Şartlar',
        noVouchers: 'Henüz kupon yok',
        stripeConnect: 'Banka Havalesi',
        stripeDescription: 'SEPA ile otomatik ödemeler için banka hesabınızı bağlayın.',
        stripeAdvantages: 'Avantajlar:',
        instantPayouts: 'Hızlı transferler (1-2 iş günü)',
        secureBanking: 'Güvenli IBAN doğrulaması',
        transparentFees: 'EUR için komisyon yok',
        detailedReports: 'Detaylı raporlar',
        connectStripe: 'Banka hesabı bağla',
        payoutHistory: 'Ödeme Geçmişi',
        noPayouts: 'Henüz ödeme yok',
        requestPayout: 'Ödeme Talep Et',
        bankDetails: 'Banka Bilgileri',
        iban: 'IBAN',
        taxId: 'Vergi No',
        saveBankDetails: 'Bilgileri Kaydet',
        uploadLogo: 'Logo Yükle',
        verificationStatus: 'Doğrulama Durumu',
        uploadDocument: 'Belge Yükle',
        documentType: 'Belge Türü',
        // Wise Bank Transfer translations
        bankTransfer: 'Banka Havalesi',
        enterBankDetails: 'Banka Bilgilerini Girin',
        accountHolder: 'Hesap Sahibi',
        connectBank: 'Banka Hesabını Bağla',
        bankConnected: 'Banka Hesabı Bağlandı',
        disconnectBank: 'Hesap Bağlantısını Kes',
        connect: 'Bağla',
        cancel: 'İptal',
        minPayout: 'Minimum ödeme tutarı',
        bankAdvantages: 'Avantajlar:',
        fastTransfer: 'Hızlı transferler (1-2 iş günü)',
        noFees: 'EUR transferleri için komisyon yok',
        secureIban: 'Güvenli IBAN doğrulaması',
        minAmount: 'Minimum tutar sadece €10',
        ibanHint: 'IBAN numaranızı banka kartınızda veya internet bankacılığında bulabilirsiniz',
        payNow: 'Şimdi öde',
        payoutAmount: 'Ödeme tutarı',
        maxAmount: 'Maks',
        completed: 'Tamamlandı',
        processing: 'İşleniyor',
        pendingStatus: 'Beklemede',
        bidblitzPay: 'BidBlitz Pay',
        customerPayments: 'Müşteri Ödemeleri Kabul Et',
        scanCustomerQR: 'Müşteri QR Tara',
        enterPaymentCode: 'Ödeme Kodu Gir',
        customerBalance: 'Müşteri Bakiyesi',
        charge: 'Tahsil Et',
        paymentSuccess: 'Ödeme Başarılı',
        staffManagement: 'Personel Yönetimi',
        addStaff: 'Personel Ekle',
        staffEmail: 'E-posta',
        staffPassword: 'Şifre',
        roleDescription: 'Rol Açıklaması',
        adminFullAccess: 'Tam erişim',
        counterLimitedAccess: 'Sadece tarayıcı ve ödemeler',
        rememberMe: 'Beni hatırla',
        businessType: 'İşletme Türü',
        businessName: 'İşletme Adı',
        address: 'Adres',
        city: 'Şehir',
        postalCode: 'Posta Kodu',
        country: 'Ülke',
        phone: 'Telefon',
        website: 'Web sitesi',
        contactPerson: 'İletişim Kişisi',
        step: 'Adım',
        next: 'İleri',
        back: 'Geri',
        submit: 'Gönder'
      },
      ar: {
        login: 'تسجيل الدخول',
        register: 'التسجيل',
        email: 'البريد الإلكتروني',
        password: 'كلمة المرور',
        dashboard: 'لوحة التحكم',
        scanner: 'الماسح',
        pay: 'الدفع',
        vouchers: 'القسائم',
        statistics: 'الإحصائيات',
        payouts: 'المدفوعات',
        verification: 'التحقق',
        profile: 'الملف الشخصي',
        staff: 'الموظفون',
        logout: 'تسجيل الخروج',
        available: 'متاح',
        pending: 'قيد الانتظار',
        redeemed: 'مستخدم',
        sold: 'مباع',
        commission: 'العمولة',
        staffLogin: 'دخول الموظف',
        adminLogin: 'دخول المدير',
        createStaff: 'إضافة موظف',
        counter: 'الكاونتر',
        admin: 'مدير',
        name: 'الاسم',
        role: 'الدور',
        active: 'نشط',
        inactive: 'غير نشط',
        delete: 'حذف',
        save: 'حفظ',
        cancel: 'إلغاء',
        scanQR: 'مسح QR',
        enterCode: 'أدخل الرمز',
        processPayment: 'معالجة الدفع',
        amount: 'المبلغ',
        success: 'نجاح',
        error: 'خطأ',
        noAccess: 'لا يوجد وصول',
        counterOnly: 'هذا العرض مخصص لموظفي الكاونتر فقط.',
        language: 'اللغة',
        welcome: 'مرحباً',
        notPartner: 'لست شريكاً بعد؟',
        applyNow: 'قدم الآن',
        counterInfo: 'دخول موظف الكاونتر - وصول محدود للماسح والدفع فقط.',
        voucherSystem: 'نظام القسائم',
        recentRedemptions: 'الاستخدامات الأخيرة',
        noRedemptions: 'لا توجد استخدامات بعد',
        value: 'القيمة',
        scanVoucher: 'مسح القسيمة',
        startCamera: 'بدء الكاميرا',
        manualEntry: 'إدخال يدوي',
        voucherCode: 'رمز القسيمة',
        validate: 'تحقق',
        validVoucher: 'قسيمة صالحة',
        invalidVoucher: 'قسيمة غير صالحة',
        redeemNow: 'استخدم الآن',
        myVouchers: 'قسائمي',
        createVoucher: 'إنشاء قسيمة',
        voucherName: 'الاسم',
        description: 'الوصف',
        price: 'السعر',
        quantity: 'الكمية',
        validUntil: 'صالح حتى',
        terms: 'الشروط',
        noVouchers: 'لا توجد قسائم بعد',
        stripeConnect: 'تحويل بنكي',
        stripeDescription: 'اربط حسابك البنكي للمدفوعات التلقائية عبر SEPA.',
        stripeAdvantages: 'المزايا:',
        instantPayouts: 'تحويلات سريعة (1-2 يوم عمل)',
        secureBanking: 'تحقق IBAN آمن',
        transparentFees: 'بدون رسوم لليورو',
        detailedReports: 'تقارير مفصلة',
        connectStripe: 'ربط الحساب البنكي',
        payoutHistory: 'سجل المدفوعات',
        noPayouts: 'لا توجد مدفوعات بعد',
        requestPayout: 'طلب دفع',
        bankDetails: 'البيانات البنكية',
        iban: 'IBAN',
        taxId: 'الرقم الضريبي',
        saveBankDetails: 'حفظ البيانات',
        uploadLogo: 'رفع الشعار',
        verificationStatus: 'حالة التحقق',
        uploadDocument: 'رفع مستند',
        documentType: 'نوع المستند',
        // Wise Bank Transfer translations
        bankTransfer: 'تحويل بنكي',
        enterBankDetails: 'أدخل البيانات البنكية',
        accountHolder: 'صاحب الحساب',
        connectBank: 'ربط الحساب البنكي',
        bankConnected: 'الحساب البنكي متصل',
        disconnectBank: 'فصل الحساب البنكي',
        connect: 'ربط',
        cancel: 'إلغاء',
        minPayout: 'الحد الأدنى للدفع',
        bankAdvantages: 'المزايا:',
        fastTransfer: 'تحويلات سريعة (1-2 يوم عمل)',
        noFees: 'بدون رسوم للتحويلات باليورو',
        secureIban: 'تحقق IBAN آمن',
        minAmount: 'الحد الأدنى فقط €10',
        ibanHint: 'يمكنك العثور على رقم IBAN على بطاقتك البنكية أو في الخدمات المصرفية عبر الإنترنت',
        payNow: 'ادفع الآن',
        payoutAmount: 'مبلغ الدفع',
        maxAmount: 'الحد الأقصى',
        completed: 'مكتمل',
        processing: 'قيد المعالجة',
        pendingStatus: 'قيد الانتظار',
        bidblitzPay: 'BidBlitz Pay',
        customerPayments: 'قبول مدفوعات العملاء',
        scanCustomerQR: 'مسح QR العميل',
        enterPaymentCode: 'أدخل رمز الدفع',
        customerBalance: 'رصيد العميل',
        charge: 'تحصيل',
        paymentSuccess: 'تم الدفع بنجاح',
        staffManagement: 'إدارة الموظفين',
        addStaff: 'إضافة موظف',
        staffEmail: 'البريد الإلكتروني',
        staffPassword: 'كلمة المرور',
        roleDescription: 'وصف الدور',
        adminFullAccess: 'وصول كامل',
        counterLimitedAccess: 'الماسح والدفع فقط',
        rememberMe: 'تذكرني',
        businessType: 'نوع العمل',
        businessName: 'اسم العمل',
        address: 'العنوان',
        city: 'المدينة',
        postalCode: 'الرمز البريدي',
        country: 'البلد',
        phone: 'الهاتف',
        website: 'الموقع',
        contactPerson: 'جهة الاتصال',
        step: 'خطوة',
        next: 'التالي',
        back: 'رجوع',
        submit: 'إرسال'
      },
      it: {
        login: 'Accedi', register: 'Registrati', email: 'Email', password: 'Password',
        dashboard: 'Pannello', scanner: 'Scanner', pay: 'Paga', vouchers: 'Buoni',
        statistics: 'Statistiche', payouts: 'Pagamenti', verification: 'Verifica',
        profile: 'Profilo', staff: 'Personale', logout: 'Esci', available: 'Disponibile',
        pending: 'In attesa', redeemed: 'Riscattato', sold: 'Venduto', commission: 'Commissione',
        staffLogin: 'Accesso Personale', adminLogin: 'Accesso Admin', createStaff: 'Crea dipendente',
        counter: 'Cassa', admin: 'Admin', name: 'Nome', role: 'Ruolo', active: 'Attivo',
        inactive: 'Inattivo', delete: 'Elimina', save: 'Salva', cancel: 'Annulla',
        welcome: 'Benvenuto', notPartner: 'Non sei ancora partner?', applyNow: 'Candidati ora',
        rememberMe: 'Ricordami', recentRedemptions: 'Riscatti recenti', noRedemptions: 'Nessun riscatto', value: 'Valore',
        bankTransfer: 'Bonifico bancario', enterBankDetails: 'Inserisci dati bancari', accountHolder: 'Titolare conto',
        connectBank: 'Collega conto bancario', bankConnected: 'Conto bancario collegato', disconnectBank: 'Scollega conto',
        connect: 'Collega', minPayout: 'Importo minimo pagamento', bankAdvantages: 'Vantaggi:',
        fastTransfer: 'Trasferimenti rapidi (1-2 giorni lavorativi)', noFees: 'Nessuna commissione per trasferimenti EUR',
        secureIban: 'Verifica IBAN sicura', minAmount: 'Importo minimo solo €10',
        ibanHint: 'Puoi trovare il tuo IBAN sulla carta bancaria o nell\'home banking', payNow: 'Paga ora',
        completed: 'Completato', processing: 'In elaborazione', pendingStatus: 'In attesa',
        payoutHistory: 'Storico pagamenti', noPayouts: 'Nessun pagamento ancora', iban: 'IBAN'
      },
      pt: {
        login: 'Entrar', register: 'Registrar', email: 'Email', password: 'Senha',
        dashboard: 'Painel', scanner: 'Scanner', pay: 'Pagar', vouchers: 'Vouchers',
        statistics: 'Estatísticas', payouts: 'Pagamentos', verification: 'Verificação',
        profile: 'Perfil', staff: 'Funcionários', logout: 'Sair', available: 'Disponível',
        pending: 'Pendente', redeemed: 'Resgatado', sold: 'Vendido', commission: 'Comissão',
        staffLogin: 'Login Funcionário', adminLogin: 'Login Admin', createStaff: 'Criar funcionário',
        counter: 'Balcão', admin: 'Admin', name: 'Nome', role: 'Função', active: 'Ativo',
        inactive: 'Inativo', delete: 'Excluir', save: 'Salvar', cancel: 'Cancelar',
        welcome: 'Bem-vindo', notPartner: 'Ainda não é parceiro?', applyNow: 'Candidate-se agora',
        rememberMe: 'Lembrar-me', recentRedemptions: 'Resgates recentes', noRedemptions: 'Nenhum resgate', value: 'Valor',
        bankTransfer: 'Transferência bancária', enterBankDetails: 'Inserir dados bancários', accountHolder: 'Titular da conta',
        connectBank: 'Conectar conta bancária', bankConnected: 'Conta bancária conectada', disconnectBank: 'Desconectar conta',
        connect: 'Conectar', minPayout: 'Valor mínimo de pagamento', bankAdvantages: 'Vantagens:',
        fastTransfer: 'Transferências rápidas (1-2 dias úteis)', noFees: 'Sem taxas para transferências EUR',
        secureIban: 'Verificação IBAN segura', minAmount: 'Valor mínimo apenas €10',
        ibanHint: 'Pode encontrar o seu IBAN no cartão bancário ou no homebanking', payNow: 'Pagar agora',
        completed: 'Concluído', processing: 'Processando', pendingStatus: 'Pendente',
        payoutHistory: 'Histórico de pagamentos', noPayouts: 'Nenhum pagamento ainda', iban: 'IBAN'
      },
      nl: {
        login: 'Inloggen', register: 'Registreren', email: 'E-mail', password: 'Wachtwoord',
        dashboard: 'Dashboard', scanner: 'Scanner', pay: 'Betalen', vouchers: 'Vouchers',
        statistics: 'Statistieken', payouts: 'Uitbetalingen', verification: 'Verificatie',
        profile: 'Profiel', staff: 'Personeel', logout: 'Uitloggen', available: 'Beschikbaar',
        pending: 'In afwachting', redeemed: 'Ingewisseld', sold: 'Verkocht', commission: 'Commissie',
        staffLogin: 'Personeel Login', adminLogin: 'Admin Login', createStaff: 'Medewerker maken',
        counter: 'Balie', admin: 'Admin', name: 'Naam', role: 'Rol', active: 'Actief',
        inactive: 'Inactief', delete: 'Verwijderen', save: 'Opslaan', cancel: 'Annuleren',
        welcome: 'Welkom', notPartner: 'Nog geen partner?', applyNow: 'Nu aanmelden',
        rememberMe: 'Onthoud mij', recentRedemptions: 'Recente inwisselingen', noRedemptions: 'Geen inwisselingen', value: 'Waarde',
        bankTransfer: 'Bankoverschrijving', enterBankDetails: 'Bankgegevens invoeren', accountHolder: 'Rekeninghouder',
        connectBank: 'Bankrekening koppelen', bankConnected: 'Bankrekening gekoppeld', disconnectBank: 'Rekening ontkoppelen',
        connect: 'Koppelen', minPayout: 'Minimum uitbetalingsbedrag', bankAdvantages: 'Voordelen:',
        fastTransfer: 'Snelle overschrijvingen (1-2 werkdagen)', noFees: 'Geen kosten voor EUR-overschrijvingen',
        secureIban: 'Veilige IBAN-verificatie', minAmount: 'Minimumbedrag slechts €10',
        ibanHint: 'Uw IBAN vindt u op uw bankpas of in internetbankieren', payNow: 'Nu betalen',
        completed: 'Voltooid', processing: 'Verwerking', pendingStatus: 'In afwachting',
        payoutHistory: 'Uitbetalingsgeschiedenis', noPayouts: 'Nog geen uitbetalingen', iban: 'IBAN'
      },
      pl: {
        login: 'Zaloguj się', register: 'Zarejestruj się', email: 'Email', password: 'Hasło',
        dashboard: 'Panel', scanner: 'Skaner', pay: 'Zapłać', vouchers: 'Vouchery',
        statistics: 'Statystyki', payouts: 'Wypłaty', verification: 'Weryfikacja',
        profile: 'Profil', staff: 'Personel', logout: 'Wyloguj', available: 'Dostępne',
        pending: 'Oczekujące', redeemed: 'Zrealizowane', sold: 'Sprzedane', commission: 'Prowizja',
        staffLogin: 'Login Personelu', adminLogin: 'Login Admina', createStaff: 'Dodaj pracownika',
        counter: 'Kasa', admin: 'Admin', name: 'Imię', role: 'Rola', active: 'Aktywny',
        inactive: 'Nieaktywny', delete: 'Usuń', save: 'Zapisz', cancel: 'Anuluj',
        welcome: 'Witamy', notPartner: 'Nie jesteś partnerem?', applyNow: 'Aplikuj teraz',
        rememberMe: 'Zapamiętaj mnie', recentRedemptions: 'Ostatnie realizacje', noRedemptions: 'Brak realizacji', value: 'Wartość',
        bankTransfer: 'Przelew bankowy', enterBankDetails: 'Wprowadź dane bankowe', accountHolder: 'Właściciel konta',
        connectBank: 'Połącz konto bankowe', bankConnected: 'Konto bankowe połączone', disconnectBank: 'Odłącz konto',
        connect: 'Połącz', minPayout: 'Minimalna kwota wypłaty', bankAdvantages: 'Zalety:',
        fastTransfer: 'Szybkie przelewy (1-2 dni robocze)', noFees: 'Bez opłat za przelewy EUR',
        secureIban: 'Bezpieczna weryfikacja IBAN', minAmount: 'Minimalna kwota tylko €10',
        ibanHint: 'Numer IBAN znajdziesz na karcie bankowej lub w bankowości internetowej', payNow: 'Wypłać teraz',
        completed: 'Zakończone', processing: 'Przetwarzanie', pendingStatus: 'Oczekuje',
        payoutHistory: 'Historia wypłat', noPayouts: 'Brak wypłat', iban: 'IBAN'
      },
      ru: {
        login: 'Войти', register: 'Регистрация', email: 'Email', password: 'Пароль',
        dashboard: 'Панель', scanner: 'Сканер', pay: 'Оплата', vouchers: 'Ваучеры',
        statistics: 'Статистика', payouts: 'Выплаты', verification: 'Верификация',
        profile: 'Профиль', staff: 'Персонал', logout: 'Выйти', available: 'Доступно',
        pending: 'В ожидании', redeemed: 'Использовано', sold: 'Продано', commission: 'Комиссия',
        staffLogin: 'Вход персонала', adminLogin: 'Вход админа', createStaff: 'Создать сотрудника',
        counter: 'Касса', admin: 'Админ', name: 'Имя', role: 'Роль', active: 'Активен',
        inactive: 'Неактивен', delete: 'Удалить', save: 'Сохранить', cancel: 'Отмена',
        welcome: 'Добро пожаловать', notPartner: 'Еще не партнер?', applyNow: 'Подать заявку',
        rememberMe: 'Запомнить меня', recentRedemptions: 'Последние использования', noRedemptions: 'Нет использований', value: 'Значение',
        bankTransfer: 'Банковский перевод', enterBankDetails: 'Введите банковские данные', accountHolder: 'Владелец счета',
        connectBank: 'Подключить банковский счет', bankConnected: 'Банковский счет подключен', disconnectBank: 'Отключить счет',
        connect: 'Подключить', minPayout: 'Минимальная сумма выплаты', bankAdvantages: 'Преимущества:',
        fastTransfer: 'Быстрые переводы (1-2 рабочих дня)', noFees: 'Без комиссии за переводы в EUR',
        secureIban: 'Безопасная проверка IBAN', minAmount: 'Минимальная сумма всего €10',
        ibanHint: 'IBAN вы найдете на банковской карте или в интернет-банкинге', payNow: 'Выплатить сейчас',
        completed: 'Завершено', processing: 'Обработка', pendingStatus: 'В ожидании',
        payoutHistory: 'История выплат', noPayouts: 'Выплат пока нет', iban: 'IBAN'
      },
      zh: {
        login: '登录', register: '注册', email: '邮箱', password: '密码',
        dashboard: '仪表板', scanner: '扫描器', pay: '支付', vouchers: '代金券',
        statistics: '统计', payouts: '支出', verification: '验证',
        profile: '个人资料', staff: '员工', logout: '退出', available: '可用',
        pending: '待处理', redeemed: '已兑换', sold: '已售', commission: '佣金',
        staffLogin: '员工登录', adminLogin: '管理员登录', createStaff: '创建员工',
        counter: '柜台', admin: '管理员', name: '姓名', role: '角色', active: '活跃',
        inactive: '非活跃', delete: '删除', save: '保存', cancel: '取消',
        welcome: '欢迎', notPartner: '还不是合作伙伴？', applyNow: '立即申请',
        rememberMe: '记住我', recentRedemptions: '最近兑换', noRedemptions: '暂无兑换', value: '价值',
        bankTransfer: '银行转账', enterBankDetails: '输入银行信息', accountHolder: '账户持有人',
        connectBank: '连接银行账户', bankConnected: '银行账户已连接', disconnectBank: '断开账户',
        connect: '连接', minPayout: '最低付款金额', bankAdvantages: '优势:',
        fastTransfer: '快速转账（1-2个工作日）', noFees: 'EUR转账无手续费',
        secureIban: '安全的IBAN验证', minAmount: '最低金额仅€10',
        ibanHint: '您可以在银行卡或网上银行中找到您的IBAN', payNow: '立即付款',
        completed: '已完成', processing: '处理中', pendingStatus: '待处理',
        payoutHistory: '付款历史', noPayouts: '暂无付款', iban: 'IBAN'
      },
      ja: {
        login: 'ログイン', register: '登録', email: 'メール', password: 'パスワード',
        dashboard: 'ダッシュボード', scanner: 'スキャナー', pay: '支払い', vouchers: 'バウチャー',
        statistics: '統計', payouts: '支払い', verification: '確認',
        profile: 'プロフィール', staff: 'スタッフ', logout: 'ログアウト', available: '利用可能',
        pending: '保留中', redeemed: '利用済み', sold: '販売済み', commission: '手数料',
        staffLogin: 'スタッフログイン', adminLogin: '管理者ログイン', createStaff: 'スタッフ作成',
        counter: 'カウンター', admin: '管理者', name: '名前', role: '役割', active: 'アクティブ',
        inactive: '非アクティブ', delete: '削除', save: '保存', cancel: 'キャンセル',
        welcome: 'ようこそ', notPartner: 'パートナーではありませんか？', applyNow: '今すぐ申請',
        rememberMe: 'ログイン状態を保持', recentRedemptions: '最近の利用', noRedemptions: 'まだ利用なし', value: '値',
        bankTransfer: '銀行振込', enterBankDetails: '銀行情報を入力', accountHolder: '口座名義人',
        connectBank: '銀行口座を接続', bankConnected: '銀行口座接続済み', disconnectBank: '口座を切断',
        connect: '接続', minPayout: '最低支払い金額', bankAdvantages: 'メリット:',
        fastTransfer: '高速送金（1-2営業日）', noFees: 'EUR送金手数料無料',
        secureIban: '安全なIBAN認証', minAmount: '最低金額€10のみ',
        ibanHint: 'IBANはキャッシュカードまたはネットバンキングで確認できます', payNow: '今すぐ支払う',
        completed: '完了', processing: '処理中', pendingStatus: '保留中',
        payoutHistory: '支払い履歴', noPayouts: 'まだ支払いなし', iban: 'IBAN'
      },
      ko: {
        login: '로그인', register: '등록', email: '이메일', password: '비밀번호',
        dashboard: '대시보드', scanner: '스캐너', pay: '결제', vouchers: '바우처',
        statistics: '통계', payouts: '지급', verification: '인증',
        profile: '프로필', staff: '직원', logout: '로그아웃', available: '사용 가능',
        pending: '대기 중', redeemed: '사용됨', sold: '판매됨', commission: '수수료',
        staffLogin: '직원 로그인', adminLogin: '관리자 로그인', createStaff: '직원 생성',
        counter: '카운터', admin: '관리자', name: '이름', role: '역할', active: '활성',
        inactive: '비활성', delete: '삭제', save: '저장', cancel: '취소',
        welcome: '환영합니다', notPartner: '파트너가 아니신가요?', applyNow: '지금 신청',
        rememberMe: '로그인 상태 유지', recentRedemptions: '최근 사용', noRedemptions: '사용 내역 없음', value: '가치',
        bankTransfer: '은행 송금', enterBankDetails: '은행 정보 입력', accountHolder: '예금주',
        connectBank: '은행 계좌 연결', bankConnected: '은행 계좌 연결됨', disconnectBank: '계좌 연결 해제',
        connect: '연결', minPayout: '최소 지급 금액', bankAdvantages: '장점:',
        fastTransfer: '빠른 송금 (1-2영업일)', noFees: 'EUR 송금 수수료 없음',
        secureIban: '안전한 IBAN 인증', minAmount: '최소 금액 €10만',
        ibanHint: 'IBAN은 은행 카드 또는 인터넷 뱅킹에서 확인할 수 있습니다', payNow: '지금 지급',
        completed: '완료됨', processing: '처리 중', pendingStatus: '대기 중',
        payoutHistory: '지급 내역', noPayouts: '아직 지급 내역 없음', iban: 'IBAN'
      },
      el: {
        login: 'Σύνδεση', register: 'Εγγραφή', email: 'Email', password: 'Κωδικός',
        dashboard: 'Πίνακας ελέγχου', scanner: 'Σαρωτής', pay: 'Πληρωμή', vouchers: 'Κουπόνια',
        statistics: 'Στατιστικά', payouts: 'Πληρωμές', verification: 'Επαλήθευση',
        profile: 'Προφίλ', staff: 'Προσωπικό', logout: 'Αποσύνδεση', available: 'Διαθέσιμο',
        pending: 'Σε αναμονή', redeemed: 'Εξαργυρώθηκε', sold: 'Πωλήθηκε', commission: 'Προμήθεια',
        staffLogin: 'Σύνδεση Προσωπικού', adminLogin: 'Σύνδεση Διαχειριστή', createStaff: 'Δημιουργία υπαλλήλου',
        counter: 'Ταμείο', admin: 'Διαχειριστής', name: 'Όνομα', role: 'Ρόλος', active: 'Ενεργός',
        inactive: 'Ανενεργός', delete: 'Διαγραφή', save: 'Αποθήκευση', cancel: 'Ακύρωση',
        welcome: 'Καλώς ήρθατε', notPartner: 'Δεν είστε συνεργάτης;', applyNow: 'Υποβάλετε αίτηση',
        rememberMe: 'Να με θυμάσαι', recentRedemptions: 'Πρόσφατες εξαργυρώσεις', noRedemptions: 'Δεν υπάρχουν εξαργυρώσεις', value: 'Αξία',
        bankTransfer: 'Τραπεζικό έμβασμα', enterBankDetails: 'Εισάγετε τραπεζικά στοιχεία', accountHolder: 'Κάτοχος λογαριασμού',
        connectBank: 'Σύνδεση τραπεζικού λογαριασμού', bankConnected: 'Τραπεζικός λογαριασμός συνδεδεμένος', disconnectBank: 'Αποσύνδεση λογαριασμού',
        connect: 'Σύνδεση', minPayout: 'Ελάχιστο ποσό πληρωμής', bankAdvantages: 'Πλεονεκτήματα:',
        fastTransfer: 'Γρήγορες μεταφορές (1-2 εργάσιμες ημέρες)', noFees: 'Χωρίς χρεώσεις για μεταφορές EUR',
        secureIban: 'Ασφαλής επαλήθευση IBAN', minAmount: 'Ελάχιστο ποσό μόνο €10',
        ibanHint: 'Μπορείτε να βρείτε το IBAN σας στην τραπεζική κάρτα ή στο e-banking', payNow: 'Πληρωμή τώρα',
        completed: 'Ολοκληρώθηκε', processing: 'Επεξεργασία', pendingStatus: 'Σε αναμονή',
        payoutHistory: 'Ιστορικό πληρωμών', noPayouts: 'Δεν υπάρχουν πληρωμές ακόμα', iban: 'IBAN'
      },
      sq: {
        login: 'Hyr', register: 'Regjistrohu', email: 'Email', password: 'Fjalëkalimi',
        dashboard: 'Paneli', scanner: 'Skaneri', pay: 'Paguaj', vouchers: 'Kuponë',
        statistics: 'Statistikat', payouts: 'Pagesat', verification: 'Verifikimi',
        profile: 'Profili', staff: 'Stafi', logout: 'Dil', available: 'E disponueshme',
        pending: 'Në pritje', redeemed: 'I përdorur', sold: 'Shitur', commission: 'Komisioni',
        staffLogin: 'Hyrja e Stafit', adminLogin: 'Hyrja e Adminit', createStaff: 'Krijo punonjës',
        counter: 'Sporteli', admin: 'Admin', name: 'Emri', role: 'Roli', active: 'Aktiv',
        inactive: 'Joaktiv', delete: 'Fshi', save: 'Ruaj', cancel: 'Anulo',
        welcome: 'Mirësevini', notPartner: 'Nuk jeni partner?', applyNow: 'Apliko tani',
        rememberMe: 'Më mbaj mend', recentRedemptions: 'Përdorimet e fundit', noRedemptions: 'Pa përdorime', value: 'Vlera',
        // Wise Bank Transfer translations
        payoutHistory: 'Historia e pagesave', noPayouts: 'Nuk ka pagesa ende',
        bankTransfer: 'Transfertë bankare',
        enterBankDetails: 'Vendosni të dhënat bankare',
        accountHolder: 'Mbajtësi i llogarisë',
        connectBank: 'Lidh llogarinë bankare',
        bankConnected: 'Llogaria bankare e lidhur',
        disconnectBank: 'Shkëput llogarinë',
        connect: 'Lidh',
        minPayout: 'Shuma minimale e pagesës',
        bankAdvantages: 'Përparësitë:',
        fastTransfer: 'Transferta të shpejta (1-2 ditë pune)',
        noFees: 'Pa tarifa për transfertat EUR',
        secureIban: 'Verifikim i sigurt IBAN',
        minAmount: 'Shuma minimale vetëm €10',
        ibanHint: 'IBAN-in tuaj e gjeni në kartën bankare ose në bankën online',
        payNow: 'Paguaj tani',
        completed: 'Përfunduar',
        processing: 'Duke u procesuar',
        pendingStatus: 'Në pritje',
        iban: 'IBAN'
      }
    };
    const langKey = getLangKey(language);
    // First check centralized partner translations, then inline translations
    return partnerTranslations[langKey]?.[key] || partnerTranslations.de?.[key] || translations[langKey]?.[key] || translations.de[key] || key;
  };
  // Login state
  const [email, setEmail] = useState(() => localStorage.getItem('partner_saved_email') || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginMode, setLoginMode] = useState('admin'); // 'admin' or 'staff'
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  
  // Registration state - extended
  const [regStep, setRegStep] = useState(1); // 1: Business Type, 2: Basic Info, 3: Details
  const [regData, setRegData] = useState({
    business_type: '',
    business_name: '',
    email: '',
    password: '',
    password_confirm: '',
    phone: '',
    address: '',
    city: '',
    postal_code: '',
    country: 'Deutschland',
    description: '',
    website: '',
    tax_id: '',
    iban: '',
    contact_person: '',
    logo_url: ''
  });
  
  // Scanner state
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [redeeming, setRedeeming] = useState(false);
  const html5QrCodeRef = useRef(null);
  
  // Dashboard state
  const [dashboardData, setDashboardData] = useState(null);
  const [vouchers, setVouchers] = useState([]);
  
  // Statistics state
  const [statistics, setStatistics] = useState(null);
  
  // Wise Payout state (Stripe removed - only Wise)
  const [payoutHistory, setPayoutHistory] = useState([]);
  const [wiseStatus, setWiseStatus] = useState(null);
  const [wiseSetupForm, setWiseSetupForm] = useState({ account_holder_name: '', iban: '' });
  const [showWiseSetup, setShowWiseSetup] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState(''); // Custom payout amount
  
  // Verification state
  const [documents, setDocuments] = useState([]);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [documentTypes, setDocumentTypes] = useState([]);
  
  // Create voucher state
  const [newVoucher, setNewVoucher] = useState({
    name: '',
    description: '',
    value: '',
    price: '',
    quantity: 1,
    valid_until: '',
    terms: ''
  });

  // Check for saved session
  useEffect(() => {
    const savedToken = localStorage.getItem('partner_token');
    const savedPartner = localStorage.getItem('partner_data');
    const savedRole = localStorage.getItem('partner_role');
    const savedIsStaff = localStorage.getItem('partner_is_staff');
    if (savedToken && savedPartner) {
      setToken(savedToken);
      setPartner(JSON.parse(savedPartner));
      setIsLoggedIn(true);
      setUserRole(savedRole || 'admin');
      setIsStaff(savedIsStaff === 'true');
      setView('dashboard');
    }
  }, []);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);
  
  // Save language preference
  useEffect(() => {
    localStorage.setItem('partner_language', language);
  }, [language]);
  
  // Auto-login from saved credentials
  useEffect(() => {
    const savedToken = localStorage.getItem('partner_token');
    const savedPartner = localStorage.getItem('partner_data');
    const savedRole = localStorage.getItem('partner_role');
    const savedIsStaff = localStorage.getItem('partner_is_staff');
    const shouldRemember = localStorage.getItem('partner_remember') === 'true';
    
    if (shouldRemember && savedToken && savedPartner) {
      try {
        const partnerData = JSON.parse(savedPartner);
        setToken(savedToken);
        setPartner(partnerData);
        setUserRole(savedRole || 'admin');
        setIsStaff(savedIsStaff === 'true');
        setIsLoggedIn(true);
        setView(savedRole === 'counter' ? 'scanner' : 'dashboard');
      } catch (e) {
        // Invalid saved data, clear it
        localStorage.removeItem('partner_token');
        localStorage.removeItem('partner_data');
        localStorage.removeItem('partner_role');
        localStorage.removeItem('partner_is_staff');
      }
    }
  }, []);

  // ==================== AUTH ====================
  
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const endpoint = loginMode === 'staff' 
        ? `${API}/api/partner-portal/staff/login`
        : `${API}/api/partner-portal/login`;
      
      // Staff login uses staff_number, admin uses email
      const payload = loginMode === 'staff'
        ? { staff_number: email, password }
        : { email, password };
        
      const response = await axios.post(endpoint, payload);
      const data = response.data;
      
      setToken(data.token);
      setPartner(data.partner);
      setIsLoggedIn(true);
      
      // Set role based on login type
      const role = data.role || data.partner?.role || 'admin';
      setUserRole(role);
      setIsStaff(data.is_staff || false);
      
      // Counter staff goes directly to scanner/pay view
      if (role === 'counter') {
        setView('scanner');
      } else {
        setView('dashboard');
      }
      
      // Save to localStorage (always save for session, remember for persistence)
      localStorage.setItem('partner_token', data.token);
      localStorage.setItem('partner_data', JSON.stringify(data.partner));
      localStorage.setItem('partner_role', role);
      localStorage.setItem('partner_is_staff', String(data.is_staff || false));
      localStorage.setItem('partner_remember', String(rememberMe));
      
      // Also save credentials if remember me is checked
      if (rememberMe) {
        localStorage.setItem('partner_saved_email', email);
      } else {
        localStorage.removeItem('partner_saved_email');
      }
      
      const welcomeName = data.staff?.name || data.partner.name;
      toast.success(language === 'en' ? `Welcome, ${welcomeName}!` : `Willkommen, ${welcomeName}!`);
      
      if (role !== 'counter') {
        fetchDashboard(data.token);
      }
    } catch (err) {
      // Handle axios error response
      const errorMessage = err.response?.data?.detail || 
        (language === 'en' ? 'Invalid credentials' : 'Ungültige Anmeldedaten');
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  const handleLogout = () => {
    setIsLoggedIn(false);
    setToken('');
    setPartner(null);
    setView('login');
    setUserRole('admin');
    setIsStaff(false);
    
    // Clear localStorage but keep remember preference and email
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_data');
    localStorage.removeItem('partner_role');
    localStorage.removeItem('partner_is_staff');
    if (!rememberMe) {
      localStorage.removeItem('partner_saved_email');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    
    // Validation
    if (regData.password !== regData.password_confirm) {
      toast.error('Passwörter stimmen nicht überein');
      return;
    }
    
    if (regData.password.length < 6) {
      toast.error('Passwort muss mindestens 6 Zeichen haben');
      return;
    }
    
    setLoading(true);
    
    try {
      await axios.post(`${API}/api/partner-portal/apply`, {
        business_type: regData.business_type,
        business_name: regData.business_name,
        email: regData.email,
        password: regData.password,
        phone: regData.phone,
        address: regData.address,
        city: regData.city,
        postal_code: regData.postal_code,
        country: regData.country,
        description: regData.description,
        website: regData.website,
        tax_id: regData.tax_id,
        iban: regData.iban,
        contact_person: regData.contact_person,
        logo_url: regData.logo_url
      });
      
      toast.success('Bewerbung erfolgreich eingereicht! Sie erhalten eine E-Mail nach der Prüfung.');
      setView('login');
      setRegStep(1);
      setRegData({
        business_type: '',
        business_name: '',
        email: '',
        password: '',
        password_confirm: '',
        phone: '',
        address: '',
        city: '',
        postal_code: '',
        country: 'Deutschland',
        description: '',
        website: '',
        tax_id: '',
        iban: '',
        contact_person: '',
        logo_url: ''
      });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registrierung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  // Staff management state
  const [staffList, setStaffList] = useState([]);
  const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '', role: 'counter' });
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [editStaffData, setEditStaffData] = useState({ name: '', email: '', role: 'counter' });
  
  const fetchStaff = async () => {
    if (!token) return;
    setLoadingStaff(true);
    try {
      const response = await axios.get(`${API}/api/partner-portal/staff?token=${token}`);
      setStaffList(response.data.staff || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setLoadingStaff(false);
    }
  };
  
  const createStaff = async (e) => {
    e.preventDefault();
    if (!newStaff.name || !newStaff.email || !newStaff.password) {
      toast.error(language === 'en' ? 'Please fill all fields' : 'Bitte alle Felder ausfüllen');
      return;
    }
    
    try {
      await axios.post(`${API}/api/partner-portal/staff/create?token=${token}`, newStaff);
      toast.success(language === 'en' ? 'Staff account created' : 'Mitarbeiter-Konto erstellt');
      setNewStaff({ name: '', email: '', password: '', role: 'counter' });
      fetchStaff();
    } catch (error) {
      toast.error(error.response?.data?.detail || error.message);
    }
  };
  
  const updateStaff = async (staffId) => {
    try {
      await axios.put(`${API}/api/partner-portal/staff/${staffId}?token=${token}`, editStaffData);
      toast.success(language === 'en' ? 'Staff updated' : 'Mitarbeiter aktualisiert');
      setEditingStaff(null);
      fetchStaff();
    } catch (error) {
      toast.error(error.response?.data?.detail || error.message);
    }
  };
  
  const deleteStaff = async (staffId) => {
    if (!confirm(language === 'en' ? 'Delete this staff account?' : 'Mitarbeiter-Konto löschen?')) return;
    
    try {
      await axios.delete(`${API}/api/partner-portal/staff/${staffId}?token=${token}`);
      toast.success(language === 'en' ? 'Staff deleted' : 'Mitarbeiter gelöscht');
      fetchStaff();
    } catch (error) {
      toast.error(error.response?.data?.detail || error.message);
    }
  };

  // ==================== SCANNER ====================
  
  const startScanner = async () => {
    try {
      setScanning(true);
      setScanResult(null);
      
      const html5QrCode = new Html5Qrcode("qr-reader");
      html5QrCodeRef.current = html5QrCode;
      
      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleQRScan(decodedText);
          html5QrCode.stop().catch(() => {});
          setScanning(false);
        },
        () => {}
      );
    } catch (err) {
      setScanning(false);
      toast.error('Kamera-Zugriff verweigert');
    }
  };

  const stopScanner = () => {
    if (html5QrCodeRef.current) {
      html5QrCodeRef.current.stop().catch(() => {});
    }
    setScanning(false);
  };

  const handleQRScan = async (qrData) => {
    const parts = qrData.split(':');
    let code = qrData;
    if (parts[0] === 'BIDBLITZ' && parts.length >= 2) {
      code = parts[1];
    }
    await validateVoucher(code);
  };

  const validateVoucher = async (code) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/api/partner-portal/validate/${code}?token=${token}`);
      setScanResult(response.data);
      if (response.data.valid) {
        toast.success(`Gültiger Gutschein: €${response.data.value}`);
      } else {
        toast.error(response.data.error || 'Ungültiger Gutschein');
      }
    } catch (err) {
      toast.error('Validierung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const handleManualValidate = async (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    await validateVoucher(manualCode.trim());
  };

  const handleRedeem = async () => {
    if (!scanResult?.valid) return;
    setRedeeming(true);
    try {
      const response = await axios.post(`${API}/api/partner-portal/redeem?token=${token}`, { voucher_code: scanResult.code });
      
      toast.success(`✅ Gutschein eingelöst! €${response.data.payout_amount.toFixed(2)} gutgeschrieben.`);
      setScanResult(null);
      setManualCode('');
      fetchDashboard(token);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Einlösung fehlgeschlagen');
    } finally {
      setRedeeming(false);
    }
  };

  // ==================== DASHBOARD ====================
  
  const fetchDashboard = async (authToken = token) => {
    try {
      const response = await axios.get(`${API}/api/partner-portal/dashboard?token=${authToken}`);
      setDashboardData(response.data);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    }
  };

  const fetchVouchers = async () => {
    try {
      const response = await axios.get(`${API}/api/partner-portal/vouchers?token=${token}`);
      setVouchers(response.data.vouchers || []);
    } catch (err) {
      console.error('Vouchers fetch error:', err);
    }
  };

  // ==================== CREATE VOUCHER ====================
  
  const handleCreateVoucher = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await axios.post(`${API}/api/partner-portal/vouchers/create?token=${token}`, {
        name: newVoucher.name,
        description: newVoucher.description,
        value: parseFloat(newVoucher.value),
        price: parseFloat(newVoucher.price),
        quantity: parseInt(newVoucher.quantity),
        valid_until: newVoucher.valid_until || null,
        terms: newVoucher.terms
      });
      
      toast.success(response.data.message);
      setNewVoucher({ name: '', description: '', value: '', price: '', quantity: 1, valid_until: '', terms: '' });
      setView('vouchers');
      fetchVouchers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler beim Erstellen');
    } finally {
      setLoading(false);
    }
  };

  // ==================== STATISTICS ====================
  
  const fetchStatistics = async () => {
    try {
      const response = await axios.get(`${API}/api/partner-portal/statistics?token=${token}`);
      setStatistics(response.data);
    } catch (err) {
      console.error('Statistics fetch error:', err);
    }
  };

  // ==================== WISE PAYOUTS (Sole payout method) ====================
  
  const fetchWiseStatus = async () => {
    try {
      const response = await axios.get(`${API}/api/wise-payouts/account-status?token=${token}`);
      setWiseStatus(response.data);
    } catch (err) {
      console.error('Wise status error:', err);
    }
  };

  const fetchWisePayoutHistory = async () => {
    try {
      const response = await axios.get(`${API}/api/wise-payouts/payout-history?token=${token}`);
      setPayoutHistory(response.data.payouts || []);
    } catch (err) {
      console.error('Wise payout history error:', err);
    }
  };

  const setupWiseAccount = async () => {
    if (!wiseSetupForm.account_holder_name || !wiseSetupForm.iban) {
      toast.error('Bitte füllen Sie alle Felder aus');
      return;
    }
    
    try {
      setLoading(true);
      const response = await axios.post(`${API}/api/wise-payouts/setup-bank-account?token=${token}`, wiseSetupForm);
      
      toast.success(response.data.message || 'Bankkonto erfolgreich verbunden');
      setShowWiseSetup(false);
      fetchWiseStatus();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler beim Verbinden des Bankkontos');
    } finally {
      setLoading(false);
    }
  };

  const requestWisePayout = async (customAmount = null) => {
    const maxAmount = dashboardData?.stats?.pending_payout || 0;
    const amount = customAmount !== null ? parseFloat(customAmount) : maxAmount;
    
    if (isNaN(amount) || amount < 10) {
      toast.error('Mindestbetrag für Auszahlung: €10');
      return;
    }
    
    if (amount > maxAmount) {
      toast.error(`Maximaler Betrag: €${maxAmount.toFixed(2)}`);
      return;
    }
    
    if (!confirm(`Möchten Sie €${amount.toFixed(2)} auf Ihr Bankkonto überweisen?`)) return;
    
    try {
      setLoading(true);
      const response = await axios.post(`${API}/api/wise-payouts/request-payout?token=${token}`, {
        amount: amount,
        reference: `BidBlitz Auszahlung - ${partner?.business_name || 'Partner'}`
      });
      
      toast.success(response.data.message || 'Auszahlung wird verarbeitet');
      setPayoutAmount(''); // Reset input
      fetchDashboard();
      fetchWisePayoutHistory();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler bei der Auszahlung');
    } finally {
      setLoading(false);
    }
  };

  const disconnectWise = async () => {
    if (!confirm('Möchten Sie Ihr Bankkonto wirklich trennen?')) return;
    
    try {
      setLoading(true);
      await axios.delete(`${API}/api/wise-payouts/disconnect?token=${token}`);
      toast.success('Bankkonto getrennt');
      setWiseStatus(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler beim Trennen');
    } finally {
      setLoading(false);
    }
  };

  // ==================== VERIFICATION ====================
  
  const fetchVerificationStatus = async () => {
    try {
      const [statusRes, docsRes, typesRes] = await Promise.all([
        axios.get(`${API}/api/partner-verification/verification-status?token=${token}`),
        axios.get(`${API}/api/partner-verification/my-documents?token=${token}`),
        axios.get(`${API}/api/partner-verification/document-types`)
      ]);
      
      setVerificationStatus(statusRes.data);
      setDocuments(docsRes.data.documents || []);
      setDocumentTypes(typesRes.data);
    } catch (err) {
      console.error('Verification fetch error:', err);
    }
  };

  const uploadDocument = async (file, docType) => {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('document_type', docType);
    
    try {
      setLoading(true);
      const response = await axios.post(`${API}/api/partner-verification/upload-document?token=${token}`, formData);
      
      toast.success(response.data.message);
      fetchVerificationStatus();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn && view === 'dashboard') {
      fetchDashboard();
    } else if (isLoggedIn && view === 'vouchers') {
      fetchVouchers();
    } else if (isLoggedIn && view === 'statistics') {
      fetchStatistics();
    } else if (isLoggedIn && view === 'payouts') {
      fetchWiseStatus();
      fetchWisePayoutHistory();
      fetchDashboard();
    } else if (isLoggedIn && view === 'verification') {
      fetchVerificationStatus();
    }
  }, [view, isLoggedIn]);

  // ==================== RENDER ====================

  // Login View
  if (!isLoggedIn && view === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Language Selector */}
            <div className="flex justify-end mb-4 relative">
              <button
                onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border hover:border-amber-300"
              >
                <span>{languages.find(l => l.code === language)?.flag}</span>
                <span>{languages.find(l => l.code === language)?.name}</span>
                <Languages className="w-4 h-4" />
              </button>
              
              {showLanguageMenu && (
                <div className="absolute top-full right-0 mt-1 bg-white border rounded-lg shadow-lg py-1 z-50 min-w-[150px]">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code);
                        setShowLanguageMenu(false);
                        localStorage.setItem('partner_language', lang.code);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-amber-50 ${
                        language === lang.code ? 'bg-amber-50 text-amber-600' : 'text-gray-700'
                      }`}
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Logo */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Store className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800">Partner Portal</h1>
              <p className="text-gray-500 text-sm">BidBlitz {t('voucherSystem')}</p>
            </div>
            
            {/* Login Mode Toggle */}
            <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setLoginMode('admin')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                  loginMode === 'admin' 
                    ? 'bg-white shadow text-amber-600' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <User className="w-4 h-4 inline mr-1" />
                {t('adminLogin')}
              </button>
              <button
                onClick={() => setLoginMode('staff')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                  loginMode === 'staff' 
                    ? 'bg-white shadow text-amber-600' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Users className="w-4 h-4 inline mr-1" />
                {t('staffLogin')}
              </button>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {loginMode === 'staff' 
                    ? (language === 'en' ? 'Staff Number' : 'Kundennummer')
                    : t('email')
                  }
                </label>
                <div className="relative">
                  {loginMode === 'staff' ? (
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  ) : (
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  )}
                  <Input
                    type={loginMode === 'staff' ? 'text' : 'email'}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={loginMode === 'staff' ? 'z.B. PR-001-001' : 'partner@example.de'}
                    className="pl-10 font-mono"
                    required
                  />
                </div>
                {loginMode === 'staff' && (
                  <p className="text-xs text-gray-500 mt-1">
                    {language === 'en' 
                      ? 'Enter the staff number provided by your employer'
                      : 'Geben Sie die Kundennummer ein, die Sie von Ihrem Arbeitgeber erhalten haben'}
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('password')}</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              
              {/* Remember Me Checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="remember-me"
                  checked={rememberMe}
                  onChange={(e) => {
                    setRememberMe(e.target.checked);
                    localStorage.setItem('partner_remember', String(e.target.checked));
                  }}
                  className="w-4 h-4 text-amber-500 border-gray-300 rounded focus:ring-amber-500"
                />
                <label htmlFor="remember-me" className="text-sm text-gray-600">
                  {t('rememberMe')}
                </label>
              </div>
              
              <Button 
                type="submit" 
                disabled={loading}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('login')}
              </Button>
            </form>
            
            {loginMode === 'admin' && (
              <div className="mt-6 text-center">
                <p className="text-gray-500 text-sm">{t('notPartner')}</p>
                <button 
                  onClick={() => setView('register')}
                  className="text-amber-600 font-medium hover:underline"
                >
                  {t('applyNow')}
                </button>
              </div>
            )}
            
            {loginMode === 'staff' && (
              <div className="mt-6 p-3 bg-blue-50 rounded-lg">
                <p className="text-blue-700 text-xs text-center">
                  {t('counterInfo')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Registration View - Multi-Step
  if (!isLoggedIn && view === 'register') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800">Partner werden</h1>
              <p className="text-gray-500">Verkaufen Sie Ihre Gutscheine auf BidBlitz</p>
            </div>
            
            {/* Progress Steps */}
            <div className="flex items-center justify-center gap-2 mb-8">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    regStep >= step 
                      ? 'bg-amber-500 text-white' 
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {step}
                  </div>
                  {step < 3 && (
                    <div className={`w-12 h-1 ${regStep > step ? 'bg-amber-500' : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>
            
            <form onSubmit={regStep === 3 ? handleRegister : (e) => { e.preventDefault(); setRegStep(regStep + 1); }}>
              {/* Step 1: Business Type */}
              {regStep === 1 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-bold text-gray-800 mb-4">Geschäftstyp wählen</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {BUSINESS_TYPES.map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setRegData({ ...regData, business_type: type.id })}
                        className={`p-4 rounded-xl border-2 text-center transition-all ${
                          regData.business_type === type.id
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-gray-200 hover:border-amber-300'
                        }`}
                      >
                        <span className="text-3xl block mb-1">{type.icon}</span>
                        <span className="text-sm font-medium text-gray-700">{type.name}</span>
                      </button>
                    ))}
                  </div>
                  
                  <Button 
                    type="submit"
                    disabled={!regData.business_type}
                    className="w-full mt-6 bg-amber-500 hover:bg-amber-600"
                  >
                    Weiter <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}
              
              {/* Step 2: Basic Info */}
              {regStep === 2 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-bold text-gray-800 mb-4">Grunddaten</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Firmenname *
                      </label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input
                          value={regData.business_name}
                          onChange={(e) => setRegData({ ...regData, business_name: e.target.value })}
                          placeholder="z.B. Pizzeria Roma"
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail *</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input
                          type="email"
                          value={regData.email}
                          onChange={(e) => setRegData({ ...regData, email: e.target.value })}
                          placeholder="info@firma.de"
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Telefon *</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input
                          type="tel"
                          value={regData.phone}
                          onChange={(e) => setRegData({ ...regData, phone: e.target.value })}
                          placeholder="+49 30 12345678"
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Passwort *</label>
                      <Input
                        type="password"
                        value={regData.password}
                        onChange={(e) => setRegData({ ...regData, password: e.target.value })}
                        placeholder="Min. 6 Zeichen"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Passwort bestätigen *</label>
                      <Input
                        type="password"
                        value={regData.password_confirm}
                        onChange={(e) => setRegData({ ...regData, password_confirm: e.target.value })}
                        placeholder="Passwort wiederholen"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-3 mt-6">
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={() => setRegStep(1)}
                      className="flex-1"
                    >
                      Zurück
                    </Button>
                    <Button 
                      type="submit"
                      disabled={!regData.business_name || !regData.email || !regData.phone || !regData.password}
                      className="flex-1 bg-amber-500 hover:bg-amber-600"
                    >
                      Weiter <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Step 3: Details & Submit */}
              {regStep === 3 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-bold text-gray-800 mb-4">Details & Adresse</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Adresse *</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input
                          value={regData.address}
                          onChange={(e) => setRegData({ ...regData, address: e.target.value })}
                          placeholder="Straße und Hausnummer"
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">PLZ *</label>
                      <Input
                        value={regData.postal_code}
                        onChange={(e) => setRegData({ ...regData, postal_code: e.target.value })}
                        placeholder="12345"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Stadt *</label>
                      <Input
                        value={regData.city}
                        onChange={(e) => setRegData({ ...regData, city: e.target.value })}
                        placeholder="Berlin"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input
                          type="url"
                          value={regData.website}
                          onChange={(e) => setRegData({ ...regData, website: e.target.value })}
                          placeholder="https://www.example.de"
                          className="pl-10"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ansprechpartner</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input
                          value={regData.contact_person}
                          onChange={(e) => setRegData({ ...regData, contact_person: e.target.value })}
                          placeholder="Max Mustermann"
                          className="pl-10"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Steuernummer</label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input
                          value={regData.tax_id}
                          onChange={(e) => setRegData({ ...regData, tax_id: e.target.value })}
                          placeholder="DE123456789"
                          className="pl-10"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">IBAN (für Auszahlungen)</label>
                      <div className="relative">
                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input
                          value={regData.iban}
                          onChange={(e) => setRegData({ ...regData, iban: e.target.value })}
                          placeholder="DE89 3704 0044 0532 0130 00"
                          className="pl-10"
                        />
                      </div>
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                      <textarea
                        value={regData.description}
                        onChange={(e) => setRegData({ ...regData, description: e.target.value })}
                        placeholder="Kurze Beschreibung Ihres Geschäfts..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                  
                  {/* Commission Info */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4">
                    <h3 className="font-bold text-amber-800 mb-2">💰 Provision</h3>
                    <p className="text-amber-700 text-sm">
                      BidBlitz behält eine Provision von 8-12% (je nach Geschäftstyp) auf verkaufte Gutscheine. 
                      Der Rest wird Ihnen nach der Einlösung gutgeschrieben.
                    </p>
                  </div>
                  
                  <div className="flex gap-3 mt-6">
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={() => setRegStep(2)}
                      className="flex-1"
                    >
                      Zurück
                    </Button>
                    <Button 
                      type="submit"
                      disabled={loading || !regData.address || !regData.city || !regData.postal_code}
                      className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Bewerbung absenden'}
                    </Button>
                  </div>
                </div>
              )}
            </form>
            
            {/* Back to Login */}
            <div className="mt-6 text-center">
              <button 
                onClick={() => { setView('login'); setRegStep(1); }}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                ← Zurück zum Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Logged In Views
  if (isLoggedIn) {
    const businessTypeInfo = BUSINESS_TYPES.find(bt => bt.id === partner?.business_type) || BUSINESS_TYPES[0];
    
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center text-xl">
                {businessTypeInfo.icon}
              </div>
              <div>
                <p className="font-bold text-gray-800">{partner?.name}</p>
                <p className="text-xs text-gray-500">{businessTypeInfo.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Language Selector in Dashboard */}
              <div className="relative">
                <button
                  onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100"
                >
                  <span>{languages.find(l => l.code === language)?.flag}</span>
                  <Languages className="w-4 h-4" />
                </button>
                
                {showLanguageMenu && (
                  <div className="absolute top-full right-0 mt-1 bg-white border rounded-lg shadow-lg py-1 z-50 min-w-[140px]">
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code);
                          setShowLanguageMenu(false);
                          localStorage.setItem('partner_language', lang.code);
                        }}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-amber-50 flex items-center gap-2 ${
                          language === lang.code ? 'bg-amber-50 text-amber-700' : 'text-gray-700'
                        }`}
                      >
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={handleLogout} className="text-gray-500 hover:text-red-500">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>
        
        {/* Navigation */}
        <nav className="bg-white border-b sticky top-14 z-10">
          <div className="max-w-4xl mx-auto px-4 flex gap-1 overflow-x-auto">
            {[
              // Admin-only tabs
              ...(userRole === 'admin' ? [{ id: 'dashboard', label: t('dashboard'), icon: BarChart3 }] : []),
              // Both roles
              { id: 'scanner', label: t('scanner'), icon: Scan },
              { id: 'bidblitz-pay', label: t('pay'), icon: CreditCard },
              // Admin-only tabs
              ...(userRole === 'admin' ? [
                { id: 'vouchers', label: t('vouchers'), icon: Ticket },
                { id: 'budget', label: 'Guthaben', icon: Wallet },
                { id: 'statistics', label: t('statistics'), icon: TrendingUp },
                { id: 'payouts', label: t('payouts'), icon: Euro },
                { id: 'marketing', label: 'Marketing', icon: Share2 },
                { id: 'verification', label: t('verification'), icon: Shield },
                { id: 'profile', label: t('profile'), icon: User },
                { id: 'staff', label: t('staff'), icon: Users },
              ] : []),
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'staff') fetchStaff();
                  setView(item.id);
                }}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  view === item.id
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </div>
        </nav>
        
        {/* Content */}
        <main className="max-w-4xl mx-auto px-4 py-6">
          {/* Dashboard View - Admin Only - Using Expanded Component */}
          {view === 'dashboard' && userRole === 'admin' && dashboardData && (
            <PartnerDashboardExpanded
              token={token}
              partner={partner}
              dashboardData={dashboardData}
              fetchDashboard={fetchDashboard}
              setView={setView}
              language={language}
            />
          )}
          
          {/* Scanner View */}
          {/* Scanner View - Using PartnerScanner Component */}
          {view === 'scanner' && (
            <PartnerScanner 
              token={token}
              fetchDashboard={fetchDashboard}
              t={t}
            />
          )}

          {/* BidBlitz Pay View - Payment Scanner for Customer QR Codes */}
          {view === 'bidblitz-pay' && (
            <BidBlitzPayPartner token={token} partnerId={partner?.id} partnerName={partner?.name} commissionRate={partner?.commission_rate || 10} />
          )}
          
          {/* Vouchers View - Using PartnerVouchers Component */}
          {(view === 'vouchers' || view === 'create-voucher') && (
            <PartnerVouchers 
              token={token}
              partner={partner}
              fetchDashboard={fetchDashboard}
              t={t}
            />
          )}

          {/* Statistics View - Using PartnerStatistics Component */}
          {view === 'statistics' && (
            <PartnerStatistics 
              token={token}
              partner={partner}
              t={t}
            />
          )}

          {/* Payouts View - Using PartnerPayouts Component */}
          {view === 'payouts' && (
            <PartnerPayouts 
              token={token}
              partner={partner}
              dashboardData={dashboardData}
              fetchDashboard={fetchDashboard}
              t={t}
            />
          )}

          {/* Budget View - Voucher Budget & Earnings */}
          {view === 'budget' && (
            <PartnerBudget 
              token={token}
              language={language}
            />
          )}

          {/* Marketing View - New Marketing Features */}
          {view === 'marketing' && (
            <div className="space-y-8">
              {/* Marketing Sub-Navigation */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { id: 'referral', label: 'Empfehlungen', icon: '👥' },
                  { id: 'qr', label: 'QR-Codes', icon: '📱' },
                  { id: 'flash', label: 'Flash Sales', icon: '⚡' },
                  { id: 'social', label: 'Social Media', icon: '📣' },
                  { id: 'ratings', label: 'Bewertungen', icon: '⭐' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setMarketingTab(tab.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      marketingTab === tab.id
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              {/* Marketing Content */}
              {marketingTab === 'referral' && (
                <PartnerReferral token={token} t={t} />
              )}
              {marketingTab === 'qr' && (
                <PartnerQRCodes token={token} partner={partner} t={t} />
              )}
              {marketingTab === 'flash' && (
                <PartnerFlashSales token={token} t={t} />
              )}
              {marketingTab === 'social' && (
                <PartnerSocialSharing token={token} t={t} />
              )}
              {marketingTab === 'ratings' && (
                <PartnerRatingsOverview token={token} partnerId={partner?.id} t={t} />
              )}
            </div>
          )}

          {/* Verification View - Using PartnerVerification Component */}
          {view === 'verification' && (
            <PartnerVerification 
              token={token}
              t={t}
            />
          )}

          {/* Profile View - Using PartnerProfile Component */}
          {view === 'profile' && (
            <PartnerProfile 
              token={token}
              partner={partner}
              setPartner={setPartner}
              t={t}
            />
          )}
          
          {/* Staff Management View - Admin Only */}
          {/* Staff View - Using PartnerStaff Component */}
          {view === 'staff' && userRole === 'admin' && (
            <PartnerStaff 
              token={token}
              language={language}
              t={t}
            />
          )}
        </main>
      </div>
    );
  }

  return null;
}

// BidBlitz Pay Partner Component - Payment Scanner
function BidBlitzPayPartner({ token, partnerId, partnerName, commissionRate }) {
  const [step, setStep] = useState('amount'); // 'amount' -> 'scan' -> 'confirm'
  const [scanning, setScanning] = useState(false);
  const [customerData, setCustomerData] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [manualQR, setManualQR] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(null);
  const html5QrCodeRef = useRef(null);
  const scannerStarted = useRef(false);

  const startScanner = async () => {
    if (scannerStarted.current) return;
    scannerStarted.current = true;
    setScanning(true);
    setCustomerData(null);
    
    try {
      // Small delay to ensure DOM element is ready
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const html5QrCode = new Html5Qrcode("bidblitz-pay-scanner");
      html5QrCodeRef.current = html5QrCode;
      
      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        async (decodedText) => {
          await html5QrCode.stop();
          scannerStarted.current = false;
          setScanning(false);
          handleQRScanned(decodedText);
        },
        () => {}
      );
    } catch (err) {
      console.error("Scanner error:", err);
      scannerStarted.current = false;
      setScanning(false);
      toast.error("Kamera-Zugriff nicht möglich. Bitte QR-Code manuell eingeben.");
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
      } catch {}
    }
    scannerStarted.current = false;
    setScanning(false);
  };

  // Auto-start camera when moving to scan step
  useEffect(() => {
    if (step === 'scan' && !scanning && !scannerStarted.current) {
      startScanner();
    }
    return () => {
      if (step !== 'scan') {
        stopScanner();
      }
    };
  }, [step]);

  const handleQRScanned = async (qrData) => {
    try {
      const response = await axios.get(
        `${API}/api/bidblitz-pay/scan-customer?qr_data=${encodeURIComponent(qrData)}&token=${token}`
      );
      
      setCustomerData(response.data);
      setStep('confirm');
      toast.success(`Kunde gefunden: ${response.data.customer.name}`);
    } catch (error) {
      console.error("Scan error:", error);
      toast.error(error.response?.data?.detail || "Ungültiger QR-Code");
    }
  };

  const handleManualInput = async (e) => {
    e.preventDefault();
    if (!manualQR.trim()) return;
    handleQRScanned(manualQR.trim());
    setManualQR('');
  };

  const proceedToScan = () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error("Bitte gültigen Betrag eingeben");
      return;
    }
    setStep('scan');
  };

  const processPayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error("Bitte gültigen Betrag eingeben");
      return;
    }
    
    if (amount > (customerData?.available_balance?.total || 0)) {
      toast.error("Nicht genug Guthaben beim Kunden");
      return;
    }
    
    setProcessing(true);
    
    try {
      const response = await axios.post(
        `${API}/api/bidblitz-pay/process-payment?token=${token}&payment_token=${customerData.payment_token}&amount=${amount}&use_partner_vouchers=true&use_universal=true`
      );
      
      setPaymentSuccess(response.data);
      setCustomerData(null);
      setPaymentAmount('');
      setStep('amount');
      toast.success(`Zahlung von €${amount.toFixed(2)} erfolgreich!`);
    } catch (error) {
      console.error("Payment error:", error);
      toast.error(error.response?.data?.detail || "Zahlung fehlgeschlagen");
    } finally {
      setProcessing(false);
    }
  };

  const resetFlow = () => {
    setStep('amount');
    setPaymentAmount('');
    setCustomerData(null);
    setPaymentSuccess(null);
    stopScanner();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
          <CreditCard className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="font-bold text-gray-800 text-xl">BidBlitz Pay</h2>
          <p className="text-sm text-gray-500">Kunden-Zahlungen akzeptieren</p>
        </div>
      </div>

      {/* Success Message */}
      {paymentSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-green-700 mb-2">Zahlung erfolgreich!</h3>
          <p className="text-3xl font-bold text-green-600 mb-4">€{paymentSuccess.amount.toFixed(2)}</p>
          <div className="bg-white rounded-lg p-4 text-left space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Transaktions-ID:</span>
              <span className="font-mono">{paymentSuccess.transaction_id}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Sie erhalten:</span>
              <span className="font-bold text-green-600">€{paymentSuccess.partner_receives.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Provision ({commissionRate}%):</span>
              <span className="text-gray-600">€{paymentSuccess.commission.toFixed(2)}</span>
            </div>
          </div>
          <Button 
            onClick={resetFlow}
            className="mt-4 bg-green-500 hover:bg-green-600"
          >
            Weitere Zahlung
          </Button>
        </div>
      )}

      {/* Step 1: Enter Amount FIRST */}
      {!paymentSuccess && step === 'amount' && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Euro className="w-5 h-5 text-amber-500" />
            1. Zahlungsbetrag eingeben
          </h3>
          
          <div className="space-y-4">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xl">€</span>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                className="pl-10 text-3xl h-16 font-bold text-center"
                step="0.01"
                min="0.01"
                autoFocus
              />
            </div>
            
            {/* Quick Amounts */}
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 20, 50].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setPaymentAmount(String(amt))}
                  className={`py-3 rounded-lg border text-lg font-medium transition-all ${
                    parseFloat(paymentAmount) === amt
                      ? 'border-amber-500 bg-amber-50 text-amber-700'
                      : 'border-gray-200 hover:border-amber-300'
                  }`}
                >
                  €{amt}
                </button>
              ))}
            </div>
            
            <Button 
              onClick={proceedToScan}
              className="w-full h-14 bg-amber-500 hover:bg-amber-600 text-lg"
              disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
            >
              <QrCode className="w-5 h-5 mr-2" />
              Weiter zum Scannen
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Scan QR (Camera auto-starts) */}
      {!paymentSuccess && step === 'scan' && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Camera className="w-5 h-5 text-amber-500" />
              2. Kunden-QR scannen
            </h3>
            <div className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm font-medium">
              €{parseFloat(paymentAmount).toFixed(2)}
            </div>
          </div>
          
          <div id="bidblitz-pay-scanner" className="w-full max-w-sm mx-auto rounded-lg overflow-hidden bg-black min-h-[250px]" />
          
          {scanning && (
            <p className="text-center text-sm text-gray-500 mt-2 animate-pulse">
              Scannen aktiv - bitte Kunden-QR zeigen...
            </p>
          )}
          
          <div className="flex gap-2 mt-4">
            <Button onClick={() => setStep('amount')} variant="outline" className="flex-1">
              Zurück
            </Button>
            <Button onClick={stopScanner} variant="outline" className="flex-1">
              <X className="w-4 h-4 mr-2" />
              Scanner beenden
            </Button>
          </div>
          
          {/* Manual Input */}
          <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-gray-500 mb-3">Oder QR-Code manuell eingeben:</p>
            <form onSubmit={handleManualInput} className="flex gap-2">
              <Input
                value={manualQR}
                onChange={(e) => setManualQR(e.target.value)}
                placeholder="BIDBLITZ-PAY:xxxxx"
                className="flex-1"
              />
              <Button type="submit">Prüfen</Button>
            </form>
          </div>
        </div>
      )}

      {/* Step 3: Customer Found - Confirm Payment */}
      {!paymentSuccess && step === 'confirm' && customerData && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            3. Zahlung bestätigen
          </h3>
          
          <div className="flex items-center gap-3 mb-6 pb-4 border-b">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="font-bold text-gray-800">{customerData.customer.name}</p>
              <p className="text-sm text-gray-500">{customerData.customer.email}</p>
            </div>
            <CheckCircle className="w-6 h-6 text-green-500 ml-auto" />
          </div>

          {/* Available Balance */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-700 mb-2">Verfügbares Guthaben:</p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-500">Partner</p>
                <p className="font-bold text-lg text-amber-600">
                  €{customerData.available_balance.partner_specific.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Universal</p>
                <p className="font-bold text-lg text-purple-600">
                  €{customerData.available_balance.universal.toFixed(2)}
                </p>
              </div>
              <div className="bg-white rounded-lg p-2">
                <p className="text-xs text-gray-500">Gesamt</p>
                <p className="font-bold text-xl text-green-600">
                  €{customerData.available_balance.total.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Payment Amount - already entered */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-center">
            <p className="text-sm text-green-700 mb-1">Zahlungsbetrag:</p>
            <p className="text-4xl font-bold text-green-600">€{parseFloat(paymentAmount).toFixed(2)}</p>
            {parseFloat(paymentAmount) > customerData.available_balance.total && (
              <p className="text-red-500 text-sm mt-2">
                ⚠️ Betrag übersteigt verfügbares Guthaben
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={resetFlow}
              className="flex-1"
            >
              Abbrechen
            </Button>
            <Button 
              onClick={processPayment}
              disabled={processing || parseFloat(paymentAmount) > customerData.available_balance.total}
              className="flex-1 bg-green-500 hover:bg-green-600 h-14"
            >
              {processing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Zahlung bestätigen
                </>
              )}
            </Button>
          </div>

          {/* Info */}
          <div className="mt-6 pt-4 border-t text-sm text-gray-500">
            <p>Sie erhalten: <span className="font-bold text-green-600">
              €{((parseFloat(paymentAmount) || 0) * (1 - commissionRate / 100)).toFixed(2)}
            </span> (nach {commissionRate}% Provision)</p>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">So funktioniert BidBlitz Pay:</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-700">
              <li>Kunde zeigt QR-Code aus seiner BidBlitz App</li>
              <li>Sie scannen den QR-Code</li>
              <li>Geben Sie den Zahlungsbetrag ein</li>
              <li>Betrag wird vom Kundenguthaben abgezogen</li>
              <li>Sie erhalten Gutschrift (abzgl. {commissionRate}% Provision)</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
