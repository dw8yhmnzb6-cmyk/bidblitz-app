import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { 
  Trophy, CreditCard, Clock, Package, CheckCircle, 
  AlertTriangle, ArrowLeft, Gift, Zap, ShieldCheck, Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import BNPLModal from '../components/BNPLModal';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const pageTexts = {
  de: {
    errorNotFound: 'Gewonnene Auktion nicht gefunden',
    bidsCredited: 'Gebote wurden gutgeschrieben!',
    paymentSuccess: 'Zahlung erfolgreich!',
    paymentFailed: 'Zahlung fehlgeschlagen',
    backToDashboard: 'Zurück zum Dashboard',
    auctionNotFound: 'Auktion nicht gefunden',
    notYourAuction: 'Diese gewonnene Auktion existiert nicht oder gehört nicht zu Ihrem Konto.',
    congratulations: 'Herzlichen Glückwunsch!',
    youWon: 'Sie haben diese Auktion gewonnen',
    rrp: 'UVP:',
    youSave: 'Sie sparen',
    freeBids: 'Gratis-Gebote',
    creditedImmediately: 'Werden sofort Ihrem Konto gutgeschrieben!',
    yourFinalPrice: 'Ihr Endpreis',
    priceFree: 'Preis (GRATIS gewonnen)',
    free: 'GRATIS',
    paid: 'Bezahlt',
    paymentDeadline: 'Zahlungsfrist',
    paymentDeadlineInfo: 'Bitte bezahlen Sie innerhalb von 7 Tagen, sonst verfällt Ihr Gewinn.',
    deadline: 'Frist:',
    paymentMethod: 'Zahlungsmethode',
    creditDebitCard: 'Kreditkarte / Debitkarte',
    cardTypes: 'Visa, Mastercard, American Express',
    securePayment: 'Sichere Zahlung über Stripe - SSL verschlüsselt',
    processing: 'Wird verarbeitet...',
    claimBids: '100 Gebote jetzt abholen!',
    payNow: 'Jetzt',
    pay: 'bezahlen',
    paymentComplete: 'Zahlung abgeschlossen!',
    bidsAddedToAccount: 'Die 100 Gebote wurden Ihrem Konto gutgeschrieben.',
    productWillShip: 'Ihr Produkt wird in Kürze versandt.'
  },
  sq: {
    errorNotFound: 'Ankandi i fituar nuk u gjet',
    bidsCredited: 'Ofertat u kredituan!',
    paymentSuccess: 'Pagesa u krye me sukses!',
    paymentFailed: 'Pagesa dështoi',
    backToDashboard: 'Kthehu te paneli',
    auctionNotFound: 'Ankandi nuk u gjet',
    notYourAuction: 'Ky ankand i fituar nuk ekziston ose nuk i përket llogarisë suaj.',
    congratulations: 'Urime!',
    youWon: 'Ju fituat këtë ankand',
    rrp: 'Çmimi i rekomanduar:',
    youSave: 'Ju kurseni',
    freeBids: 'Oferta falas',
    creditedImmediately: 'Do të kreditohen menjëherë në llogarinë tuaj!',
    yourFinalPrice: 'Çmimi juaj përfundimtar',
    priceFree: 'Çmimi (FITUAR FALAS)',
    free: 'FALAS',
    paid: 'Paguar',
    paymentDeadline: 'Afati i pagesës',
    paymentDeadlineInfo: 'Ju lutemi paguani brenda 7 ditëve, përndryshe fitimi juaj do të skadojë.',
    deadline: 'Afati:',
    paymentMethod: 'Metoda e pagesës',
    creditDebitCard: 'Kartë krediti / debiti',
    cardTypes: 'Visa, Mastercard, American Express',
    securePayment: 'Pagesë e sigurt përmes Stripe - e enkriptuar me SSL',
    processing: 'Duke u përpunuar...',
    claimBids: 'Merr 100 oferta tani!',
    payNow: 'Paguaj tani',
    pay: 'paguaj',
    paymentComplete: 'Pagesa u krye!',
    bidsAddedToAccount: '100 ofertat u shtuan në llogarinë tuaj.',
    productWillShip: 'Produkti juaj do të dërgohet së shpejti.'
  }
};

export default function WonAuctionCheckout() {
  const { auctionId } = useParams();
  const { token, user, refreshUser } = useAuth();
  const { language } = useLanguage();
  const t = pageTexts[language] || pageTexts.de;
  const navigate = useNavigate();
  
  const [wonAuction, setWonAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('stripe');
  const [showBNPLModal, setShowBNPLModal] = useState(false);
  
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
      toast.error(t.errorNotFound);
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
        
        toast.success(`🎉 ${response.data.bids_credited} ${t.bidsCredited}`);
        refreshUser();
        navigate('/dashboard');
        return;
      }
      
      // For physical products, create Stripe checkout session
      const response = await axios.post(
        `${API}/checkout/won-auction`,
        { 
          auction_id: auctionId,
          shipping_address: null // Will be collected by Stripe
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.url) {
        // Redirect to Stripe Checkout
        window.location.href = response.data.url;
      } else {
        toast.error(t.paymentFailed);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || t.paymentFailed);
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
          <h1 className="text-2xl font-bold text-white mb-2">{t.auctionNotFound}</h1>
          <p className="text-gray-400 mb-6">{t.notYourAuction}</p>
          <Link to="/dashboard">
            <Button className="btn-primary">{t.backToDashboard}</Button>
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
          {t.backToDashboard}
        </Link>
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            🎉 {t.congratulations}
          </h1>
          <p className="text-gray-400">
            {t.youWon}
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
                    {t.rrp} <span className="line-through">€ {wonAuction.retail_price?.toFixed(2)}</span>
                  </p>
                )}
                
                {/* Savings Badge */}
                {!isBidVoucher && savings > 0 && (
                  <div className="inline-flex items-center gap-2 bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">
                    <CheckCircle className="w-4 h-4" />
                    {t.youSave} € {savings.toFixed(2)} ({savingsPercent}%)
                  </div>
                )}
                
                {isBidVoucher && (
                  <div className="bg-cyan-500/20 text-cyan-400 px-4 py-2 rounded-lg">
                    <p className="font-bold">🎁 100 {t.freeBids}</p>
                    <p className="text-sm">{t.creditedImmediately}</p>
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
                  {isBidVoucher ? t.priceFree : t.yourFinalPrice}
                </p>
                <p className="text-4xl font-black text-white">
                  {isBidVoucher ? t.free : `€ ${wonAuction.final_price?.toFixed(2)}`}
                </p>
              </div>
              
              {isPaid && (
                <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full">
                  <CheckCircle className="w-5 h-5 text-white" />
                  <span className="text-white font-bold">{t.paid}</span>
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
                    <p className="text-amber-500 font-medium">{t.paymentDeadline}</p>
                    <p className="text-gray-400 text-sm">
                      {t.paymentDeadlineInfo}
                    </p>
                    {wonAuction.payment_deadline && (
                      <p className="text-white font-bold mt-1">
                        {t.deadline} {new Date(wonAuction.payment_deadline).toLocaleDateString('de-DE')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Payment Methods (only for non-bid-voucher) */}
            {!isBidVoucher && (
              <div className="glass-card rounded-xl p-6 mb-6">
                <h3 className="text-white font-bold mb-4">{t.paymentMethod}</h3>
                
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
                      <p className="text-white font-medium">{t.creditDebitCard}</p>
                      <p className="text-gray-400 text-sm">{t.cardTypes}</p>
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
              <span>{t.securePayment}</span>
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
                  {t.processing}
                </span>
              ) : isBidVoucher ? (
                <span className="flex items-center gap-2">
                  <Gift className="w-5 h-5" />
                  {t.claimBids}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  {t.payNow} € {wonAuction.final_price?.toFixed(2)} {t.pay}
                </span>
              )}
            </Button>
          </>
        )}
        
        {/* Already Paid */}
        {isPaid && (
          <div className="glass-card rounded-xl p-6 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">{t.paymentComplete}</h3>
            <p className="text-gray-400 mb-4">
              {isBidVoucher 
                ? t.bidsAddedToAccount 
                : t.productWillShip}
            </p>
            <Link to="/dashboard">
              <Button variant="outline" className="border-white/20 text-white">
                {t.backToDashboard}
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
