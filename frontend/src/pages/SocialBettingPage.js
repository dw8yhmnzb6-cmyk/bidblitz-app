import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { 
  Coins, Trophy, TrendingUp, Users, Target, Gift,
  Clock, ChevronRight, Crown, Zap, Star, RefreshCw
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const translations = {
  de: {
    title: 'Soziale Wetten',
    subtitle: 'Wette auf Auktionsgewinner und verdiene BidCoins!',
    balance: 'Dein Guthaben',
    currency: 'BidCoins',
    dailyBonus: 'Täglicher Bonus',
    claimBonus: 'Bonus abholen',
    bonusClaimed: 'Bonus bereits abgeholt',
    placeBet: 'Wette platzieren',
    myBets: 'Meine Wetten',
    leaderboard: 'Rangliste',
    activeBets: 'Aktive Wetten',
    history: 'Verlauf',
    noBets: 'Noch keine Wetten platziert',
    startBetting: 'Starte jetzt!',
    auction: 'Auktion',
    predictedWinner: 'Tipp',
    amount: 'Einsatz',
    odds: 'Quote',
    potentialWin: 'Möglicher Gewinn',
    status: 'Status',
    active: 'Aktiv',
    won: 'Gewonnen',
    lost: 'Verloren',
    rank: 'Rang',
    player: 'Spieler',
    totalWon: 'Gewonnen',
    winRate: 'Gewinnrate',
    loginRequired: 'Bitte anmelden',
    loginToPlay: 'Melde dich an um zu wetten',
    howItWorks: 'So funktioniert es',
    step1: 'Sammle BidCoins (täglicher Bonus)',
    step2: 'Wette auf Auktionsgewinner',
    step3: 'Gewinne mehr BidCoins!',
    minBet: 'Min: 10',
    maxBet: 'Max: 500',
    placeYourBet: 'Wette auf diese Auktion',
    selectAuction: 'Wähle eine Auktion',
    loading: 'Laden...'
  },
  en: {
    title: 'Social Betting',
    subtitle: 'Bet on auction winners and earn BidCoins!',
    balance: 'Your Balance',
    currency: 'BidCoins',
    dailyBonus: 'Daily Bonus',
    claimBonus: 'Claim Bonus',
    bonusClaimed: 'Bonus already claimed',
    placeBet: 'Place Bet',
    myBets: 'My Bets',
    leaderboard: 'Leaderboard',
    activeBets: 'Active Bets',
    history: 'History',
    noBets: 'No bets placed yet',
    startBetting: 'Start betting!',
    auction: 'Auction',
    predictedWinner: 'Prediction',
    amount: 'Amount',
    odds: 'Odds',
    potentialWin: 'Potential Win',
    status: 'Status',
    active: 'Active',
    won: 'Won',
    lost: 'Lost',
    rank: 'Rank',
    player: 'Player',
    totalWon: 'Won',
    winRate: 'Win Rate',
    loginRequired: 'Please login',
    loginToPlay: 'Login to place bets',
    howItWorks: 'How it works',
    step1: 'Collect BidCoins (daily bonus)',
    step2: 'Bet on auction winners',
    step3: 'Win more BidCoins!',
    minBet: 'Min: 10',
    maxBet: 'Max: 500',
    placeYourBet: 'Bet on this auction',
    selectAuction: 'Select an auction',
    loading: 'Loading...'
  },
  sq: {
    title: 'Bastet Sociale',
    subtitle: 'Bast në fituesit e ankandeve dhe fito BidCoins!',
    balance: 'Bilanci Yt',
    currency: 'BidCoins',
    dailyBonus: 'Bonusi Ditor',
    claimBonus: 'Merr Bonusin',
    bonusClaimed: 'Bonusi u mor',
    placeBet: 'Vendos Bast',
    myBets: 'Bastet e Mia',
    leaderboard: 'Renditja',
    activeBets: 'Baste Aktive',
    history: 'Historia',
    noBets: 'Asnjë bast ende',
    startBetting: 'Fillo tani!',
    auction: 'Ankand',
    predictedWinner: 'Parashikim',
    amount: 'Shuma',
    odds: 'Kuotat',
    potentialWin: 'Fitim Potencial',
    status: 'Statusi',
    active: 'Aktiv',
    won: 'Fituar',
    lost: 'Humbur',
    rank: 'Renditja',
    player: 'Lojtari',
    totalWon: 'Fituar',
    winRate: 'Norma e Fitores',
    loginRequired: 'Ju lutem identifikohuni',
    loginToPlay: 'Identifikohuni për të vendosur baste',
    howItWorks: 'Si funksionon',
    step1: 'Mblidh BidCoins (bonus ditor)',
    step2: 'Bast në fituesit e ankandeve',
    step3: 'Fito më shumë BidCoins!',
    minBet: 'Min: 10',
    maxBet: 'Maks: 500',
    placeYourBet: 'Bast në këtë ankand',
    selectAuction: 'Zgjidh një ankand',
    loading: 'Duke ngarkuar...'
  },
  xk: {
    title: 'Bastet Sociale',
    subtitle: 'Bast në fituesit e ankandeve dhe fito BidCoins!',
    balance: 'Bilanci Yt',
    currency: 'BidCoins',
    dailyBonus: 'Bonusi Ditor',
    claimBonus: 'Merr Bonusin',
    bonusClaimed: 'Bonusi u mor',
    placeBet: 'Vendos Bast',
    myBets: 'Bastet e Mia',
    leaderboard: 'Renditja',
    activeBets: 'Baste Aktive',
    history: 'Historia',
    noBets: 'Asnjë bast ende',
    startBetting: 'Fillo tani!',
    auction: 'Ankand',
    predictedWinner: 'Parashikim',
    amount: 'Shuma',
    odds: 'Kuotat',
    potentialWin: 'Fitim Potencial',
    status: 'Statusi',
    active: 'Aktiv',
    won: 'Fituar',
    lost: 'Humbur',
    rank: 'Renditja',
    player: 'Lojtari',
    totalWon: 'Fituar',
    winRate: 'Norma e Fitores',
    loginRequired: 'Ju lutem identifikohuni',
    loginToPlay: 'Identifikohuni për të vendosur baste',
    howItWorks: 'Si funksionon',
    step1: 'Mblidh BidCoins (bonus ditor)',
    step2: 'Bast në fituesit e ankandeve',
    step3: 'Fito më shumë BidCoins!',
    minBet: 'Min: 10',
    maxBet: 'Maks: 500',
    placeYourBet: 'Bast në këtë ankand',
    selectAuction: 'Zgjidh një ankand',
    loading: 'Duke ngarkuar...'
  }
};

const SocialBettingPage = () => {
  const { isAuthenticated, token, user } = useAuth();
  const { language, mappedLanguage } = useLanguage();
  const navigate = useNavigate();
  const langKey = mappedLanguage || language;
  const t = translations[langKey] || translations.de;

  const [balance, setBalance] = useState(null);
  const [myBets, setMyBets] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [activeTab, setActiveTab] = useState('bets');
  const [loading, setLoading] = useState(true);
  const [claimingBonus, setClaimingBonus] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState(null);
  const [betAmount, setBetAmount] = useState(50);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      const [balanceRes, betsRes, leaderRes, auctionsRes] = await Promise.all([
        fetch(`${API}/api/betting/balance`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API}/api/betting/my-bets`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API}/api/betting/leaderboard`),
        fetch(`${API}/api/auctions?status=active&limit=10`)
      ]);

      if (balanceRes.ok) {
        const data = await balanceRes.json();
        setBalance(data);
      }

      if (betsRes.ok) {
        const data = await betsRes.json();
        setMyBets(data.bets || []);
      }

      if (leaderRes.ok) {
        const data = await leaderRes.json();
        setLeaderboard(data.leaderboard || []);
      }

      if (auctionsRes.ok) {
        const data = await auctionsRes.json();
        setAuctions(data.auctions || []);
      }
    } catch (err) {
      console.error('Error fetching betting data:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleClaimBonus = async () => {
    if (!isAuthenticated) return;
    setClaimingBonus(true);

    try {
      const res = await fetch(`${API}/api/betting/claim-daily-bonus`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`+${data.bonus} ${t.currency}!`);
        fetchData();
      } else {
        toast.error(data.detail || t.bonusClaimed);
      }
    } catch (err) {
      toast.error('Error claiming bonus');
    } finally {
      setClaimingBonus(false);
    }
  };

  const handlePlaceBet = async (auctionId, predictedWinner) => {
    if (!isAuthenticated || !auctionId) return;

    try {
      const res = await fetch(`${API}/api/betting/place-bet/${auctionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          predicted_winner: predictedWinner,
          amount: betAmount
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Wette platziert! Quote: ${data.bet.odds}x`);
        setSelectedAuction(null);
        fetchData();
      } else {
        toast.error(data.detail || 'Error placing bet');
      }
    } catch (err) {
      toast.error('Network error');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900 pt-20 px-4">
        <div className="max-w-md mx-auto text-center py-16">
          <Coins className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">{t.title}</h1>
          <p className="text-gray-400 mb-6">{t.loginToPlay}</p>
          <Button onClick={() => navigate('/login')} className="bg-yellow-500 hover:bg-yellow-600 text-black">
            {t.loginRequired}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900 pt-20 pb-24 px-4" data-testid="social-betting-page">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Coins className="w-10 h-10 text-yellow-500" />
            <h1 className="text-3xl font-black text-white">{t.title}</h1>
          </div>
          <p className="text-gray-400">{t.subtitle}</p>
        </div>

        {/* Balance Card */}
        <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 backdrop-blur rounded-2xl p-6 mb-6 border border-yellow-500/30">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left">
              <p className="text-gray-400 text-sm">{t.balance}</p>
              <p className="text-4xl font-black text-yellow-400">
                {balance?.balance?.toLocaleString() || '1000'} <span className="text-lg">{t.currency}</span>
              </p>
              <div className="flex gap-4 mt-2 text-sm">
                <span className="text-green-400">+{balance?.total_won?.toLocaleString() || 0} {t.won}</span>
                <span className="text-gray-400">|</span>
                <span className="text-purple-400">{balance?.win_rate || 0}% {t.winRate}</span>
              </div>
            </div>

            <Button
              onClick={handleClaimBonus}
              disabled={claimingBonus || !balance?.can_claim_daily_bonus}
              className={`px-6 py-3 font-bold ${
                balance?.can_claim_daily_bonus
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-black'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Gift className="w-5 h-5 mr-2" />
              {balance?.can_claim_daily_bonus ? `${t.claimBonus} (+${balance?.daily_bonus_amount || 50})` : t.bonusClaimed}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'bets', label: t.myBets, icon: <Target className="w-4 h-4" /> },
            { id: 'place', label: t.placeBet, icon: <Zap className="w-4 h-4" /> },
            { id: 'leaderboard', label: t.leaderboard, icon: <Trophy className="w-4 h-4" /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-yellow-500 text-black'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-12 h-12 text-yellow-500 mx-auto animate-spin" />
            <p className="text-gray-400 mt-4">{t.loading}</p>
          </div>
        ) : (
          <>
            {/* My Bets Tab */}
            {activeTab === 'bets' && (
              <div className="space-y-4">
                {myBets.length === 0 ? (
                  <div className="text-center py-12 bg-gray-800/50 rounded-xl">
                    <Coins className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 mb-2">{t.noBets}</p>
                    <Button onClick={() => setActiveTab('place')} className="bg-yellow-500 hover:bg-yellow-600 text-black">
                      {t.startBetting}
                    </Button>
                  </div>
                ) : (
                  myBets.map((bet) => (
                    <div
                      key={bet.id}
                      className={`bg-gray-800/80 backdrop-blur rounded-xl p-4 border ${
                        bet.status === 'won' ? 'border-green-500/50' :
                        bet.status === 'lost' ? 'border-red-500/50' :
                        'border-yellow-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-bold">{bet.product_name || t.auction}</p>
                          <div className="flex items-center gap-4 mt-1 text-sm">
                            <span className="text-gray-400">{t.amount}: <span className="text-yellow-400">{bet.amount}</span></span>
                            <span className="text-gray-400">{t.odds}: <span className="text-purple-400">{bet.odds}x</span></span>
                            <span className="text-gray-400">{t.potentialWin}: <span className="text-green-400">{bet.potential_win}</span></span>
                          </div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                          bet.status === 'won' ? 'bg-green-500/20 text-green-400' :
                          bet.status === 'lost' ? 'bg-red-500/20 text-red-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {bet.status === 'won' ? t.won :
                           bet.status === 'lost' ? t.lost :
                           t.active}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Place Bet Tab */}
            {activeTab === 'place' && (
              <div className="space-y-4">
                {/* Bet Amount Selector */}
                <div className="bg-gray-800/80 backdrop-blur rounded-xl p-4 border border-yellow-500/30">
                  <label className="text-gray-300 text-sm mb-2 block">{t.amount} ({t.minBet} - {t.maxBet})</label>
                  <div className="flex gap-2 flex-wrap">
                    {[10, 25, 50, 100, 200, 500].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setBetAmount(amount)}
                        disabled={amount > (balance?.balance || 0)}
                        className={`px-4 py-2 rounded-lg font-bold transition-all ${
                          betAmount === amount
                            ? 'bg-yellow-500 text-black'
                            : amount > (balance?.balance || 0)
                            ? 'bg-gray-700 text-gray-600 cursor-not-allowed'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {amount}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active Auctions */}
                <h3 className="text-white font-bold text-lg">{t.selectAuction}</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {auctions.slice(0, 6).map((auction) => (
                    <div
                      key={auction.id}
                      className={`bg-gray-800/80 backdrop-blur rounded-xl p-4 border cursor-pointer transition-all ${
                        selectedAuction === auction.id
                          ? 'border-yellow-500 shadow-lg shadow-yellow-500/20'
                          : 'border-gray-700 hover:border-yellow-500/50'
                      }`}
                      onClick={() => setSelectedAuction(auction.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gray-700 rounded-lg overflow-hidden">
                          {auction.product_image && (
                            <img src={auction.product_image} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-white font-bold truncate">{auction.product_name || 'Auktion'}</p>
                          <p className="text-yellow-400 text-sm">€{auction.current_price?.toFixed(2) || '0.00'}</p>
                          <p className="text-gray-500 text-xs">{auction.total_bids || 0} Gebote</p>
                        </div>
                        {selectedAuction === auction.id && (
                          <Zap className="w-6 h-6 text-yellow-500" />
                        )}
                      </div>

                      {selectedAuction === auction.id && (
                        <div className="mt-4 pt-4 border-t border-gray-700">
                          <p className="text-gray-400 text-sm mb-2">{t.placeYourBet}</p>
                          <div className="flex gap-2">
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePlaceBet(auction.id, auction.current_bidder_id || 'random');
                              }}
                              className="flex-1 bg-green-600 hover:bg-green-700"
                            >
                              Aktueller Bieter
                            </Button>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePlaceBet(auction.id, 'bot');
                              }}
                              className="flex-1 bg-purple-600 hover:bg-purple-700"
                            >
                              Neuer Bieter
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Leaderboard Tab */}
            {activeTab === 'leaderboard' && (
              <div className="bg-gray-800/80 backdrop-blur rounded-xl overflow-hidden border border-yellow-500/30">
                <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 px-4 py-3 border-b border-yellow-500/30">
                  <div className="grid grid-cols-4 text-sm font-bold text-gray-400">
                    <span>{t.rank}</span>
                    <span>{t.player}</span>
                    <span className="text-right">{t.totalWon}</span>
                    <span className="text-right">{t.winRate}</span>
                  </div>
                </div>
                <div className="divide-y divide-gray-700">
                  {leaderboard.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Trophy className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p>Noch keine Daten</p>
                    </div>
                  ) : (
                    leaderboard.map((player, idx) => (
                      <div
                        key={idx}
                        className={`grid grid-cols-4 px-4 py-3 items-center ${
                          idx < 3 ? 'bg-yellow-500/5' : ''
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {idx === 0 && <Crown className="w-5 h-5 text-yellow-400" />}
                          {idx === 1 && <Crown className="w-5 h-5 text-gray-400" />}
                          {idx === 2 && <Crown className="w-5 h-5 text-orange-400" />}
                          <span className={idx < 3 ? 'text-yellow-400 font-bold' : 'text-gray-400'}>
                            #{player.rank}
                          </span>
                        </span>
                        <span className="text-white font-medium">{player.name}</span>
                        <span className="text-right text-green-400 font-bold">
                          {player.total_won?.toLocaleString()}
                        </span>
                        <span className="text-right text-purple-400">
                          {player.win_rate}%
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* How It Works */}
        <div className="mt-8 bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            {t.howItWorks}
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center text-yellow-400 font-bold">1</div>
              <p className="text-gray-300">{t.step1}</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center text-yellow-400 font-bold">2</div>
              <p className="text-gray-300">{t.step2}</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center text-yellow-400 font-bold">3</div>
              <p className="text-gray-300">{t.step3}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SocialBettingPage;
