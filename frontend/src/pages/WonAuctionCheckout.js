import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { 
  Trophy, CreditCard, Clock, Package, CheckCircle, 
  AlertTriangle, ArrowLeft, Gift, Zap, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function WonAuctionCheckout() {
  const { auctionId } = useParams();
  const { token, user, refreshUser } = useAuth();
  const navigate = useNavigate();
  
  const [wonAuction, setWonAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('stripe');
  
  useEffect(() => {
    fetchWonAuction();
  }, [auctionId, token]);
  
  const fetchWonAuction = async () => {
    try {
      const response = await axios.get(`${API}/won-auctions/${auctionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWonAuction(response.data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Gewonnene Auktion nicht gefunden');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };
  
  const handlePayment = async () => {
    if (!wonAuction) return;
    
    setProcessing(true);
    
    try {
      // Check if this is a bid voucher (100 Gebote Gutschein)
      if (wonAuction.is_bid_voucher) {
        // For bid vouchers, directly credit the bids
        const response = await axios.post(
          `${API}/won-auctions/${auctionId}/claim-bids`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        toast.success(`🎉 ${response.data.bids_credited} Gebote wurden gutgeschrieben!`);
        refreshUser();
        navigate('/dashboard');
        return;
      }
      
      // For physical products, redirect to Stripe
      const response = await axios.post(
        `${API}/won-auctions/${auctionId}/checkout`,
        { payment_method: paymentMethod },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.checkout_url) {
        window.location.href = response.data.checkout_url;
      } else {
        toast.success('Zahlung erfolgreich!');
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Zahlung fehlgeschlagen');
    } finally {
      setProcessing(false);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-cyan-500 border-t-transparent" />
      </div>
    );
  }
  
  if (!wonAuction) {
    return (
      <div className="min-h-screen pt-24 px-4 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Auktion nicht gefunden</h1>
          <p className="text-gray-400 mb-6">Diese gewonnene Auktion existiert nicht oder gehört nicht zu Ihrem Konto.</p>
          <Link to="/dashboard">
            <Button className="btn-primary">Zurück zum Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }
  
  const isBidVoucher = wonAuction.is_bid_voucher || wonAuction.product_name?.includes('Gebote');
  const isPaid = wonAuction.status === 'paid' || wonAuction.paid;
  const savings = (wonAuction.retail_price || 0) - (wonAuction.final_price || 0);
  const savingsPercent = wonAuction.retail_price > 0 
    ? Math.round((savings / wonAuction.retail_price) * 100) 
    : 0;
  
  return (
    <div className="min-h-screen pt-24 pb-12 px-4" data-testid="won-checkout-page">
      <div className="max-w-2xl mx-auto">
        {/* Back Button */}
        <Link to="/dashboard" className="inline-flex items-center text-gray-400 hover:text-white mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück zum Dashboard
        </Link>
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            🎉 Herzlichen Glückwunsch!
          </h1>
          <p className="text-gray-400">
            Sie haben diese Auktion gewonnen
          </p>
        </div>
        
        {/* Product Card */}
        <div className="glass-card rounded-2xl overflow-hidden mb-6">
          {/* Product Image & Info */}
          <div className="p-6">
            <div className="flex gap-6">
              <div className="w-32 h-32 bg-white rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                {isBidVoucher ? (
                  <div className="text-center">
                    <Zap className="w-12 h-12 text-cyan-500 mx-auto" />
                    <span className="text-2xl font-black text-gray-800">100</span>
                  </div>
                ) : (
                  <img 
                    src={wonAuction.product_image || 'https://via.placeholder.com/128'} 
                    alt={wonAuction.product_name}
                    className="max-w-full max-h-full object-contain p-2"
                  />
                )}
              </div>
              
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white mb-2">
                  {wonAuction.product_name}
                </h2>
                
                {!isBidVoucher && (
                  <p className="text-gray-400 text-sm mb-3">
                    UVP: <span className="line-through">€ {wonAuction.retail_price?.toFixed(2)}</span>
                  </p>
                )}
                
                {/* Savings Badge */}
                {!isBidVoucher && savings > 0 && (
                  <div className="inline-flex items-center gap-2 bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">
                    <CheckCircle className="w-4 h-4" />
                    Sie sparen € {savings.toFixed(2)} ({savingsPercent}%)
                  </div>
                )}
                
                {isBidVoucher && (
                  <div className="bg-cyan-500/20 text-cyan-400 px-4 py-2 rounded-lg">
                    <p className="font-bold">🎁 100 Gratis-Gebote</p>
                    <p className="text-sm">Werden sofort Ihrem Konto gutgeschrieben!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Price Box */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">
                  {isBidVoucher ? 'Preis (GRATIS gewonnen)' : 'Ihr Endpreis'}
                </p>
                <p className="text-4xl font-black text-white">
                  {isBidVoucher ? 'GRATIS' : `€ ${wonAuction.final_price?.toFixed(2)}`}
                </p>
              </div>
              
              {isPaid && (
                <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full">
                  <CheckCircle className="w-5 h-5 text-white" />
                  <span className="text-white font-bold">Bezahlt</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Payment Section */}
        {!isPaid && (
          <>
            {/* Payment Info */}
            {!isBidVoucher && (
              <div className="glass-card rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-amber-500 mt-0.5" />
                  <div>
                    <p className="text-amber-500 font-medium">Zahlungsfrist</p>
                    <p className="text-gray-400 text-sm">
                      Bitte bezahlen Sie innerhalb von 7 Tagen, sonst verfällt Ihr Gewinn.
                    </p>
                    {wonAuction.payment_deadline && (
                      <p className="text-white font-bold mt-1">
                        Frist: {new Date(wonAuction.payment_deadline).toLocaleDateString('de-DE')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Payment Methods (only for non-bid-voucher) */}
            {!isBidVoucher && (
              <div className="glass-card rounded-xl p-6 mb-6">
                <h3 className="text-white font-bold mb-4">Zahlungsmethode</h3>
                
                <div className="space-y-3">
                  <label className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${paymentMethod === 'stripe' ? 'border-cyan-500 bg-cyan-500/10' : 'border-white/10 hover:border-white/30'}`}>
                    <input 
                      type="radio" 
                      name="payment" 
                      value="stripe"
                      checked={paymentMethod === 'stripe'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-5 h-5 text-cyan-500"
                    />
                    <CreditCard className="w-6 h-6 text-white" />
                    <div className="flex-1">
                      <p className="text-white font-medium">Kreditkarte / Debitkarte</p>
                      <p className="text-gray-400 text-sm">Visa, Mastercard, American Express</p>
                    </div>
                    <div className="flex gap-1">
                      <div className="w-8 h-5 bg-blue-600 rounded text-[8px] text-white flex items-center justify-center font-bold">VISA</div>
                      <div className="w-8 h-5 bg-red-500 rounded text-[8px] text-white flex items-center justify-center font-bold">MC</div>
                    </div>
                  </label>
                </div>
              </div>
            )}
            
            {/* Security Info */}
            <div className="flex items-center gap-3 text-gray-400 text-sm mb-6">
              <ShieldCheck className="w-5 h-5 text-green-500" />
              <span>Sichere Zahlung über Stripe - SSL verschlüsselt</span>
            </div>
            
            {/* Pay Button */}
            <Button
              onClick={handlePayment}
              disabled={processing}
              className="w-full py-4 text-lg font-bold bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400"
              data-testid="pay-button"
            >
              {processing ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  Wird verarbeitet...
                </span>
              ) : isBidVoucher ? (
                <span className="flex items-center gap-2">
                  <Gift className="w-5 h-5" />
                  100 Gebote jetzt abholen!
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Jetzt € {wonAuction.final_price?.toFixed(2)} bezahlen
                </span>
              )}
            </Button>
          </>
        )}
        
        {/* Already Paid */}
        {isPaid && (
          <div className="glass-card rounded-xl p-6 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Zahlung abgeschlossen!</h3>
            <p className="text-gray-400 mb-4">
              {isBidVoucher 
                ? 'Die 100 Gebote wurden Ihrem Konto gutgeschrieben.' 
                : 'Ihr Produkt wird in Kürze versandt.'}
            </p>
            <Link to="/dashboard">
              <Button variant="outline" className="border-white/20 text-white">
                Zurück zum Dashboard
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
