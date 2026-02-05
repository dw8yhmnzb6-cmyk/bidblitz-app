import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { CheckCircle, XCircle, Loader2, Zap, ArrowRight } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const { token, refreshUser } = useAuth();
  const [status, setStatus] = useState('loading');
  const [bidsAdded, setBidsAdded] = useState(0);
  const [attempts, setAttempts] = useState(0);

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
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Zahlung wird verarbeitet...</h1>
              <p className="text-gray-500 mb-4">Bitte warten Sie einen Moment</p>
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
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Zahlung erfolgreich!</h1>
              <p className="text-gray-500 mb-6">Ihre Gebote wurden Ihrem Konto gutgeschrieben</p>
              
              {bidsAdded > 0 && (
                <div className="flex items-center justify-center gap-3 p-4 rounded-lg bg-white mb-6">
                  <Zap className="w-8 h-8 text-[#F59E0B]" />
                  <div className="text-left">
                    <p className="text-gray-500 text-sm">Hinzugefügt</p>
                    <p className="text-2xl font-bold text-[#06B6D4]">+{bidsAdded} Gebote</p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <Link to="/auctions" className="block">
                  <Button className="w-full btn-primary py-3 h-auto" data-testid="go-to-auctions">
                    Jetzt bieten
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link to="/dashboard" className="block">
                  <Button variant="outline" className="w-full border-gray-200 text-gray-800 hover:bg-white/10">
                    Zum Dashboard
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
                {status === 'timeout' ? 'Zeitüberschreitung' : 'Zahlung fehlgeschlagen'}
              </h1>
              <p className="text-gray-500 mb-6">
                {status === 'timeout' 
                  ? 'Die Zahlungsüberprüfung hat zu lange gedauert. Bitte überprüfen Sie Ihr E-Mail-Postfach.'
                  : 'Die Zahlung konnte nicht verarbeitet werden. Bitte versuchen Sie es erneut.'
                }
              </p>

              <Link to="/buy-bids">
                <Button className="w-full btn-primary py-3 h-auto">
                  Erneut versuchen
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
