import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Phone, CheckCircle, Shield, Gift, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Translations
const translations = {
  de: { title: 'Telefon verifizieren', subtitle: 'Verifizieren Sie Ihre Telefonnummer und erhalten Sie 5 Gratis-Gebote!', phoneLabel: 'Telefonnummer', phonePlaceholder: '+49 123 456789', sendCode: 'Code senden', sending: 'Wird gesendet...', codeLabel: 'Verifizierungscode', codePlaceholder: '6-stelliger Code', verify: 'Verifizieren', verifying: 'Wird verifiziert...', resendCode: 'Code erneut senden', verified: 'Verifiziert', verifiedMessage: 'Ihre Telefonnummer ist verifiziert!', bonus: '+5 Gebote', benefits: ['Erhöhte Kontosicherheit', 'Schnellere Auszahlungen', 'SMS-Benachrichtigungen bei Auktionsende', '5 Gratis-Gebote als Dankeschön'], mockModeNote: 'Test-Modus: Der Code wird unten angezeigt', codeExpires: 'Code läuft ab in', minutes: 'Minuten' },
  en: { title: 'Verify Phone', subtitle: 'Verify your phone number and get 5 free bids!', phoneLabel: 'Phone Number', phonePlaceholder: '+49 123 456789', sendCode: 'Send Code', sending: 'Sending...', codeLabel: 'Verification Code', codePlaceholder: '6-digit code', verify: 'Verify', verifying: 'Verifying...', resendCode: 'Resend Code', verified: 'Verified', verifiedMessage: 'Your phone number is verified!', bonus: '+5 Bids', benefits: ['Increased account security', 'Faster payouts', 'SMS notifications when auctions end', '5 free bids as a thank you'], mockModeNote: 'Test mode: Code is shown below', codeExpires: 'Code expires in', minutes: 'minutes' },
  us: { title: 'Verify Phone', subtitle: 'Verify your phone number and get 5 free bids!', phoneLabel: 'Phone Number', phonePlaceholder: '+1 555 123456', sendCode: 'Send Code', sending: 'Sending...', codeLabel: 'Verification Code', codePlaceholder: '6-digit code', verify: 'Verify', verifying: 'Verifying...', resendCode: 'Resend Code', verified: 'Verified', verifiedMessage: 'Your phone number is verified!', bonus: '+5 Bids', benefits: ['Increased account security', 'Faster payouts', 'SMS notifications when auctions end', '5 free bids as a thank you'], mockModeNote: 'Test mode: Code is shown below', codeExpires: 'Code expires in', minutes: 'minutes' },
  fr: { title: 'Vérifier Téléphone', subtitle: 'Vérifiez votre numéro et obtenez 5 enchères gratuites!', phoneLabel: 'Numéro de téléphone', phonePlaceholder: '+33 123 456789', sendCode: 'Envoyer Code', sending: 'Envoi...', codeLabel: 'Code de vérification', codePlaceholder: 'Code à 6 chiffres', verify: 'Vérifier', verifying: 'Vérification...', resendCode: 'Renvoyer Code', verified: 'Vérifié', verifiedMessage: 'Votre numéro est vérifié!', bonus: '+5 Enchères', benefits: ['Sécurité du compte renforcée', 'Paiements plus rapides', 'Notifications SMS fin d\'enchère', '5 enchères gratuites en cadeau'], mockModeNote: 'Mode test: Code affiché ci-dessous', codeExpires: 'Le code expire dans', minutes: 'minutes' },
  es: { title: 'Verificar Teléfono', subtitle: '¡Verifica tu número y obtén 5 pujas gratis!', phoneLabel: 'Número de teléfono', phonePlaceholder: '+34 123 456789', sendCode: 'Enviar Código', sending: 'Enviando...', codeLabel: 'Código de verificación', codePlaceholder: 'Código de 6 dígitos', verify: 'Verificar', verifying: 'Verificando...', resendCode: 'Reenviar Código', verified: 'Verificado', verifiedMessage: '¡Tu número está verificado!', bonus: '+5 Pujas', benefits: ['Mayor seguridad de cuenta', 'Pagos más rápidos', 'Notificaciones SMS al finalizar subasta', '5 pujas gratis como regalo'], mockModeNote: 'Modo test: Código mostrado abajo', codeExpires: 'El código expira en', minutes: 'minutos' },
  it: { title: 'Verifica Telefono', subtitle: 'Verifica il tuo numero e ottieni 5 offerte gratis!', phoneLabel: 'Numero di telefono', phonePlaceholder: '+39 123 456789', sendCode: 'Invia Codice', sending: 'Invio...', codeLabel: 'Codice di verifica', codePlaceholder: 'Codice a 6 cifre', verify: 'Verifica', verifying: 'Verifica in corso...', resendCode: 'Reinvia Codice', verified: 'Verificato', verifiedMessage: 'Il tuo numero è verificato!', bonus: '+5 Offerte', benefits: ['Maggiore sicurezza account', 'Pagamenti più veloci', 'Notifiche SMS fine asta', '5 offerte gratuite in regalo'], mockModeNote: 'Modalità test: Codice mostrato sotto', codeExpires: 'Il codice scade tra', minutes: 'minuti' },
  pt: { title: 'Verificar Telefone', subtitle: 'Verifique seu número e ganhe 5 lances grátis!', phoneLabel: 'Número de telefone', phonePlaceholder: '+55 123 456789', sendCode: 'Enviar Código', sending: 'Enviando...', codeLabel: 'Código de verificação', codePlaceholder: 'Código de 6 dígitos', verify: 'Verificar', verifying: 'Verificando...', resendCode: 'Reenviar Código', verified: 'Verificado', verifiedMessage: 'Seu número está verificado!', bonus: '+5 Lances', benefits: ['Maior segurança da conta', 'Pagamentos mais rápidos', 'Notificações SMS ao finalizar leilão', '5 lances grátis como presente'], mockModeNote: 'Modo teste: Código mostrado abaixo', codeExpires: 'O código expira em', minutes: 'minutos' },
  nl: { title: 'Telefoon Verifiëren', subtitle: 'Verifieer je nummer en krijg 5 gratis biedingen!', phoneLabel: 'Telefoonnummer', phonePlaceholder: '+31 123 456789', sendCode: 'Code Verzenden', sending: 'Verzenden...', codeLabel: 'Verificatiecode', codePlaceholder: '6-cijferige code', verify: 'Verifiëren', verifying: 'Verifiëren...', resendCode: 'Code Opnieuw Verzenden', verified: 'Geverifieerd', verifiedMessage: 'Je nummer is geverifieerd!', bonus: '+5 Biedingen', benefits: ['Verhoogde accountbeveiliging', 'Snellere uitbetalingen', 'SMS-meldingen einde veiling', '5 gratis biedingen als cadeau'], mockModeNote: 'Testmodus: Code hieronder weergegeven', codeExpires: 'Code verloopt over', minutes: 'minuten' },
  pl: { title: 'Zweryfikuj Telefon', subtitle: 'Zweryfikuj numer i otrzymaj 5 darmowych ofert!', phoneLabel: 'Numer telefonu', phonePlaceholder: '+48 123 456789', sendCode: 'Wyślij Kod', sending: 'Wysyłanie...', codeLabel: 'Kod weryfikacyjny', codePlaceholder: '6-cyfrowy kod', verify: 'Zweryfikuj', verifying: 'Weryfikacja...', resendCode: 'Wyślij Ponownie', verified: 'Zweryfikowano', verifiedMessage: 'Twój numer jest zweryfikowany!', bonus: '+5 Ofert', benefits: ['Większe bezpieczeństwo konta', 'Szybsze wypłaty', 'Powiadomienia SMS po zakończeniu aukcji', '5 darmowych ofert w prezencie'], mockModeNote: 'Tryb testowy: Kod pokazany poniżej', codeExpires: 'Kod wygasa za', minutes: 'minut' },
  tr: { title: 'Telefon Doğrula', subtitle: 'Numaranı doğrula ve 5 ücretsiz teklif kazan!', phoneLabel: 'Telefon Numarası', phonePlaceholder: '+90 123 456789', sendCode: 'Kod Gönder', sending: 'Gönderiliyor...', codeLabel: 'Doğrulama Kodu', codePlaceholder: '6 haneli kod', verify: 'Doğrula', verifying: 'Doğrulanıyor...', resendCode: 'Kodu Tekrar Gönder', verified: 'Doğrulandı', verifiedMessage: 'Numaranız doğrulandı!', bonus: '+5 Teklif', benefits: ['Artırılmış hesap güvenliği', 'Daha hızlı ödemeler', 'Müzayede bitiminde SMS bildirimleri', 'Hediye olarak 5 ücretsiz teklif'], mockModeNote: 'Test modu: Kod aşağıda gösterilir', codeExpires: 'Kod süresi doluyor', minutes: 'dakika' },
  ru: { title: 'Подтвердить Телефон', subtitle: 'Подтвердите номер и получите 5 бесплатных ставок!', phoneLabel: 'Номер телефона', phonePlaceholder: '+7 123 456789', sendCode: 'Отправить Код', sending: 'Отправка...', codeLabel: 'Код подтверждения', codePlaceholder: '6-значный код', verify: 'Подтвердить', verifying: 'Проверка...', resendCode: 'Отправить Повторно', verified: 'Подтверждено', verifiedMessage: 'Ваш номер подтвержден!', bonus: '+5 Ставок', benefits: ['Повышенная безопасность аккаунта', 'Более быстрые выплаты', 'SMS-уведомления об окончании аукциона', '5 бесплатных ставок в подарок'], mockModeNote: 'Тестовый режим: Код показан ниже', codeExpires: 'Код истекает через', minutes: 'минут' },
  ar: { title: 'تأكيد الهاتف', subtitle: 'أكد رقمك واحصل على 5 عروض مجانية!', phoneLabel: 'رقم الهاتف', phonePlaceholder: '+971 123 456789', sendCode: 'إرسال الرمز', sending: 'جاري الإرسال...', codeLabel: 'رمز التحقق', codePlaceholder: 'رمز من 6 أرقام', verify: 'تأكيد', verifying: 'جاري التحقق...', resendCode: 'إعادة إرسال الرمز', verified: 'تم التأكيد', verifiedMessage: 'تم تأكيد رقمك!', bonus: '+5 عروض', benefits: ['أمان محسّن للحساب', 'سحب أسرع', 'إشعارات SMS عند انتهاء المزاد', '5 عروض مجانية كهدية'], mockModeNote: 'وضع الاختبار: الرمز معروض أدناه', codeExpires: 'الرمز ينتهي في', minutes: 'دقائق' },
  ae: { title: 'تأكيد الهاتف', subtitle: 'أكد رقمك واحصل على 5 عروض مجانية!', phoneLabel: 'رقم الهاتف', phonePlaceholder: '+971 123 456789', sendCode: 'إرسال الرمز', sending: 'جاري الإرسال...', codeLabel: 'رمز التحقق', codePlaceholder: 'رمز من 6 أرقام', verify: 'تأكيد', verifying: 'جاري التحقق...', resendCode: 'إعادة إرسال الرمز', verified: 'تم التأكيد', verifiedMessage: 'تم تأكيد رقمك!', bonus: '+5 عروض', benefits: ['أمان محسّن للحساب', 'سحب أسرع', 'إشعارات SMS عند انتهاء المزاد', '5 عروض مجانية كهدية'], mockModeNote: 'وضع الاختبار: الرمز معروض أدناه', codeExpires: 'الرمز ينتهي في', minutes: 'دقائق' },
  zh: { title: '验证手机', subtitle: '验证您的号码，获得5次免费出价！', phoneLabel: '电话号码', phonePlaceholder: '+86 123 456789', sendCode: '发送验证码', sending: '发送中...', codeLabel: '验证码', codePlaceholder: '6位数验证码', verify: '验证', verifying: '验证中...', resendCode: '重新发送', verified: '已验证', verifiedMessage: '您的号码已验证！', bonus: '+5 出价', benefits: ['增强账户安全', '更快提款', '拍卖结束时短信通知', '5次免费出价作为礼物'], mockModeNote: '测试模式：验证码显示在下方', codeExpires: '验证码过期于', minutes: '分钟' },
  ja: { title: '電話番号認証', subtitle: '番号を認証して5回の無料入札を獲得！', phoneLabel: '電話番号', phonePlaceholder: '+81 123 456789', sendCode: 'コード送信', sending: '送信中...', codeLabel: '認証コード', codePlaceholder: '6桁のコード', verify: '認証', verifying: '認証中...', resendCode: '再送信', verified: '認証済み', verifiedMessage: '電話番号が認証されました！', bonus: '+5 入札', benefits: ['アカウントセキュリティ強化', 'より速い出金', 'オークション終了時のSMS通知', 'プレゼントとして5回の無料入札'], mockModeNote: 'テストモード：コードは下に表示', codeExpires: 'コード有効期限', minutes: '分' },
  ko: { title: '전화번호 인증', subtitle: '번호를 인증하고 5번의 무료 입찰을 받으세요!', phoneLabel: '전화번호', phonePlaceholder: '+82 123 456789', sendCode: '코드 전송', sending: '전송 중...', codeLabel: '인증 코드', codePlaceholder: '6자리 코드', verify: '인증', verifying: '인증 중...', resendCode: '코드 재전송', verified: '인증됨', verifiedMessage: '전화번호가 인증되었습니다!', bonus: '+5 입찰', benefits: ['계정 보안 강화', '더 빠른 출금', '경매 종료 시 SMS 알림', '선물로 5번의 무료 입찰'], mockModeNote: '테스트 모드: 코드가 아래 표시됨', codeExpires: '코드 만료', minutes: '분' },
  hi: { title: 'फोन सत्यापित करें', subtitle: 'अपना नंबर सत्यापित करें और 5 मुफ्त बोलियां पाएं!', phoneLabel: 'फोन नंबर', phonePlaceholder: '+91 123 456789', sendCode: 'कोड भेजें', sending: 'भेज रहे हैं...', codeLabel: 'सत्यापन कोड', codePlaceholder: '6-अंकीय कोड', verify: 'सत्यापित करें', verifying: 'सत्यापित हो रहा है...', resendCode: 'कोड दोबारा भेजें', verified: 'सत्यापित', verifiedMessage: 'आपका नंबर सत्यापित है!', bonus: '+5 बोलियां', benefits: ['बढ़ी हुई खाता सुरक्षा', 'तेज़ निकासी', 'नीलामी समाप्त होने पर SMS सूचनाएं', 'उपहार के रूप में 5 मुफ्त बोलियां'], mockModeNote: 'टेस्ट मोड: कोड नीचे दिखाया गया है', codeExpires: 'कोड समाप्त होता है', minutes: 'मिनट' },
  sq: { title: 'Verifiko Telefonin', subtitle: 'Verifiko numrin dhe merr 5 oferta falas!', phoneLabel: 'Numri i telefonit', phonePlaceholder: '+355 123 456789', sendCode: 'Dërgo Kodin', sending: 'Duke dërguar...', codeLabel: 'Kodi i verifikimit', codePlaceholder: 'Kod 6-shifror', verify: 'Verifiko', verifying: 'Duke verifikuar...', resendCode: 'Ridërgo Kodin', verified: 'Verifikuar', verifiedMessage: 'Numri juaj është verifikuar!', bonus: '+5 Oferta', benefits: ['Siguri e rritur e llogarisë', 'Pagesa më të shpejta', 'Njoftime SMS kur përfundon ankandi', '5 oferta falas si dhuratë'], mockModeNote: 'Modaliteti test: Kodi tregohet më poshtë', codeExpires: 'Kodi skadon për', minutes: 'minuta' },
  xk: { title: 'Verifiko Telefonin', subtitle: 'Verifiko numrin dhe merr 5 oferta falas!', phoneLabel: 'Numri i telefonit', phonePlaceholder: '+383 123 456789', sendCode: 'Dërgo Kodin', sending: 'Duke dërguar...', codeLabel: 'Kodi i verifikimit', codePlaceholder: 'Kod 6-shifror', verify: 'Verifiko', verifying: 'Duke verifikuar...', resendCode: 'Ridërgo Kodin', verified: 'Verifikuar', verifiedMessage: 'Numri juaj është verifikuar!', bonus: '+5 Oferta', benefits: ['Siguri e rritur e llogarisë', 'Pagesa më të shpejta', 'Njoftime SMS kur përfundon ankandi', '5 oferta falas si dhuratë'], mockModeNote: 'Modaliteti test: Kodi tregohet më poshtë', codeExpires: 'Kodi skadon për', minutes: 'minuta' },
  cs: { title: 'Ověřit telefon', subtitle: 'Ověřte číslo a získejte 5 nabídek zdarma!', phoneLabel: 'Telefonní číslo', phonePlaceholder: '+420 123 456789', sendCode: 'Odeslat kód', sending: 'Odesílání...', codeLabel: 'Ověřovací kód', codePlaceholder: '6místný kód', verify: 'Ověřit', verifying: 'Ověřování...', resendCode: 'Odeslat znovu', verified: 'Ověřeno', verifiedMessage: 'Vaše číslo je ověřeno!', bonus: '+5 Nabídek', benefits: ['Zvýšená bezpečnost účtu', 'Rychlejší výběry', 'SMS upozornění po skončení aukce', '5 nabídek zdarma jako dárek'], mockModeNote: 'Testovací režim: Kód zobrazen níže', codeExpires: 'Kód vyprší za', minutes: 'minut' },
  sv: { title: 'Verifiera telefon', subtitle: 'Verifiera ditt nummer och få 5 gratis bud!', phoneLabel: 'Telefonnummer', phonePlaceholder: '+46 123 456789', sendCode: 'Skicka kod', sending: 'Skickar...', codeLabel: 'Verifieringskod', codePlaceholder: '6-siffrig kod', verify: 'Verifiera', verifying: 'Verifierar...', resendCode: 'Skicka igen', verified: 'Verifierad', verifiedMessage: 'Ditt nummer är verifierat!', bonus: '+5 Bud', benefits: ['Ökad kontosäkerhet', 'Snabbare uttag', 'SMS-aviseringar vid auktionsslut', '5 gratis bud som present'], mockModeNote: 'Testläge: Kod visas nedan', codeExpires: 'Koden går ut om', minutes: 'minuter' },
  da: { title: 'Verificer telefon', subtitle: 'Verificer dit nummer og få 5 gratis bud!', phoneLabel: 'Telefonnummer', phonePlaceholder: '+45 123 456789', sendCode: 'Send kode', sending: 'Sender...', codeLabel: 'Verifikationskode', codePlaceholder: '6-cifret kode', verify: 'Verificer', verifying: 'Verificerer...', resendCode: 'Send igen', verified: 'Verificeret', verifiedMessage: 'Dit nummer er verificeret!', bonus: '+5 Bud', benefits: ['Øget kontosikkerhed', 'Hurtigere udbetalinger', 'SMS-notifikationer ved auktionsslut', '5 gratis bud som gave'], mockModeNote: 'Testtilstand: Kode vises nedenfor', codeExpires: 'Koden udløber om', minutes: 'minutter' },
  fi: { title: 'Vahvista puhelin', subtitle: 'Vahvista numerosi ja saa 5 ilmaista tarjousta!', phoneLabel: 'Puhelinnumero', phonePlaceholder: '+358 123 456789', sendCode: 'Lähetä koodi', sending: 'Lähetetään...', codeLabel: 'Vahvistuskoodi', codePlaceholder: '6-numeroinen koodi', verify: 'Vahvista', verifying: 'Vahvistetaan...', resendCode: 'Lähetä uudelleen', verified: 'Vahvistettu', verifiedMessage: 'Numerosi on vahvistettu!', bonus: '+5 Tarjousta', benefits: ['Parannettu tilin turvallisuus', 'Nopeammat nostot', 'SMS-ilmoitukset huutokaupan päättyessä', '5 ilmaista tarjousta lahjaksi'], mockModeNote: 'Testitila: Koodi näkyy alla', codeExpires: 'Koodi vanhenee', minutes: 'minuuttia' },
  el: { title: 'Επαλήθευση τηλεφώνου', subtitle: 'Επαληθεύστε το νούμερο και κερδίστε 5 δωρεάν προσφορές!', phoneLabel: 'Τηλέφωνο', phonePlaceholder: '+30 123 456789', sendCode: 'Αποστολή κωδικού', sending: 'Αποστολή...', codeLabel: 'Κωδικός επαλήθευσης', codePlaceholder: '6ψήφιος κωδικός', verify: 'Επαλήθευση', verifying: 'Επαληθεύεται...', resendCode: 'Επαναποστολή', verified: 'Επαληθεύτηκε', verifiedMessage: 'Το νούμερό σας επαληθεύτηκε!', bonus: '+5 Προσφορές', benefits: ['Αυξημένη ασφάλεια λογαριασμού', 'Ταχύτερες αναλήψεις', 'Ειδοποιήσεις SMS στο τέλος δημοπρασίας', '5 δωρεάν προσφορές ως δώρο'], mockModeNote: 'Λειτουργία δοκιμής: Ο κωδικός εμφανίζεται παρακάτω', codeExpires: 'Ο κωδικός λήγει σε', minutes: 'λεπτά' }
};

export default function PhoneVerification() {
  const { token } = useAuth();
  const { language , mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const t = translations[langKey] || translations.de;
  
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('phone'); // phone, code, verified
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [mockCode, setMockCode] = useState(null);
  const [countdown, setCountdown] = useState(0);

  // Fetch verification status
  useEffect(() => {
    if (token) {
      fetchStatus();
    }
  }, [token]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const fetchStatus = async () => {
    try {
      const res = await axios.get(`${API}/phone/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus(res.data);
      if (res.data.verified) {
        setStep('verified');
      }
    } catch (error) {
      console.error('Error fetching phone status:', error);
    }
  };

  const handleSendCode = async (e) => {
    e.preventDefault();
    if (!phone.trim()) {
      toast.error('Bitte Telefonnummer eingeben');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API}/phone/send-code`, {
        phone_number: phone
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(res.data.message);
      setStep('code');
      setCountdown(res.data.expires_in_minutes * 60);
      
      if (res.data.mock_mode && res.data.mock_code) {
        setMockCode(res.data.mock_code);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Senden');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!code.trim() || code.length !== 6) {
      toast.error('Bitte 6-stelligen Code eingeben');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API}/phone/verify`, {
        phone_number: phone,
        code: code
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(res.data.message);
      setStep('verified');
      fetchStatus();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ungültiger Code');
    } finally {
      setLoading(false);
    }
  };

  const formatCountdown = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 pt-20 pb-12 px-4">
        <div className="max-w-md mx-auto text-center">
          <Phone className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-800">Bitte anmelden um fortzufahren</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 pt-20 pb-12 px-4" data-testid="phone-verification-page">
      <div className="max-w-md mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-[#7C3AED] to-[#06B6D4] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Phone className="w-10 h-10 text-gray-800" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{t.title}</h1>
          <p className="text-gray-500">{t.subtitle}</p>
        </div>

        {/* Benefits */}
        <div className="glass-card rounded-xl p-4 mb-6">
          <h3 className="text-gray-800 font-medium mb-3 flex items-center gap-2">
            <Gift className="w-5 h-5 text-[#FFD700]" />
            {t.bonus}
          </h3>
          <ul className="space-y-2">
            {t.benefits.map((benefit, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-gray-500">
                <CheckCircle className="w-4 h-4 text-[#10B981]" />
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        {/* Verification Form */}
        <div className="glass-card rounded-xl p-6">
          
          {/* Step: Phone */}
          {step === 'phone' && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label className="block text-gray-800 text-sm font-medium mb-2">
                  {t.phoneLabel}
                </label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t.phonePlaceholder}
                  className="bg-white/5 border-gray-200 text-gray-800"
                  data-testid="phone-input"
                />
              </div>
              <Button
                type="submit"
                disabled={loading || !phone.trim()}
                className="w-full btn-primary"
                data-testid="send-code-btn"
              >
                {loading ? t.sending : t.sendCode}
              </Button>
            </form>
          )}

          {/* Step: Code */}
          {step === 'code' && (
            <form onSubmit={handleVerify} className="space-y-4">
              {/* Mock Mode Notice */}
              {mockCode && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2 text-yellow-500 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {t.mockModeNote}
                  </div>
                  <div className="text-2xl font-mono text-gray-800 mt-2 text-center">
                    {mockCode}
                  </div>
                </div>
              )}

              {/* Countdown */}
              {countdown > 0 && (
                <div className="text-center text-gray-500 text-sm mb-2">
                  {t.codeExpires}: <span className="text-gray-800 font-mono">{formatCountdown(countdown)}</span>
                </div>
              )}

              <div>
                <label className="block text-gray-800 text-sm font-medium mb-2">
                  {t.codeLabel}
                </label>
                <Input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder={t.codePlaceholder}
                  className="bg-white/5 border-gray-200 text-gray-800 text-center text-2xl tracking-widest"
                  maxLength={6}
                  data-testid="code-input"
                />
              </div>
              
              <Button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full btn-primary"
                data-testid="verify-btn"
              >
                {loading ? t.verifying : t.verify}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep('phone');
                  setCode('');
                  setMockCode(null);
                }}
                className="w-full text-gray-500"
              >
                {t.resendCode}
              </Button>
            </form>
          )}

          {/* Step: Verified */}
          {step === 'verified' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-[#10B981]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-[#10B981]" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">{t.verified}</h3>
              <p className="text-gray-500 mb-4">{t.verifiedMessage}</p>
              {status?.phone_masked && (
                <div className="flex items-center justify-center gap-2 text-gray-500">
                  <Phone className="w-4 h-4" />
                  {status.phone_masked}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Security Note */}
        <div className="flex items-center justify-center gap-2 mt-6 text-gray-500 text-sm">
          <Shield className="w-4 h-4" />
          <span>SSL-verschlüsselt • DSGVO-konform</span>
        </div>
      </div>
    </div>
  );
}
