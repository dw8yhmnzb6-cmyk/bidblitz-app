import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { ShoppingBag, Percent, Clock, ArrowRight, Tag } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function BuyItNowPage() {
  const { language } = useLanguage();
  const { token } = useAuth();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  const texts = {
    de: {
      title: 'Buy It Now',
      subtitle: 'Kaufe mit deinem Gebot-Guthaben',
      description: 'Deine Gebote werden als Rabatt angerechnet!',
      noOffers: 'Keine Angebote verfügbar',
      noOffersDesc: 'Nimm an Auktionen teil um Buy It Now Angebote zu erhalten!',
      retailPrice: 'UVP',
      yourBids: 'Deine Gebote',
      bidCredit: 'Gebot-Guthaben',
      finalPrice: 'Dein Preis',
      validUntil: 'Gültig bis',
      buyNow: 'Jetzt kaufen',
      savings: 'Du sparst'
    },
    en: {
      title: 'Buy It Now',
      subtitle: 'Buy with your bid credit',
      description: 'Your bids count as discount!',
      noOffers: 'No offers available',
      noOffersDesc: 'Participate in auctions to get Buy It Now offers!',
      retailPrice: 'Retail',
      yourBids: 'Your Bids',
      bidCredit: 'Bid Credit',
      finalPrice: 'Your Price',
      validUntil: 'Valid until',
      buyNow: 'Buy Now',
      savings: 'You save'
    }
  };

  const t = texts[language] || texts.de;

  useEffect(() => {
    if (token) fetchOffers();
  }, [token]);

  const fetchOffers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/buy-it-now/offers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setOffers(data.offers || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handlePurchase = async (auctionId) => {
    try {
      const res = await fetch(`${API_URL}/api/buy-it-now/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ auction_id: auctionId, use_bid_credit: true })
      });
      const data = await res.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        toast.error(data.detail || 'Fehler');
      }
    } catch (err) {
      toast.error('Fehler beim Kauf');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4" data-testid="buy-it-now-page">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#F59E0B] to-[#EF4444] mb-4">
            <ShoppingBag className="w-10 h-10 text-gray-800" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">{t.title}</h1>
          <p className="text-xl text-[#F59E0B]">{t.subtitle}</p>
          <p className="text-gray-500 mt-2">{t.description}</p>
        </div>

        {/* Info Banner */}
        <Card className="bg-gradient-to-r from-[#F59E0B]/20 to-[#EF4444]/20 border-[#F59E0B]/30 mb-6">
          <CardContent className="p-4 flex items-center">
            <Tag className="w-8 h-8 text-[#F59E0B] mr-4" />
            <div>
              <p className="text-gray-800 font-medium">Jedes Gebot = €0,50 Guthaben</p>
              <p className="text-gray-500 text-sm">Deine platzierten Gebote werden als Rabatt auf den Kaufpreis angerechnet!</p>
            </div>
          </CardContent>
        </Card>

        {/* Offers */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Laden...</div>
        ) : offers.length === 0 ? (
          <Card className="bg-[#1A1A2E] border-gray-200">
            <CardContent className="p-8 text-center">
              <ShoppingBag className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-gray-800 text-xl mb-2">{t.noOffers}</h3>
              <p className="text-gray-500">{t.noOffersDesc}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {offers.map((offer) => (
              <Card key={offer.auction_id} className="bg-[#1A1A2E] border-gray-200 overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row">
                    {/* Image */}
                    <div className="w-full md:w-48 h-48 bg-white/5">
                      {offer.product_image && (
                        <img 
                          src={offer.product_image} 
                          alt={offer.product_name}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 p-4">
                      <h3 className="text-gray-800 text-lg font-bold mb-3">{offer.product_name}</h3>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        <div>
                          <p className="text-gray-500 text-xs">{t.retailPrice}</p>
                          <p className="text-gray-800 line-through">€{offer.retail_price}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">{t.yourBids}</p>
                          <p className="text-gray-800">{offer.bids_placed} Gebote</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">{t.bidCredit}</p>
                          <p className="text-[#10B981]">-€{offer.applied_credit}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">{t.finalPrice}</p>
                          <p className="text-[#F59E0B] text-xl font-bold">€{offer.final_price}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-gray-500 text-sm">
                          <Clock className="w-4 h-4 mr-1" />
                          {t.validUntil}: {new Date(offer.valid_until).toLocaleDateString()}
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <Badge className="bg-[#10B981]/20 text-[#10B981]">
                            <Percent className="w-3 h-3 mr-1" />
                            {t.savings} {offer.savings_percent}%
                          </Badge>
                          <Button 
                            onClick={() => handlePurchase(offer.auction_id)}
                            className="bg-gradient-to-r from-[#F59E0B] to-[#EF4444]"
                          >
                            {t.buyNow}
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
