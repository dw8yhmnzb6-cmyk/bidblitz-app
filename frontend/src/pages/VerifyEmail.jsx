import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Mail, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [status, setStatus] = useState('loading'); // loading, success, already_verified, error
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Kein Verifizierungstoken gefunden');
        return;
      }

      try {
        const response = await axios.get(`${API}/auth/verify-email?token=${token}`);
        
        if (response.data.already_verified) {
          setStatus('already_verified');
          setMessage('Ihre E-Mail-Adresse wurde bereits bestätigt.');
        } else {
          setStatus('success');
          setMessage(response.data.message || 'E-Mail erfolgreich bestätigt!');
          setEmail(response.data.email || '');
        }
      } catch (error) {
        setStatus('error');
        setMessage(error.response?.data?.detail || 'Verifizierung fehlgeschlagen');
      }
    };

    verifyEmail();
  }, [token]);

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <>
            <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-4">E-Mail wird verifiziert...</h1>
            <p className="text-slate-400">Bitte warten Sie einen Moment.</p>
          </>
        );

      case 'success':
        return (
          <>
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-4">E-Mail bestätigt! 🎉</h1>
            <p className="text-slate-400 mb-2">{message}</p>
            {email && <p className="text-amber-400 mb-6">{email}</p>}
            <div className="space-y-3">
              <Button
                onClick={() => navigate('/kyc-verification')}
                className="w-full bg-amber-500 hover:bg-amber-600"
              >
                Weiter zur Identitätsverifizierung
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <p className="text-sm text-slate-500">
                Im nächsten Schritt laden Sie Ihren Ausweis hoch.
              </p>
            </div>
          </>
        );

      case 'already_verified':
        return (
          <>
            <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Mail className="w-10 h-10 text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-4">Bereits bestätigt</h1>
            <p className="text-slate-400 mb-6">{message}</p>
            <Button
              onClick={() => navigate('/login')}
              className="w-full bg-amber-500 hover:bg-amber-600"
            >
              Zum Login
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </>
        );

      case 'error':
        return (
          <>
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-4">Verifizierung fehlgeschlagen</h1>
            <p className="text-red-400 mb-6">{message}</p>
            <div className="space-y-3">
              <Button
                onClick={() => navigate('/login')}
                variant="outline"
                className="w-full border-slate-600 text-slate-300"
              >
                Zum Login
              </Button>
              <p className="text-sm text-slate-500">
                Melden Sie sich an, um einen neuen Verifizierungslink anzufordern.
              </p>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800/80 rounded-2xl p-8 max-w-md w-full text-center border border-slate-700/50 backdrop-blur-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-xl">⚡</span>
          </div>
          <span className="text-2xl font-bold text-white">BidBlitz</span>
        </div>
        
        {renderContent()}
      </div>
    </div>
  );
}
