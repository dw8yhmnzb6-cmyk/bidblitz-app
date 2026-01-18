import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { languageList } from '../i18n/translations';
import { AuctionCard } from '../components/AuctionCard';
import { Button } from '../components/ui/button';
import { Zap, Trophy, Clock, Shield, ArrowRight, Sparkles, Globe } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Home() {
  const { isAuthenticated, token, updateBidsBalance } = useAuth();
  const { language, changeLanguage } = useLanguage();
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllLanguages, setShowAllLanguages] = useState(false);

  useEffect(() => {
    fetchAuctions();
    const interval = setInterval(fetchAuctions, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchAuctions = async () => {
    try {
      const response = await axios.get(`${API}/auctions?status=active`);
      setAuctions(response.data.slice(0, 4));
    } catch (error) {
      console.error('Error fetching auctions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBid = async (auctionId) => {
    if (!isAuthenticated) {
      toast.error('Bitte melden Sie sich an, um zu bieten');
      return;
    }

    try {
      const response = await axios.post(
        `${API}/auctions/${auctionId}/bid`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Gebot erfolgreich platziert!');
      updateBidsBalance(response.data.bids_remaining);
      fetchAuctions();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Bieten');
    }
  };

  const features = [
    {
      icon: <Zap className="w-8 h-8" />,
      title: 'Penny Auktionen',
      description: 'Jedes Gebot erhöht den Preis nur um wenige Cent'
    },
    {
      icon: <Trophy className="w-8 h-8" />,
      title: 'Große Ersparnisse',
      description: 'Gewinnen Sie Produkte bis zu 90% unter dem Einzelhandelspreis'
    },
    {
      icon: <Clock className="w-8 h-8" />,
      title: 'Echtzeit-Gebote',
      description: 'Live-Updates und spannendes Bieterlebnis'
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: 'Sicher & Fair',
      description: 'Transparente Auktionen mit verifiziertem System'
    }
  ];

  return (
    <div className="min-h-screen" data-testid="home-page">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#7C3AED]/10 via-transparent to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#7C3AED]/5 rounded-full blur-3xl" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#181824] border border-white/10 mb-8">
              <Sparkles className="w-4 h-4 text-[#F59E0B]" />
              <span className="text-sm text-[#94A3B8]">10 kostenlose Gebote bei Registrierung</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight mb-6">
              <span className="text-white">Gewinnen Sie </span>
              <span className="bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] bg-clip-text text-transparent">
                Premium-Produkte
              </span>
              <br />
              <span className="text-white">für Centbeträge</span>
            </h1>
            
            <p className="text-lg sm:text-xl text-[#94A3B8] mb-10 max-w-2xl mx-auto">
              Die aufregendste Penny-Auktionsplattform Deutschlands. Bieten, gewinnen und sparen Sie bis zu 90% auf Top-Marken.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auctions">
                <Button className="btn-primary text-lg px-8 py-4 h-auto" data-testid="cta-auctions">
                  Jetzt bieten
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link to="/buy-bids">
                <Button 
                  variant="outline" 
                  className="text-lg px-8 py-4 h-auto border-white/20 text-white hover:bg-white/10"
                  data-testid="cta-buy-bids"
                >
                  Gebote kaufen
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-[#0F0F16]/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="glass-card p-6 rounded-2xl hover:border-[#7C3AED]/30 transition-colors"
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#7C3AED]/20 to-[#06B6D4]/20 flex items-center justify-center text-[#7C3AED] mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-[#94A3B8] text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live Auctions */}
      <section className="py-20 px-4" data-testid="live-auctions-section">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2">
                Live Auktionen
              </h2>
              <p className="text-[#94A3B8]">Verpassen Sie nicht Ihre Chance zu gewinnen</p>
            </div>
            <Link to="/auctions">
              <Button variant="ghost" className="text-[#7C3AED] hover:text-[#A78BFA]">
                Alle anzeigen
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="auction-card animate-pulse">
                  <div className="aspect-square bg-[#181824]" />
                  <div className="p-4 space-y-4">
                    <div className="h-6 bg-[#181824] rounded" />
                    <div className="h-12 bg-[#181824] rounded" />
                    <div className="h-8 bg-[#181824] rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : auctions.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {auctions.map((auction) => (
                <AuctionCard
                  key={auction.id}
                  auction={auction}
                  onBid={handleBid}
                  isAuthenticated={isAuthenticated}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 glass-card rounded-2xl">
              <Zap className="w-16 h-16 text-[#475569] mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Keine aktiven Auktionen</h3>
              <p className="text-[#94A3B8]">Schauen Sie bald wieder vorbei!</p>
            </div>
          )}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-[#0F0F16]/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              So funktioniert's
            </h2>
            <p className="text-[#94A3B8] max-w-2xl mx-auto">
              In nur drei einfachen Schritten zum Schnäppchen
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Gebote kaufen', desc: 'Kaufen Sie ein Gebotspaket zu günstigen Preisen' },
              { step: '02', title: 'Bieten', desc: 'Platzieren Sie Ihr Gebot bei laufenden Auktionen' },
              { step: '03', title: 'Gewinnen', desc: 'Seien Sie der letzte Bieter und gewinnen Sie das Produkt' }
            ].map((item, index) => (
              <div key={index} className="relative">
                <div className="glass-card p-8 rounded-2xl text-center">
                  <div className="text-5xl font-black text-[#7C3AED]/30 mb-4">{item.step}</div>
                  <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-[#94A3B8]">{item.desc}</p>
                </div>
                {index < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                    <ArrowRight className="w-8 h-8 text-[#7C3AED]" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="glass-card p-10 sm:p-16 rounded-3xl text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-[#7C3AED]/10 to-[#06B6D4]/10" />
            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Bereit zu gewinnen?
              </h2>
              <p className="text-[#94A3B8] mb-8 max-w-xl mx-auto">
                Registrieren Sie sich jetzt und erhalten Sie 10 kostenlose Gebote zum Starten!
              </p>
              <Link to="/register">
                <Button className="btn-primary text-lg px-10 py-4 h-auto" data-testid="cta-register">
                  Kostenlos registrieren
                  <Zap className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-4 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#06B6D4] flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-white">BidBlitz</span>
            </div>
            <p className="text-[#94A3B8] text-sm">
              © 2024 BidBlitz. Alle Rechte vorbehalten.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
