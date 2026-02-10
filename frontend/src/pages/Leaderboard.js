import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import { 
  Trophy, Crown, Medal, Star, Zap, Clock, 
  ChevronUp, ChevronDown, User, Calendar
} from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const Leaderboard = () => {
  const { token, user } = useAuth();
  const { language , mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [weekInfo, setWeekInfo] = useState({ start: null, end: null });
  const [prizes, setPrizes] = useState({});
  const [loading, setLoading] = useState(true);

  const t = {
    de: {
      title: 'Wochen-Rangliste',
      subtitle: 'Top 10 gewinnen am Sonntag Gratis-Gebote!',
      rank: 'Platz',
      user: 'Nutzer',
      bids: 'Gebote',
      prize: 'Preis',
      yourPosition: 'Deine Position',
      notRanked: 'Noch nicht platziert',
      bidMore: 'Biete mehr, um in die Top 10 zu kommen!',
      weekPeriod: 'Wochenperiode',
      endsIn: 'Endet in',
      freeBids: 'Gratis-Gebote',
      loginToSee: 'Einloggen um deine Position zu sehen',
      loading: 'Lade Rangliste...',
      vip: 'VIP',
    },
    en: {
      title: 'Weekly Leaderboard',
      subtitle: 'Top 10 win free bids on Sunday!',
      rank: 'Rank',
      user: 'User',
      bids: 'Bids',
      prize: 'Prize',
      yourPosition: 'Your Position',
      notRanked: 'Not ranked yet',
      bidMore: 'Bid more to enter the Top 10!',
      weekPeriod: 'Week Period',
      endsIn: 'Ends in',
      freeBids: 'Free Bids',
      loginToSee: 'Login to see your position',
      loading: 'Loading leaderboard...',
      vip: 'VIP',
    },
    tr: {
      title: 'Haftalık Sıralama',
      subtitle: 'İlk 10 Pazar günü ücretsiz teklif kazanır!',
      rank: 'Sıra',
      user: 'Kullanıcı',
      bids: 'Teklifler',
      prize: 'Ödül',
      yourPosition: 'Senin Sıran',
      notRanked: 'Henüz sıralanmadın',
      bidMore: 'İlk 10\'a girmek için daha fazla teklif ver!',
      weekPeriod: 'Hafta Dönemi',
      endsIn: 'Bitiş',
      freeBids: 'Ücretsiz Teklifler',
      loginToSee: 'Sıranı görmek için giriş yap',
      loading: 'Sıralama yükleniyor...',
      vip: 'VIP',
    },
    sq: {
      title: 'Renditja Javore',
      subtitle: 'Top 10 fitojnë oferta falas të dielën!',
      rank: 'Pozicioni',
      user: 'Përdoruesi',
      bids: 'Ofertat',
      prize: 'Çmimi',
      yourPosition: 'Pozicioni Yt',
      notRanked: 'Ende pa u renditur',
      bidMore: 'Bëj më shumë oferta për të hyrë në Top 10!',
      weekPeriod: 'Periudha Javore',
      endsIn: 'Përfundon në',
      freeBids: 'Oferta Falas',
      loginToSee: 'Hyr për të parë pozicionin tënd',
      loading: 'Duke ngarkuar renditjen...',
      vip: 'VIP',
    },
    xk: {
      title: 'Renditja Javore',
      subtitle: 'Top 10 fitojnë oferta falas të dielën!',
      rank: 'Pozicioni',
      user: 'Përdoruesi',
      bids: 'Ofertat',
      prize: 'Çmimi',
      yourPosition: 'Pozicioni Yt',
      notRanked: 'Ende pa u renditur',
      bidMore: 'Bëj më shumë oferta për të hyrë në Top 10!',
      weekPeriod: 'Periudha Javore',
      endsIn: 'Përfundon në',
      freeBids: 'Oferta Falas',
      loginToSee: 'Hyr për të parë pozicionin tënd',
      loading: 'Duke ngarkuar renditjen...',
      vip: 'VIP',
    }
  };
  const text = t[langKey] || t.de;

  useEffect(() => {
    fetchLeaderboard();
  }, [token]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      let res;
      if (token) {
        res = await axios.get(`${API}/api/leaderboard`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCurrentUser(res.data.current_user);
      } else {
        res = await axios.get(`${API}/api/leaderboard/public`);
      }
      
      setLeaderboard(res.data.leaderboard || []);
      setPrizes(res.data.prizes || {});
      setWeekInfo({
        start: res.data.week_start,
        end: res.data.week_end
      });
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      toast.error('Fehler beim Laden der Rangliste');
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-400" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-600" />;
      case 3:
        return <Medal className="w-6 h-6 text-amber-600" />;
      default:
        return <Star className="w-5 h-5 text-blue-400" />;
    }
  };

  const getRankBg = (rank) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/50';
      case 2:
        return 'bg-gradient-to-r from-gray-400/20 to-gray-500/20 border-gray-400/50';
      case 3:
        return 'bg-gradient-to-r from-amber-600/20 to-orange-600/20 border-amber-600/50';
      default:
        return 'bg-white shadow-md border-gray-200';
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString(language === 'de' ? 'de-DE' : language === 'en' ? 'en-US' : 'tr-TR', {
      day: '2-digit',
      month: '2-digit'
    });
  };

  const getTimeRemaining = () => {
    if (!weekInfo.end) return '';
    const end = new Date(weekInfo.end);
    const now = new Date();
    const diff = end - now;
    
    if (diff <= 0) return 'Ended';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    return `${hours}h`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Trophy className="w-10 h-10 text-yellow-400" />
            <h1 className="text-3xl font-bold text-gray-800">{text.title}</h1>
          </div>
          <p className="text-gray-500">{text.subtitle}</p>
          
          {/* Week Info */}
          <div className="mt-4 inline-flex items-center gap-4 px-4 py-2 rounded-full bg-white shadow-md border border-gray-200">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-blue-400" />
              <span className="text-gray-500">{formatDate(weekInfo.start)} - {formatDate(weekInfo.end)}</span>
            </div>
            <div className="w-px h-4 bg-white/20"></div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-green-400" />
              <span className="text-green-400 font-medium">{text.endsIn}: {getTimeRemaining()}</span>
            </div>
          </div>
        </div>

        {/* Prize Overview */}
        <div className="mb-8 grid grid-cols-3 gap-3">
          {[1, 2, 3].map(rank => (
            <div 
              key={rank}
              className={`p-4 rounded-xl text-center border ${getRankBg(rank)}`}
            >
              {getRankIcon(rank)}
              <p className="text-gray-800 font-bold mt-2">{text.rank} {rank}</p>
              <p className="text-yellow-400 font-mono text-lg flex items-center justify-center gap-1">
                <Zap className="w-4 h-4" />
                {prizes[rank]?.bids || 0}
              </p>
              <p className="text-gray-500 text-xs">{text.freeBids}</p>
            </div>
          ))}
        </div>

        {/* Current User Position */}
        {token && currentUser && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30" data-testid="user-position">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-500/30 flex items-center justify-center">
                  <User className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-gray-500 text-sm">{text.yourPosition}</p>
                  <p className="text-gray-800 font-bold">
                    {currentUser.rank <= 10 ? (
                      <span className="text-green-400">#{currentUser.rank}</span>
                    ) : (
                      <span>#{currentUser.rank}</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-gray-500 text-sm">{text.bids}</p>
                <p className="text-yellow-400 font-bold font-mono">{currentUser.total_bids || 0}</p>
              </div>
              {currentUser.prize && (
                <div className="text-right">
                  <p className="text-gray-500 text-sm">{text.prize}</p>
                  <p className="text-green-400 font-bold flex items-center gap-1">
                    <Zap className="w-4 h-4" />
                    {currentUser.prize.bids}
                  </p>
                </div>
              )}
            </div>
            {currentUser.rank > 10 && (
              <p className="text-gray-500 text-sm mt-2 text-center">{text.bidMore}</p>
            )}
          </div>
        )}

        {!token && (
          <div className="mb-6 p-4 rounded-xl bg-white shadow-md border border-gray-200 text-center">
            <p className="text-gray-500">{text.loginToSee}</p>
          </div>
        )}

        {/* Leaderboard Table */}
        <div className="glass-card rounded-xl overflow-hidden" data-testid="leaderboard-table">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 p-4 bg-[#1A1A2E] border-b border-gray-200 text-sm font-medium text-gray-500">
            <div className="col-span-2">{text.rank}</div>
            <div className="col-span-6">{text.user}</div>
            <div className="col-span-2 text-right">{text.bids}</div>
            <div className="col-span-2 text-right">{text.prize}</div>
          </div>

          {/* Rows */}
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-400 mx-auto mb-2"></div>
              {text.loading}
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {text.notRanked}
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {leaderboard.map((entry, index) => (
                <div 
                  key={entry.user_id || index}
                  className={`grid grid-cols-12 gap-2 p-4 items-center transition-colors hover:bg-white/5 ${
                    currentUser?.user_id === entry.user_id ? 'bg-purple-500/10' : ''
                  } ${getRankBg(entry.rank)}`}
                  data-testid={`leaderboard-row-${entry.rank}`}
                >
                  {/* Rank */}
                  <div className="col-span-2 flex items-center gap-2">
                    {getRankIcon(entry.rank)}
                    <span className={`font-bold ${entry.rank <= 3 ? 'text-gray-800 text-lg' : 'text-gray-500'}`}>
                      #{entry.rank}
                    </span>
                  </div>
                  
                  {/* User */}
                  <div className="col-span-6 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-gray-800 font-bold">
                      {entry.username?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="text-gray-800 font-medium flex items-center gap-2">
                        {entry.username}
                        {entry.is_vip && (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400 flex items-center gap-1">
                            <Crown className="w-3 h-3" />
                            {text.vip}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  
                  {/* Bids */}
                  <div className="col-span-2 text-right">
                    <span className="text-yellow-400 font-mono font-bold">{entry.total_bids}</span>
                  </div>
                  
                  {/* Prize */}
                  <div className="col-span-2 text-right">
                    {entry.prize && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-sm font-medium">
                        <Zap className="w-3 h-3" />
                        {entry.prize.bids}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Prize Legend */}
        <div className="mt-6 p-4 rounded-xl bg-white shadow-md border border-gray-200">
          <h3 className="text-gray-800 font-bold mb-3 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            {text.prize}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
            {Object.entries(prizes).slice(0, 10).map(([rank, prize]) => (
              <div key={rank} className="flex items-center gap-2 text-gray-500">
                <span className="text-gray-800 font-medium">#{rank}:</span>
                <span className="text-yellow-400">{prize.bids} {text.freeBids}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
