import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { safeCopyToClipboard } from '../utils/clipboard';
import { Gift, Check, Copy, Mail, Download, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const pageTexts = {
  de: {
    errorLoading: 'Fehler beim Laden der Geschenkkarte',
    codeCopied: 'Code kopiert!',
    notFound: 'Geschenkkarte nicht gefunden',
    backToGiftcards: 'Zurück zu Geschenkkarten',
    purchaseSuccess: 'Kauf erfolgreich!',
    cardReady: 'Ihre Geschenkkarte ist bereit',
    giftCard: 'GESCHENKKARTE',
    giftcardCode: 'Geschenkkarten-Code',
    copyCode: 'Code kopieren',
    value: 'Wert',
    bids: 'Gebote',
    emailSent: 'E-Mail wurde an',
    sent: 'gesendet',
    buyAnother: 'Weitere Geschenkkarte kaufen',
    backToDashboard: 'Zurück zum Dashboard'
  },
  sq: {
    errorLoading: 'Gabim gjatë ngarkimit të kartës dhuratë',
    codeCopied: 'Kodi u kopjua!',
    notFound: 'Karta dhuratë nuk u gjet',
    backToGiftcards: 'Kthehu te kartat dhuratë',
    purchaseSuccess: 'Blerja u krye me sukses!',
    cardReady: 'Karta juaj dhuratë është gati',
    giftCard: 'KARTË DHURATË',
    giftcardCode: 'Kodi i kartës dhuratë',
    copyCode: 'Kopjo kodin',
    value: 'Vlera',
    bids: 'Oferta',
    emailSent: 'Email-i u dërgua te',
    sent: 'dërguar',
    buyAnother: 'Bli kartë tjetër dhuratë',
    backToDashboard: 'Kthehu te paneli'
  }
};

export default function GiftCardSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token } = useAuth();
  const { language } = useLanguage();
  const t = pageTexts[language] || pageTexts.de;
  
  const [loading, setLoading] = useState(true);
  const [giftcard, setGiftcard] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId && token) {
      checkStatus(sessionId);
    } else {
      setLoading(false);
    }
  }, [searchParams, token]);

  const checkStatus = async (sessionId) => {
    try {
      const response = await axios.get(
        `${API}/giftcards/purchase/status/${sessionId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.status === 'completed' && response.data.giftcard) {
        setGiftcard(response.data.giftcard);
      }
    } catch (error) {
      toast.error(t.errorLoading);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async () => {
    if (giftcard?.code) {
      const success = await safeCopyToClipboard(giftcard.code);
      if (success) {
        setCopied(true);
        toast.success(t.codeCopied);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#7C3AED]" />
      </div>
    );
  }

  if (!giftcard) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-800 text-xl mb-4">{t.notFound}</p>
          <Link to="/giftcards" className="text-[#7C3AED] hover:underline">
            {t.backToGiftcards}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-12 px-4" data-testid="giftcard-success-page">
      <div className="max-w-lg mx-auto">
        {/* Success Animation */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] flex items-center justify-center mx-auto mb-6 animate-bounce">
            <Check className="w-12 h-12 text-gray-800" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">{t.purchaseSuccess}</h1>
          <p className="text-gray-500">{t.cardReady}</p>
        </div>

        {/* Gift Card Display */}
        <div className="relative overflow-hidden rounded-2xl mb-8">
          {/* Card Background */}
          <div className="bg-gradient-to-br from-[#7C3AED] via-[#9333EA] to-[#F59E0B] p-1">
            <div className="bg-gradient-to-br from-[#1E1E2D] to-[#0F0F16] p-8 rounded-xl">
              {/* Logo */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <Gift className="w-8 h-8 text-[#F59E0B]" />
                  <span className="text-gray-800 font-bold text-xl">bidblitz.ae</span>
                </div>
                <span className="text-gray-500 text-sm">{t.giftCard}</span>
              </div>

              {/* Code */}
              <div className="text-center mb-8">
                <p className="text-gray-500 text-sm mb-2">{t.giftcardCode}</p>
                <div className="flex items-center justify-center gap-3">
                  <p className="font-mono text-2xl md:text-3xl font-bold text-gray-800 tracking-widest">
                    {giftcard.code}
                  </p>
                  <button
                    onClick={copyCode}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                    title={t.copyCode}
                  >
                    {copied ? (
                      <Check className="w-5 h-5 text-[#10B981]" />
                    ) : (
                      <Copy className="w-5 h-5 text-gray-800" />
                    )}
                  </button>
                </div>
              </div>

              {/* Value */}
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-gray-500 text-xs">{t.value}</p>
                  <p className="text-3xl font-bold text-gray-800">€{giftcard.amount}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-500 text-xs">{t.bids}</p>
                  <p className="text-3xl font-bold text-[#F59E0B]">{giftcard.bids_value}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Decorative Elements */}
          <div className="absolute top-4 right-4 w-20 h-20 bg-white/5 rounded-full blur-2xl" />
          <div className="absolute bottom-4 left-4 w-16 h-16 bg-[#F59E0B]/10 rounded-full blur-xl" />
        </div>

        {/* Info */}
        {giftcard.recipient_email && (
          <div className="flex items-center gap-3 p-4 bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl mb-6">
            <Mail className="w-5 h-5 text-[#10B981]" />
            <p className="text-[#10B981]">
              {t.emailSent} <strong>{giftcard.recipient_email}</strong> {t.sent}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-4">
          <Button
            onClick={copyCode}
            variant="outline"
            className="w-full border-[#3D3D4D] text-gray-800 hover:bg-[#2D2D3D] py-6"
          >
            <Copy className="w-5 h-5 mr-2" />
            {t.copyCode}
          </Button>

          <Link to="/giftcards" className="block">
            <Button className="w-full bg-gradient-to-r from-[#7C3AED] to-[#F59E0B] hover:opacity-90 text-gray-800 py-6">
              {t.buyAnother}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

          <Link to="/dashboard" className="block text-center">
            <span className="text-gray-500 hover:text-gray-800 transition-colors">
              {t.backToDashboard}
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
