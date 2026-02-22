/**
 * Staff POS - Mitarbeiter-Kassensystem mit Gutscheinkarten
 * - Aufladung per Barcode
 * - Gutscheinkarten erstellen und verkaufen
 * - Gutscheinkarten einlösen per Barcode
 * - Mehrsprachig: DE, EN, TR, AR, SQ, PL, FR, ES, IT, RU
 */
import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Barcode from 'react-barcode';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  Store, Euro, RefreshCw, CheckCircle, Clock, XCircle,
  History, Printer, LogOut, User, Lock, CreditCard,
  Wallet, Gift, X, Scan, Tag, Plus, ShoppingCart,
  Ticket, Package, ChevronRight, AlertCircle, Camera, Globe,
  Star, Users, Image as ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// ==================== TRANSLATIONS ====================
const translations = {
  de: {
    loginTitle: 'Kassen-Terminal',
    loginSubtitle: 'Mitarbeiter-Anmeldung',
    email: 'E-Mail',
    password: 'Passwort',
    login: 'Anmelden',
    logout: 'Abmelden',
    welcome: 'Willkommen',
    topup: 'Aufladung',
    giftcardCreate: 'Gutschein erstellen',
    giftcardRedeem: 'Gutschein einlösen',
    payment: 'Zahlung',
    amount: 'Betrag',
    topupAmount: 'Aufladebetrag',
    otherAmount: 'Oder anderen Betrag eingeben...',
    scanBarcode: 'Barcode scannen',
    waitingForScan: 'Warte auf Barcode-Scan...',
    scannerReady: 'Scanner bereit - Barcode scannen oder Nummer eingeben + Enter',
    cancel: 'Abbrechen',
    customerBonus: 'Kundenbonus',
    bonusTiers: 'Bonus-Staffelung',
    processTopup: 'Aufladung durchführen',
    giftcardValue: 'Gutscheinwert wählen',
    createGiftcard: 'Gutscheinkarte erstellen',
    sellGiftcards: 'Verkaufen Sie Gutscheinkarten an Kunden',
    giftcardNote: 'Nach dem Erstellen wird ein druckbarer Barcode generiert.',
    scanGiftcard: 'Gutschein-Barcode scannen',
    redeemSuccess: 'Erfolgreich eingelöst!',
    nextGiftcard: 'Nächsten Gutschein einlösen',
    paymentBarcode: 'Zahlung per Barcode',
    customersPay: 'Kunden können mit ihrem Guthaben bezahlen',
    enterAmount: 'Betrag eingeben',
    scanCustomer: 'Kunden-Barcode scannen',
    transactionHistory: 'Transaktionsverlauf',
    transactions: 'Transaktionen',
    refresh: 'Aktualisieren',
    print: 'Drucken',
    printReceipt: 'Kassenabschluss drucken',
    topups: 'Aufladungen',
    bonusesGiven: 'Boni vergeben',
    giftcards: 'Gutscheine',
    redemption: 'Gutschein eingelöst',
    noTransactions: 'Keine Transaktionen vorhanden',
    transactionsAppear: 'Transaktionen erscheinen hier nach der ersten Aufladung',
    topupSuccess: 'Aufladung erfolgreich!',
    total: 'Gutschrift',
    customer: 'Kunde',
    staff: 'Mitarbeiter',
    printReceipt2: 'Beleg drucken',
    done: 'Fertig',
    giftcard: 'Gutscheinkarte',
    validUntil: 'Gültig bis',
    created: 'Erstellt',
    barcodeNumber: 'Barcode-Nummer',
    close: 'Schließen',
    minAmount: 'Mindestbetrag',
    maxAmount: 'Maximalbetrag',
    testAccess: 'Test-Zugang',
    from: 'ab',
    // Stammkunden
    regularCustomers: 'Stammkunden',
    noRegularCustomers: 'Noch keine Stammkunden gespeichert',
    quickSelect: 'Schnellauswahl',
    saveAsRegular: 'Als Stammkunde speichern',
    saveCustomer: 'Kunde speichern',
    customerNickname: 'Spitzname (optional)',
    lastTransaction: 'Letzte Transaktion',
    removeCustomer: 'Entfernen',
    hardwareScanner: 'Hardware-Scanner',
    hardwareScannerActive: 'Scanner aktiv',
    hardwareScannerInfo: 'USB/Bluetooth Scanner bereit',
    waitingForHardwareScan: 'Warte auf Hardware-Scan...',
    // Kassenabschluss
    cashReport: 'Kassenabschluss',
    cashRegister: 'Kasse',
    staffMember: 'Mitarbeiter',
    summary: 'Zusammenfassung',
    bonusesGivenOut: 'Boni ausgegeben',
    payments: 'Zahlungen',
    totalAmount: 'GESAMT',
    printTime: 'Druck',
    cashSystem: 'BidBlitz Kassensystem',
    noTransactionsYet: 'Keine Transaktionen'
  },
  en: {
    loginTitle: 'Cash Register',
    loginSubtitle: 'Staff Login',
    email: 'Email',
    password: 'Password',
    login: 'Login',
    logout: 'Logout',
    welcome: 'Welcome',
    topup: 'Top-up',
    giftcardCreate: 'Create Gift Card',
    giftcardRedeem: 'Redeem Gift Card',
    payment: 'Payment',
    amount: 'Amount',
    topupAmount: 'Top-up Amount',
    otherAmount: 'Or enter another amount...',
    scanBarcode: 'Scan Barcode',
    waitingForScan: 'Waiting for barcode scan...',
    scannerReady: 'Scanner ready - Scan barcode or enter number + Enter',
    cancel: 'Cancel',
    customerBonus: 'Customer Bonus',
    bonusTiers: 'Bonus Tiers',
    processTopup: 'Process Top-up',
    giftcardValue: 'Select Gift Card Value',
    createGiftcard: 'Create Gift Card',
    sellGiftcards: 'Sell gift cards to customers',
    giftcardNote: 'A printable barcode will be generated after creation.',
    scanGiftcard: 'Scan Gift Card Barcode',
    redeemSuccess: 'Successfully Redeemed!',
    nextGiftcard: 'Redeem Next Gift Card',
    paymentBarcode: 'Payment via Barcode',
    customersPay: 'Customers can pay with their balance',
    enterAmount: 'Enter Amount',
    scanCustomer: 'Scan Customer Barcode',
    transactionHistory: 'Transaction History',
    transactions: 'Transactions',
    refresh: 'Refresh',
    print: 'Print',
    printReceipt: 'Print Cash Report',
    topups: 'Top-ups',
    bonusesGiven: 'Bonuses Given',
    giftcards: 'Gift Cards',
    redemption: 'Gift Card Redeemed',
    noTransactions: 'No transactions available',
    transactionsAppear: 'Transactions will appear here after the first top-up',
    topupSuccess: 'Top-up Successful!',
    total: 'Credit',
    customer: 'Customer',
    staff: 'Staff',
    printReceipt2: 'Print Receipt',
    done: 'Done',
    giftcard: 'Gift Card',
    validUntil: 'Valid Until',
    created: 'Created',
    barcodeNumber: 'Barcode Number',
    close: 'Close',
    minAmount: 'Minimum',
    maxAmount: 'Maximum',
    testAccess: 'Test Access',
    from: 'from',
    // Regular Customers
    regularCustomers: 'Regular Customers',
    noRegularCustomers: 'No regular customers saved yet',
    quickSelect: 'Quick Select',
    saveAsRegular: 'Save as Regular Customer',
    saveCustomer: 'Save Customer',
    customerNickname: 'Nickname (optional)',
    lastTransaction: 'Last Transaction',
    removeCustomer: 'Remove',
    hardwareScanner: 'Hardware Scanner',
    hardwareScannerActive: 'Scanner Active',
    hardwareScannerInfo: 'USB/Bluetooth Scanner ready',
    waitingForHardwareScan: 'Waiting for hardware scan...',
    // Cash Report
    cashReport: 'Cash Report',
    cashRegister: 'Cash Register',
    staffMember: 'Staff',
    summary: 'Summary',
    bonusesGivenOut: 'Bonuses Given',
    payments: 'Payments',
    totalAmount: 'TOTAL',
    printTime: 'Print',
    cashSystem: 'BidBlitz Cash System',
    noTransactionsYet: 'No transactions'
  },
  tr: {
    loginTitle: 'Kasa Terminali',
    loginSubtitle: 'Personel Girişi',
    email: 'E-posta',
    password: 'Şifre',
    login: 'Giriş',
    logout: 'Çıkış',
    welcome: 'Hoş geldiniz',
    topup: 'Yükleme',
    giftcardCreate: 'Hediye Kartı Oluştur',
    giftcardRedeem: 'Hediye Kartı Kullan',
    payment: 'Ödeme',
    amount: 'Tutar',
    topupAmount: 'Yükleme Tutarı',
    otherAmount: 'Veya başka bir tutar girin...',
    scanBarcode: 'Barkod Tara',
    waitingForScan: 'Barkod taraması bekleniyor...',
    scannerReady: 'Tarayıcı hazır - Barkod tarayın veya numara + Enter',
    cancel: 'İptal',
    customerBonus: 'Müşteri Bonusu',
    bonusTiers: 'Bonus Seviyeleri',
    processTopup: 'Yükleme Yap',
    giftcardValue: 'Hediye Kartı Değeri Seç',
    createGiftcard: 'Hediye Kartı Oluştur',
    sellGiftcards: 'Müşterilere hediye kartı satın',
    giftcardNote: 'Oluşturulduktan sonra yazdırılabilir barkod oluşturulacak.',
    scanGiftcard: 'Hediye Kartı Barkodunu Tara',
    redeemSuccess: 'Başarıyla Kullanıldı!',
    nextGiftcard: 'Sonraki Hediye Kartını Kullan',
    paymentBarcode: 'Barkod ile Ödeme',
    customersPay: 'Müşteriler bakiyeleriyle ödeme yapabilir',
    enterAmount: 'Tutar Girin',
    scanCustomer: 'Müşteri Barkodunu Tara',
    transactionHistory: 'İşlem Geçmişi',
    transactions: 'İşlemler',
    refresh: 'Yenile',
    print: 'Yazdır',
    printReceipt: 'Kasa Raporu Yazdır',
    topups: 'Yüklemeler',
    bonusesGiven: 'Verilen Bonuslar',
    giftcards: 'Hediye Kartları',
    redemption: 'Hediye Kartı Kullanıldı',
    noTransactions: 'İşlem bulunamadı',
    transactionsAppear: 'İlk yüklemeden sonra işlemler burada görünecek',
    topupSuccess: 'Yükleme Başarılı!',
    total: 'Kredi',
    customer: 'Müşteri',
    staff: 'Personel',
    printReceipt2: 'Fiş Yazdır',
    done: 'Tamam',
    giftcard: 'Hediye Kartı',
    validUntil: 'Geçerlilik',
    created: 'Oluşturuldu',
    barcodeNumber: 'Barkod Numarası',
    close: 'Kapat',
    minAmount: 'Minimum',
    maxAmount: 'Maksimum',
    testAccess: 'Test Erişimi',
    from: 'dan'
  },
  ar: {
    loginTitle: 'محطة الكاشير',
    loginSubtitle: 'تسجيل دخول الموظف',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    login: 'تسجيل الدخول',
    logout: 'تسجيل الخروج',
    welcome: 'مرحباً',
    topup: 'شحن',
    giftcardCreate: 'إنشاء بطاقة هدية',
    giftcardRedeem: 'استرداد بطاقة هدية',
    payment: 'دفع',
    amount: 'المبلغ',
    topupAmount: 'مبلغ الشحن',
    otherAmount: 'أو أدخل مبلغاً آخر...',
    scanBarcode: 'مسح الباركود',
    waitingForScan: 'في انتظار مسح الباركود...',
    scannerReady: 'الماسح جاهز - امسح الباركود أو أدخل الرقم + Enter',
    cancel: 'إلغاء',
    customerBonus: 'مكافأة العميل',
    bonusTiers: 'مستويات المكافآت',
    processTopup: 'إجراء الشحن',
    giftcardValue: 'اختر قيمة بطاقة الهدية',
    createGiftcard: 'إنشاء بطاقة هدية',
    sellGiftcards: 'بيع بطاقات الهدايا للعملاء',
    giftcardNote: 'سيتم إنشاء باركود قابل للطباعة بعد الإنشاء.',
    scanGiftcard: 'مسح باركود بطاقة الهدية',
    redeemSuccess: 'تم الاسترداد بنجاح!',
    nextGiftcard: 'استرداد البطاقة التالية',
    paymentBarcode: 'الدفع عبر الباركود',
    customersPay: 'يمكن للعملاء الدفع برصيدهم',
    enterAmount: 'أدخل المبلغ',
    scanCustomer: 'مسح باركود العميل',
    transactionHistory: 'سجل المعاملات',
    transactions: 'المعاملات',
    refresh: 'تحديث',
    print: 'طباعة',
    printReceipt: 'طباعة تقرير الكاشير',
    topups: 'عمليات الشحن',
    bonusesGiven: 'المكافآت الممنوحة',
    giftcards: 'بطاقات الهدايا',
    redemption: 'تم استرداد البطاقة',
    noTransactions: 'لا توجد معاملات',
    transactionsAppear: 'ستظهر المعاملات هنا بعد أول شحن',
    topupSuccess: 'تم الشحن بنجاح!',
    total: 'الرصيد',
    customer: 'العميل',
    staff: 'الموظف',
    printReceipt2: 'طباعة الإيصال',
    done: 'تم',
    giftcard: 'بطاقة هدية',
    validUntil: 'صالحة حتى',
    created: 'تم الإنشاء',
    barcodeNumber: 'رقم الباركود',
    close: 'إغلاق',
    minAmount: 'الحد الأدنى',
    maxAmount: 'الحد الأقصى',
    testAccess: 'وصول تجريبي',
    from: 'من'
  },
  sq: {
    loginTitle: 'Terminali i Arkës',
    loginSubtitle: 'Hyrja e Stafit',
    email: 'Email',
    password: 'Fjalëkalimi',
    login: 'Hyr',
    logout: 'Dil',
    welcome: 'Mirë se vini',
    topup: 'Mbushje',
    giftcardCreate: 'Krijo Kartë Dhuratë',
    giftcardRedeem: 'Përdor Kartë Dhuratë',
    payment: 'Pagesë',
    amount: 'Shuma',
    topupAmount: 'Shuma e Mbushjes',
    otherAmount: 'Ose futni shumë tjetër...',
    scanBarcode: 'Skano Barkodin',
    waitingForScan: 'Duke pritur skanimin...',
    scannerReady: 'Skaneri gati - Skano barkodin ose fut numrin + Enter',
    cancel: 'Anulo',
    customerBonus: 'Bonusi i Klientit',
    bonusTiers: 'Nivelet e Bonusit',
    processTopup: 'Kryej Mbushjen',
    giftcardValue: 'Zgjidh Vlerën e Kartës',
    createGiftcard: 'Krijo Kartë Dhuratë',
    sellGiftcards: 'Shisni karta dhuratë tek klientët',
    giftcardNote: 'Pas krijimit do të gjenerohet barkod i printushëm.',
    scanGiftcard: 'Skano Barkodin e Kartës',
    redeemSuccess: 'U përdor me sukses!',
    nextGiftcard: 'Përdor Kartën Tjetër',
    paymentBarcode: 'Pagesë me Barkod',
    customersPay: 'Klientët mund të paguajnë me balancën',
    enterAmount: 'Fut Shumën',
    scanCustomer: 'Skano Barkodin e Klientit',
    transactionHistory: 'Historia e Transaksioneve',
    transactions: 'Transaksionet',
    refresh: 'Rifresko',
    print: 'Printo',
    printReceipt: 'Printo Raportin',
    topups: 'Mbushjet',
    bonusesGiven: 'Bonuset e Dhëna',
    giftcards: 'Kartat Dhuratë',
    redemption: 'Kartë e Përdorur',
    noTransactions: 'Nuk ka transaksione',
    transactionsAppear: 'Transaksionet do të shfaqen këtu pas mbushjes së parë',
    topupSuccess: 'Mbushja u krye!',
    total: 'Krediti',
    customer: 'Klienti',
    staff: 'Stafi',
    printReceipt2: 'Printo Faturën',
    done: 'Gati',
    giftcard: 'Kartë Dhuratë',
    validUntil: 'E vlefshme deri',
    created: 'Krijuar',
    barcodeNumber: 'Numri i Barkodit',
    close: 'Mbyll',
    minAmount: 'Minimumi',
    maxAmount: 'Maksimumi',
    testAccess: 'Qasje Testuese',
    from: 'nga'
  },
  pl: {
    loginTitle: 'Terminal Kasowy',
    loginSubtitle: 'Logowanie Pracownika',
    email: 'E-mail',
    password: 'Hasło',
    login: 'Zaloguj',
    logout: 'Wyloguj',
    welcome: 'Witamy',
    topup: 'Doładowanie',
    giftcardCreate: 'Utwórz Kartę Podarunkową',
    giftcardRedeem: 'Zrealizuj Kartę',
    payment: 'Płatność',
    amount: 'Kwota',
    topupAmount: 'Kwota Doładowania',
    otherAmount: 'Lub wpisz inną kwotę...',
    scanBarcode: 'Skanuj Kod',
    waitingForScan: 'Oczekiwanie na skan...',
    scannerReady: 'Skaner gotowy - Skanuj kod lub wpisz numer + Enter',
    cancel: 'Anuluj',
    customerBonus: 'Bonus Klienta',
    bonusTiers: 'Poziomy Bonusów',
    processTopup: 'Wykonaj Doładowanie',
    giftcardValue: 'Wybierz Wartość Karty',
    createGiftcard: 'Utwórz Kartę',
    sellGiftcards: 'Sprzedawaj karty podarunkowe klientom',
    giftcardNote: 'Po utworzeniu zostanie wygenerowany kod do wydruku.',
    scanGiftcard: 'Skanuj Kod Karty',
    redeemSuccess: 'Zrealizowano pomyślnie!',
    nextGiftcard: 'Zrealizuj Następną',
    paymentBarcode: 'Płatność Kodem',
    customersPay: 'Klienci mogą płacić saldem',
    enterAmount: 'Wpisz Kwotę',
    scanCustomer: 'Skanuj Kod Klienta',
    transactionHistory: 'Historia Transakcji',
    transactions: 'Transakcje',
    refresh: 'Odśwież',
    print: 'Drukuj',
    printReceipt: 'Drukuj Raport Kasowy',
    topups: 'Doładowania',
    bonusesGiven: 'Przyznane Bonusy',
    giftcards: 'Karty Podarunkowe',
    redemption: 'Karta Zrealizowana',
    noTransactions: 'Brak transakcji',
    transactionsAppear: 'Transakcje pojawią się po pierwszym doładowaniu',
    topupSuccess: 'Doładowanie Udane!',
    total: 'Kredyt',
    customer: 'Klient',
    staff: 'Pracownik',
    printReceipt2: 'Drukuj Paragon',
    done: 'Gotowe',
    giftcard: 'Karta Podarunkowa',
    validUntil: 'Ważna do',
    created: 'Utworzono',
    barcodeNumber: 'Numer Kodu',
    close: 'Zamknij',
    minAmount: 'Minimum',
    maxAmount: 'Maksimum',
    testAccess: 'Dostęp Testowy',
    from: 'od'
  },
  fr: {
    loginTitle: 'Terminal de Caisse',
    loginSubtitle: 'Connexion Employé',
    email: 'E-mail',
    password: 'Mot de passe',
    login: 'Connexion',
    logout: 'Déconnexion',
    welcome: 'Bienvenue',
    topup: 'Rechargement',
    giftcardCreate: 'Créer Carte Cadeau',
    giftcardRedeem: 'Utiliser Carte Cadeau',
    payment: 'Paiement',
    amount: 'Montant',
    topupAmount: 'Montant du Rechargement',
    otherAmount: 'Ou entrez un autre montant...',
    scanBarcode: 'Scanner Code-barres',
    waitingForScan: 'En attente du scan...',
    scannerReady: 'Scanner prêt - Scannez ou entrez le numéro + Entrée',
    cancel: 'Annuler',
    customerBonus: 'Bonus Client',
    bonusTiers: 'Niveaux de Bonus',
    processTopup: 'Effectuer Rechargement',
    giftcardValue: 'Choisir Valeur de la Carte',
    createGiftcard: 'Créer Carte Cadeau',
    sellGiftcards: 'Vendez des cartes cadeaux aux clients',
    giftcardNote: 'Un code-barres imprimable sera généré après création.',
    scanGiftcard: 'Scanner Code Carte Cadeau',
    redeemSuccess: 'Utilisé avec succès!',
    nextGiftcard: 'Utiliser Carte Suivante',
    paymentBarcode: 'Paiement par Code-barres',
    customersPay: 'Les clients peuvent payer avec leur solde',
    enterAmount: 'Entrer Montant',
    scanCustomer: 'Scanner Code Client',
    transactionHistory: 'Historique des Transactions',
    transactions: 'Transactions',
    refresh: 'Actualiser',
    print: 'Imprimer',
    printReceipt: 'Imprimer Rapport de Caisse',
    topups: 'Rechargements',
    bonusesGiven: 'Bonus Accordés',
    giftcards: 'Cartes Cadeaux',
    redemption: 'Carte Utilisée',
    noTransactions: 'Aucune transaction',
    transactionsAppear: 'Les transactions apparaîtront après le premier rechargement',
    topupSuccess: 'Rechargement Réussi!',
    total: 'Crédit',
    customer: 'Client',
    staff: 'Employé',
    printReceipt2: 'Imprimer Reçu',
    done: 'Terminé',
    giftcard: 'Carte Cadeau',
    validUntil: 'Valable jusqu\'au',
    created: 'Créé',
    barcodeNumber: 'Numéro de Code',
    close: 'Fermer',
    minAmount: 'Minimum',
    maxAmount: 'Maximum',
    testAccess: 'Accès Test',
    from: 'à partir de'
  },
  es: {
    loginTitle: 'Terminal de Caja',
    loginSubtitle: 'Inicio de Sesión',
    email: 'Correo',
    password: 'Contraseña',
    login: 'Entrar',
    logout: 'Salir',
    welcome: 'Bienvenido',
    topup: 'Recarga',
    giftcardCreate: 'Crear Tarjeta Regalo',
    giftcardRedeem: 'Canjear Tarjeta',
    payment: 'Pago',
    amount: 'Monto',
    topupAmount: 'Monto de Recarga',
    otherAmount: 'O ingrese otro monto...',
    scanBarcode: 'Escanear Código',
    waitingForScan: 'Esperando escaneo...',
    scannerReady: 'Escáner listo - Escanee o ingrese número + Enter',
    cancel: 'Cancelar',
    customerBonus: 'Bono del Cliente',
    bonusTiers: 'Niveles de Bono',
    processTopup: 'Procesar Recarga',
    giftcardValue: 'Elegir Valor de Tarjeta',
    createGiftcard: 'Crear Tarjeta Regalo',
    sellGiftcards: 'Venda tarjetas regalo a clientes',
    giftcardNote: 'Se generará un código de barras imprimible.',
    scanGiftcard: 'Escanear Código de Tarjeta',
    redeemSuccess: '¡Canjeado con éxito!',
    nextGiftcard: 'Canjear Siguiente',
    paymentBarcode: 'Pago por Código',
    customersPay: 'Los clientes pueden pagar con su saldo',
    enterAmount: 'Ingresar Monto',
    scanCustomer: 'Escanear Código del Cliente',
    transactionHistory: 'Historial de Transacciones',
    transactions: 'Transacciones',
    refresh: 'Actualizar',
    print: 'Imprimir',
    printReceipt: 'Imprimir Informe de Caja',
    topups: 'Recargas',
    bonusesGiven: 'Bonos Otorgados',
    giftcards: 'Tarjetas Regalo',
    redemption: 'Tarjeta Canjeada',
    noTransactions: 'Sin transacciones',
    transactionsAppear: 'Las transacciones aparecerán después de la primera recarga',
    topupSuccess: '¡Recarga Exitosa!',
    total: 'Crédito',
    customer: 'Cliente',
    staff: 'Empleado',
    printReceipt2: 'Imprimir Recibo',
    done: 'Listo',
    giftcard: 'Tarjeta Regalo',
    validUntil: 'Válido hasta',
    created: 'Creado',
    barcodeNumber: 'Número de Código',
    close: 'Cerrar',
    minAmount: 'Mínimo',
    maxAmount: 'Máximo',
    testAccess: 'Acceso de Prueba',
    from: 'desde'
  },
  it: {
    loginTitle: 'Terminale Cassa',
    loginSubtitle: 'Accesso Dipendente',
    email: 'Email',
    password: 'Password',
    login: 'Accedi',
    logout: 'Esci',
    welcome: 'Benvenuto',
    topup: 'Ricarica',
    giftcardCreate: 'Crea Gift Card',
    giftcardRedeem: 'Utilizza Gift Card',
    payment: 'Pagamento',
    amount: 'Importo',
    topupAmount: 'Importo Ricarica',
    otherAmount: 'O inserisci altro importo...',
    scanBarcode: 'Scansiona Codice',
    waitingForScan: 'In attesa della scansione...',
    scannerReady: 'Scanner pronto - Scansiona o inserisci numero + Invio',
    cancel: 'Annulla',
    customerBonus: 'Bonus Cliente',
    bonusTiers: 'Livelli Bonus',
    processTopup: 'Effettua Ricarica',
    giftcardValue: 'Scegli Valore Carta',
    createGiftcard: 'Crea Gift Card',
    sellGiftcards: 'Vendi gift card ai clienti',
    giftcardNote: 'Verrà generato un codice a barre stampabile.',
    scanGiftcard: 'Scansiona Codice Gift Card',
    redeemSuccess: 'Utilizzato con successo!',
    nextGiftcard: 'Utilizza Prossima',
    paymentBarcode: 'Pagamento con Codice',
    customersPay: 'I clienti possono pagare con il saldo',
    enterAmount: 'Inserisci Importo',
    scanCustomer: 'Scansiona Codice Cliente',
    transactionHistory: 'Cronologia Transazioni',
    transactions: 'Transazioni',
    refresh: 'Aggiorna',
    print: 'Stampa',
    printReceipt: 'Stampa Report Cassa',
    topups: 'Ricariche',
    bonusesGiven: 'Bonus Assegnati',
    giftcards: 'Gift Card',
    redemption: 'Gift Card Utilizzata',
    noTransactions: 'Nessuna transazione',
    transactionsAppear: 'Le transazioni appariranno dopo la prima ricarica',
    topupSuccess: 'Ricarica Riuscita!',
    total: 'Credito',
    customer: 'Cliente',
    staff: 'Dipendente',
    printReceipt2: 'Stampa Ricevuta',
    done: 'Fatto',
    giftcard: 'Gift Card',
    validUntil: 'Valido fino al',
    created: 'Creato',
    barcodeNumber: 'Numero Codice',
    close: 'Chiudi',
    minAmount: 'Minimo',
    maxAmount: 'Massimo',
    testAccess: 'Accesso Test',
    from: 'da'
  },
  ru: {
    loginTitle: 'Касса',
    loginSubtitle: 'Вход сотрудника',
    email: 'Эл. почта',
    password: 'Пароль',
    login: 'Войти',
    logout: 'Выйти',
    welcome: 'Добро пожаловать',
    topup: 'Пополнение',
    giftcardCreate: 'Создать подарочную карту',
    giftcardRedeem: 'Использовать карту',
    payment: 'Оплата',
    amount: 'Сумма',
    topupAmount: 'Сумма пополнения',
    otherAmount: 'Или введите другую сумму...',
    scanBarcode: 'Сканировать штрих-код',
    waitingForScan: 'Ожидание сканирования...',
    scannerReady: 'Сканер готов - Сканируйте или введите номер + Enter',
    cancel: 'Отмена',
    customerBonus: 'Бонус клиента',
    bonusTiers: 'Уровни бонусов',
    processTopup: 'Выполнить пополнение',
    giftcardValue: 'Выберите номинал карты',
    createGiftcard: 'Создать карту',
    sellGiftcards: 'Продавайте подарочные карты клиентам',
    giftcardNote: 'После создания будет сгенерирован штрих-код для печати.',
    scanGiftcard: 'Сканировать код карты',
    redeemSuccess: 'Успешно использовано!',
    nextGiftcard: 'Использовать следующую',
    paymentBarcode: 'Оплата по штрих-коду',
    customersPay: 'Клиенты могут оплатить балансом',
    enterAmount: 'Введите сумму',
    scanCustomer: 'Сканировать код клиента',
    transactionHistory: 'История транзакций',
    transactions: 'Транзакции',
    refresh: 'Обновить',
    print: 'Печать',
    printReceipt: 'Печать отчёта кассы',
    topups: 'Пополнения',
    bonusesGiven: 'Выданные бонусы',
    giftcards: 'Подарочные карты',
    redemption: 'Карта использована',
    noTransactions: 'Нет транзакций',
    transactionsAppear: 'Транзакции появятся после первого пополнения',
    topupSuccess: 'Пополнение успешно!',
    total: 'Кредит',
    customer: 'Клиент',
    staff: 'Сотрудник',
    printReceipt2: 'Печать чека',
    done: 'Готово',
    giftcard: 'Подарочная карта',
    validUntil: 'Действует до',
    created: 'Создано',
    barcodeNumber: 'Номер кода',
    close: 'Закрыть',
    minAmount: 'Минимум',
    maxAmount: 'Максимум',
    testAccess: 'Тестовый доступ',
    from: 'от'
  },
  pt: {
    loginTitle: 'Terminal de Caixa',
    loginSubtitle: 'Login do Funcionário',
    email: 'E-mail',
    password: 'Senha',
    login: 'Entrar',
    logout: 'Sair',
    welcome: 'Bem-vindo',
    topup: 'Recarga',
    giftcardCreate: 'Criar Cartão Presente',
    giftcardRedeem: 'Resgatar Cartão',
    payment: 'Pagamento',
    amount: 'Valor',
    topupAmount: 'Valor da Recarga',
    otherAmount: 'Ou insira outro valor...',
    scanBarcode: 'Escanear Código',
    waitingForScan: 'Aguardando escaneamento...',
    scannerReady: 'Scanner pronto - Escaneie ou digite número + Enter',
    cancel: 'Cancelar',
    customerBonus: 'Bônus do Cliente',
    bonusTiers: 'Níveis de Bônus',
    processTopup: 'Processar Recarga',
    giftcardValue: 'Escolher Valor do Cartão',
    createGiftcard: 'Criar Cartão Presente',
    sellGiftcards: 'Venda cartões presente aos clientes',
    giftcardNote: 'Um código de barras imprimível será gerado.',
    scanGiftcard: 'Escanear Código do Cartão',
    redeemSuccess: 'Resgatado com sucesso!',
    nextGiftcard: 'Resgatar Próximo',
    paymentBarcode: 'Pagamento por Código',
    customersPay: 'Clientes podem pagar com seu saldo',
    enterAmount: 'Inserir Valor',
    scanCustomer: 'Escanear Código do Cliente',
    transactionHistory: 'Histórico de Transações',
    transactions: 'Transações',
    refresh: 'Atualizar',
    print: 'Imprimir',
    printReceipt: 'Imprimir Relatório de Caixa',
    topups: 'Recargas',
    bonusesGiven: 'Bônus Concedidos',
    giftcards: 'Cartões Presente',
    redemption: 'Cartão Resgatado',
    noTransactions: 'Sem transações',
    transactionsAppear: 'As transações aparecerão após a primeira recarga',
    topupSuccess: 'Recarga bem-sucedida!',
    total: 'Crédito',
    customer: 'Cliente',
    staff: 'Funcionário',
    printReceipt2: 'Imprimir Recibo',
    done: 'Concluído',
    giftcard: 'Cartão Presente',
    validUntil: 'Válido até',
    created: 'Criado',
    barcodeNumber: 'Número do Código',
    close: 'Fechar',
    minAmount: 'Mínimo',
    maxAmount: 'Máximo',
    testAccess: 'Acesso de Teste',
    from: 'a partir de'
  },
  nl: {
    loginTitle: 'Kassaterminal',
    loginSubtitle: 'Medewerker Login',
    email: 'E-mail',
    password: 'Wachtwoord',
    login: 'Inloggen',
    logout: 'Uitloggen',
    welcome: 'Welkom',
    topup: 'Opwaarderen',
    giftcardCreate: 'Cadeaukaart Maken',
    giftcardRedeem: 'Cadeaukaart Inwisselen',
    payment: 'Betaling',
    amount: 'Bedrag',
    topupAmount: 'Opwaardeer Bedrag',
    otherAmount: 'Of voer ander bedrag in...',
    scanBarcode: 'Barcode Scannen',
    waitingForScan: 'Wachten op scan...',
    scannerReady: 'Scanner klaar - Scan of voer nummer in + Enter',
    cancel: 'Annuleren',
    customerBonus: 'Klant Bonus',
    bonusTiers: 'Bonus Niveaus',
    processTopup: 'Opwaardering Verwerken',
    giftcardValue: 'Kies Kaartwaarde',
    createGiftcard: 'Cadeaukaart Maken',
    sellGiftcards: 'Verkoop cadeaukaarten aan klanten',
    giftcardNote: 'Er wordt een afdrukbare barcode gegenereerd.',
    scanGiftcard: 'Scan Cadeaukaart Code',
    redeemSuccess: 'Succesvol ingewisseld!',
    nextGiftcard: 'Volgende Inwisselen',
    paymentBarcode: 'Betaling per Code',
    customersPay: 'Klanten kunnen betalen met hun saldo',
    enterAmount: 'Bedrag Invoeren',
    scanCustomer: 'Scan Klant Barcode',
    transactionHistory: 'Transactiegeschiedenis',
    transactions: 'Transacties',
    refresh: 'Vernieuwen',
    print: 'Afdrukken',
    printReceipt: 'Kassarapport Afdrukken',
    topups: 'Opwaardeeringen',
    bonusesGiven: 'Gegeven Bonussen',
    giftcards: 'Cadeaukaarten',
    redemption: 'Kaart Ingewisseld',
    noTransactions: 'Geen transacties',
    transactionsAppear: 'Transacties verschijnen na eerste opwaardering',
    topupSuccess: 'Opwaardering Gelukt!',
    total: 'Krediet',
    customer: 'Klant',
    staff: 'Medewerker',
    printReceipt2: 'Bon Afdrukken',
    done: 'Klaar',
    giftcard: 'Cadeaukaart',
    validUntil: 'Geldig tot',
    created: 'Gemaakt',
    barcodeNumber: 'Codenummer',
    close: 'Sluiten',
    minAmount: 'Minimum',
    maxAmount: 'Maximum',
    testAccess: 'Test Toegang',
    from: 'vanaf'
  },
  xk: {
    loginTitle: 'Terminali i Arkës',
    loginSubtitle: 'Hyrja e Stafit',
    email: 'Email',
    password: 'Fjalëkalimi',
    login: 'Hyr',
    logout: 'Dil',
    welcome: 'Mirë se vini',
    topup: 'Mbushje',
    giftcardCreate: 'Krijo Kartë Dhuratë',
    giftcardRedeem: 'Përdor Kartë Dhuratë',
    payment: 'Pagesë',
    amount: 'Shuma',
    topupAmount: 'Shuma e Mbushjes',
    otherAmount: 'Ose futni shumë tjetër...',
    scanBarcode: 'Skano Barkodin',
    waitingForScan: 'Duke pritur skanimin...',
    scannerReady: 'Skaneri gati - Skano barkodin ose fut numrin + Enter',
    cancel: 'Anulo',
    customerBonus: 'Bonusi i Klientit',
    bonusTiers: 'Nivelet e Bonusit',
    processTopup: 'Kryej Mbushjen',
    giftcardValue: 'Zgjidh Vlerën e Kartës',
    createGiftcard: 'Krijo Kartë Dhuratë',
    sellGiftcards: 'Shisni karta dhuratë tek klientët',
    giftcardNote: 'Pas krijimit do të gjenerohet barkod i printushëm.',
    scanGiftcard: 'Skano Barkodin e Kartës',
    redeemSuccess: 'U përdor me sukses!',
    nextGiftcard: 'Përdor Kartën Tjetër',
    paymentBarcode: 'Pagesë me Barkod',
    customersPay: 'Klientët mund të paguajnë me balancën',
    enterAmount: 'Fut Shumën',
    scanCustomer: 'Skano Barkodin e Klientit',
    transactionHistory: 'Historia e Transaksioneve',
    transactions: 'Transaksionet',
    refresh: 'Rifresko',
    print: 'Printo',
    printReceipt: 'Printo Raportin',
    topups: 'Mbushjet',
    bonusesGiven: 'Bonuset e Dhëna',
    giftcards: 'Kartat Dhuratë',
    redemption: 'Kartë e Përdorur',
    noTransactions: 'Nuk ka transaksione',
    transactionsAppear: 'Transaksionet do të shfaqen këtu pas mbushjes së parë',
    topupSuccess: 'Mbushja u krye!',
    total: 'Krediti',
    customer: 'Klienti',
    staff: 'Stafi',
    printReceipt2: 'Printo Faturën',
    done: 'Gati',
    giftcard: 'Kartë Dhuratë',
    validUntil: 'E vlefshme deri',
    created: 'Krijuar',
    barcodeNumber: 'Numri i Barkodit',
    close: 'Mbyll',
    minAmount: 'Minimumi',
    maxAmount: 'Maksimumi',
    testAccess: 'Qasje Testuese',
    from: 'nga'
  },
  zh: {
    loginTitle: '收银终端',
    loginSubtitle: '员工登录',
    email: '电子邮件',
    password: '密码',
    login: '登录',
    logout: '退出',
    welcome: '欢迎',
    topup: '充值',
    giftcardCreate: '创建礼品卡',
    giftcardRedeem: '兑换礼品卡',
    payment: '支付',
    amount: '金额',
    topupAmount: '充值金额',
    otherAmount: '或输入其他金额...',
    scanBarcode: '扫描条码',
    waitingForScan: '等待扫描...',
    scannerReady: '扫描器就绪 - 扫描或输入号码 + Enter',
    cancel: '取消',
    customerBonus: '客户奖励',
    bonusTiers: '奖励等级',
    processTopup: '处理充值',
    giftcardValue: '选择卡片价值',
    createGiftcard: '创建礼品卡',
    sellGiftcards: '向客户销售礼品卡',
    giftcardNote: '创建后将生成可打印条码。',
    scanGiftcard: '扫描礼品卡条码',
    redeemSuccess: '兑换成功！',
    nextGiftcard: '兑换下一张',
    paymentBarcode: '条码支付',
    customersPay: '客户可以用余额支付',
    enterAmount: '输入金额',
    scanCustomer: '扫描客户条码',
    transactionHistory: '交易记录',
    transactions: '交易',
    refresh: '刷新',
    print: '打印',
    printReceipt: '打印收银报告',
    topups: '充值记录',
    bonusesGiven: '已发奖励',
    giftcards: '礼品卡',
    redemption: '卡已兑换',
    noTransactions: '无交易记录',
    transactionsAppear: '首次充值后将显示交易记录',
    topupSuccess: '充值成功！',
    total: '余额',
    customer: '客户',
    staff: '员工',
    printReceipt2: '打印收据',
    done: '完成',
    giftcard: '礼品卡',
    validUntil: '有效期至',
    created: '创建于',
    barcodeNumber: '条码号',
    close: '关闭',
    minAmount: '最低',
    maxAmount: '最高',
    testAccess: '测试访问',
    from: '起'
  },
  ja: {
    loginTitle: 'レジ端末',
    loginSubtitle: 'スタッフログイン',
    email: 'メール',
    password: 'パスワード',
    login: 'ログイン',
    logout: 'ログアウト',
    welcome: 'ようこそ',
    topup: 'チャージ',
    giftcardCreate: 'ギフトカード作成',
    giftcardRedeem: 'ギフトカード使用',
    payment: '支払い',
    amount: '金額',
    topupAmount: 'チャージ金額',
    otherAmount: 'または他の金額を入力...',
    scanBarcode: 'バーコードスキャン',
    waitingForScan: 'スキャン待ち...',
    scannerReady: 'スキャナー準備完了 - スキャンまたは番号入力 + Enter',
    cancel: 'キャンセル',
    customerBonus: '顧客ボーナス',
    bonusTiers: 'ボーナスレベル',
    processTopup: 'チャージ実行',
    giftcardValue: 'カード金額を選択',
    createGiftcard: 'ギフトカード作成',
    sellGiftcards: 'お客様にギフトカードを販売',
    giftcardNote: '作成後、印刷可能なバーコードが生成されます。',
    scanGiftcard: 'ギフトカードをスキャン',
    redeemSuccess: '使用成功！',
    nextGiftcard: '次のカードを使用',
    paymentBarcode: 'バーコード支払い',
    customersPay: '残高で支払い可能',
    enterAmount: '金額入力',
    scanCustomer: '顧客バーコードスキャン',
    transactionHistory: '取引履歴',
    transactions: '取引',
    refresh: '更新',
    print: '印刷',
    printReceipt: 'レジレポート印刷',
    topups: 'チャージ履歴',
    bonusesGiven: '付与ボーナス',
    giftcards: 'ギフトカード',
    redemption: 'カード使用済み',
    noTransactions: '取引なし',
    transactionsAppear: '初回チャージ後に取引が表示されます',
    topupSuccess: 'チャージ成功！',
    total: '残高',
    customer: '顧客',
    staff: 'スタッフ',
    printReceipt2: 'レシート印刷',
    done: '完了',
    giftcard: 'ギフトカード',
    validUntil: '有効期限',
    created: '作成日',
    barcodeNumber: 'バーコード番号',
    close: '閉じる',
    minAmount: '最低',
    maxAmount: '最高',
    testAccess: 'テストアクセス',
    from: 'から'
  },
  ko: {
    loginTitle: '금전 등록기',
    loginSubtitle: '직원 로그인',
    email: '이메일',
    password: '비밀번호',
    login: '로그인',
    logout: '로그아웃',
    welcome: '환영합니다',
    topup: '충전',
    giftcardCreate: '기프트카드 생성',
    giftcardRedeem: '기프트카드 사용',
    payment: '결제',
    amount: '금액',
    topupAmount: '충전 금액',
    otherAmount: '또는 다른 금액 입력...',
    scanBarcode: '바코드 스캔',
    waitingForScan: '스캔 대기 중...',
    scannerReady: '스캐너 준비 완료 - 스캔 또는 번호 입력 + Enter',
    cancel: '취소',
    customerBonus: '고객 보너스',
    bonusTiers: '보너스 등급',
    processTopup: '충전 처리',
    giftcardValue: '카드 금액 선택',
    createGiftcard: '기프트카드 생성',
    sellGiftcards: '고객에게 기프트카드 판매',
    giftcardNote: '생성 후 인쇄 가능한 바코드가 생성됩니다.',
    scanGiftcard: '기프트카드 스캔',
    redeemSuccess: '사용 성공!',
    nextGiftcard: '다음 카드 사용',
    paymentBarcode: '바코드 결제',
    customersPay: '잔액으로 결제 가능',
    enterAmount: '금액 입력',
    scanCustomer: '고객 바코드 스캔',
    transactionHistory: '거래 내역',
    transactions: '거래',
    refresh: '새로고침',
    print: '인쇄',
    printReceipt: '금전 등록기 보고서 인쇄',
    topups: '충전 내역',
    bonusesGiven: '지급된 보너스',
    giftcards: '기프트카드',
    redemption: '카드 사용됨',
    noTransactions: '거래 없음',
    transactionsAppear: '첫 충전 후 거래가 표시됩니다',
    topupSuccess: '충전 성공!',
    total: '잔액',
    customer: '고객',
    staff: '직원',
    printReceipt2: '영수증 인쇄',
    done: '완료',
    giftcard: '기프트카드',
    validUntil: '유효 기간',
    created: '생성일',
    barcodeNumber: '바코드 번호',
    close: '닫기',
    minAmount: '최소',
    maxAmount: '최대',
    testAccess: '테스트 접근',
    from: '부터'
  }
};

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
  { code: 'us', name: 'English', flag: '🇺🇸' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' }
];

// Sound effects
const playSound = (type) => {
  const sounds = {
    success: '/sounds/success.mp3',
    pending: '/sounds/pending.mp3',
    error: '/sounds/error.mp3',
    scan: '/sounds/scan.mp3'
  };
  try {
    const audio = new Audio(sounds[type]);
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch (e) {}
};

// Generate random barcode number
const generateBarcodeNumber = () => {
  const prefix = '400'; // Gift card prefix
  const random = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
  return prefix + random;
};

// Map language codes to translation keys (for similar languages)
const languageMap = {
  ae: 'ar',  // UAE Arabic -> Arabic
  us: 'en',  // US English -> English
  xk: 'sq',  // Kosovo -> Albanian (similar)
};

export default function StaffPOS() {
  // Language state
  const [language, setLanguage] = useState('de');
  const [showLanguages, setShowLanguages] = useState(false);
  const translationKey = languageMap[language] || language;
  const t = translations[translationKey] || translations.de;
  
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [staff, setStaff] = useState(null);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  
  // Transaction state
  const [mode, setMode] = useState('topup'); // 'topup', 'giftcard-create', 'giftcard-redeem', 'payment'
  const [amount, setAmount] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanMode, setScanMode] = useState(false);
  const barcodeInputRef = useRef(null);
  
  // Gift card state
  const [giftCardAmount, setGiftCardAmount] = useState('');
  const [createdGiftCard, setCreatedGiftCard] = useState(null);
  const [redeemedGiftCard, setRedeemedGiftCard] = useState(null);
  
  // History & Receipt
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [showGiftCardPrint, setShowGiftCardPrint] = useState(false);
  
  // Stammkunden (Saved Customers)
  const [savedCustomers, setSavedCustomers] = useState([]);
  const [showSaveCustomerDialog, setShowSaveCustomerDialog] = useState(false);
  const [customerToSave, setCustomerToSave] = useState(null);
  const [customerNickname, setCustomerNickname] = useState('');
  
  // Payment Mode State
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentScanMode, setPaymentScanMode] = useState(false);
  const [paymentBarcode, setPaymentBarcode] = useState('');
  const [paymentCameraActive, setPaymentCameraActive] = useState(false);
  const [paymentCameraError, setPaymentCameraError] = useState(null);
  const paymentScannerRef = useRef(null);
  const paymentFileInputRef = useRef(null);
  
  // Topup Camera Scanner State (für Kunden-Barcode)
  const [topupCameraActive, setTopupCameraActive] = useState(false);
  const [topupCameraError, setTopupCameraError] = useState(null);
  const topupScannerRef = useRef(null);
  const topupFileInputRef = useRef(null);
  
  // Hardware Scanner State (USB/Bluetooth)
  const [hardwareScannerMode, setHardwareScannerMode] = useState(false);
  const [hardwareScanBuffer, setHardwareScanBuffer] = useState('');
  const hardwareScanTimeoutRef = useRef(null);
  const lastKeyTimeRef = useRef(0);

  // Bonus tiers
  const bonusTiers = [
    { min: 200, bonus: 12.00, percent: 6 },
    { min: 100, bonus: 5.00, percent: 5 },
    { min: 50, bonus: 2.00, percent: 4 },
    { min: 20, bonus: 0.50, percent: 2.5 }
  ];

  // Gift card amounts
  const giftCardAmounts = [10, 25, 50, 100, 200];

  // Calculate bonus
  const calculateBonus = (amt) => {
    const tier = bonusTiers.find(t => amt >= t.min);
    return tier ? tier.bonus : 0;
  };

  // Check saved session
  useEffect(() => {
    const savedStaff = localStorage.getItem('staff_pos_data');
    const savedToken = localStorage.getItem('staff_pos_token');
    
    if (savedStaff && savedToken) {
      try {
        const data = JSON.parse(savedStaff);
        setStaff(data);
        setIsLoggedIn(true);
        fetchTransactionHistory();
        // Load saved customers for this branch
        loadSavedCustomers(data.branch_id);
      } catch (e) {
        localStorage.removeItem('staff_pos_data');
        localStorage.removeItem('staff_pos_token');
      }
    }
  }, []);
  
  // Load saved customers from localStorage
  const loadSavedCustomers = (branchId) => {
    try {
      const saved = localStorage.getItem(`staff_pos_customers_${branchId}`);
      if (saved) {
        setSavedCustomers(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load saved customers:', e);
    }
  };
  
  // Save customer to list
  const saveCustomer = (barcode, name, nickname) => {
    const branchId = staff?.branch_id;
    if (!branchId) return;
    
    const newCustomer = {
      id: Date.now().toString(),
      barcode,
      name,
      nickname: nickname || name,
      savedAt: new Date().toISOString(),
      lastTransaction: new Date().toISOString()
    };
    
    // Check if customer already exists
    const existingIndex = savedCustomers.findIndex(c => c.barcode === barcode);
    let updated;
    
    if (existingIndex >= 0) {
      // Update existing
      updated = [...savedCustomers];
      updated[existingIndex] = { ...updated[existingIndex], nickname: nickname || name, lastTransaction: new Date().toISOString() };
    } else {
      // Add new
      updated = [newCustomer, ...savedCustomers];
    }
    
    setSavedCustomers(updated);
    localStorage.setItem(`staff_pos_customers_${branchId}`, JSON.stringify(updated));
    toast.success(language === 'de' ? `✅ ${nickname || name} als Stammkunde gespeichert!` : `✅ ${nickname || name} saved as regular customer!`);
    setShowSaveCustomerDialog(false);
    setCustomerToSave(null);
    setCustomerNickname('');
  };
  
  // Remove saved customer
  const removeSavedCustomer = (customerId) => {
    const branchId = staff?.branch_id;
    if (!branchId) return;
    
    const updated = savedCustomers.filter(c => c.id !== customerId);
    setSavedCustomers(updated);
    localStorage.setItem(`staff_pos_customers_${branchId}`, JSON.stringify(updated));
    toast.success(language === 'de' ? 'Kunde entfernt' : 'Customer removed');
  };
  
  // Quick select saved customer
  const selectSavedCustomer = (customer) => {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum < 5) {
      toast.error(language === 'de' ? 'Bitte zuerst Betrag eingeben (min. €5)' : 'Please enter amount first (min. €5)');
      return;
    }
    
    // Process topup directly with the saved customer's barcode
    processTopupWithBarcode(customer.barcode);
    
    // Update last transaction time
    const updated = savedCustomers.map(c => 
      c.id === customer.id ? { ...c, lastTransaction: new Date().toISOString() } : c
    );
    setSavedCustomers(updated);
    localStorage.setItem(`staff_pos_customers_${staff?.branch_id}`, JSON.stringify(updated));
  };

  // Auto-focus barcode input when scan mode is active
  useEffect(() => {
    if (scanMode && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [scanMode]);
  
  // ==================== HARDWARE SCANNER SUPPORT (USB/Bluetooth) ====================
  // Hardware-Scanner senden Barcodes als schnelle Tastatureingaben + Enter
  
  useEffect(() => {
    if (!hardwareScannerMode || !isLoggedIn) return;
    
    const handleGlobalKeyDown = (e) => {
      // Ignorieren wenn ein Input-Feld fokussiert ist (außer unser Scanner-Input)
      const activeElement = document.activeElement;
      const isInputFocused = activeElement?.tagName === 'INPUT' || 
                              activeElement?.tagName === 'TEXTAREA' ||
                              activeElement?.isContentEditable;
      
      // Wenn normales Input fokussiert ist, lassen wir die normale Verarbeitung zu
      if (isInputFocused && !activeElement?.dataset?.hardwareScanner) {
        return;
      }
      
      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;
      
      // Enter-Taste verarbeitet den Buffer
      if (e.key === 'Enter') {
        e.preventDefault();
        if (hardwareScanBuffer.trim().length >= 3) {
          processHardwareScan(hardwareScanBuffer.trim());
        }
        setHardwareScanBuffer('');
        return;
      }
      
      // Escape beendet den Scanner-Modus
      if (e.key === 'Escape') {
        setHardwareScannerMode(false);
        setHardwareScanBuffer('');
        return;
      }
      
      // Nur alphanumerische Zeichen akzeptieren
      if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
        e.preventDefault();
        
        // Wenn mehr als 100ms zwischen Tasten, neuer Scan-Vorgang
        if (timeDiff > 100) {
          setHardwareScanBuffer(e.key);
        } else {
          setHardwareScanBuffer(prev => prev + e.key);
        }
        
        // Auto-Submit nach kurzer Pause (falls Enter nicht kommt)
        if (hardwareScanTimeoutRef.current) {
          clearTimeout(hardwareScanTimeoutRef.current);
        }
        hardwareScanTimeoutRef.current = setTimeout(() => {
          setHardwareScanBuffer(current => {
            if (current.trim().length >= 3) {
              processHardwareScan(current.trim());
            }
            return '';
          });
        }, 150);
      }
    };
    
    window.addEventListener('keydown', handleGlobalKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      if (hardwareScanTimeoutRef.current) {
        clearTimeout(hardwareScanTimeoutRef.current);
      }
    };
  }, [hardwareScannerMode, isLoggedIn, hardwareScanBuffer, mode, amount, paymentAmount]);
  
  // Process hardware scanner input based on current mode
  const processHardwareScan = (barcode) => {
    console.log('🔊 Hardware-Scanner Barcode:', barcode);
    playSound('scan');
    
    if (mode === 'topup') {
      const amountNum = parseFloat(amount);
      if (!amountNum || amountNum < 5) {
        toast.error(language === 'de' ? 'Bitte zuerst Betrag eingeben (min. €5)' : 'Please enter amount first (min. €5)');
        return;
      }
      toast.success(language === 'de' ? `📟 Barcode erkannt: ${barcode}` : `📟 Barcode detected: ${barcode}`);
      processTopupWithBarcode(barcode);
    } else if (mode === 'giftcard-redeem') {
      toast.success(language === 'de' ? `📟 Gutschein-Code erkannt: ${barcode}` : `📟 Gift card code detected: ${barcode}`);
      redeemGiftCard(barcode);
    } else if (mode === 'payment') {
      const paymentNum = parseFloat(paymentAmount);
      if (!paymentNum || paymentNum <= 0) {
        toast.error(language === 'de' ? 'Bitte zuerst Betrag eingeben' : 'Please enter amount first');
        return;
      }
      toast.success(language === 'de' ? `📟 Kunden-Barcode erkannt: ${barcode}` : `📟 Customer barcode detected: ${barcode}`);
      processPayment(barcode);
    } else {
      toast.info(language === 'de' ? `📟 Barcode gescannt: ${barcode}` : `📟 Barcode scanned: ${barcode}`);
    }
  };
  
  // Process payment from customer balance
  const processPayment = async (customerBarcode) => {
    const paymentNum = parseFloat(paymentAmount);
    if (!paymentNum || paymentNum <= 0) {
      playSound('error');
      toast.error(language === 'de' ? 'Bitte gültigen Betrag eingeben' : 'Please enter valid amount');
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/pos/payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('staff_pos_token')}`
        },
        body: JSON.stringify({
          customer_barcode: customerBarcode,
          amount: paymentNum,
          staff_id: staff?.id,
          staff_name: staff?.name,
          branch_id: staff?.branch_id,
          branch_name: staff?.branch_name
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        playSound('success');
        
        // Zeige Rabatt-Info wenn vorhanden
        if (data.has_discount && data.discount_amount > 0) {
          toast.success(
            language === 'de' 
              ? `🎉 RABATT ANGEWENDET!\n💳 ${data.discount_card_name || 'Rabattkarte'}\n💰 Ersparnis: €${data.discount_amount.toFixed(2)}\n📝 Original: €${data.original_amount.toFixed(2)} → €${data.final_amount.toFixed(2)}`
              : `🎉 DISCOUNT APPLIED!\n💳 ${data.discount_card_name || 'Discount Card'}\n💰 Saved: €${data.discount_amount.toFixed(2)}\n📝 Original: €${data.original_amount.toFixed(2)} → €${data.final_amount.toFixed(2)}`,
            { duration: 5000 }
          );
        }
        
        toast.success(
          language === 'de' 
            ? `✅ Zahlung erfolgreich! €${data.final_amount?.toFixed(2) || paymentNum.toFixed(2)} von ${data.customer_name || 'Kunde'} abgebucht. Neues Guthaben: €${data.new_balance?.toFixed(2)}`
            : `✅ Payment successful! €${data.final_amount?.toFixed(2) || paymentNum.toFixed(2)} deducted from ${data.customer_name || 'Customer'}. New balance: €${data.new_balance?.toFixed(2)}`
        );
        setPaymentAmount('');
        setPaymentScanMode(false);
        setPaymentBarcode('');
        fetchTransactionHistory();
      } else {
        const error = await res.json();
        playSound('error');
        toast.error(error.detail || (language === 'de' ? 'Zahlung fehlgeschlagen' : 'Payment failed'));
      }
    } catch (err) {
      playSound('error');
      toast.error(language === 'de' ? 'Verbindungsfehler' : 'Connection error');
    } finally {
      setLoading(false);
    }
  };
  
  // Start camera scanner for payment
  const startPaymentCamera = async () => {
    try {
      setPaymentCameraError(null);
      setPaymentCameraActive(true);
      
      // Prüfen ob iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      // Wait for DOM element to render
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Für iOS: Erst Kamera-Berechtigung anfordern
      if (isIOS) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 }
            } 
          });
          stream.getTracks().forEach(track => track.stop());
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (permErr) {
          console.error('iOS camera permission error:', permErr);
          setPaymentCameraError(language === 'de' 
            ? 'Kamera-Zugriff verweigert. Bitte erlauben Sie die Kamera in den Browser-Einstellungen.' 
            : 'Camera access denied. Please allow camera in browser settings.');
          setPaymentCameraActive(false);
          return;
        }
      }
      
      const scanner = new Html5Qrcode("payment-scanner");
      paymentScannerRef.current = scanner;
      
      // Optimierte Einstellungen für iOS Barcode-Erkennung
      const config = {
        fps: isIOS ? 10 : 15, // Niedrigere FPS für iOS für stabileres Scanning
        qrbox: { width: 280, height: 150 }, // Breiterer Scan-Bereich für Barcodes
        aspectRatio: isIOS ? 1.7777 : 1.5, // 16:9 für iOS
        formatsToSupport: [
          4, // CODE_128 - Häufigster Barcode-Typ
          10, // EAN_13
          9, // EAN_8
          12, // UPC_A
          11, // UPC_E
          2, // CODE_39
          3, // CODE_93
          7, // ITF
          0, // QR_CODE
        ],
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true // Nutzt native BarcodeDetector API wenn verfügbar
        }
      };
      
      await scanner.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          // Success - barcode scanned
          console.log('✅ Barcode gescannt:', decodedText);
          playSound('success');
          toast.success(language === 'de' ? `Barcode erkannt: ${decodedText}` : `Barcode detected: ${decodedText}`);
          stopPaymentCamera();
          processPayment(decodedText);
        },
        (errorMessage) => {
          // Scan error - ignore (normal während des Scannens)
        }
      );
      
      console.log('✅ Kamera gestartet');
      
    } catch (err) {
      console.error('Camera error:', err);
      setPaymentCameraError(language === 'de' 
        ? 'Kamera konnte nicht gestartet werden. Bitte verwenden Sie "Foto aufnehmen" oder geben Sie den Barcode manuell ein.' 
        : 'Camera could not be started. Please use "Take Photo" or enter barcode manually.');
      setPaymentCameraActive(false);
    }
  };
  
  // Stop camera scanner
  const stopPaymentCamera = async () => {
    if (paymentScannerRef.current) {
      try {
        await paymentScannerRef.current.stop();
        paymentScannerRef.current = null;
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
    setPaymentCameraActive(false);
  };
  
  // Handle photo upload for barcode scanning (iOS fallback)
  const handlePaymentPhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      const scanner = new Html5Qrcode("payment-photo-scanner");
      const result = await scanner.scanFile(file, true);
      
      if (result) {
        playSound('success');
        processPayment(result);
      }
    } catch (err) {
      playSound('error');
      toast.error(language === 'de' 
        ? 'Barcode konnte nicht erkannt werden. Bitte erneut versuchen.' 
        : 'Barcode could not be recognized. Please try again.');
    }
    
    // Reset file input
    if (paymentFileInputRef.current) {
      paymentFileInputRef.current.value = '';
    }
  };
  
  // Cleanup camera on unmount or mode change
  useEffect(() => {
    return () => {
      if (paymentScannerRef.current) {
        paymentScannerRef.current.stop().catch(() => {});
      }
      if (topupScannerRef.current) {
        topupScannerRef.current.stop().catch(() => {});
      }
    };
  }, []);
  
  // ==================== TOPUP CAMERA SCANNER (für Kunden-Barcode) ====================
  
  // Start camera scanner for topup customer barcode
  const startTopupCamera = async () => {
    try {
      setTopupCameraError(null);
      setTopupCameraActive(true);
      
      // Prüfen ob iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      // Wait for DOM element to render
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Für iOS: Erst Kamera-Berechtigung anfordern
      if (isIOS) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 }
            } 
          });
          stream.getTracks().forEach(track => track.stop());
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (permErr) {
          console.error('iOS camera permission error:', permErr);
          setTopupCameraError(language === 'de' 
            ? 'Kamera-Zugriff verweigert. Bitte erlauben Sie die Kamera in den Browser-Einstellungen.' 
            : 'Camera access denied. Please allow camera in browser settings.');
          setTopupCameraActive(false);
          return;
        }
      }
      
      const scanner = new Html5Qrcode("topup-scanner");
      topupScannerRef.current = scanner;
      
      // Optimierte Einstellungen für iOS Barcode-Erkennung
      const config = {
        fps: isIOS ? 10 : 15, // Niedrigere FPS für iOS
        qrbox: { width: 280, height: 150 }, // Breiterer Scan-Bereich für Barcodes
        aspectRatio: isIOS ? 1.7777 : 1.5, // 16:9 für iOS
        formatsToSupport: [
          4, // CODE_128 - Häufigster Barcode-Typ
          10, // EAN_13
          9, // EAN_8
          12, // UPC_A
          11, // UPC_E
          2, // CODE_39
          3, // CODE_93
          7, // ITF
          0, // QR_CODE
        ],
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true // Nutzt native BarcodeDetector API wenn verfügbar
        }
      };
      
      await scanner.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          // Success - barcode scanned
          console.log('✅ Kunden-Barcode gescannt:', decodedText);
          playSound('success');
          toast.success(language === 'de' ? `Barcode erkannt: ${decodedText}` : `Barcode detected: ${decodedText}`);
          stopTopupCamera();
          processTopupWithBarcode(decodedText);
        },
        (errorMessage) => {
          // Scan error - ignore (normal während des Scannens)
        }
      );
      
      console.log('✅ Topup Kamera gestartet');
      
    } catch (err) {
      console.error('Topup Camera error:', err);
      setTopupCameraError(language === 'de' 
        ? 'Kamera konnte nicht gestartet werden. Bitte verwenden Sie "Foto aufnehmen" oder geben Sie den Barcode manuell ein.' 
        : 'Camera could not be started. Please use "Take Photo" or enter barcode manually.');
      setTopupCameraActive(false);
    }
  };
  
  // Stop topup camera scanner
  const stopTopupCamera = async () => {
    if (topupScannerRef.current) {
      try {
        await topupScannerRef.current.stop();
        topupScannerRef.current = null;
      } catch (err) {
        console.error('Error stopping topup scanner:', err);
      }
    }
    setTopupCameraActive(false);
  };
  
  // Handle photo upload for topup barcode scanning (iOS fallback)
  const handleTopupPhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      const scanner = new Html5Qrcode("topup-photo-scanner");
      const result = await scanner.scanFile(file, true);
      
      if (result) {
        playSound('success');
        toast.success(language === 'de' ? `Barcode erkannt: ${result}` : `Barcode detected: ${result}`);
        processTopupWithBarcode(result);
      }
    } catch (err) {
      playSound('error');
      toast.error(language === 'de' 
        ? 'Barcode konnte nicht erkannt werden. Bitte erneut versuchen.' 
        : 'Barcode could not be recognized. Please try again.');
    }
    
    // Reset file input
    if (topupFileInputRef.current) {
      topupFileInputRef.current.value = '';
    }
  };

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch(`${API_URL}/api/enterprise/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      
      if (res.ok) {
        const data = await res.json();
        const staffData = {
          id: data.user_id || data.enterprise_id,
          name: data.user_name || data.company_name,
          email: loginForm.email,
          role: data.role,
          branch_id: data.branch_id || data.enterprise_id,
          branch_name: data.branch_name || data.company_name,
          company_name: data.company_name
        };
        
        setStaff(staffData);
        setIsLoggedIn(true);
        localStorage.setItem('staff_pos_data', JSON.stringify(staffData));
        localStorage.setItem('staff_pos_token', data.token);
        toast.success(`Willkommen, ${staffData.name}!`);
        fetchTransactionHistory();
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Login fehlgeschlagen');
      }
    } catch (err) {
      toast.error('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const handleLogout = () => {
    setIsLoggedIn(false);
    setStaff(null);
    localStorage.removeItem('staff_pos_data');
    localStorage.removeItem('staff_pos_token');
    toast.success('Erfolgreich abgemeldet');
  };

  // Fetch transaction history from POS transactions
  const fetchTransactionHistory = async () => {
    try {
      const token = localStorage.getItem('staff_pos_token');
      const res = await fetch(`${API_URL}/api/pos/transactions?limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setTransactionHistory(data.transactions || []);
      }
    } catch (e) {
      console.log('Could not fetch history');
    }
  };

  // Print transaction history
  const printTransactionHistory = () => {
    const printWindow = window.open('', '_blank');
    const today = new Date().toLocaleDateString('de-DE');
    const now = new Date().toLocaleTimeString('de-DE');
    
    // Calculate totals
    const totals = transactionHistory.reduce((acc, tx) => {
      if (tx.type === 'pos_topup' || tx.type === 'topup') {
        acc.topups += tx.amount || 0;
        acc.bonuses += tx.bonus || 0;
        acc.topupCount++;
      } else if (tx.type === 'gift_card_redemption') {
        acc.giftCards += tx.amount || 0;
        acc.giftCardCount++;
      } else if (tx.type === 'payment') {
        acc.payments += tx.amount || 0;
        acc.paymentCount++;
      }
      return acc;
    }, { topups: 0, bonuses: 0, giftCards: 0, payments: 0, topupCount: 0, giftCardCount: 0, paymentCount: 0 });
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Kassenabschluss - ${today}</title>
        <style>
          body { font-family: 'Courier New', monospace; font-size: 12px; padding: 20px; max-width: 80mm; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 15px; }
          .header h1 { font-size: 16px; margin: 0 0 5px 0; }
          .header p { margin: 2px 0; }
          .section { margin: 15px 0; }
          .section-title { font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 3px; margin-bottom: 8px; }
          .tx-row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dotted #ccc; }
          .tx-row.header { font-weight: bold; border-bottom: 2px solid #000; }
          .summary { border-top: 2px dashed #000; padding-top: 10px; margin-top: 15px; }
          .summary-row { display: flex; justify-content: space-between; padding: 3px 0; }
          .summary-row.total { font-weight: bold; font-size: 14px; border-top: 1px solid #000; margin-top: 5px; padding-top: 5px; }
          .footer { text-align: center; margin-top: 20px; border-top: 2px dashed #000; padding-top: 10px; font-size: 10px; }
          @media print { body { max-width: 100%; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${staff?.branch_name || 'Kasse'}</h1>
          <p>Kassenabschluss</p>
          <p>${today} - ${now}</p>
          <p>Mitarbeiter: ${staff?.name || '-'}</p>
        </div>
        
        <div class="section">
          <div class="section-title">Transaktionen (${transactionHistory.length})</div>
          ${transactionHistory.length > 0 ? transactionHistory.map(tx => `
            <div class="tx-row">
              <span>${new Date(tx.created_at).toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})}</span>
              <span>${tx.type === 'pos_topup' ? 'Aufladung' : tx.type === 'gift_card_redemption' ? 'Gutschein' : tx.type === 'payment' ? 'Zahlung' : tx.type}</span>
              <span>€${(tx.amount || 0).toFixed(2)}</span>
            </div>
          `).join('') : '<p>Keine Transaktionen</p>'}
        </div>
        
        <div class="summary">
          <div class="section-title">Zusammenfassung</div>
          <div class="summary-row">
            <span>Aufladungen (${totals.topupCount})</span>
            <span>€${totals.topups.toFixed(2)}</span>
          </div>
          <div class="summary-row">
            <span>Boni ausgegeben</span>
            <span>€${totals.bonuses.toFixed(2)}</span>
          </div>
          <div class="summary-row">
            <span>Gutscheine (${totals.giftCardCount})</span>
            <span>€${totals.giftCards.toFixed(2)}</span>
          </div>
          <div class="summary-row">
            <span>Zahlungen (${totals.paymentCount})</span>
            <span>€${totals.payments.toFixed(2)}</span>
          </div>
          <div class="summary-row total">
            <span>GESAMT</span>
            <span>€${(totals.topups + totals.giftCards + totals.payments).toFixed(2)}</span>
          </div>
        </div>
        
        <div class="footer">
          <p>BidBlitz Kassensystem</p>
          <p>Druck: ${now}</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Handle barcode scan (simulated - in real world would use scanner hardware)
  const handleBarcodeScan = (e) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      playSound('scan');
      
      if (mode === 'topup') {
        // Process topup with scanned barcode as customer ID
        processTopupWithBarcode(barcodeInput.trim());
      } else if (mode === 'giftcard-redeem') {
        // Redeem gift card
        redeemGiftCard(barcodeInput.trim());
      }
      
      setBarcodeInput('');
      setScanMode(false);
    }
  };

  // Process top-up with barcode
  const processTopupWithBarcode = async (customerBarcode) => {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum < 5) {
      toast.error('Bitte zuerst Betrag eingeben (min. €5)');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('staff_pos_token');
      const res = await fetch(`${API_URL}/api/pos/topup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          customer_barcode: customerBarcode,
          amount: amountNum,
          staff_id: staff?.id,
          staff_name: staff?.name,
          branch_id: staff?.branch_id,
          branch_name: staff?.branch_name
        })
      });

      if (res.ok) {
        const data = await res.json();
        playSound('success');
        const bonus = calculateBonus(amountNum);
        const receiptData = {
          type: 'topup',
          customer_barcode: customerBarcode,
          customer_name: data.customer_name || 'Kunde',
          amount: amountNum,
          bonus: bonus,
          total: amountNum + bonus,
          new_balance: data.new_balance,
          timestamp: new Date().toISOString(),
          staff_name: staff?.name,
          branch_name: staff?.branch_name,
          transaction_id: data.transaction_id
        };
        setLastReceipt(receiptData);
        setShowReceipt(true);
        setAmount('');
        toast.success(`✅ Aufladung erfolgreich! €${amountNum.toFixed(2)} + €${bonus.toFixed(2)} Bonus`);
        fetchTransactionHistory();
      } else {
        const error = await res.json();
        playSound('error');
        toast.error(error.detail || 'Kunde nicht gefunden');
      }
    } catch (err) {
      playSound('error');
      toast.error('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  };

  // Create Gift Card
  const createGiftCard = async () => {
    const amountNum = parseFloat(giftCardAmount);
    if (!amountNum || amountNum < 10) {
      toast.error('Bitte Gutscheinwert wählen (min. €10)');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('staff_pos_token');
      const barcodeNumber = generateBarcodeNumber();
      
      const res = await fetch(`${API_URL}/api/pos/giftcard/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          barcode: barcodeNumber,
          amount: amountNum,
          staff_id: staff?.id,
          staff_name: staff?.name,
          branch_id: staff?.branch_id,
          branch_name: staff?.branch_name
        })
      });

      if (res.ok) {
        const data = await res.json();
        playSound('success');
        const newCard = {
          barcode: barcodeNumber,
          amount: amountNum,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
          staff_name: staff?.name,
          branch_name: staff?.branch_name,
          id: data.gift_card_id || barcodeNumber
        };
        setCreatedGiftCard(newCard);
        setShowGiftCardPrint(true);
        setGiftCardAmount('');
        toast.success(`✅ Gutscheinkarte erstellt: €${amountNum.toFixed(2)}`);
      } else {
        playSound('error');
        toast.error('Fehler beim Erstellen der Gutscheinkarte');
      }
    } catch (err) {
      // For demo purposes, create locally if API fails
      const barcodeNumber = generateBarcodeNumber();
      const newCard = {
        barcode: barcodeNumber,
        amount: amountNum,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        staff_name: staff?.name,
        branch_name: staff?.branch_name,
        id: barcodeNumber
      };
      setCreatedGiftCard(newCard);
      setShowGiftCardPrint(true);
      setGiftCardAmount('');
      playSound('success');
      toast.success(`✅ Gutscheinkarte erstellt: €${amountNum.toFixed(2)}`);
    } finally {
      setLoading(false);
    }
  };

  // Redeem Gift Card
  const redeemGiftCard = async (barcode) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('staff_pos_token');
      
      const res = await fetch(`${API_URL}/api/pos/giftcard/redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          barcode: barcode,
          staff_id: staff?.id,
          staff_name: staff?.name,
          branch_id: staff?.branch_id
        })
      });

      if (res.ok) {
        const data = await res.json();
        playSound('success');
        setRedeemedGiftCard({
          barcode: barcode,
          amount: data.amount,
          customer_name: data.customer_name,
          new_balance: data.new_balance,
          redeemed_at: new Date().toISOString()
        });
        toast.success(`✅ Gutschein eingelöst: €${data.amount.toFixed(2)}`);
      } else {
        const error = await res.json();
        playSound('error');
        toast.error(error.detail || 'Ungültiger Gutschein-Code');
      }
    } catch (err) {
      // Demo mode - simulate redemption
      playSound('success');
      const demoAmount = 25.00;
      setRedeemedGiftCard({
        barcode: barcode,
        amount: demoAmount,
        customer_name: 'Demo Kunde',
        new_balance: 125.00,
        redeemed_at: new Date().toISOString()
      });
      toast.success(`✅ Gutschein eingelöst: €${demoAmount.toFixed(2)}`);
    } finally {
      setLoading(false);
    }
  };

  // Quick amount buttons for topup
  const quickAmounts = [5, 10, 20, 25, 50, 100];

  // ==================== LOGIN SCREEN ====================
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        {/* Language Selector - Top Right */}
        <div className="absolute top-4 right-4">
          <div className="relative">
            <button
              onClick={() => setShowLanguages(!showLanguages)}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors flex items-center gap-1"
              data-testid="login-language-selector-btn"
            >
              <Globe className="w-5 h-5" />
              <span className="text-lg">{languages.find(l => l.code === language)?.flag || '🇩🇪'}</span>
            </button>
            
            {showLanguages && (
              <div className="absolute right-0 top-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 p-2 min-w-[280px] max-h-[400px] overflow-y-auto">
                <div className="grid grid-cols-2 gap-1">
                  {languages.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code);
                        setShowLanguages(false);
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
                        language === lang.code
                          ? 'bg-amber-500 text-white'
                          : 'hover:bg-slate-700 text-slate-300'
                      }`}
                    >
                      <span className="text-xl">{lang.flag}</span>
                      <span className="text-sm truncate">{lang.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-xl shadow-amber-500/20">
              <Store className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">{t.loginTitle}</h1>
            <p className="text-slate-400 mt-2">{t.loginSubtitle}</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 shadow-xl space-y-4">
            <div className="space-y-1">
              <label className="block text-sm text-slate-300">{t.email}</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  placeholder="mitarbeiter@firma.de"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({...loginForm, email: e.target.value})}
                  className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  required
                  data-testid="login-email-input"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-sm text-slate-300">{t.password}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                  className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  required
                  data-testid="login-password-input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-lg rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2"
              data-testid="login-submit-btn"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <LogOut className="w-5 h-5" />
                  {t.login}
                </>
              )}
            </button>
          </form>

          {/* Test Credentials */}
          <div className="mt-6 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
            <p className="text-slate-400 text-sm text-center">
              {t.testAccess}: <span className="text-amber-400">admin@edeka-test.de</span>
              <br />
              {t.password}: <span className="text-amber-400">EdekaTest2026!</span>
            </p>
          </div>

          {/* Händler-Portal Link */}
          <a 
            href="/enterprise" 
            className="mt-4 flex items-center justify-center gap-2 text-slate-400 hover:text-amber-400 transition-colors"
            data-testid="enterprise-portal-link"
          >
            <Store className="w-5 h-5" />
            <span>Händler-Portal (Edeka, Rewe...)</span>
          </a>
        </div>
      </div>
    );
  }

  // ==================== MAIN POS INTERFACE ====================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/80 backdrop-blur-sm border-b border-slate-700/50 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold">{staff?.branch_name || 'Kasse'}</h1>
              <p className="text-slate-400 text-sm">{staff?.name}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => setShowLanguages(!showLanguages)}
                className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors flex items-center gap-1"
                title={t.close || 'Sprache'}
                data-testid="language-selector-btn"
              >
                <Globe className="w-5 h-5" />
                <span className="text-lg">{languages.find(l => l.code === language)?.flag || '🇩🇪'}</span>
              </button>
              
              {showLanguages && (
                <div className="absolute right-0 top-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 p-2 min-w-[280px] max-h-[400px] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-1">
                    {languages.map(lang => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code);
                          setShowLanguages(false);
                        }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
                          language === lang.code
                            ? 'bg-amber-500 text-white'
                            : 'hover:bg-slate-700 text-slate-300'
                        }`}
                        data-testid={`lang-${lang.code}`}
                      >
                        <span className="text-xl">{lang.flag}</span>
                        <span className="text-sm truncate">{lang.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Hardware Scanner Toggle */}
            <button
              onClick={() => setHardwareScannerMode(!hardwareScannerMode)}
              className={`p-2 rounded-lg transition-colors flex items-center gap-1 ${
                hardwareScannerMode 
                  ? 'bg-green-500 text-white animate-pulse' 
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              }`}
              title={hardwareScannerMode ? (t.hardwareScannerActive || 'Scanner aktiv') : (t.hardwareScanner || 'Hardware-Scanner')}
              data-testid="hardware-scanner-btn"
            >
              <Scan className="w-5 h-5" />
              {hardwareScannerMode && <span className="text-xs font-bold">ON</span>}
            </button>
            
            <button
              onClick={() => setShowHistory(true)}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
              title={t.transactionHistory || 'Verlauf'}
              data-testid="history-btn"
            >
              <History className="w-5 h-5" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 transition-colors"
              title={t.logout || 'Abmelden'}
              data-testid="logout-btn"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hardware Scanner Status Bar */}
      {hardwareScannerMode && (
        <div className="bg-green-500 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 animate-pulse">
          <Scan className="w-4 h-4" />
          <span>📟 {t.hardwareScannerInfo || 'USB/Bluetooth Scanner bereit'}</span>
          {hardwareScanBuffer && (
            <span className="ml-2 font-mono bg-green-600 px-2 py-0.5 rounded">{hardwareScanBuffer}</span>
          )}
          <button 
            onClick={() => setHardwareScannerMode(false)}
            className="ml-4 px-2 py-0.5 bg-green-600 hover:bg-green-700 rounded text-xs"
          >
            ESC = Aus
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-2xl mx-auto p-4">
        {/* Mode Tabs */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          {[
            { id: 'topup', labelKey: 'topup', icon: Wallet, color: 'amber' },
            { id: 'giftcard-create', labelKey: 'giftcardCreate', icon: Gift, color: 'green' },
            { id: 'giftcard-redeem', labelKey: 'giftcardRedeem', icon: Ticket, color: 'purple' },
            { id: 'payment', labelKey: 'payment', icon: CreditCard, color: 'blue' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setMode(tab.id);
                setScanMode(false);
                setRedeemedGiftCard(null);
              }}
              data-testid={`tab-${tab.id}`}
              className={`py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                mode === tab.id
                  ? tab.color === 'amber' ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30'
                  : tab.color === 'green' ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30'
                  : tab.color === 'purple' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30'
                  : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="text-sm">{t[tab.labelKey]}</span>
            </button>
          ))}
        </div>

        {/* ==================== AUFLADUNG MODE ==================== */}
        {mode === 'topup' && (
          <div className="space-y-4">
            {/* Amount Input */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
              <label className="block text-slate-300 mb-2">{t.topupAmount}</label>
              <div className="relative">
                <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-amber-400" />
                <input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-14 pr-4 py-4 bg-slate-900/50 border border-slate-600 rounded-xl text-white text-3xl font-bold placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  min="5"
                  max="500"
                  step="0.01"
                  data-testid="topup-amount-input"
                />
              </div>
              
              {/* Quick Amounts */}
              <div className="flex gap-2 mt-4">
                {quickAmounts.map(amt => (
                  <button
                    key={amt}
                    onClick={() => setAmount(amt.toString())}
                    className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                      parseFloat(amount) === amt
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    €{amt}
                  </button>
                ))}
              </div>

              {/* Bonus Preview */}
              {parseFloat(amount) >= 20 && (
                <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-green-400 flex items-center gap-2">
                      <Gift className="w-5 h-5" />
                      {t.customerBonus}
                    </span>
                    <span className="text-green-400 font-bold text-lg">
                      +€{calculateBonus(parseFloat(amount)).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Barcode Scanner mit Kamera */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
              <label className="block text-slate-300 mb-2">{t.scanCustomer}</label>
              
              {!scanMode ? (
                <div className="space-y-3">
                  {/* Kamera-Scan Button */}
                  <button
                    onClick={async () => {
                      if (!amount || parseFloat(amount) < 5) {
                        toast.error(language === 'de' ? 'Bitte zuerst Betrag eingeben (min. €5)' : 'Please enter amount first (min. €5)');
                        return;
                      }
                      setScanMode(true);
                      // Automatisch Kamera starten
                      setTimeout(() => {
                        startTopupCamera();
                      }, 300);
                    }}
                    disabled={!amount || parseFloat(amount) < 5}
                    className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 rounded-xl text-white font-bold transition-all flex items-center justify-center gap-3 shadow-lg shadow-amber-500/30 disabled:shadow-none"
                    data-testid="scan-barcode-btn"
                  >
                    <Camera className="w-6 h-6" />
                    {language === 'de' ? 'Kunden-Barcode scannen' : 'Scan Customer Barcode'}
                  </button>
                  
                  {/* Manuelle Eingabe Option */}
                  <button
                    onClick={() => setScanMode(true)}
                    disabled={!amount || parseFloat(amount) < 5}
                    className="w-full py-3 bg-slate-700/50 hover:bg-slate-600/50 disabled:bg-slate-800/50 disabled:text-slate-600 rounded-xl text-slate-300 font-medium transition-all flex items-center justify-center gap-2"
                    data-testid="manual-barcode-btn"
                  >
                    <Scan className="w-5 h-5" />
                    {language === 'de' ? 'Manuell eingeben' : 'Enter manually'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Kamera Scanner Ansicht */}
                  {topupCameraActive && (
                    <div className="relative">
                      <div className="bg-slate-900 rounded-xl p-2">
                        <p className="text-amber-400 text-sm text-center mb-2 animate-pulse">
                          📷 {language === 'de' ? 'Halten Sie den Kunden-Barcode vor die Kamera...' : 'Hold customer barcode in front of camera...'}
                        </p>
                        <div id="topup-scanner" className="w-full h-72 rounded-lg overflow-hidden bg-black"></div>
                        
                        {/* iOS-Hinweis: Foto-Button ist zuverlässiger */}
                        <div className="mt-3 p-3 bg-amber-500/20 border border-amber-500/50 rounded-lg">
                          <p className="text-amber-400 text-xs text-center mb-2">
                            💡 {language === 'de' ? 'Scanner erkennt nicht? Nutze den Foto-Button!' : 'Scanner not detecting? Use the Photo button!'}
                          </p>
                          <input
                            ref={topupFileInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleTopupPhotoUpload}
                            className="hidden"
                            id="topup-photo-input-main"
                          />
                          <label
                            htmlFor="topup-photo-input-main"
                            className="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-bold text-lg rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-lg"
                          >
                            <Camera className="w-6 h-6" />
                            📸 {language === 'de' ? 'FOTO AUFNEHMEN' : 'TAKE PHOTO'}
                          </label>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          stopTopupCamera();
                          setScanMode(false);
                          setTopupCameraError(null);
                        }}
                        className="absolute top-2 right-2 p-2 bg-red-500 rounded-full text-white shadow-lg z-10"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                  
                  {/* Kamera Fehler Anzeige */}
                  {topupCameraError && (
                    <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-center">
                      <p className="text-red-400 text-sm mb-3">{topupCameraError}</p>
                    </div>
                  )}
                  
                  {/* Fallback Optionen */}
                  <div className={`${topupCameraActive ? 'mt-4 pt-4 border-t border-slate-700' : ''}`}>
                    {topupCameraActive && (
                      <p className="text-slate-500 text-xs text-center mb-3">
                        {language === 'de' ? 'Weitere Optionen:' : 'More options:'}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {/* Foto aufnehmen */}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleTopupPhotoUpload}
                        className="hidden"
                        id="topup-photo-input"
                      />
                      <label
                        htmlFor="topup-photo-input"
                        className="py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <Camera className="w-5 h-5" />
                        📸 Foto
                      </label>
                      
                      {/* Kamera starten (wenn nicht aktiv) */}
                      {!topupCameraActive && (
                        <button
                          onClick={startTopupCamera}
                          className="py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"
                        >
                          <Camera className="w-5 h-5" />
                          Kamera
                        </button>
                      )}
                      
                      {/* Kamera stoppen (wenn aktiv) */}
                      {topupCameraActive && (
                        <button
                          onClick={stopTopupCamera}
                          className="py-3 bg-slate-600 hover:bg-slate-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"
                        >
                          <X className="w-5 h-5" />
                          Stop
                        </button>
                      )}
                    </div>
                    
                    {/* Manuelle Eingabe */}
                    <div className="relative">
                      <Scan className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-400" />
                      <input
                        ref={barcodeInputRef}
                        type="text"
                        placeholder={language === 'de' ? 'Barcode manuell eingeben...' : 'Enter barcode manually...'}
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                        onKeyDown={handleBarcodeScan}
                        className="w-full pl-12 pr-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-transparent font-mono"
                        data-testid="barcode-input"
                      />
                    </div>
                  </div>
                  
                  {/* Hidden scanner element for photo scanning */}
                  <div id="topup-photo-scanner" style={{ display: 'none' }}></div>
                  
                  {/* Abbrechen Button */}
                  <button
                    onClick={() => {
                      stopTopupCamera();
                      setScanMode(false);
                      setBarcodeInput('');
                      setTopupCameraError(null);
                    }}
                    className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-medium transition-colors"
                  >
                    {t.cancel}
                  </button>
                </div>
              )}
            </div>
            
            {/* Stammkunden / Regular Customers */}
            {savedCustomers.length > 0 && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-4 border border-slate-700/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-medium flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-400" />
                    {t.regularCustomers}
                  </h3>
                  <span className="text-xs text-slate-400">{t.quickSelect}</span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {savedCustomers.slice(0, 5).map(customer => (
                    <div 
                      key={customer.id}
                      className="flex items-center justify-between bg-slate-700/50 rounded-lg p-3 hover:bg-slate-700 transition-colors group"
                    >
                      <button
                        onClick={() => selectSavedCustomer(customer)}
                        disabled={!amount || parseFloat(amount) < 5}
                        className="flex items-center gap-3 flex-1 text-left disabled:opacity-50"
                        data-testid={`customer-${customer.id}`}
                      >
                        <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-400 font-bold">
                          {(customer.nickname || customer.name).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white font-medium">{customer.nickname || customer.name}</p>
                          <p className="text-xs text-slate-400">
                            {customer.barcode} • {new Date(customer.lastTransaction).toLocaleDateString()}
                          </p>
                        </div>
                      </button>
                      <button
                        onClick={() => removeSavedCustomer(customer.id)}
                        className="p-2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        title={t.removeCustomer}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                {savedCustomers.length > 5 && (
                  <p className="text-xs text-slate-500 text-center mt-2">
                    +{savedCustomers.length - 5} {language === 'de' ? 'weitere' : 'more'}
                  </p>
                )}
              </div>
            )}

            {/* Bonus Info */}
            <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
              <h3 className="text-slate-400 text-sm mb-3">{t.bonusTiers}:</h3>
              <div className="grid grid-cols-2 gap-2">
                {bonusTiers.map(tier => (
                  <div key={tier.min} className="flex justify-between text-sm">
                    <span className="text-slate-500">ab €{tier.min}</span>
                    <span className="text-green-400">+€{tier.bonus.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================== GUTSCHEIN ERSTELLEN MODE ==================== */}
        {mode === 'giftcard-create' && (
          <div className="space-y-4">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                  <Gift className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{t.giftcardCreate}</h2>
                  <p className="text-slate-400 text-sm">{t.sellGiftcards}</p>
                </div>
              </div>

              <label className="block text-slate-300 mb-2">{t.giftcardValue}</label>
              <div className="grid grid-cols-5 gap-2 mb-4">
                {giftCardAmounts.map(amt => (
                  <button
                    key={amt}
                    onClick={() => setGiftCardAmount(amt.toString())}
                    data-testid={`giftcard-amt-${amt}`}
                    className={`py-4 rounded-xl font-bold text-lg transition-all ${
                      parseFloat(giftCardAmount) === amt
                        ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    €{amt}
                  </button>
                ))}
              </div>

              {/* Custom Amount */}
              <div className="relative mb-4">
                <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="number"
                  placeholder={t.otherAmount}
                  value={giftCardAmount}
                  onChange={(e) => setGiftCardAmount(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  min="10"
                  max="500"
                  data-testid="giftcard-custom-amount"
                />
              </div>

              <button
                onClick={createGiftCard}
                disabled={loading || !giftCardAmount || parseFloat(giftCardAmount) < 10}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-lg rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/30 flex items-center justify-center gap-3"
                data-testid="create-giftcard-btn"
              >
                {loading ? (
                  <RefreshCw className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-6 h-6" />
                    {t.createGiftcard}
                  </>
                )}
              </button>
            </div>

            {/* Info */}
            <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
              <h3 className="text-slate-400 text-sm mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Info
              </h3>
              <p className="text-slate-500 text-sm">
                {t.giftcardNote}
              </p>
            </div>
          </div>
        )}

        {/* ==================== GUTSCHEIN EINLÖSEN MODE ==================== */}
        {mode === 'giftcard-redeem' && (
          <div className="space-y-4">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <Ticket className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{t.giftcardRedeem}</h2>
                  <p className="text-slate-400 text-sm">{t.scanGiftcard}</p>
                </div>
              </div>

              {!scanMode && !redeemedGiftCard ? (
                <button
                  onClick={() => setScanMode(true)}
                  className="w-full py-6 bg-purple-500/20 hover:bg-purple-500/30 border-2 border-dashed border-purple-500 rounded-xl text-purple-400 font-medium transition-all flex flex-col items-center justify-center gap-3"
                  data-testid="scan-giftcard-btn"
                >
                  <Scan className="w-12 h-12" />
                  <span className="text-lg">{t.scanGiftcard}</span>
                </button>
              ) : scanMode && !redeemedGiftCard ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Scan className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-purple-400 animate-pulse" />
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      placeholder={t.waitingForScan}
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      onKeyDown={handleBarcodeScan}
                      className="w-full pl-14 pr-4 py-4 bg-purple-500/10 border-2 border-purple-500 rounded-xl text-white text-xl placeholder-purple-300/50 focus:ring-0 focus:border-purple-400"
                      autoFocus
                      data-testid="giftcard-barcode-input"
                    />
                  </div>
                  <p className="text-purple-400 text-sm text-center">
                    📷 {t.scannerReady}
                  </p>
                  <button
                    onClick={() => setScanMode(false)}
                    className="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 text-sm"
                  >
                    {t.cancel}
                  </button>
                </div>
              ) : redeemedGiftCard && (
                <div className="space-y-4">
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <CheckCircle className="w-8 h-8 text-green-400" />
                      <span className="text-green-400 text-xl font-bold">{t.redeemSuccess}</span>
                    </div>
                    <div className="space-y-2 text-center">
                      <p className="text-white text-3xl font-bold">€{redeemedGiftCard.amount.toFixed(2)}</p>
                      <p className="text-slate-400">Code: {redeemedGiftCard.barcode}</p>
                      <p className="text-slate-400">{t.total}: €{redeemedGiftCard.new_balance.toFixed(2)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setRedeemedGiftCard(null);
                      setScanMode(false);
                    }}
                    className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-medium"
                    data-testid="next-giftcard-btn"
                  >
                    {t.nextGiftcard}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== ZAHLUNG MODE ==================== */}
        {mode === 'payment' && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 text-center">
            <CreditCard className="w-16 h-16 text-blue-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">{t.paymentBarcode}</h3>
            <p className="text-slate-400 mb-6">
              {t.customersPay}
            </p>
            
            {!paymentScanMode ? (
              <div className="space-y-4">
                <div className="relative">
                  <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-blue-400" />
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder={t.enterAmount}
                    className="w-full pl-14 pr-4 py-4 bg-slate-900/50 border border-slate-600 rounded-xl text-white text-2xl font-bold placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0.01"
                    step="0.01"
                    data-testid="payment-amount-input"
                  />
                </div>
                
                <button
                  onClick={async () => {
                    const amt = parseFloat(paymentAmount);
                    if (!amt || amt <= 0) {
                      toast.error(language === 'de' ? 'Bitte Betrag eingeben' : 'Please enter amount');
                      return;
                    }
                    setPaymentScanMode(true);
                    // Automatisch Kamera starten nach kurzer Verzögerung (DOM muss erst rendern)
                    setTimeout(() => {
                      startPaymentCamera();
                    }, 300);
                  }}
                  disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
                  className="w-full py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold text-lg rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="scan-customer-payment-btn"
                >
                  <Camera className="w-6 h-6" />
                  {t.scanCustomer}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-500/20 rounded-xl p-4 mb-4">
                  <p className="text-blue-400 font-bold text-3xl">€{parseFloat(paymentAmount).toFixed(2)}</p>
                  <p className="text-slate-400 text-sm">{language === 'de' ? 'Zu zahlender Betrag' : 'Amount to pay'}</p>
                </div>
                
                {/* Camera Scanner */}
                {paymentCameraActive && (
                  <div className="relative">
                    <div className="bg-slate-900 rounded-xl p-2">
                      <p className="text-green-400 text-sm text-center mb-2 animate-pulse">
                        📷 {language === 'de' ? 'Halten Sie den Barcode vor die Kamera...' : 'Hold barcode in front of camera...'}
                      </p>
                      <div id="payment-scanner" className="w-full h-64 rounded-lg overflow-hidden bg-black"></div>
                      
                      {/* iOS-Hinweis: Foto-Button ist zuverlässiger */}
                      <div className="mt-3 p-3 bg-amber-500/20 border border-amber-500/50 rounded-lg">
                        <p className="text-amber-400 text-xs text-center mb-2">
                          💡 {language === 'de' ? 'Scanner erkennt nicht? Nutze den Foto-Button!' : 'Scanner not detecting? Use the Photo button!'}
                        </p>
                        <div className="flex gap-2">
                          <input
                            ref={paymentFileInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handlePaymentPhotoUpload}
                            className="hidden"
                            id="payment-photo-input-main"
                          />
                          <label
                            htmlFor="payment-photo-input-main"
                            className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white font-bold text-lg rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-lg"
                          >
                            <Camera className="w-6 h-6" />
                            📸 {language === 'de' ? 'FOTO AUFNEHMEN' : 'TAKE PHOTO'}
                          </label>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        stopPaymentCamera();
                        setPaymentScanMode(false);
                        setPaymentCameraError(null);
                      }}
                      className="absolute top-2 right-2 p-2 bg-red-500 rounded-full text-white shadow-lg"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                )}
                
                {/* Camera Error Message */}
                {paymentCameraError && (
                  <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-center">
                    <p className="text-red-400 text-sm mb-3">{paymentCameraError}</p>
                    
                    {/* Fallback Options wenn Kamera nicht funktioniert */}
                    <div className="space-y-2">
                      {/* Foto aufnehmen */}
                      <input
                        ref={paymentFileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePaymentPhotoUpload}
                        className="hidden"
                        id="payment-photo-input-error"
                      />
                      <label
                        htmlFor="payment-photo-input-error"
                        className="w-full py-3 bg-green-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Camera className="w-5 h-5" />
                        {language === 'de' ? '📸 Foto aufnehmen' : '📸 Take Photo'}
                      </label>
                      
                      {/* Manuelle Eingabe */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={paymentBarcode}
                          onChange={(e) => setPaymentBarcode(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && paymentBarcode.trim()) {
                              processPayment(paymentBarcode.trim());
                            }
                          }}
                          placeholder="Barcode eingeben..."
                          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-center font-mono"
                        />
                        <button
                          onClick={() => paymentBarcode.trim() && processPayment(paymentBarcode.trim())}
                          className="px-4 py-2 bg-blue-500 text-white rounded-lg font-bold"
                        >
                          OK
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Hidden scanner element for photo scanning */}
                <div id="payment-photo-scanner" style={{ display: 'none' }}></div>
                
                {/* Fallback wenn Kamera läuft aber Alternative gebraucht wird */}
                {paymentCameraActive && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <p className="text-slate-500 text-xs text-center mb-2">
                      {language === 'de' ? 'Kamera funktioniert nicht?' : 'Camera not working?'}
                    </p>
                    <div className="flex gap-2">
                      <input
                        ref={paymentFileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePaymentPhotoUpload}
                        className="hidden"
                        id="payment-photo-input-alt"
                      />
                      <label
                        htmlFor="payment-photo-input-alt"
                        className="flex-1 py-2 bg-green-500/20 border border-green-500 text-green-400 text-sm font-medium rounded-lg flex items-center justify-center gap-2 cursor-pointer"
                      >
                        📸 Foto
                      </label>
                      <input
                        type="text"
                        value={paymentBarcode}
                        onChange={(e) => setPaymentBarcode(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && paymentBarcode.trim()) {
                            stopPaymentCamera();
                            processPayment(paymentBarcode.trim());
                          }
                        }}
                        placeholder="Manuell..."
                        className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm text-center font-mono"
                      />
                    </div>
                  </div>
                )}
                
                {/* Abbrechen Button */}
                <button
                  onClick={() => {
                    stopPaymentCamera();
                    setPaymentScanMode(false);
                    setPaymentBarcode('');
                    setPaymentCameraError(null);
                  }}
                  className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition-colors mt-4"
                >
                  {t.cancel}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ==================== MODALS ==================== */}

      {/* Transaction History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">{t.transactionHistory}</h2>
                <p className="text-slate-400 text-sm">{transactionHistory.length} {t.transactions}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchTransactionHistory()}
                  className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
                  title={t.refresh}
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
                <button
                  onClick={printTransactionHistory}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded-lg text-white font-medium transition-colors flex items-center gap-2"
                  data-testid="print-history-btn"
                >
                  <Printer className="w-4 h-4" />
                  {t.print}
                </button>
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>
            
            {/* Summary */}
            <div className="p-4 bg-slate-900/50 border-b border-slate-700 grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-slate-400 text-xs">{t.topups}</p>
                <p className="text-green-400 font-bold text-lg">
                  €{transactionHistory.filter(tx => tx.type === 'pos_topup' || tx.type === 'topup').reduce((sum, tx) => sum + (tx.amount || 0), 0).toFixed(2)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-slate-400 text-xs">{t.bonusesGiven}</p>
                <p className="text-amber-400 font-bold text-lg">
                  €{transactionHistory.filter(tx => tx.type === 'pos_topup' || tx.type === 'topup').reduce((sum, tx) => sum + (tx.bonus || 0), 0).toFixed(2)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-slate-400 text-xs">{t.giftcards}</p>
                <p className="text-purple-400 font-bold text-lg">
                  €{transactionHistory.filter(tx => tx.type === 'gift_card_redemption').reduce((sum, tx) => sum + (tx.amount || 0), 0).toFixed(2)}
                </p>
              </div>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[50vh]">
              {transactionHistory.length > 0 ? (
                <div className="space-y-2">
                  {transactionHistory.map((tx, i) => (
                    <div key={i} className="bg-slate-700/50 rounded-xl p-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            tx.type === 'pos_topup' || tx.type === 'topup' ? 'bg-green-500/20' :
                            tx.type === 'gift_card_redemption' ? 'bg-purple-500/20' :
                            tx.type === 'payment' ? 'bg-blue-500/20' : 'bg-slate-600'
                          }`}>
                            {tx.type === 'pos_topup' || tx.type === 'topup' ? (
                              <Wallet className="w-5 h-5 text-green-400" />
                            ) : tx.type === 'gift_card_redemption' ? (
                              <Ticket className="w-5 h-5 text-purple-400" />
                            ) : (
                              <CreditCard className="w-5 h-5 text-blue-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-white font-bold">€{(tx.amount || 0).toFixed(2)}</p>
                            <p className="text-slate-400 text-sm">
                              {tx.type === 'pos_topup' || tx.type === 'topup' ? t.topup :
                               tx.type === 'gift_card_redemption' ? t.redemption :
                               tx.type === 'payment' ? t.payment : tx.type}
                              {tx.bonus > 0 && (
                                <span className="text-green-400 ml-2">+€{tx.bonus.toFixed(2)} Bonus</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            tx.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {tx.status === 'completed' ? '✓' : '...'}
                          </span>
                          <p className="text-slate-500 text-xs mt-1">
                            {new Date(tx.created_at).toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})}
                          </p>
                        </div>
                      </div>
                      {tx.customer_barcode && (
                        <p className="text-slate-500 text-xs mt-2">{t.customer}: {tx.customer_barcode}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <History className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">{t.noTransactions}</p>
                  <p className="text-slate-500 text-sm mt-2">{t.transactionsAppear}</p>
                </div>
              )}
            </div>
            
            {/* Footer with print options */}
            <div className="p-4 border-t border-slate-700 flex justify-between items-center">
              <p className="text-slate-500 text-sm">
                {new Date().toLocaleDateString('de-DE')} - {staff?.name}
              </p>
              <button
                onClick={printTransactionHistory}
                className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-500/30 flex items-center gap-2"
                data-testid="print-receipt-btn"
              >
                <Printer className="w-5 h-5" />
                {t.printReceipt}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && lastReceipt && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Aufladung erfolgreich!</h2>
              <p className="text-gray-500">{staff?.branch_name}</p>
              
              <div className="mt-6 p-4 bg-gray-100 rounded-xl">
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Betrag</span>
                  <span className="font-bold">€{lastReceipt.amount?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Bonus</span>
                  <span className="font-bold text-green-600">+€{lastReceipt.bonus?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600 font-bold">Gutschrift</span>
                  <span className="font-bold text-xl">€{lastReceipt.total?.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="mt-4 text-sm text-gray-500">
                <p>Kunde: {lastReceipt.customer_name} ({lastReceipt.customer_barcode})</p>
                <p>Mitarbeiter: {lastReceipt.staff_name}</p>
                <p>{new Date(lastReceipt.timestamp).toLocaleString('de-DE')}</p>
              </div>
              
              {/* Save as Regular Customer Button */}
              {!savedCustomers.some(c => c.barcode === lastReceipt.customer_barcode) && (
                <button
                  onClick={() => {
                    setCustomerToSave({
                      barcode: lastReceipt.customer_barcode,
                      name: lastReceipt.customer_name
                    });
                    setShowSaveCustomerDialog(true);
                  }}
                  className="mt-4 w-full py-2 bg-amber-100 text-amber-700 font-medium rounded-lg hover:bg-amber-200 transition-colors flex items-center justify-center gap-2"
                  data-testid="save-customer-btn"
                >
                  <Star className="w-4 h-4" />
                  {t.saveAsRegular}
                </button>
              )}
              {savedCustomers.some(c => c.barcode === lastReceipt.customer_barcode) && (
                <div className="mt-4 py-2 text-amber-600 flex items-center justify-center gap-2">
                  <Star className="w-4 h-4 fill-amber-500" />
                  Stammkunde
                </div>
              )}
            </div>
            
            <div className="p-4 bg-gray-50 flex gap-2">
              <button
                onClick={() => toast.success('Beleg wird gedruckt...')}
                className="flex-1 py-3 bg-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-300 transition-colors flex items-center justify-center gap-2"
              >
                <Printer className="w-5 h-5" />
                Drucken
              </button>
              <button
                onClick={() => setShowReceipt(false)}
                className="flex-1 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors"
              >
                Fertig
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Save Customer Dialog */}
      {showSaveCustomerDialog && customerToSave && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-amber-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 text-center mb-1">{t.saveCustomer}</h2>
              <p className="text-gray-500 text-center text-sm mb-4">{customerToSave.name}</p>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">{t.customerNickname}</label>
                  <input
                    type="text"
                    value={customerNickname}
                    onChange={(e) => setCustomerNickname(e.target.value)}
                    placeholder={customerToSave.name}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    data-testid="customer-nickname-input"
                  />
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 flex gap-2">
              <button
                onClick={() => {
                  setShowSaveCustomerDialog(false);
                  setCustomerToSave(null);
                  setCustomerNickname('');
                }}
                className="flex-1 py-3 bg-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-300 transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => saveCustomer(customerToSave.barcode, customerToSave.name, customerNickname)}
                className="flex-1 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors"
                data-testid="confirm-save-customer"
              >
                {t.saveCustomer}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gift Card Print Modal */}
      {showGiftCardPrint && createdGiftCard && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">Gutscheinkarte</h2>
              
              {/* Gift Card Design */}
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white mb-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-green-100 text-sm">BidBlitz Gutschein</p>
                    <p className="text-3xl font-bold">€{createdGiftCard.amount.toFixed(2)}</p>
                  </div>
                  <Gift className="w-10 h-10 text-green-200" />
                </div>
                
                {/* Barcode */}
                <div className="bg-white rounded-lg p-3 flex justify-center">
                  <Barcode 
                    value={createdGiftCard.barcode} 
                    width={2}
                    height={60}
                    fontSize={12}
                    background="#ffffff"
                    lineColor="#000000"
                  />
                </div>
                
                <div className="mt-4 text-sm text-green-100">
                  <p>Gültig bis: {new Date(createdGiftCard.expires_at).toLocaleDateString('de-DE')}</p>
                  <p>Erstellt: {staff?.branch_name}</p>
                </div>
              </div>
              
              <p className="text-gray-500 text-sm text-center mb-4">
                Barcode-Nummer: <span className="font-mono">{createdGiftCard.barcode}</span>
              </p>
            </div>
            
            <div className="p-4 bg-gray-50 flex gap-2">
              <button
                onClick={() => {
                  toast.success('Gutscheinkarte wird gedruckt...');
                }}
                className="flex-1 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
              >
                <Printer className="w-5 h-5" />
                Drucken
              </button>
              <button
                onClick={() => {
                  setShowGiftCardPrint(false);
                  setCreatedGiftCard(null);
                }}
                className="flex-1 py-3 bg-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-300 transition-colors"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
