import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Slider } from '../components/ui/slider';
import { toast } from 'sonner';
import { Bot, Zap, Play, Pause, Settings, TrendingUp } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function BidBuddyPage() {
  const { language } = useLanguage();
  const { token } = useAuth();
  const [myBuddies, setMyBuddies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userBids, setUserBids] = useState(0);

  const texts = {
    de: {
      title: 'Bid Buddy',
      subtitle: 'Dein automatischer Bieter',
      description: 'Lass Bid Buddy für dich bieten, auch wenn du nicht online bist!',
      activeBuddies: 'Aktive Bid Buddies',
      noBuddies: 'Kein aktiver Bid Buddy. Aktiviere einen bei einer Auktion!',
      maxBids: 'Max. Gebote',
      bidsPlaced: 'Gebote platziert',
      remaining: 'Verbleibend',
      deactivate: 'Deaktivieren',
      howItWorks: 'So funktioniert es',
      step1: '1. Gehe zu einer Auktion',
      step2: '2. Klicke auf "Bid Buddy aktivieren"',
      step3: '3. Wähle max. Gebote & Preis',
      step4: '4. Bid Buddy bietet automatisch für dich!',
      yourBids: 'Deine Gebote'
    },
    en: {
      title: 'Bid Buddy',
      subtitle: 'Your automatic bidder',
      description: 'Let Bid Buddy bid for you, even when you\'re offline!',
      activeBuddies: 'Active Bid Buddies',
      noBuddies: 'No active Bid Buddy. Activate one at an auction!',
      maxBids: 'Max Bids',
      bidsPlaced: 'Bids Placed',
      remaining: 'Remaining',
      deactivate: 'Deactivate',
      howItWorks: 'How It Works',
      step1: '1. Go to an auction',
      step2: '2. Click "Activate Bid Buddy"',
      step3: '3. Choose max bids & price',
      step4: '4. Bid Buddy bids automatically for you!',
      yourBids: 'Your Bids'
    }
  };

  const t = texts[language] || texts.de;

  useEffect(() => {
    if (token) {
      fetchMyBuddies();
      fetchUserBids();
    }
  }, [token]);

  const fetchMyBuddies = async () => {
    try {
      const res = await fetch(`${API_URL}/api/bid-buddy/my-buddies`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setMyBuddies(data.bid_buddies || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const fetchUserBids = async () => {
    try {
      const res = await fetch(`${API_URL}/api/user/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setUserBids(data.bids || 0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeactivate = async (auctionId) => {
    try {
      const res = await fetch(`${API_URL}/api/bid-buddy/deactivate/${auctionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Bid Buddy deaktiviert');
        fetchMyBuddies();
      }
    } catch (err) {
      toast.error('Fehler');
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0D14] py-8 px-4" data-testid="bid-buddy-page">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#10B981] mb-4">
            <Bot className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">{t.title}</h1>
          <p className="text-xl text-[#7C3AED]">{t.subtitle}</p>
          <p className="text-[#94A3B8] mt-2">{t.description}</p>
        </div>

        {/* User Bids */}
        <Card className="bg-[#1A1A2E] border-white/10 mb-6">
          <CardContent className="p-4 flex items-center justify-between">
            <span className="text-[#94A3B8]">{t.yourBids}:</span>
            <Badge className="bg-[#10B981]/20 text-[#10B981] text-lg px-4 py-1">
              <Zap className="w-4 h-4 mr-1" />
              {userBids}
            </Badge>
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card className="bg-[#1A1A2E] border-white/10 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Settings className="w-5 h-5 mr-2 text-[#7C3AED]" />
              {t.howItWorks}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[t.step1, t.step2, t.step3, t.step4].map((step, i) => (
              <div key={i} className="flex items-center text-[#94A3B8]">
                <div className="w-8 h-8 rounded-full bg-[#7C3AED]/20 flex items-center justify-center mr-3">
                  <span className="text-[#7C3AED] font-bold">{i + 1}</span>
                </div>
                {step.substring(3)}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Active Buddies */}
        <Card className="bg-[#1A1A2E] border-white/10">
          <CardHeader>
            <CardTitle className="text-white">{t.activeBuddies}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-[#94A3B8]">Laden...</div>
            ) : myBuddies.length === 0 ? (
              <div className="text-center py-8 text-[#94A3B8]">{t.noBuddies}</div>
            ) : (
              <div className="space-y-4">
                {myBuddies.map((buddy) => (
                  <div key={buddy.id} className="bg-[#0D0D14] rounded-lg p-4 border border-white/5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center">
                        {buddy.auction?.product_image && (
                          <img 
                            src={buddy.auction.product_image} 
                            alt="" 
                            className="w-12 h-12 rounded-lg object-cover mr-3"
                          />
                        )}
                        <div>
                          <h3 className="text-white font-medium">{buddy.auction_name}</h3>
                          <p className="text-[#94A3B8] text-sm">
                            {buddy.auction?.current_price && `€${buddy.auction.current_price}`}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-[#10B981]/20 text-[#10B981]">
                        <Play className="w-3 h-3 mr-1" /> Aktiv
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div className="text-center">
                        <p className="text-[#94A3B8] text-xs">{t.maxBids}</p>
                        <p className="text-white font-bold">{buddy.max_bids}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[#94A3B8] text-xs">{t.bidsPlaced}</p>
                        <p className="text-white font-bold">{buddy.bids_placed}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[#94A3B8] text-xs">{t.remaining}</p>
                        <p className="text-[#10B981] font-bold">{buddy.remaining_bids}</p>
                      </div>
                    </div>
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDeactivate(buddy.auction_id)}
                      className="w-full border-red-500/30 text-red-500 hover:bg-red-500/10"
                    >
                      <Pause className="w-4 h-4 mr-2" />
                      {t.deactivate}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
