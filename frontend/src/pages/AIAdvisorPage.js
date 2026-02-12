import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { 
  Brain, TrendingUp, Target, Clock, Zap, ChevronRight,
  BarChart3, Lightbulb, RefreshCw, ArrowRight, Star
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const translations = {
  de: {
    title: 'KI-Berater',
    subtitle: 'Intelligente Empfehlungen für deine Gebote',
    hotAuctions: 'Heiße Tipps',
    predictions: 'Preis-Vorhersagen',
    timing: 'Beste Bietzeit',
    analyze: 'Analysieren',
    winChance: 'Gewinnchance',
    predictedPrice: 'Vorhergesagter Preis',
    currentPrice: 'Aktueller Preis',
    savings: 'Potenzielle Ersparnis',
    competition: 'Wettbewerb',
    low: 'Niedrig',
    medium: 'Mittel',
    high: 'Hoch',
    critical: 'Kritisch',
    recommendation: 'Empfehlung',
    bidNow: 'Jetzt bieten!',
    wait: 'Warten',
    consider: 'Beobachten',
    insights: 'KI-Einblicke',
    strategy: 'Strategie',
    schedule: 'Gebot-Zeitplan',
    budget: 'Dein Budget',
    bids: 'Gebote',
    refreshing: 'Aktualisiere...',
    lastUpdated: 'Zuletzt aktualisiert',
    selectAuction: 'Wähle eine Auktion zur Analyse',
    noData: 'Keine Daten verfügbar',
    loading: 'KI analysiert...',
    aiPowered: 'KI-gestützt',
    savingsPercent: 'Ersparnis',
    bestTime: 'Beste Zeit zum Bieten',
    lastSeconds: 'Letzte Sekunden',
    aggressive: 'Aggressiv',
    balanced: 'Ausgewogen',
    conservative: 'Konservativ'
  },
  en: {
    title: 'AI Advisor',
    subtitle: 'Smart recommendations for your bids',
    hotAuctions: 'Hot Tips',
    predictions: 'Price Predictions',
    timing: 'Best Bid Time',
    analyze: 'Analyze',
    winChance: 'Win Chance',
    predictedPrice: 'Predicted Price',
    currentPrice: 'Current Price',
    savings: 'Potential Savings',
    competition: 'Competition',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical',
    recommendation: 'Recommendation',
    bidNow: 'Bid now!',
    wait: 'Wait',
    consider: 'Consider',
    insights: 'AI Insights',
    strategy: 'Strategy',
    schedule: 'Bid Schedule',
    budget: 'Your Budget',
    bids: 'Bids',
    refreshing: 'Refreshing...',
    lastUpdated: 'Last updated',
    selectAuction: 'Select an auction to analyze',
    noData: 'No data available',
    loading: 'AI analyzing...',
    aiPowered: 'AI-powered',
    savingsPercent: 'Savings',
    bestTime: 'Best time to bid',
    lastSeconds: 'Last seconds',
    aggressive: 'Aggressive',
    balanced: 'Balanced',
    conservative: 'Conservative'
  },
  sq: {
    title: 'Këshilltari AI',
    subtitle: 'Rekomandime të zgjuara për ofertat tuaja',
    hotAuctions: 'Këshilla të Nxehta',
    predictions: 'Parashikimet e Çmimit',
    timing: 'Koha më e Mirë për Ofertë',
    analyze: 'Analizo',
    winChance: 'Shansi i Fitores',
    predictedPrice: 'Çmimi i Parashikuar',
    currentPrice: 'Çmimi Aktual',
    savings: 'Kursimi Potencial',
    competition: 'Konkurrenca',
    low: 'E Ulët',
    medium: 'Mesatare',
    high: 'E Lartë',
    critical: 'Kritike',
    recommendation: 'Rekomandimi',
    bidNow: 'Oferto tani!',
    wait: 'Prit',
    consider: 'Konsidero',
    insights: 'Vështrime AI',
    strategy: 'Strategjia',
    schedule: 'Plani i Ofertave',
    budget: 'Buxheti Yt',
    bids: 'Oferta',
    refreshing: 'Duke rifreskuar...',
    lastUpdated: 'Përditësuar së fundi',
    selectAuction: 'Zgjidh një ankand për të analizuar',
    noData: 'Nuk ka të dhëna',
    loading: 'AI po analizon...',
    aiPowered: 'Fuqizuar nga AI',
    savingsPercent: 'Kursimi',
    bestTime: 'Koha më e mirë për ofertë',
    lastSeconds: 'Sekondat e fundit',
    aggressive: 'Agresiv',
    balanced: 'I Balancuar',
    conservative: 'Konservativ'
  },
  xk: {
    title: 'Këshilltari AI',
    subtitle: 'Rekomandime të zgjuara për ofertat tuaja',
    hotAuctions: 'Këshilla të Nxehta',
    predictions: 'Parashikimet e Çmimit',
    timing: 'Koha më e Mirë për Ofertë',
    analyze: 'Analizo',
    winChance: 'Shansi i Fitores',
    predictedPrice: 'Çmimi i Parashikuar',
    currentPrice: 'Çmimi Aktual',
    savings: 'Kursimi Potencial',
    competition: 'Konkurrenca',
    low: 'E Ulët',
    medium: 'Mesatare',
    high: 'E Lartë',
    critical: 'Kritike',
    recommendation: 'Rekomandimi',
    bidNow: 'Oferto tani!',
    wait: 'Prit',
    consider: 'Konsidero',
    insights: 'Vështrime AI',
    strategy: 'Strategjia',
    schedule: 'Plani i Ofertave',
    budget: 'Buxheti Yt',
    bids: 'Oferta',
    refreshing: 'Duke rifreskuar...',
    lastUpdated: 'Përditësuar së fundi',
    selectAuction: 'Zgjidh një ankand për të analizuar',
    noData: 'Nuk ka të dhëna',
    loading: 'AI po analizon...',
    aiPowered: 'Fuqizuar nga AI',
    savingsPercent: 'Kursimi',
    bestTime: 'Koha më e mirë për ofertë',
    lastSeconds: 'Sekondat e fundit',
    aggressive: 'Agresiv',
    balanced: 'I Balancuar',
    conservative: 'Konservativ'
  }
};

const AIAdvisorPage = () => {
  const { isAuthenticated, token, user } = useAuth();
  const { language, mappedLanguage } = useLanguage();
  const navigate = useNavigate();
  const langKey = mappedLanguage || language;
  const t = translations[langKey] || translations.de;

  const [hotAuctions, setHotAuctions] = useState([]);
  const [selectedAuction, setSelectedAuction] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [timing, setTiming] = useState(null);
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [userBudget, setUserBudget] = useState(10);

  const fetchHotAuctions = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/ai-advisor/hot-auctions`);
      if (res.ok) {
        const data = await res.json();
        setHotAuctions(data || []);
      }
    } catch (err) {
      console.error('Error fetching hot auctions:', err);
    }
  }, []);

  const fetchAuctions = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/auctions?status=active&limit=15`);
      if (res.ok) {
        const data = await res.json();
        setAuctions(data.auctions || []);
      }
    } catch (err) {
      console.error('Error fetching auctions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHotAuctions();
    fetchAuctions();
    const interval = setInterval(() => {
      fetchHotAuctions();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchHotAuctions, fetchAuctions]);

  const analyzeAuction = async (auctionId) => {
    setSelectedAuction(auctionId);
    setAnalyzing(true);
    setPrediction(null);
    setTiming(null);

    try {
      const [predRes, timingRes] = await Promise.all([
        fetch(`${API}/api/ai-advisor/predict/${auctionId}`),
        fetch(`${API}/api/ai-advisor/timing/${auctionId}?budget=${userBudget}`)
      ]);

      if (predRes.ok) {
        const data = await predRes.json();
        setPrediction(data);
      }

      if (timingRes.ok) {
        const data = await timingRes.json();
        setTiming(data);
      }
    } catch (err) {
      toast.error('Analysis error');
    } finally {
      setAnalyzing(false);
    }
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'critical': return 'text-red-500 bg-red-500/20';
      case 'high': return 'text-orange-500 bg-orange-500/20';
      case 'medium': return 'text-yellow-500 bg-yellow-500/20';
      default: return 'text-green-500 bg-green-500/20';
    }
  };

  const getStrategyLabel = (strategy) => {
    switch (strategy) {
      case 'aggressive': return t.aggressive;
      case 'balanced': return t.balanced;
      case 'conservative': return t.conservative;
      default: return strategy;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-blue-900/20 to-gray-900 pt-20 pb-24 px-4" data-testid="ai-advisor-page">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 rounded-full text-blue-400 text-sm mb-4">
            <Brain className="w-4 h-4" />
            {t.aiPowered}
          </div>
          <div className="flex items-center justify-center gap-3 mb-2">
            <Brain className="w-10 h-10 text-blue-500" />
            <h1 className="text-3xl font-black text-white">{t.title}</h1>
          </div>
          <p className="text-gray-400">{t.subtitle}</p>
        </div>

        {/* Budget Selector */}
        <div className="bg-gray-800/80 backdrop-blur rounded-xl p-4 mb-6 border border-blue-500/30">
          <label className="text-gray-300 text-sm mb-2 block">{t.budget}: {userBudget} {t.bids}</label>
          <input
            type="range"
            min="5"
            max="100"
            value={userBudget}
            onChange={(e) => setUserBudget(parseInt(e.target.value))}
            className="w-full accent-blue-500"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>5</span>
            <span>50</span>
            <span>100</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Hot Auctions & Selection */}
          <div className="lg:col-span-1 space-y-6">
            {/* Hot Auctions */}
            <div className="bg-gray-800/80 backdrop-blur rounded-xl p-4 border border-orange-500/30">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-500" />
                {t.hotAuctions}
              </h3>
              <div className="space-y-3">
                {hotAuctions.slice(0, 3).map((item, idx) => (
                  <button
                    key={item.auction?.id || idx}
                    onClick={() => analyzeAuction(item.auction?.id)}
                    className="w-full flex items-center gap-3 p-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-left transition-all"
                  >
                    <div className="w-10 h-10 bg-gray-600 rounded overflow-hidden flex-shrink-0">
                      {item.auction?.product?.image_url && (
                        <img src={item.auction.product.image_url} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {item.auction?.product?.name || 'Auktion'}
                      </p>
                      <p className="text-green-400 text-xs">{item.win_chance}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-400">{t.winChance}</span>
                      <p className="text-orange-400 font-bold">{item.score}%</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Auction Selection */}
            <div className="bg-gray-800/80 backdrop-blur rounded-xl p-4 border border-blue-500/30">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-500" />
                {t.selectAuction}
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {loading ? (
                  <div className="text-center py-4">
                    <RefreshCw className="w-6 h-6 text-blue-500 mx-auto animate-spin" />
                  </div>
                ) : (
                  auctions.map((auction) => (
                    <button
                      key={auction.id}
                      onClick={() => analyzeAuction(auction.id)}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-all ${
                        selectedAuction === auction.id
                          ? 'bg-blue-600/20 border border-blue-500'
                          : 'bg-gray-700/30 hover:bg-gray-700/50 border border-transparent'
                      }`}
                    >
                      <div className="w-10 h-10 bg-gray-600 rounded overflow-hidden flex-shrink-0">
                        {auction.product_image && (
                          <img src={auction.product_image} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm truncate">{auction.product_name}</p>
                        <p className="text-yellow-400 text-xs">€{auction.current_price?.toFixed(2)}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Analysis Results */}
          <div className="lg:col-span-2 space-y-6">
            {analyzing ? (
              <div className="bg-gray-800/80 backdrop-blur rounded-xl p-12 border border-blue-500/30 text-center">
                <Brain className="w-16 h-16 text-blue-500 mx-auto animate-pulse mb-4" />
                <p className="text-white font-bold text-lg">{t.loading}</p>
              </div>
            ) : prediction ? (
              <>
                {/* Prediction Card */}
                <div className="bg-gray-800/80 backdrop-blur rounded-xl p-6 border border-blue-500/30">
                  <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-500" />
                    {t.predictions}
                  </h3>

                  <div className="grid md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                      <p className="text-gray-400 text-sm">{t.currentPrice}</p>
                      <p className="text-2xl font-black text-white">€{prediction.current_price?.toFixed(2)}</p>
                    </div>
                    <div className="bg-green-500/10 rounded-lg p-4 text-center border border-green-500/30">
                      <p className="text-gray-400 text-sm">{t.predictedPrice}</p>
                      <p className="text-2xl font-black text-green-400">€{prediction.prediction?.likely_price?.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">
                        €{prediction.prediction?.min_price?.toFixed(2)} - €{prediction.prediction?.max_price?.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-purple-500/10 rounded-lg p-4 text-center border border-purple-500/30">
                      <p className="text-gray-400 text-sm">{t.winChance}</p>
                      <p className="text-2xl font-black text-purple-400">{prediction.win_probability}%</p>
                    </div>
                  </div>

                  {/* Recommendation */}
                  {prediction.recommendation && (
                    <div className={`rounded-lg p-4 ${getUrgencyColor(prediction.recommendation.urgency)}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{prediction.recommendation.emoji}</span>
                        <div>
                          <p className="font-bold text-lg">{prediction.recommendation.message}</p>
                          <p className="text-sm opacity-80">{t.recommendation}: {prediction.recommendation.action}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Insights */}
                {prediction.insights && prediction.insights.length > 0 && (
                  <div className="bg-gray-800/80 backdrop-blur rounded-xl p-6 border border-yellow-500/30">
                    <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-yellow-500" />
                      {t.insights}
                    </h3>
                    <div className="grid md:grid-cols-3 gap-4">
                      {prediction.insights.map((insight, idx) => (
                        <div key={idx} className="bg-gray-700/50 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">{insight.icon}</span>
                            <span className="text-gray-300 font-medium">{insight.title}</span>
                          </div>
                          <p className="text-white text-sm">{insight.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timing Strategy */}
                {timing && (
                  <div className="bg-gray-800/80 backdrop-blur rounded-xl p-6 border border-green-500/30">
                    <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-green-500" />
                      {t.timing}
                    </h3>

                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400">{t.strategy}</span>
                        <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-bold">
                          {getStrategyLabel(timing.strategy)}
                        </span>
                      </div>
                      <p className="text-white">{timing.advice}</p>
                    </div>

                    {timing.schedule && timing.schedule.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-gray-400 text-sm">{t.schedule}</p>
                        {timing.schedule.map((step, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between bg-gray-700/50 rounded-lg p-3"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 font-bold text-sm">
                                {idx + 1}
                              </div>
                              <div>
                                <p className="text-white font-medium">{step.time}</p>
                                <p className="text-gray-400 text-sm">{step.action}</p>
                              </div>
                            </div>
                            <span className="text-yellow-400 font-bold">
                              {step.bids_to_use} {t.bids}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Action Button */}
                <Button
                  onClick={() => navigate(`/auctions/${selectedAuction}`)}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 py-4 text-lg font-bold"
                >
                  <ArrowRight className="w-5 h-5 mr-2" />
                  {t.bidNow}
                </Button>
              </>
            ) : (
              <div className="bg-gray-800/80 backdrop-blur rounded-xl p-12 border border-gray-700 text-center">
                <Brain className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">{t.selectAuction}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAdvisorPage;
