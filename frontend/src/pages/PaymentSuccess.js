import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { CheckCircle, XCircle, Loader2, Zap, ArrowRight } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// PaymentSuccess translations
const paymentTexts = {
  de: {
    processing: 'Zahlung wird verarbeitet...',
    pleaseWait: 'Bitte warten Sie einen Moment',
    success: 'Zahlung erfolgreich!',
    bidsAdded: 'Ihre Gebote wurden Ihrem Konto gutgeschrieben',
    added: 'Hinzugefügt',
    bids: 'Gebote',
    bidNow: 'Jetzt bieten',
    toDashboard: 'Zum Dashboard',
    timeout: 'Zeitüberschreitung',
    failed: 'Zahlung fehlgeschlagen',
    timeoutDesc: 'Die Zahlungsüberprüfung hat zu lange gedauert. Bitte überprüfen Sie Ihr E-Mail-Postfach.',
    failedDesc: 'Die Zahlung konnte nicht verarbeitet werden. Bitte versuchen Sie es erneut.',
    tryAgain: 'Erneut versuchen'
  },
  en: {
    processing: 'Processing payment...',
    pleaseWait: 'Please wait a moment',
    success: 'Payment successful!',
    bidsAdded: 'Your bids have been added to your account',
    added: 'Added',
    bids: 'Bids',
    bidNow: 'Bid Now',
    toDashboard: 'Go to Dashboard',
    timeout: 'Timeout',
    failed: 'Payment failed',
    timeoutDesc: 'Payment verification took too long. Please check your email.',
    failedDesc: 'Payment could not be processed. Please try again.',
    tryAgain: 'Try again'
  },
  sq: {
    processing: 'Duke përpunuar pagesën...',
    pleaseWait: 'Ju lutem prisni një moment',
    success: 'Pagesa u krye me sukses!',
    bidsAdded: 'Ofertat tuaja u shtuan në llogarinë tuaj',
    added: 'Shtuar',
    bids: 'Oferta',
    bidNow: 'Ofertohu Tani',
    toDashboard: 'Shko në Dashboard',
    timeout: 'Kohëzgjatje',
    failed: 'Pagesa dështoi',
    timeoutDesc: 'Verifikimi i pagesës mori shumë kohë. Kontrolloni email-in tuaj.',
    failedDesc: 'Pagesa nuk mund të përpunohej. Provoni përsëri.',
    tryAgain: 'Provo përsëri'
  },
  xk: {
    processing: 'Duke përpunuar pagesën...',
    pleaseWait: 'Ju lutem prisni një moment',
    success: 'Pagesa u krye me sukses!',
    bidsAdded: 'Ofertat tuaja u shtuan në llogarinë tuaj',
    added: 'Shtuar',
    bids: 'Oferta',
    bidNow: 'Ofertohu Tani',
    toDashboard: 'Shko në Dashboard',
    timeout: 'Kohëzgjatje',
    failed: 'Pagesa dështoi',
    timeoutDesc: 'Verifikimi i pagesës mori shumë kohë. Kontrolloni email-in tuaj.',
    failedDesc: 'Pagesa nuk mund të përpunohej. Provoni përsëri.',
    tryAgain: 'Provo përsëri'
  },
  tr: {
    processing: 'Ödeme işleniyor...',
    pleaseWait: 'Lütfen bekleyin',
    success: 'Ödeme başarılı!',
    bidsAdded: 'Teklifleriniz hesabınıza eklendi',
    added: 'Eklendi',
    bids: 'Teklifler',
    bidNow: 'Şimdi Teklif Ver',
    toDashboard: 'Panele Git',
    timeout: 'Zaman Aşımı',
    failed: 'Ödeme başarısız',
    timeoutDesc: 'Ödeme doğrulaması çok uzun sürdü. E-postanızı kontrol edin.',
    failedDesc: 'Ödeme işlenemedi. Lütfen tekrar deneyin.',
    tryAgain: 'Tekrar dene'
  },
  fr: {
    processing: 'Traitement du paiement...',
    pleaseWait: 'Veuillez patienter',
    success: 'Paiement réussi!',
    bidsAdded: 'Vos enchères ont été ajoutées à votre compte',
    added: 'Ajouté',
    bids: 'Enchères',
    bidNow: 'Enchérir Maintenant',
    toDashboard: 'Aller au Tableau de Bord',
    timeout: 'Délai dépassé',
    failed: 'Paiement échoué',
    timeoutDesc: 'La vérification du paiement a pris trop de temps. Vérifiez votre email.',
    failedDesc: 'Le paiement n\'a pas pu être traité. Veuillez réessayer.',
    tryAgain: 'Réessayer'
  }
};

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const { token, refreshUser } = useAuth();
  const { language } = useLanguage();
  const [status, setStatus] = useState('loading');
  const [bidsAdded, setBidsAdded] = useState(0);
  const [attempts, setAttempts] = useState(0);
  
  const t = paymentTexts[language] || paymentTexts.de;

  useEffect(() => {
    if (sessionId && token) {
      pollPaymentStatus();
    }
  }, [sessionId, token]);

  const pollPaymentStatus = async () => {
    const maxAttempts = 10;
    const pollInterval = 2000;

    if (attempts >= maxAttempts) {
      setStatus('timeout');
      return;
    }

    try {
      const response = await axios.get(
        `${API}/checkout/status/${sessionId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.payment_status === 'paid') {
        setStatus('success');
        setBidsAdded(response.data.bids_added || 0);
        await refreshUser();
        return;
      } else if (response.data.status === 'expired') {
        setStatus('failed');
        return;
      }

      // Continue polling
      setAttempts(prev => prev + 1);
      setTimeout(pollPaymentStatus, pollInterval);
    } catch (error) {
      console.error('Error checking payment status:', error);
      setAttempts(prev => prev + 1);
      setTimeout(pollPaymentStatus, pollInterval);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center" data-testid="payment-success-page">
      <div className="max-w-md w-full">
        <div className="glass-card rounded-2xl p-8 text-center">
          {status === 'loading' && (
            <>
              <div className="w-20 h-20 rounded-full bg-[#7C3AED]/20 flex items-center justify-center mx-auto mb-6">
                <Loader2 className="w-10 h-10 text-[#7C3AED] animate-spin" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">{t.processing}</h1>
              <p className="text-gray-500 mb-4">{t.pleaseWait}</p>
              <div className="h-2 bg-white rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] transition-all duration-500"
                  style={{ width: `${(attempts / 10) * 100}%` }}
                />
              </div>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-20 h-20 rounded-full bg-[#10B981]/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-[#10B981]" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">{t.success}</h1>
              <p className="text-gray-500 mb-6">{t.bidsAdded}</p>
              
              {bidsAdded > 0 && (
                <div className="flex items-center justify-center gap-3 p-4 rounded-lg bg-white mb-6">
                  <Zap className="w-8 h-8 text-[#F59E0B]" />
                  <div className="text-left">
                    <p className="text-gray-500 text-sm">{t.added}</p>
                    <p className="text-2xl font-bold text-[#06B6D4]">+{bidsAdded} {t.bids}</p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <Link to="/auctions" className="block">
                  <Button className="w-full btn-primary py-3 h-auto" data-testid="go-to-auctions">
                    {t.bidNow}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link to="/dashboard" className="block">
                  <Button variant="outline" className="w-full border-gray-200 text-gray-800 hover:bg-white/10">
                    {t.toDashboard}
                  </Button>
                </Link>
              </div>
            </>
          )}

          {(status === 'failed' || status === 'timeout') && (
            <>
              <div className="w-20 h-20 rounded-full bg-[#EF4444]/20 flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-[#EF4444]" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">
                {status === 'timeout' ? t.timeout : t.failed}
              </h1>
              <p className="text-gray-500 mb-6">
                {status === 'timeout' ? t.timeoutDesc : t.failedDesc}
              </p>

              <Link to="/buy-bids">
                <Button className="w-full btn-primary py-3 h-auto">
                  {t.tryAgain}
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
