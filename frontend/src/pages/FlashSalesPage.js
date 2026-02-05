import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { 
  Zap, Clock, Gift, Sparkles, ChevronRight, 
  Bell, Tag, Percent, Timer
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const FlashSalesPage = () => {
  const { token, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const [activeSales, setActiveSales] = useState([]);
  const [upcomingSales, setUpcomingSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [countdowns, setCountdowns] = useState({});

  const texts = {
    de: {
      title: 'Flash Sales',
      subtitle: 'Zeitlich begrenzte Angebote - Schnell sein lohnt sich!',
      active: 'Jetzt Aktiv',
      upcoming: 'Demnächst',
      endsIn: 'Endet in',
      startsIn: 'Startet in',
      bids: 'Gebote',
      save: 'Spare',
      buyNow: 'Jetzt kaufen',
      notify: 'Benachrichtigen',
      notified: 'Du wirst benachrichtigt',
      noSales: 'Keine Flash Sales aktiv',
      checkBack: 'Schau später wieder vorbei!',
      popular: 'Beliebt'
    },
    en: {
      title: 'Flash Sales',
      subtitle: 'Limited time offers - Be quick to save!',
      active: 'Active Now',
      upcoming: 'Coming Soon',
      endsIn: 'Ends in',
      startsIn: 'Starts in',
      bids: 'bids',
      save: 'Save',
      buyNow: 'Buy Now',
      notify: 'Notify Me',
      notified: 'You will be notified',
      noSales: 'No flash sales active',
      checkBack: 'Check back later!',
      popular: 'Popular'
    }
  };
  const t = texts[language] || texts.de;

  useEffect(() => {
    fetchSales();
  }, []);

  useEffect(() => {
    // Update countdowns every second
    const interval = setInterval(() => {
      setCountdowns(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(key => {
          if (updated[key] > 0) {
            updated[key] = updated[key] - 1;
          }
        });
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const fetchSales = async () => {
    try {
      const [activeRes, upcomingRes] = await Promise.all([
        axios.get(`${API}/api/flash-sales/active`),
        axios.get(`${API}/api/flash-sales/upcoming`)
      ]);
      
      setActiveSales(activeRes.data.sales || []);
      setUpcomingSales(upcomingRes.data.sales || []);
      
      // Initialize countdowns
      const newCountdowns = {};
      (activeRes.data.sales || []).forEach(sale => {
        newCountdowns[sale.id] = sale.seconds_remaining || 0;
      });
      setCountdowns(newCountdowns);
    } catch (err) {
      console.error('Error fetching flash sales:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (saleId) => {
    if (!isAuthenticated) {
      toast.error('Bitte einloggen');
      return;
    }

    try {
      await axios.post(`${API}/api/flash-sales/subscribe/${saleId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(t.notified);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler');
    }
  };

  const handlePurchase = async (saleId, packageId) => {
    if (!isAuthenticated) {
      toast.error('Bitte einloggen');
      return;
    }

    try {
      const res = await axios.post(`${API}/api/flash-sales/purchase/${saleId}/${packageId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.checkout_url) {
        window.location.href = res.data.checkout_url;
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler beim Kauf');
    }
  };

  const formatCountdown = (seconds) => {
    if (seconds <= 0) return '00:00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-12 bg-gray-800 rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-64 bg-gray-800 rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4" data-testid="flash-sales-page">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-red-500/20 to-orange-500/20 text-red-400 mb-4 animate-pulse">
            <Zap className="w-5 h-5" />
            <span className="font-bold">⚡ FLASH SALE ⚡</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            {t.title}
          </h1>
          <p className="text-gray-500 text-lg">{t.subtitle}</p>
        </div>

        {/* Active Sales */}
        {activeSales.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <h2 className="text-2xl font-bold text-gray-800">{t.active}</h2>
            </div>

            {activeSales.map(sale => (
              <div 
                key={sale.id}
                className="glass-card rounded-2xl p-6 mb-6 border-2 border-red-500/30 bg-gradient-to-r from-red-500/5 to-orange-500/5"
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-800">{sale.title}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <Timer className="w-5 h-5 text-red-400" />
                      <span className="text-red-400 font-mono text-xl font-bold">
                        {formatCountdown(countdowns[sale.id] || 0)}
                      </span>
                      <span className="text-gray-500">{t.endsIn}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {(sale.packages || []).map(pkg => (
                    <div 
                      key={pkg.id}
                      className={`relative glass-card rounded-xl p-4 transition-all hover:border-yellow-500/50 ${
                        pkg.popular ? 'border-2 border-yellow-500/50' : ''
                      }`}
                    >
                      {pkg.popular && (
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-yellow-500 rounded-full text-black text-xs font-bold">
                          {t.popular}
                        </div>
                      )}

                      <div className="text-center mb-3 pt-2">
                        <div className="w-14 h-14 mx-auto rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center mb-2">
                          <Zap className="w-7 h-7 text-gray-800" />
                        </div>
                        <h4 className="text-gray-800 font-bold">{pkg.name}</h4>
                        <p className="text-yellow-400 font-bold text-lg">{pkg.bids} {t.bids}</p>
                      </div>

                      <div className="text-center mb-3">
                        <span className="text-gray-500 line-through text-sm">€{pkg.original_price}</span>
                        <span className="text-2xl font-bold text-gray-800 ml-2">€{pkg.flash_price}</span>
                        <div className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 bg-green-500/20 rounded-full">
                          <Percent className="w-3 h-3 text-green-400" />
                          <span className="text-green-400 text-sm font-bold">-{pkg.discount_percent}%</span>
                        </div>
                      </div>

                      <Button
                        onClick={() => handlePurchase(sale.id, pkg.id)}
                        className="w-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-400"
                      >
                        {t.buyNow}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* No Active Sales */}
        {activeSales.length === 0 && (
          <div className="glass-card rounded-xl p-12 text-center mb-12">
            <Zap className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">{t.noSales}</h3>
            <p className="text-gray-500">{t.checkBack}</p>
          </div>
        )}

        {/* Upcoming Sales */}
        {upcomingSales.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <Clock className="w-6 h-6 text-purple-400" />
              <h2 className="text-2xl font-bold text-gray-800">{t.upcoming}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcomingSales.map(sale => (
                <div key={sale.id} className="glass-card rounded-xl p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-gray-800 font-bold">{sale.title}</h3>
                      <p className="text-gray-500 text-sm flex items-center gap-1 mt-1">
                        <Clock className="w-4 h-4" />
                        {t.startsIn}: {new Date(sale.start_time).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSubscribe(sale.id)}
                    >
                      <Bell className="w-4 h-4 mr-1" />
                      {t.notify}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default FlashSalesPage;
