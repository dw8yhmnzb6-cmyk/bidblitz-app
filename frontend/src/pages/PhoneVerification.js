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
  de: {
    title: 'Telefon verifizieren',
    subtitle: 'Verifizieren Sie Ihre Telefonnummer und erhalten Sie 5 Gratis-Gebote!',
    phoneLabel: 'Telefonnummer',
    phonePlaceholder: '+49 123 456789',
    sendCode: 'Code senden',
    sending: 'Wird gesendet...',
    codeLabel: 'Verifizierungscode',
    codePlaceholder: '6-stelliger Code',
    verify: 'Verifizieren',
    verifying: 'Wird verifiziert...',
    resendCode: 'Code erneut senden',
    verified: 'Verifiziert',
    verifiedMessage: 'Ihre Telefonnummer ist verifiziert!',
    bonus: '+5 Gebote',
    benefits: [
      'Erhöhte Kontosicherheit',
      'Schnellere Auszahlungen',
      'SMS-Benachrichtigungen bei Auktionsende',
      '5 Gratis-Gebote als Dankeschön'
    ],
    mockModeNote: 'Test-Modus: Der Code wird unten angezeigt',
    codeExpires: 'Code läuft ab in',
    minutes: 'Minuten'
  },
  en: {
    title: 'Verify Phone',
    subtitle: 'Verify your phone number and get 5 free bids!',
    phoneLabel: 'Phone Number',
    phonePlaceholder: '+49 123 456789',
    sendCode: 'Send Code',
    sending: 'Sending...',
    codeLabel: 'Verification Code',
    codePlaceholder: '6-digit code',
    verify: 'Verify',
    verifying: 'Verifying...',
    resendCode: 'Resend Code',
    verified: 'Verified',
    verifiedMessage: 'Your phone number is verified!',
    bonus: '+5 Bids',
    benefits: [
      'Increased account security',
      'Faster payouts',
      'SMS notifications when auctions end',
      '5 free bids as a thank you'
    ],
    mockModeNote: 'Test mode: Code is shown below',
    codeExpires: 'Code expires in',
    minutes: 'minutes'
  }
};

export default function PhoneVerification() {
  const { token } = useAuth();
  const { language } = useLanguage();
  const t = translations[language] || translations.de;
  
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
