import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Zap, Check, Sparkles, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function BuyBids() {
  const { isAuthenticated, token } = useAuth();
  const navigate = useNavigate();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const response = await axios.get(`${API}/bid-packages`);
      setPackages(response.data);
    } catch (error) {
      console.error('Error fetching packages:', error);
      toast.error('Fehler beim Laden der Pakete');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (packageId) => {
    if (!isAuthenticated) {
      toast.error('Bitte melden Sie sich an, um Gebote zu kaufen');
      navigate('/login');
      return;
    }

    setPurchasing(packageId);
    try {
      const response = await axios.post(
        `${API}/checkout/create-session`,
        {
          package_id: packageId,
          origin_url: window.location.origin
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Redirect to Stripe Checkout
      window.location.href = response.data.url;
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error(error.response?.data?.detail || 'Fehler beim Erstellen der Zahlung');
      setPurchasing(null);
    }
  };

  const getPackageFeatures = (pkg) => {
    const pricePerBid = (pkg.price / pkg.bids).toFixed(2);
    return [
      `${pkg.bids} Gebote`,
      `€${pricePerBid} pro Gebot`,
      'Sofort verfügbar',
      'Kein Ablaufdatum'
    ];
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4" data-testid="buy-bids-page">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#181824] border border-white/10 mb-6">
            <Sparkles className="w-4 h-4 text-[#F59E0B]" />
            <span className="text-sm text-[#94A3B8]">Beste Preise garantiert</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Gebote kaufen
          </h1>
          <p className="text-[#94A3B8] text-lg max-w-2xl mx-auto">
            Wählen Sie das passende Paket und starten Sie mit dem Bieten. Je mehr Gebote Sie kaufen, desto mehr sparen Sie!
          </p>
        </div>

        {/* Packages Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="glass-card rounded-2xl p-6 animate-pulse">
                <div className="h-8 bg-[#181824] rounded mb-4" />
                <div className="h-16 bg-[#181824] rounded mb-6" />
                <div className="space-y-3">
                  {[...Array(4)].map((_, j) => (
                    <div key={j} className="h-4 bg-[#181824] rounded" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className={`relative glass-card rounded-2xl p-6 transition-all hover:-translate-y-2 ${
                  pkg.popular ? 'border-2 border-[#7C3AED] glow-primary' : ''
                }`}
                data-testid={`package-${pkg.id}`}
              >
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="badge-popular">Beliebt</span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-white mb-2">{pkg.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-[#06B6D4] font-mono">
                      €{pkg.price.toFixed(0)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 py-4 mb-6 rounded-lg bg-[#181824]">
                  <Zap className="w-6 h-6 text-[#F59E0B]" />
                  <span className="text-2xl font-bold text-white">{pkg.bids}</span>
                  <span className="text-[#94A3B8]">Gebote</span>
                </div>

                <ul className="space-y-3 mb-6">
                  {getPackageFeatures(pkg).map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-[#94A3B8]">
                      <Check className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handlePurchase(pkg.id)}
                  disabled={purchasing === pkg.id}
                  className={`w-full py-3 h-auto ${
                    pkg.popular ? 'btn-bid' : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                  data-testid={`buy-${pkg.id}`}
                >
                  {purchasing === pkg.id ? (
                    'Wird geladen...'
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Jetzt kaufen
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Info Section */}
        <div className="mt-16 glass-card rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">Wie funktionieren Gebote?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#7C3AED]/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-[#7C3AED]">1</span>
              </div>
              <h3 className="font-bold text-white mb-2">Gebot platzieren</h3>
              <p className="text-[#94A3B8] text-sm">
                Jedes Mal, wenn Sie bieten, wird ein Gebot von Ihrem Konto abgezogen.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#06B6D4]/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-[#06B6D4]">2</span>
              </div>
              <h3 className="font-bold text-white mb-2">Preis erhöht sich</h3>
              <p className="text-[#94A3B8] text-sm">
                Der Auktionspreis steigt um wenige Cent und der Timer wird zurückgesetzt.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#10B981]/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-[#10B981]">3</span>
              </div>
              <h3 className="font-bold text-white mb-2">Gewinnen</h3>
              <p className="text-[#94A3B8] text-sm">
                Der letzte Bieter gewinnt das Produkt zum aktuellen Auktionspreis.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
