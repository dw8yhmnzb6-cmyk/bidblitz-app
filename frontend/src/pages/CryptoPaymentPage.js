import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Bitcoin, Wallet, QrCode, Copy, Check,
  ArrowRight, Clock, Shield, Zap
} from 'lucide-react';
import { Button } from '../components/ui/button';

const API = process.env.REACT_APP_BACKEND_URL;

// Crypto icons
const cryptoIcons = {
  BTC: '₿',
  ETH: 'Ξ',
  USDT: '₮',
  USDC: '$',
  LTC: 'Ł'
};

// Translations
const translations = {
  de: {
    title: 'Krypto-Zahlung', subtitle: 'Bezahle mit Bitcoin, Ethereum und mehr', selectCrypto: 'Währung wählen', amount: 'Betrag (EUR)', equivalent: 'Entspricht', createPayment: 'Zahlung erstellen', waitingPayment: 'Warte auf Zahlung...', sendExactly: 'Sende genau', toAddress: 'an folgende Adresse', copyAddress: 'Adresse kopieren', copied: 'Kopiert!', expiresIn: 'Läuft ab in', minutes: 'Minuten', paymentReceived: 'Zahlung empfangen!', processing: 'Verarbeitung...', benefits: { fast: 'Schnelle Bestätigung', secure: 'Sichere Blockchain', anonymous: 'Keine Bankdaten nötig' }, instructions: 'Anleitung', step1: 'Wähle deine Kryptowährung', step2: 'Gib den Betrag ein', step3: 'Scanne den QR-Code oder kopiere die Adresse', step4: 'Sende den exakten Betrag', demoButton: 'Demo: Zahlung bestätigen'
  },
  en: {
    title: 'Crypto Payment', subtitle: 'Pay with Bitcoin, Ethereum and more', selectCrypto: 'Select Currency', amount: 'Amount (EUR)', equivalent: 'Equivalent to', createPayment: 'Create Payment', waitingPayment: 'Waiting for payment...', sendExactly: 'Send exactly', toAddress: 'to the following address', copyAddress: 'Copy Address', copied: 'Copied!', expiresIn: 'Expires in', minutes: 'minutes', paymentReceived: 'Payment received!', processing: 'Processing...', benefits: { fast: 'Fast confirmation', secure: 'Secure blockchain', anonymous: 'No bank details needed' }, instructions: 'Instructions', step1: 'Select your cryptocurrency', step2: 'Enter the amount', step3: 'Scan the QR code or copy the address', step4: 'Send the exact amount', demoButton: 'Demo: Confirm Payment'
  },
  us: {
    title: 'Crypto Payment', subtitle: 'Pay with Bitcoin, Ethereum and more', selectCrypto: 'Select Currency', amount: 'Amount (EUR)', equivalent: 'Equivalent to', createPayment: 'Create Payment', waitingPayment: 'Waiting for payment...', sendExactly: 'Send exactly', toAddress: 'to the following address', copyAddress: 'Copy Address', copied: 'Copied!', expiresIn: 'Expires in', minutes: 'minutes', paymentReceived: 'Payment received!', processing: 'Processing...', benefits: { fast: 'Fast confirmation', secure: 'Secure blockchain', anonymous: 'No bank details needed' }, instructions: 'Instructions', step1: 'Select your cryptocurrency', step2: 'Enter the amount', step3: 'Scan the QR code or copy the address', step4: 'Send the exact amount', demoButton: 'Demo: Confirm Payment'
  },
  fr: {
    title: 'Paiement Crypto', subtitle: 'Payez avec Bitcoin, Ethereum et plus', selectCrypto: 'Sélectionner devise', amount: 'Montant (EUR)', equivalent: 'Équivalent à', createPayment: 'Créer paiement', waitingPayment: 'En attente de paiement...', sendExactly: 'Envoyez exactement', toAddress: 'à l\'adresse suivante', copyAddress: 'Copier l\'adresse', copied: 'Copié!', expiresIn: 'Expire dans', minutes: 'minutes', paymentReceived: 'Paiement reçu!', processing: 'Traitement...', benefits: { fast: 'Confirmation rapide', secure: 'Blockchain sécurisée', anonymous: 'Aucune donnée bancaire nécessaire' }, instructions: 'Instructions', step1: 'Sélectionnez votre cryptomonnaie', step2: 'Entrez le montant', step3: 'Scannez le QR code ou copiez l\'adresse', step4: 'Envoyez le montant exact', demoButton: 'Démo: Confirmer paiement'
  },
  es: {
    title: 'Pago Crypto', subtitle: 'Paga con Bitcoin, Ethereum y más', selectCrypto: 'Seleccionar moneda', amount: 'Cantidad (EUR)', equivalent: 'Equivalente a', createPayment: 'Crear pago', waitingPayment: 'Esperando pago...', sendExactly: 'Envía exactamente', toAddress: 'a la siguiente dirección', copyAddress: 'Copiar dirección', copied: '¡Copiado!', expiresIn: 'Expira en', minutes: 'minutos', paymentReceived: '¡Pago recibido!', processing: 'Procesando...', benefits: { fast: 'Confirmación rápida', secure: 'Blockchain segura', anonymous: 'Sin datos bancarios' }, instructions: 'Instrucciones', step1: 'Selecciona tu criptomoneda', step2: 'Ingresa el monto', step3: 'Escanea el código QR o copia la dirección', step4: 'Envía el monto exacto', demoButton: 'Demo: Confirmar pago'
  },
  it: {
    title: 'Pagamento Crypto', subtitle: 'Paga con Bitcoin, Ethereum e altro', selectCrypto: 'Seleziona valuta', amount: 'Importo (EUR)', equivalent: 'Equivalente a', createPayment: 'Crea pagamento', waitingPayment: 'In attesa di pagamento...', sendExactly: 'Invia esattamente', toAddress: 'al seguente indirizzo', copyAddress: 'Copia indirizzo', copied: 'Copiato!', expiresIn: 'Scade tra', minutes: 'minuti', paymentReceived: 'Pagamento ricevuto!', processing: 'Elaborazione...', benefits: { fast: 'Conferma rapida', secure: 'Blockchain sicura', anonymous: 'Nessun dato bancario necessario' }, instructions: 'Istruzioni', step1: 'Seleziona la tua criptovaluta', step2: 'Inserisci l\'importo', step3: 'Scansiona il QR code o copia l\'indirizzo', step4: 'Invia l\'importo esatto', demoButton: 'Demo: Conferma pagamento'
  },
  pt: {
    title: 'Pagamento Crypto', subtitle: 'Pague com Bitcoin, Ethereum e mais', selectCrypto: 'Selecionar moeda', amount: 'Valor (EUR)', equivalent: 'Equivalente a', createPayment: 'Criar pagamento', waitingPayment: 'Aguardando pagamento...', sendExactly: 'Envie exatamente', toAddress: 'para o seguinte endereço', copyAddress: 'Copiar endereço', copied: 'Copiado!', expiresIn: 'Expira em', minutes: 'minutos', paymentReceived: 'Pagamento recebido!', processing: 'Processando...', benefits: { fast: 'Confirmação rápida', secure: 'Blockchain segura', anonymous: 'Sem dados bancários necessários' }, instructions: 'Instruções', step1: 'Selecione sua criptomoeda', step2: 'Digite o valor', step3: 'Escaneie o código QR ou copie o endereço', step4: 'Envie o valor exato', demoButton: 'Demo: Confirmar pagamento'
  },
  nl: {
    title: 'Crypto Betaling', subtitle: 'Betaal met Bitcoin, Ethereum en meer', selectCrypto: 'Selecteer valuta', amount: 'Bedrag (EUR)', equivalent: 'Gelijk aan', createPayment: 'Betaling aanmaken', waitingPayment: 'Wachten op betaling...', sendExactly: 'Stuur precies', toAddress: 'naar het volgende adres', copyAddress: 'Kopieer adres', copied: 'Gekopieerd!', expiresIn: 'Verloopt over', minutes: 'minuten', paymentReceived: 'Betaling ontvangen!', processing: 'Verwerken...', benefits: { fast: 'Snelle bevestiging', secure: 'Veilige blockchain', anonymous: 'Geen bankgegevens nodig' }, instructions: 'Instructies', step1: 'Selecteer je cryptocurrency', step2: 'Voer het bedrag in', step3: 'Scan de QR-code of kopieer het adres', step4: 'Stuur het exacte bedrag', demoButton: 'Demo: Bevestig betaling'
  },
  pl: {
    title: 'Płatność Crypto', subtitle: 'Płać Bitcoinem, Ethereum i więcej', selectCrypto: 'Wybierz walutę', amount: 'Kwota (EUR)', equivalent: 'Odpowiada', createPayment: 'Utwórz płatność', waitingPayment: 'Oczekiwanie na płatność...', sendExactly: 'Wyślij dokładnie', toAddress: 'na następujący adres', copyAddress: 'Kopiuj adres', copied: 'Skopiowano!', expiresIn: 'Wygasa za', minutes: 'minut', paymentReceived: 'Płatność otrzymana!', processing: 'Przetwarzanie...', benefits: { fast: 'Szybkie potwierdzenie', secure: 'Bezpieczny blockchain', anonymous: 'Bez danych bankowych' }, instructions: 'Instrukcje', step1: 'Wybierz swoją kryptowalutę', step2: 'Wprowadź kwotę', step3: 'Zeskanuj kod QR lub skopiuj adres', step4: 'Wyślij dokładną kwotę', demoButton: 'Demo: Potwierdź płatność'
  },
  tr: {
    title: 'Kripto Ödeme', subtitle: 'Bitcoin, Ethereum ve daha fazlasıyla öde', selectCrypto: 'Para birimi seç', amount: 'Tutar (EUR)', equivalent: 'Karşılığı', createPayment: 'Ödeme oluştur', waitingPayment: 'Ödeme bekleniyor...', sendExactly: 'Tam olarak gönder', toAddress: 'şu adrese', copyAddress: 'Adresi kopyala', copied: 'Kopyalandı!', expiresIn: 'Sona eriyor', minutes: 'dakika', paymentReceived: 'Ödeme alındı!', processing: 'İşleniyor...', benefits: { fast: 'Hızlı onay', secure: 'Güvenli blockchain', anonymous: 'Banka bilgisi gerekmiyor' }, instructions: 'Talimatlar', step1: 'Kripto paranı seç', step2: 'Tutarı gir', step3: 'QR kodu tara veya adresi kopyala', step4: 'Tam tutarı gönder', demoButton: 'Demo: Ödemeyi onayla'
  },
  ru: {
    title: 'Крипто-платеж', subtitle: 'Платите Bitcoin, Ethereum и др.', selectCrypto: 'Выберите валюту', amount: 'Сумма (EUR)', equivalent: 'Эквивалент', createPayment: 'Создать платеж', waitingPayment: 'Ожидание платежа...', sendExactly: 'Отправьте точно', toAddress: 'на следующий адрес', copyAddress: 'Копировать адрес', copied: 'Скопировано!', expiresIn: 'Истекает через', minutes: 'минут', paymentReceived: 'Платеж получен!', processing: 'Обработка...', benefits: { fast: 'Быстрое подтверждение', secure: 'Безопасный блокчейн', anonymous: 'Без банковских данных' }, instructions: 'Инструкции', step1: 'Выберите криптовалюту', step2: 'Введите сумму', step3: 'Отсканируйте QR-код или скопируйте адрес', step4: 'Отправьте точную сумму', demoButton: 'Демо: Подтвердить платеж'
  },
  ar: {
    title: 'دفع بالعملات الرقمية', subtitle: 'ادفع بـ Bitcoin، Ethereum والمزيد', selectCrypto: 'اختر العملة', amount: 'المبلغ (EUR)', equivalent: 'يعادل', createPayment: 'إنشاء دفعة', waitingPayment: 'في انتظار الدفع...', sendExactly: 'أرسل بالضبط', toAddress: 'إلى العنوان التالي', copyAddress: 'نسخ العنوان', copied: 'تم النسخ!', expiresIn: 'ينتهي في', minutes: 'دقائق', paymentReceived: 'تم استلام الدفع!', processing: 'معالجة...', benefits: { fast: 'تأكيد سريع', secure: 'بلوكتشين آمن', anonymous: 'لا حاجة لبيانات بنكية' }, instructions: 'التعليمات', step1: 'اختر عملتك الرقمية', step2: 'أدخل المبلغ', step3: 'امسح رمز QR أو انسخ العنوان', step4: 'أرسل المبلغ بالضبط', demoButton: 'تجريبي: تأكيد الدفع'
  },
  ae: {
    title: 'دفع بالعملات الرقمية', subtitle: 'ادفع بـ Bitcoin، Ethereum والمزيد', selectCrypto: 'اختر العملة', amount: 'المبلغ (EUR)', equivalent: 'يعادل', createPayment: 'إنشاء دفعة', waitingPayment: 'في انتظار الدفع...', sendExactly: 'أرسل بالضبط', toAddress: 'إلى العنوان التالي', copyAddress: 'نسخ العنوان', copied: 'تم النسخ!', expiresIn: 'ينتهي في', minutes: 'دقائق', paymentReceived: 'تم استلام الدفع!', processing: 'معالجة...', benefits: { fast: 'تأكيد سريع', secure: 'بلوكتشين آمن', anonymous: 'لا حاجة لبيانات بنكية' }, instructions: 'التعليمات', step1: 'اختر عملتك الرقمية', step2: 'أدخل المبلغ', step3: 'امسح رمز QR أو انسخ العنوان', step4: 'أرسل المبلغ بالضبط', demoButton: 'تجريبي: تأكيد الدفع'
  },
  zh: {
    title: '加密货币支付', subtitle: '使用比特币、以太坊等支付', selectCrypto: '选择货币', amount: '金额 (EUR)', equivalent: '相当于', createPayment: '创建支付', waitingPayment: '等待支付...', sendExactly: '精确发送', toAddress: '到以下地址', copyAddress: '复制地址', copied: '已复制!', expiresIn: '过期时间', minutes: '分钟', paymentReceived: '支付已收到!', processing: '处理中...', benefits: { fast: '快速确认', secure: '安全区块链', anonymous: '无需银行信息' }, instructions: '说明', step1: '选择您的加密货币', step2: '输入金额', step3: '扫描二维码或复制地址', step4: '发送准确金额', demoButton: '演示：确认支付'
  },
  ja: {
    title: '暗号通貨支払い', subtitle: 'Bitcoin、Ethereumなどで支払い', selectCrypto: '通貨を選択', amount: '金額 (EUR)', equivalent: '相当', createPayment: '支払い作成', waitingPayment: '支払い待ち...', sendExactly: '正確に送金', toAddress: '以下のアドレスへ', copyAddress: 'アドレスをコピー', copied: 'コピー完了!', expiresIn: '有効期限', minutes: '分', paymentReceived: '支払い受領!', processing: '処理中...', benefits: { fast: '高速確認', secure: '安全なブロックチェーン', anonymous: '銀行情報不要' }, instructions: '手順', step1: '暗号通貨を選択', step2: '金額を入力', step3: 'QRコードをスキャンまたはアドレスをコピー', step4: '正確な金額を送金', demoButton: 'デモ：支払い確認'
  },
  ko: {
    title: '암호화폐 결제', subtitle: '비트코인, 이더리움 등으로 결제', selectCrypto: '통화 선택', amount: '금액 (EUR)', equivalent: '상당', createPayment: '결제 생성', waitingPayment: '결제 대기 중...', sendExactly: '정확히 전송', toAddress: '다음 주소로', copyAddress: '주소 복사', copied: '복사됨!', expiresIn: '만료 시간', minutes: '분', paymentReceived: '결제 수신!', processing: '처리 중...', benefits: { fast: '빠른 확인', secure: '안전한 블록체인', anonymous: '은행 정보 불필요' }, instructions: '안내', step1: '암호화폐 선택', step2: '금액 입력', step3: 'QR 코드 스캔 또는 주소 복사', step4: '정확한 금액 전송', demoButton: '데모: 결제 확인'
  },
  hi: {
    title: 'क्रिप्टो भुगतान', subtitle: 'Bitcoin, Ethereum आदि से भुगतान करें', selectCrypto: 'मुद्रा चुनें', amount: 'राशि (EUR)', equivalent: 'बराबर', createPayment: 'भुगतान बनाएं', waitingPayment: 'भुगतान की प्रतीक्षा...', sendExactly: 'सही राशि भेजें', toAddress: 'इस पते पर', copyAddress: 'पता कॉपी करें', copied: 'कॉपी किया!', expiresIn: 'समाप्ति', minutes: 'मिनट', paymentReceived: 'भुगतान प्राप्त!', processing: 'प्रोसेसिंग...', benefits: { fast: 'तेज़ पुष्टि', secure: 'सुरक्षित ब्लॉकचेन', anonymous: 'बैंक जानकारी नहीं चाहिए' }, instructions: 'निर्देश', step1: 'अपनी क्रिप्टोकरेंसी चुनें', step2: 'राशि दर्ज करें', step3: 'QR कोड स्कैन करें या पता कॉपी करें', step4: 'सही राशि भेजें', demoButton: 'डेमो: भुगतान पुष्टि'
  },
  sq: {
    title: 'Pagesa Kripto', subtitle: 'Paguaj me Bitcoin, Ethereum dhe më shumë', selectCrypto: 'Zgjidhni monedhën', amount: 'Shuma (EUR)', equivalent: 'Ekuivalent me', createPayment: 'Krijo pagesë', waitingPayment: 'Duke pritur pagesën...', sendExactly: 'Dërgo saktësisht', toAddress: 'në adresën e mëposhtme', copyAddress: 'Kopjo adresën', copied: 'U kopjua!', expiresIn: 'Skadon për', minutes: 'minuta', paymentReceived: 'Pagesa u mor!', processing: 'Duke procesuar...', benefits: { fast: 'Konfirmim i shpejtë', secure: 'Blockchain i sigurt', anonymous: 'Pa të dhëna bankare' }, instructions: 'Udhëzime', step1: 'Zgjidhni kriptomonedhën tuaj', step2: 'Vendosni shumën', step3: 'Skanoni kodin QR ose kopjoni adresën', step4: 'Dërgoni shumën e saktë', demoButton: 'Demo: Konfirmo pagesën'
  },
  xk: {
    title: 'Pagesa Kripto', subtitle: 'Paguaj me Bitcoin, Ethereum dhe më shumë', selectCrypto: 'Zgjidhni monedhën', amount: 'Shuma (EUR)', equivalent: 'Ekuivalent me', createPayment: 'Krijo pagesë', waitingPayment: 'Duke pritur pagesën...', sendExactly: 'Dërgo saktësisht', toAddress: 'në adresën e mëposhtme', copyAddress: 'Kopjo adresën', copied: 'U kopjua!', expiresIn: 'Skadon për', minutes: 'minuta', paymentReceived: 'Pagesa u mor!', processing: 'Duke procesuar...', benefits: { fast: 'Konfirmim i shpejtë', secure: 'Blockchain i sigurt', anonymous: 'Pa të dhëna bankare' }, instructions: 'Udhëzime', step1: 'Zgjidhni kriptomonedhën tuaj', step2: 'Vendosni shumën', step3: 'Skanoni kodin QR ose kopjoni adresën', step4: 'Dërgoni shumën e saktë', demoButton: 'Demo: Konfirmo pagesën'
  },
  cs: {
    title: 'Krypto platba', subtitle: 'Plaťte Bitcoinem, Ethereem a dalšími', selectCrypto: 'Vyberte měnu', amount: 'Částka (EUR)', equivalent: 'Ekvivalent', createPayment: 'Vytvořit platbu', waitingPayment: 'Čekání na platbu...', sendExactly: 'Pošlete přesně', toAddress: 'na následující adresu', copyAddress: 'Kopírovat adresu', copied: 'Zkopírováno!', expiresIn: 'Vyprší za', minutes: 'minut', paymentReceived: 'Platba přijata!', processing: 'Zpracování...', benefits: { fast: 'Rychlé potvrzení', secure: 'Bezpečný blockchain', anonymous: 'Bez bankovních údajů' }, instructions: 'Instrukce', step1: 'Vyberte svou kryptoměnu', step2: 'Zadejte částku', step3: 'Naskenujte QR kód nebo zkopírujte adresu', step4: 'Odešlete přesnou částku', demoButton: 'Demo: Potvrdit platbu'
  },
  sv: {
    title: 'Kryptobetalning', subtitle: 'Betala med Bitcoin, Ethereum och mer', selectCrypto: 'Välj valuta', amount: 'Belopp (EUR)', equivalent: 'Motsvarar', createPayment: 'Skapa betalning', waitingPayment: 'Väntar på betalning...', sendExactly: 'Skicka exakt', toAddress: 'till följande adress', copyAddress: 'Kopiera adress', copied: 'Kopierat!', expiresIn: 'Går ut om', minutes: 'minuter', paymentReceived: 'Betalning mottagen!', processing: 'Bearbetar...', benefits: { fast: 'Snabb bekräftelse', secure: 'Säker blockchain', anonymous: 'Inga bankuppgifter krävs' }, instructions: 'Instruktioner', step1: 'Välj din kryptovaluta', step2: 'Ange belopp', step3: 'Skanna QR-koden eller kopiera adressen', step4: 'Skicka det exakta beloppet', demoButton: 'Demo: Bekräfta betalning'
  },
  da: {
    title: 'Kryptobetaling', subtitle: 'Betal med Bitcoin, Ethereum og mere', selectCrypto: 'Vælg valuta', amount: 'Beløb (EUR)', equivalent: 'Svarer til', createPayment: 'Opret betaling', waitingPayment: 'Venter på betaling...', sendExactly: 'Send præcis', toAddress: 'til følgende adresse', copyAddress: 'Kopiér adresse', copied: 'Kopieret!', expiresIn: 'Udløber om', minutes: 'minutter', paymentReceived: 'Betaling modtaget!', processing: 'Behandler...', benefits: { fast: 'Hurtig bekræftelse', secure: 'Sikker blockchain', anonymous: 'Ingen bankoplysninger kræves' }, instructions: 'Instruktioner', step1: 'Vælg din kryptovaluta', step2: 'Indtast beløb', step3: 'Scan QR-koden eller kopiér adressen', step4: 'Send det nøjagtige beløb', demoButton: 'Demo: Bekræft betaling'
  },
  fi: {
    title: 'Kryptomaksu', subtitle: 'Maksa Bitcoinilla, Ethereumilla ja muilla', selectCrypto: 'Valitse valuutta', amount: 'Summa (EUR)', equivalent: 'Vastaa', createPayment: 'Luo maksu', waitingPayment: 'Odotetaan maksua...', sendExactly: 'Lähetä tarkasti', toAddress: 'seuraavaan osoitteeseen', copyAddress: 'Kopioi osoite', copied: 'Kopioitu!', expiresIn: 'Vanhenee', minutes: 'minuuttia', paymentReceived: 'Maksu vastaanotettu!', processing: 'Käsitellään...', benefits: { fast: 'Nopea vahvistus', secure: 'Turvallinen lohkoketju', anonymous: 'Ei pankkitietoja tarvita' }, instructions: 'Ohjeet', step1: 'Valitse kryptovaluuttasi', step2: 'Syötä summa', step3: 'Skannaa QR-koodi tai kopioi osoite', step4: 'Lähetä tarkka summa', demoButton: 'Demo: Vahvista maksu'
  },
  el: {
    title: 'Πληρωμή Κρυπτο', subtitle: 'Πληρώστε με Bitcoin, Ethereum και άλλα', selectCrypto: 'Επιλέξτε νόμισμα', amount: 'Ποσό (EUR)', equivalent: 'Ισοδύναμο με', createPayment: 'Δημιουργία πληρωμής', waitingPayment: 'Αναμονή πληρωμής...', sendExactly: 'Στείλτε ακριβώς', toAddress: 'στην παρακάτω διεύθυνση', copyAddress: 'Αντιγραφή διεύθυνσης', copied: 'Αντιγράφηκε!', expiresIn: 'Λήγει σε', minutes: 'λεπτά', paymentReceived: 'Πληρωμή ελήφθη!', processing: 'Επεξεργασία...', benefits: { fast: 'Γρήγορη επιβεβαίωση', secure: 'Ασφαλές blockchain', anonymous: 'Χωρίς τραπεζικά στοιχεία' }, instructions: 'Οδηγίες', step1: 'Επιλέξτε το κρυπτονόμισμά σας', step2: 'Εισάγετε το ποσό', step3: 'Σκανάρετε τον κώδικα QR ή αντιγράψτε τη διεύθυνση', step4: 'Στείλτε το ακριβές ποσό', demoButton: 'Demo: Επιβεβαίωση πληρωμής'
  }
};

export default function CryptoPaymentPage() {
  const { isAuthenticated, token } = useAuth();
  const { language, mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const navigate = useNavigate();
  const t = translations[mappedLanguage] || translations[langKey] || translations.de;
  
  const [cryptos, setCryptos] = useState([]);
  const [selectedCrypto, setSelectedCrypto] = useState('BTC');
  const [amount, setAmount] = useState(50);
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  
  // Fetch supported cryptos
  useEffect(() => {
    const fetchCryptos = async () => {
      try {
        const res = await axios.get(`${API}/api/crypto/supported`);
        setCryptos(res.data.cryptocurrencies || []);
      } catch (error) {
        console.error('Error fetching cryptos:', error);
      }
    };
    fetchCryptos();
  }, []);
  
  // Countdown timer
  useEffect(() => {
    if (payment && payment.expires_at) {
      const updateTimer = () => {
        const expires = new Date(payment.expires_at).getTime();
        const now = Date.now();
        const diff = Math.max(0, Math.floor((expires - now) / 1000));
        setTimeLeft(diff);
        
        if (diff === 0) {
          setPayment(null);
          toast.error('Zahlung abgelaufen');
        }
      };
      
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [payment]);
  
  const createPayment = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    setLoading(true);
    try {
      const res = await axios.post(
        `${API}/api/crypto/create-payment`,
        {
          amount_eur: amount,
          crypto_code: selectedCrypto,
          bid_package_id: 'starter' // Would be selected by user
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPayment(res.data.payment);
      toast.success('Zahlung erstellt!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Erstellen');
    } finally {
      setLoading(false);
    }
  };
  
  const copyAddress = () => {
    if (payment?.wallet_address) {
      navigator.clipboard.writeText(payment.wallet_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(t.copied);
    }
  };
  
  const confirmDemo = async () => {
    if (!payment) return;
    
    try {
      const res = await axios.post(
        `${API}/api/crypto/demo/confirm/${payment.id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(res.data.message);
      setPayment(null);
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
    }
  };
  
  const selectedCryptoInfo = cryptos.find(c => c.code === selectedCrypto);
  const cryptoAmount = selectedCryptoInfo 
    ? (amount / selectedCryptoInfo.current_rate_usd).toFixed(8)
    : 0;
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black py-8 px-4" data-testid="crypto-payment-page">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/20 border border-orange-500/30 mb-4">
            <Bitcoin className="w-5 h-5 text-orange-400" />
            <span className="text-orange-400 font-bold">CRYPTO</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">{t.title}</h1>
          <p className="text-gray-400">{t.subtitle}</p>
        </div>
        
        {!payment ? (
          <>
            {/* Crypto Selection */}
            <div className="bg-gray-800/50 rounded-xl p-6 mb-6">
              <h3 className="text-white font-bold mb-4">{t.selectCrypto}</h3>
              <div className="grid grid-cols-5 gap-2">
                {cryptos.map(crypto => (
                  <button
                    key={crypto.code}
                    onClick={() => setSelectedCrypto(crypto.code)}
                    className={`p-4 rounded-xl border transition-all ${
                      selectedCrypto === crypto.code
                        ? 'bg-orange-500/20 border-orange-500'
                        : 'bg-gray-700/50 border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <span className="text-2xl block text-center">{cryptoIcons[crypto.code]}</span>
                    <span className="text-white text-sm font-bold block text-center mt-1">{crypto.code}</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Amount Input */}
            <div className="bg-gray-800/50 rounded-xl p-6 mb-6">
              <h3 className="text-white font-bold mb-4">{t.amount}</h3>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  min="5"
                  max="1000"
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white text-xl font-bold"
                />
                <span className="text-gray-400 text-xl">EUR</span>
              </div>
              
              {selectedCryptoInfo && (
                <p className="text-gray-400 mt-3">
                  {t.equivalent}: <span className="text-orange-400 font-bold">{cryptoAmount} {selectedCrypto}</span>
                </p>
              )}
            </div>
            
            {/* Create Payment Button */}
            <Button 
              onClick={createPayment}
              disabled={loading || !isAuthenticated}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-lg font-bold"
            >
              {loading ? t.processing : t.createPayment}
              <ArrowRight className="ml-2" />
            </Button>
            
            {/* Benefits */}
            <div className="grid grid-cols-3 gap-4 mt-8">
              <div className="text-center p-4">
                <Zap className="w-8 h-8 text-orange-400 mx-auto mb-2" />
                <p className="text-white text-sm">{t.benefits.fast}</p>
              </div>
              <div className="text-center p-4">
                <Shield className="w-8 h-8 text-orange-400 mx-auto mb-2" />
                <p className="text-white text-sm">{t.benefits.secure}</p>
              </div>
              <div className="text-center p-4">
                <Wallet className="w-8 h-8 text-orange-400 mx-auto mb-2" />
                <p className="text-white text-sm">{t.benefits.anonymous}</p>
              </div>
            </div>
          </>
        ) : (
          /* Payment Created - Show QR and Address */
          <div className="bg-gray-800/50 rounded-xl p-6">
            <div className="text-center mb-6">
              <Clock className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
              <p className="text-yellow-400 font-bold">
                {t.expiresIn}: {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')} {t.minutes}
              </p>
            </div>
            
            <div className="text-center mb-6">
              <p className="text-gray-400 mb-2">{t.sendExactly}</p>
              <p className="text-3xl font-bold text-orange-400">
                {payment.crypto_amount} {payment.crypto_code}
              </p>
              <p className="text-gray-500 text-sm">(€{payment.amount_eur})</p>
            </div>
            
            {/* QR Code */}
            <div className="flex justify-center mb-6">
              <div className="bg-white p-4 rounded-xl">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?data=${payment.wallet_address}&size=200x200`}
                  alt="QR Code"
                  className="w-48 h-48"
                />
              </div>
            </div>
            
            {/* Address */}
            <div className="mb-6">
              <p className="text-gray-400 text-sm mb-2 text-center">{t.toAddress}</p>
              <div className="flex items-center gap-2 bg-gray-700 rounded-lg p-3">
                <input 
                  type="text"
                  value={payment.wallet_address}
                  readOnly
                  className="flex-1 bg-transparent text-white text-sm font-mono"
                />
                <button 
                  onClick={copyAddress}
                  className="p-2 bg-gray-600 rounded-lg hover:bg-gray-500 transition-colors"
                >
                  {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5 text-white" />}
                </button>
              </div>
            </div>
            
            {/* Demo Button */}
            <Button 
              onClick={confirmDemo}
              variant="outline"
              className="w-full"
            >
              {t.demoButton}
            </Button>
            
            <p className="text-gray-500 text-xs text-center mt-4">
              Demo-Modus: Klicke oben um die Zahlung zu simulieren
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
