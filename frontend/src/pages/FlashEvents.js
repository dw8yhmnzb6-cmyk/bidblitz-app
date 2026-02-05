import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { 
  Zap, Clock, Bell, BellOff, Calendar, Gift, 
  Timer, ChevronRight, Sparkles, Trophy
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const FlashEvents = () => {
  const { token, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [activeFlash, setActiveFlash] = useState([]);
  const [subscriptions, setSubscriptions] = useState({});
  const [loading, setLoading] = useState(true);

  const texts = {
    de: {
      title: 'Flash-Auktionen & Events',
      subtitle: 'Limitierte Blitz-Auktionen mit unschlagbaren Preisen!',
      upcoming: 'Kommende Events',
      activeNow: 'Jetzt Aktiv',
      startsIn: 'Startet in',
      endsIn: 'Endet in',
      notify: 'Benachrichtigen',
      notifying: 'Benachrichtigung aktiv',
      noEvents: 'Keine Events geplant',
      viewAuction: 'Zur Auktion',
      duration: 'Dauer',
      minutes: 'Minuten',
      subscribed: 'Du wirst benachrichtigt!',
      unsubscribed: 'Benachrichtigung deaktiviert'
    },
    en: {
      title: 'Flash Auctions & Events',
      subtitle: 'Limited lightning auctions with unbeatable prices!',
      upcoming: 'Upcoming Events',
      activeNow: 'Active Now',
      startsIn: 'Starts in',
      endsIn: 'Ends in',
      notify: 'Notify Me',
      notifying: 'Notification active',
      noEvents: 'No events scheduled',
      viewAuction: 'View Auction',
      duration: 'Duration',
      minutes: 'minutes',
      subscribed: 'You will be notified!',
      unsubscribed: 'Notification disabled'
    }
  };
  const t = texts[language] || texts.de;

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const [upcomingRes, activeRes] = await Promise.all([
        axios.get(`${API}/api/events/upcoming`),
        axios.get(`${API}/api/events/active`)
      ]);
      setUpcomingEvents(upcomingRes.data.events || []);
      setActiveFlash(activeRes.data.flash_auctions || []);
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSubscription = async (eventId) => {
    if (!isAuthenticated) {
      toast.error('Bitte einloggen');
      return;
    }

    try {
      const isSubscribed = subscriptions[eventId];
      if (isSubscribed) {
        await axios.delete(`${API}/api/events/subscribe/${eventId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSubscriptions(prev => ({ ...prev, [eventId]: false }));
        toast.success(t.unsubscribed);
      } else {
        await axios.post(`${API}/api/events/subscribe/${eventId}`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSubscriptions(prev => ({ ...prev, [eventId]: true }));
        toast.success(t.subscribed);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler');
    }
  };

  const formatTimeUntil = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = date - now;
    
    if (diff < 0) return '0:00';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-12 bg-white rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-64 bg-white rounded-xl"></div>
              <div className="h-64 bg-white rounded-xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4" data-testid="flash-events-page">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/20 text-yellow-400 mb-4">
            <Zap className="w-5 h-5" />
            <span className="font-bold">Flash Events</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            {t.title}
          </h1>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            {t.subtitle}
          </p>
        </div>

        {/* Active Flash Auctions */}
        {activeFlash.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <h2 className="text-2xl font-bold text-gray-800">{t.activeNow}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeFlash.map(auction => (
                <Link 
                  to={`/auctions/${auction.id}`} 
                  key={auction.id}
                  className="group"
                >
                  <div className="glass-card rounded-xl p-6 border-2 border-yellow-500/50 hover:border-yellow-500 transition-all">
                    <div className="flex items-center gap-2 mb-4">
                      <Zap className="w-5 h-5 text-yellow-400" />
                      <span className="text-yellow-400 font-bold">LIVE</span>
                    </div>
                    
                    {auction.product && (
                      <img 
                        src={auction.product.image_url} 
                        alt={auction.product.name}
                        className="w-full h-40 object-contain bg-white/5 rounded-lg mb-4"
                      />
                    )}
                    
                    <h3 className="text-gray-800 font-bold text-lg mb-2">
                      {auction.flash_title || auction.product?.name}
                    </h3>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-gray-500 text-sm">{t.endsIn}</span>
                        <div className="text-2xl font-bold text-green-400">
                          {formatTimeUntil(auction.end_time)}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-500 text-sm">Preis</span>
                        <div className="text-2xl font-bold text-gray-800">
                          €{auction.current_price?.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    
                    <Button className="w-full mt-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold group-hover:from-yellow-300">
                      {t.viewAuction}
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Upcoming Events */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <Calendar className="w-6 h-6 text-purple-400" />
            <h2 className="text-2xl font-bold text-gray-800">{t.upcoming}</h2>
          </div>

          {upcomingEvents.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <Sparkles className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">{t.noEvents}</p>
              <p className="text-gray-500 mt-2">Schau später nochmal vorbei!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {upcomingEvents.map(event => (
                <div 
                  key={event.id}
                  className="glass-card rounded-xl p-6 hover:border-purple-500/30 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <Zap className="w-6 h-6 text-gray-800" />
                      </div>
                      <div>
                        <h3 className="text-gray-800 font-bold">{event.title}</h3>
                        <p className="text-gray-500 text-sm">{event.description}</p>
                      </div>
                    </div>
                    <Button
                      variant={subscriptions[event.id] ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => toggleSubscription(event.id)}
                      className={subscriptions[event.id] ? 'bg-purple-500/20 text-purple-400' : ''}
                    >
                      {subscriptions[event.id] ? (
                        <>
                          <Bell className="w-4 h-4 mr-1" />
                          {t.notifying}
                        </>
                      ) : (
                        <>
                          <BellOff className="w-4 h-4 mr-1" />
                          {t.notify}
                        </>
                      )}
                    </Button>
                  </div>

                  {event.product && (
                    <div className="flex items-center gap-4 p-3 bg-white/5 rounded-lg mb-4">
                      <img 
                        src={event.product.image_url}
                        alt={event.product.name}
                        className="w-16 h-16 object-contain"
                      />
                      <div>
                        <p className="text-gray-800 font-medium">{event.product.name}</p>
                        <p className="text-gray-500 text-sm">UVP: €{event.product.retail_price?.toFixed(2)}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Timer className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-500">{t.startsIn}:</span>
                      <span className="text-gray-800 font-bold">{formatTimeUntil(event.start_time)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-500">{t.duration}:</span>
                      <span className="text-gray-800 font-medium">
                        {Math.round((new Date(event.end_time) - new Date(event.start_time)) / 60000)} {t.minutes}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default FlashEvents;
