import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Brain, TrendingUp, Target, Clock, 
  Zap, AlertTriangle, CheckCircle, ArrowRight,
  BarChart3, Users, Timer
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';

const API = process.env.REACT_APP_BACKEND_URL;

// Translations
const translations = {
  de: {
    title: 'KI Bid-Empfehlungen',
    subtitle: 'Smarte Gebots-Strategien basierend auf Echtzeit-Analyse',
    bestOpportunities: 'Beste Chancen für dich',
    winProbability: 'Gewinnchance',
    currentPrice: 'Aktueller Preis',
    timeLeft: 'Verbleibend',
    competition: 'Konkurrenz',
    recommendation: 'Empfehlung',
    bidNow: 'Jetzt bieten',
    wait: 'Warten',
    skip: 'Überspringen',
    confidence: 'Konfidenz',
    high: 'Hoch',
    medium: 'Mittel',
    low: 'Niedrig',
    bidders: 'Bieter',
    avgInterval: 'Ø Intervall',
    seconds: 'Sek',
    strategy: 'Strategie',
    loading: 'Analysiere Auktionen...',
    noOpportunities: 'Keine passenden Auktionen gefunden',
    refresh: 'Aktualisieren',
    urgency: {
      critical: '🔥 JETZT!',
      high: '⚡ Schnell handeln',
      medium: '✅ Gute Chance',
      low: '⏳ Abwarten',
      none: '⚠️ Hohe Konkurrenz'
    }
  },
  en: {
    title: 'AI Bid Recommendations',
    subtitle: 'Smart bidding strategies based on real-time analysis',
    bestOpportunities: 'Best opportunities for you',
    winProbability: 'Win Probability',
    currentPrice: 'Current Price',
    timeLeft: 'Time Left',
    competition: 'Competition',
    recommendation: 'Recommendation',
    bidNow: 'Bid Now',
    wait: 'Wait',
    skip: 'Skip',
    confidence: 'Confidence',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    bidders: 'Bidders',
    avgInterval: 'Avg Interval',
    seconds: 'sec',
    strategy: 'Strategy',
    loading: 'Analyzing auctions...',
    noOpportunities: 'No suitable auctions found',
    refresh: 'Refresh',
    urgency: {
      critical: '🔥 NOW!',
      high: '⚡ Act fast',
      medium: '✅ Good chance',
      low: '⏳ Wait',
      none: '⚠️ High competition'
    }
  }
};

// Opportunity Card
const OpportunityCard = ({ opportunity, t, onBid }) => {
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState(opportunity.seconds_left);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  const formatTime = (seconds) => {
    if (seconds <= 0) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  
  const probability = opportunity.win_probability || 0;
  const isGoodChance = probability >= 50;
  
  return (
    <div 
      className={`bg-white rounded-xl border-2 shadow-lg ${
        probability >= 70 ? 'border-green-500' : 
        probability >= 50 ? 'border-cyan-500' : 
        'border-gray-200'
      } overflow-hidden hover:shadow-xl transition-all`}
    >
      {/* Header with probability */}
      <div className={`p-3 ${
        probability >= 70 ? 'bg-green-50' : 
        probability >= 50 ? 'bg-cyan-50' : 
        'bg-gray-50'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className={`w-5 h-5 ${probability >= 50 ? 'text-green-600' : 'text-gray-500'}`} />
            <span className={`font-bold ${probability >= 50 ? 'text-green-600' : 'text-gray-600'}`}>
              {probability}% {t.winProbability}
            </span>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${
            opportunity.confidence === 'high' ? 'bg-green-100 text-green-700' :
            opportunity.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {t[opportunity.confidence] || opportunity.confidence}
          </span>
        </div>
        <Progress value={probability} className="h-1.5 mt-2" />
      </div>
      
      {/* Content */}
      <div className="p-4">
        <div className="flex gap-3 mb-3">
          {/* Product Image */}
          <div className="w-16 h-16 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 cursor-pointer border border-gray-100"
               onClick={() => navigate(`/auctions/${opportunity.auction_id}`)}>
            {opportunity.product_image ? (
              <img 
                src={opportunity.product_image} 
                alt="" 
                className="max-w-full max-h-full object-contain p-1"
              />
            ) : (
              <Target className="w-8 h-8 text-gray-400" />
            )}
          </div>
          
          {/* Product Info */}
          <div className="flex-1 min-w-0">
            <h3 
              className="text-gray-800 font-bold text-sm line-clamp-2 cursor-pointer hover:text-cyan-600"
              onClick={() => navigate(`/auctions/${opportunity.auction_id}`)}
            >
              {opportunity.product_name}
            </h3>
            <p className="text-gray-400 text-xs line-through">
              UVP: €{opportunity.retail_price?.toLocaleString('de-DE')}
            </p>
            <p className="text-amber-600 font-bold">
              €{opportunity.current_price?.toFixed(2).replace('.', ',')}
            </p>
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-gray-50 rounded-lg p-2 text-center border border-gray-100">
            <Timer className="w-4 h-4 text-gray-500 mx-auto mb-1" />
            <p className="text-gray-800 text-sm font-bold">{formatTime(timeLeft)}</p>
            <p className="text-gray-500 text-[10px]">{t.timeLeft}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center border border-gray-100">
            <Users className="w-4 h-4 text-gray-500 mx-auto mb-1" />
            <p className="text-gray-800 text-sm font-bold">{opportunity.total_bids || 0}</p>
            <p className="text-gray-500 text-[10px]">{t.bidders}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center border border-gray-100">
            <BarChart3 className="w-4 h-4 text-gray-500 mx-auto mb-1" />
            <p className={`text-sm font-bold ${isGoodChance ? 'text-green-600' : 'text-amber-600'}`}>
              {isGoodChance ? t.low : t.high}
            </p>
            <p className="text-gray-500 text-[10px]">{t.competition}</p>
          </div>
        </div>
        
        {/* Action Button */}
        <Button 
          onClick={() => onBid(opportunity.auction_id)}
          className={`w-full ${
            probability >= 70 ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white' :
            probability >= 50 ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white' :
            'bg-gray-200 hover:bg-gray-300 text-gray-700'
          }`}
        >
          <Zap className="w-4 h-4 mr-1" />
          {probability >= 50 ? t.bidNow : t.wait}
        </Button>
      </div>
    </div>
  );
};

export default function AIBidRecommendationsPage() {
  const { isAuthenticated, token } = useAuth();
  const { language, mappedLanguage } = useLanguage();
  const navigate = useNavigate();
  const t = translations[mappedLanguage] || translations[language] || translations.de;
  
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const fetchOpportunities = async () => {
    if (!isAuthenticated) return;
    
    try {
      setLoading(true);
      const res = await axios.get(`${API}/api/ai-bid/best-opportunities?limit=8`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOpportunities(res.data.opportunities || []);
    } catch (error) {
      console.error('Error fetching opportunities:', error);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchOpportunities();
    // Refresh every 30 seconds
    const interval = setInterval(fetchOpportunities, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, token]);
  
  const handleBid = async (auctionId) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    try {
      await axios.post(
        `${API}/api/auctions/${auctionId}/bid`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Gebot platziert!');
      fetchOpportunities(); // Refresh
    } catch (error) {
      // Check if it's an authentication error
      if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error('Bitte anmelden um zu bieten');
        navigate('/login');
        return;
      }
      toast.error(error.response?.data?.detail || 'Fehler beim Bieten');
    }
  };
  
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4 flex items-center justify-center">
        <div className="text-center bg-white rounded-xl p-8 shadow-lg border border-gray-200">
          <Brain className="w-16 h-16 text-cyan-500 mx-auto mb-4" />
          <p className="text-gray-600">Bitte anmelden für KI-Empfehlungen</p>
          <Button onClick={() => navigate('/login')} className="mt-4 bg-amber-500 hover:bg-amber-600 text-white">
            Anmelden
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4" data-testid="ai-bid-page">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100 border border-purple-200 mb-4">
            <Brain className="w-5 h-5 text-purple-600" />
            <span className="text-purple-600 font-bold">KI-POWERED</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-3">{t.title}</h1>
          <p className="text-gray-600 text-lg">{t.subtitle}</p>
        </div>
        
        {/* Refresh Button */}
        <div className="flex justify-end mb-4">
          <Button variant="outline" onClick={fetchOpportunities} disabled={loading} className="border-gray-300 text-gray-700 hover:bg-gray-50">
            {t.refresh}
          </Button>
        </div>
        
        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Brain className="w-16 h-16 text-purple-500 mx-auto mb-4 animate-pulse" />
              <p className="text-gray-600">{t.loading}</p>
            </div>
          </div>
        ) : opportunities.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-lg border border-gray-200">
            <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl text-gray-800 mb-2">{t.noOpportunities}</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {opportunities.map(opp => (
              <OpportunityCard 
                key={opp.auction_id} 
                opportunity={opp} 
                t={t} 
                onBid={handleBid}
              />
            ))}
          </div>
        )}
        
        {/* Info Box */}
        <div className="mt-8 bg-white rounded-xl p-6 border border-purple-200 shadow-lg">
          <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-600" />
            Wie funktionieren die KI-Empfehlungen?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div className="flex items-start gap-2">
              <BarChart3 className="w-5 h-5 text-purple-500 flex-shrink-0" />
              <p>Analyse von Bieter-Mustern und Aktivitätsintensität</p>
            </div>
            <div className="flex items-start gap-2">
              <Users className="w-5 h-5 text-purple-500 flex-shrink-0" />
              <p>Bewertung der Konkurrenz und deiner Gewinnhistorie</p>
            </div>
            <div className="flex items-start gap-2">
              <TrendingUp className="w-5 h-5 text-purple-500 flex-shrink-0" />
              <p>Echtzeit-Berechnung der Gewinnwahrscheinlichkeit</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
