import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { 
  Trophy, CheckCircle, Package, Download, Home,
  Truck, FileText, PartyPopper
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const pageTexts = {
  de: {
    paymentSuccess: 'Zahlung erfolgreich!',
    thankYou: 'Vielen Dank für Ihre Zahlung',
    orderConfirmed: 'Ihre Bestellung wurde bestätigt',
    productInfo: 'Produktinformation',
    finalPrice: 'Endpreis',
    shipping: 'Versand',
    total: 'Gesamtbetrag',
    nextSteps: 'Nächste Schritte',
    step1: 'Sie erhalten eine Bestätigungs-E-Mail',
    step2: 'Ihr Produkt wird für den Versand vorbereitet',
    step3: 'Tracking-Informationen werden per E-Mail gesendet',
    downloadInvoice: 'Rechnung herunterladen',
    backToHome: 'Zurück zur Startseite',
    viewDashboard: 'Zum Dashboard',
    processing: 'Zahlung wird verarbeitet...',
    error: 'Fehler beim Laden der Zahlungsinformationen'
  },
  en: {
    paymentSuccess: 'Payment Successful!',
    thankYou: 'Thank you for your payment',
    orderConfirmed: 'Your order has been confirmed',
    productInfo: 'Product Information',
    finalPrice: 'Final Price',
    shipping: 'Shipping',
    total: 'Total',
    nextSteps: 'Next Steps',
    step1: 'You will receive a confirmation email',
    step2: 'Your product will be prepared for shipping',
    step3: 'Tracking information will be sent via email',
    downloadInvoice: 'Download Invoice',
    backToHome: 'Back to Home',
    viewDashboard: 'View Dashboard',
    processing: 'Processing payment...',
    error: 'Error loading payment information'
  }
};

export default function WonAuctionSuccess() {
  const { auctionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { language } = useLanguage();
  const t = pageTexts[language] || pageTexts.de;
  
  const [loading, setLoading] = useState(true);
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [error, setError] = useState(null);
  
  const sessionId = searchParams.get('session_id');
  
  useEffect(() => {
    if (sessionId && auctionId) {
      verifyPayment();
    } else {
      setLoading(false);
      setError('Keine Session-ID gefunden');
    }
  }, [sessionId, auctionId]);
  
  const verifyPayment = async () => {
    try {
      // Verify payment status with backend
      const response = await axios.get(
        `${API}/checkout/won-auction/${auctionId}/status?session_id=${sessionId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.payment_status === 'paid') {
        // Get full payment info
        const paymentResponse = await axios.get(
          `${API}/checkout/won-auction/${auctionId}/payment`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setPaymentInfo(paymentResponse.data);
        toast.success('🎉 ' + t.paymentSuccess);
      } else {
        setError('Zahlung noch nicht abgeschlossen');
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      setError(error.response?.data?.detail || t.error);
    } finally {
      setLoading(false);
    }
  };
  
  const downloadInvoice = async () => {
    try {
      const response = await axios.get(
        `${API}/invoices/auction-win/${auctionId}`,
        { 
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rechnung-${auctionId.slice(0, 8)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Rechnung heruntergeladen');
    } catch (error) {
      toast.error('Fehler beim Herunterladen der Rechnung');
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-900 to-emerald-900 pt-24 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-white border-t-transparent mx-auto mb-4" />
          <p className="text-white text-lg">{t.processing}</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 pt-24 px-4">
        <div className="max-w-md mx-auto text-center">
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
            <Package className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">{error}</h1>
          <Link to="/dashboard">
            <Button className="bg-cyan-500 hover:bg-cyan-600 text-white">
              {t.viewDashboard}
            </Button>
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-900 to-emerald-900 pt-20 pb-12 px-4">
      <div className="max-w-2xl mx-auto">
        
        {/* Success Animation */}
        <div className="text-center mb-8">
          <div className="relative inline-block">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-4 animate-bounce">
              <CheckCircle className="w-12 h-12 text-white" />
            </div>
            <PartyPopper className="w-8 h-8 text-yellow-400 absolute -top-2 -right-2 animate-pulse" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            🎉 {t.paymentSuccess}
          </h1>
          <p className="text-green-200">{t.thankYou}</p>
        </div>
        
        {/* Order Summary Card */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-white/20">
          <div className="flex items-center gap-2 text-green-300 mb-4">
            <Trophy className="w-5 h-5" />
            <span className="font-medium">{t.orderConfirmed}</span>
          </div>
          
          {paymentInfo && (
            <>
              {/* Product Info */}
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
                {paymentInfo.product_image ? (
                  <img 
                    src={paymentInfo.product_image} 
                    alt={paymentInfo.product_name}
                    className="w-20 h-20 bg-white rounded-lg object-contain p-2"
                  />
                ) : (
                  <div className="w-20 h-20 bg-white/10 rounded-lg flex items-center justify-center">
                    <Package className="w-8 h-8 text-white/50" />
                  </div>
                )}
                <div>
                  <h3 className="text-white font-bold text-lg">{paymentInfo.product_name}</h3>
                  {paymentInfo.retail_price > 0 && (
                    <p className="text-green-300 text-sm">
                      UVP: <span className="line-through">€{paymentInfo.retail_price.toFixed(2)}</span>
                    </p>
                  )}
                </div>
              </div>
              
              {/* Price Breakdown */}
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-white/80">
                  <span>{t.finalPrice}</span>
                  <span>€{paymentInfo.final_price?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-white/80">
                  <span>{t.shipping}</span>
                  <span>€{paymentInfo.shipping_cost?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-white font-bold text-lg pt-3 border-t border-white/10">
                  <span>{t.total}</span>
                  <span className="text-green-400">€{paymentInfo.total_amount?.toFixed(2)}</span>
                </div>
              </div>
              
              {/* Shipping Address */}
              {paymentInfo.shipping_address && (
                <div className="bg-white/5 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-2 text-white/80 mb-2">
                    <Truck className="w-4 h-4" />
                    <span className="text-sm font-medium">Lieferadresse</span>
                  </div>
                  <p className="text-white text-sm">
                    {paymentInfo.shipping_address.name}<br/>
                    {paymentInfo.shipping_address.street}<br/>
                    {paymentInfo.shipping_address.postal_code} {paymentInfo.shipping_address.city}<br/>
                    {paymentInfo.shipping_address.country}
                  </p>
                </div>
              )}
            </>
          )}
          
          {/* Download Invoice Button */}
          <Button
            onClick={downloadInvoice}
            variant="outline"
            className="w-full border-white/30 text-white hover:bg-white/10"
          >
            <FileText className="w-4 h-4 mr-2" />
            {t.downloadInvoice}
          </Button>
        </div>
        
        {/* Next Steps */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-white/10">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2">
            <Truck className="w-5 h-5 text-green-400" />
            {t.nextSteps}
          </h3>
          <div className="space-y-4">
            {[t.step1, t.step2, t.step3].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-400 text-sm font-bold">{i + 1}</span>
                </div>
                <p className="text-white/80 text-sm">{step}</p>
              </div>
            ))}
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link to="/dashboard" className="flex-1">
            <Button className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white">
              {t.viewDashboard}
            </Button>
          </Link>
          <Link to="/" className="flex-1">
            <Button variant="outline" className="w-full border-white/30 text-white hover:bg-white/10">
              <Home className="w-4 h-4 mr-2" />
              {t.backToHome}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
