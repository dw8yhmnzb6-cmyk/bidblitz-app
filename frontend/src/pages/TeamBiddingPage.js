import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { 
  Users, Shield, Trophy, Target, Crown, Zap,
  Plus, UserPlus, Star, Medal, ChevronRight
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const translations = {
  de: {
    title: 'Team-Bieten',
    subtitle: 'Bilde ein Team und biete gemeinsam!',
    createTeam: 'Team erstellen',
    joinTeam: 'Team beitreten',
    myTeam: 'Mein Team',
    leaderboard: 'Team-Rangliste',
    members: 'Mitglieder',
    totalBids: 'Gebote gesamt',
    wins: 'Siege',
    teamName: 'Team-Name',
    teamCode: 'Team-Code',
    enterCode: 'Code eingeben',
    create: 'Erstellen',
    join: 'Beitreten',
    leave: 'Verlassen',
    invite: 'Einladen',
    noTeam: 'Du bist noch in keinem Team',
    joinOrCreate: 'Erstelle ein Team oder tritt einem bei!',
    rank: 'Rang',
    team: 'Team',
    points: 'Punkte',
    captain: 'Kapitän',
    member: 'Mitglied',
    loginRequired: 'Bitte anmelden',
    loginToPlay: 'Melde dich an um Teams beizutreten',
    loading: 'Laden...',
    howItWorks: 'So funktioniert es',
    step1: 'Erstelle oder tritt einem Team bei',
    step2: 'Biete auf Auktionen - deine Siege zählen fürs Team!',
    step3: 'Erreiche die Spitze der Rangliste für Bonus-Gebote!',
    bonusRewards: 'Bonus-Belohnungen',
    top1: '1. Platz: 100 Bonus-Gebote',
    top2: '2. Platz: 50 Bonus-Gebote',
    top3: '3. Platz: 25 Bonus-Gebote'
  },
  en: {
    title: 'Team Bidding',
    subtitle: 'Form a team and bid together!',
    createTeam: 'Create Team',
    joinTeam: 'Join Team',
    myTeam: 'My Team',
    leaderboard: 'Team Leaderboard',
    members: 'Members',
    totalBids: 'Total Bids',
    wins: 'Wins',
    teamName: 'Team Name',
    teamCode: 'Team Code',
    enterCode: 'Enter Code',
    create: 'Create',
    join: 'Join',
    leave: 'Leave',
    invite: 'Invite',
    noTeam: 'You\'re not in a team yet',
    joinOrCreate: 'Create a team or join one!',
    rank: 'Rank',
    team: 'Team',
    points: 'Points',
    captain: 'Captain',
    member: 'Member',
    loginRequired: 'Please login',
    loginToPlay: 'Login to join teams',
    loading: 'Loading...',
    howItWorks: 'How it works',
    step1: 'Create or join a team',
    step2: 'Bid on auctions - your wins count for the team!',
    step3: 'Reach the top of the leaderboard for bonus bids!',
    bonusRewards: 'Bonus Rewards',
    top1: '1st Place: 100 bonus bids',
    top2: '2nd Place: 50 bonus bids',
    top3: '3rd Place: 25 bonus bids'
  },
  sq: {
    title: 'Ofertimi në Ekip',
    subtitle: 'Krijo një ekip dhe oferto së bashku!',
    createTeam: 'Krijo Ekip',
    joinTeam: 'Bashkohu Ekipit',
    myTeam: 'Ekipi Im',
    leaderboard: 'Renditja e Ekipeve',
    members: 'Anëtarët',
    totalBids: 'Ofertat Totale',
    wins: 'Fitore',
    teamName: 'Emri i Ekipit',
    teamCode: 'Kodi i Ekipit',
    enterCode: 'Fut Kodin',
    create: 'Krijo',
    join: 'Bashkohu',
    leave: 'Largohu',
    invite: 'Fto',
    noTeam: 'Nuk je në asnjë ekip ende',
    joinOrCreate: 'Krijo një ekip ose bashkohu një!',
    rank: 'Renditja',
    team: 'Ekipi',
    points: 'Pikët',
    captain: 'Kapiteni',
    member: 'Anëtar',
    loginRequired: 'Ju lutem identifikohuni',
    loginToPlay: 'Identifikohuni për të bashkuar ekipe',
    loading: 'Duke ngarkuar...',
    howItWorks: 'Si funksionon',
    step1: 'Krijo ose bashkohu një ekipi',
    step2: 'Oferto në ankande - fitoret e tua numërohen për ekipin!',
    step3: 'Arrij majën e renditjes për oferta bonus!',
    bonusRewards: 'Shpërblimet Bonus',
    top1: 'Vendi 1: 100 oferta bonus',
    top2: 'Vendi 2: 50 oferta bonus',
    top3: 'Vendi 3: 25 oferta bonus'
  },
  xk: {
    title: 'Ofertimi në Ekip',
    subtitle: 'Krijo një ekip dhe oferto së bashku!',
    createTeam: 'Krijo Ekip',
    joinTeam: 'Bashkohu Ekipit',
    myTeam: 'Ekipi Im',
    leaderboard: 'Renditja e Ekipeve',
    members: 'Anëtarët',
    totalBids: 'Ofertat Totale',
    wins: 'Fitore',
    teamName: 'Emri i Ekipit',
    teamCode: 'Kodi i Ekipit',
    enterCode: 'Fut Kodin',
    create: 'Krijo',
    join: 'Bashkohu',
    leave: 'Largohu',
    invite: 'Fto',
    noTeam: 'Nuk je në asnjë ekip ende',
    joinOrCreate: 'Krijo një ekip ose bashkohu një!',
    rank: 'Renditja',
    team: 'Ekipi',
    points: 'Pikët',
    captain: 'Kapiteni',
    member: 'Anëtar',
    loginRequired: 'Ju lutem identifikohuni',
    loginToPlay: 'Identifikohuni për të bashkuar ekipe',
    loading: 'Duke ngarkuar...',
    howItWorks: 'Si funksionon',
    step1: 'Krijo ose bashkohu një ekipi',
    step2: 'Oferto në ankande - fitoret e tua numërohen për ekipin!',
    step3: 'Arrij majën e renditjes për oferta bonus!',
    bonusRewards: 'Shpërblimet Bonus',
    top1: 'Vendi 1: 100 oferta bonus',
    top2: 'Vendi 2: 50 oferta bonus',
    top3: 'Vendi 3: 25 oferta bonus'
  }
};

const TeamBiddingPage = () => {
  const { isAuthenticated, token, user } = useAuth();
  const { language, mappedLanguage } = useLanguage();
  const navigate = useNavigate();
  const langKey = mappedLanguage || language;
  const t = translations[langKey] || translations.de;

  const [activeTab, setActiveTab] = useState('team');
  const [myTeam, setMyTeam] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamCode, setTeamCode] = useState('');

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      const [teamRes, leaderRes] = await Promise.all([
        fetch(`${API}/api/teams/my-team`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API}/api/teams/leaderboard`)
      ]);

      if (teamRes.ok) {
        const data = await teamRes.json();
        setMyTeam(data.team);
      }

      if (leaderRes.ok) {
        const data = await leaderRes.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch (err) {
      console.error('Error fetching team data:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateTeam = async () => {
    if (!teamName) {
      toast.error('Bitte gib einen Team-Namen ein');
      return;
    }

    try {
      const res = await fetch(`${API}/api/teams/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: teamName })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Team erstellt!');
        setShowCreate(false);
        setTeamName('');
        fetchData();
      } else {
        toast.error(data.detail || 'Fehler beim Erstellen');
      }
    } catch (err) {
      toast.error('Netzwerkfehler');
    }
  };

  const handleJoinTeam = async () => {
    if (!teamCode) {
      toast.error('Bitte gib einen Team-Code ein');
      return;
    }

    try {
      const res = await fetch(`${API}/api/teams/join/${teamCode}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Team beigetreten!');
        setShowJoin(false);
        setTeamCode('');
        fetchData();
      } else {
        toast.error(data.detail || 'Fehler beim Beitreten');
      }
    } catch (err) {
      toast.error('Netzwerkfehler');
    }
  };

  const handleLeaveTeam = async () => {
    try {
      const res = await fetch(`${API}/api/teams/leave`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Team verlassen');
        setMyTeam(null);
        fetchData();
      } else {
        toast.error(data.detail || 'Fehler beim Verlassen');
      }
    } catch (err) {
      toast.error('Netzwerkfehler');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-green-900/20 to-gray-900 pt-20 px-4">
        <div className="max-w-md mx-auto text-center py-16">
          <Users className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">{t.title}</h1>
          <p className="text-gray-400 mb-6">{t.loginToPlay}</p>
          <Button onClick={() => navigate('/login')} className="bg-green-500 hover:bg-green-600">
            {t.loginRequired}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-green-900/20 to-gray-900 pt-20 pb-24 px-4" data-testid="team-bidding-page">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Users className="w-10 h-10 text-green-500" />
            <h1 className="text-3xl font-black text-white">{t.title}</h1>
          </div>
          <p className="text-gray-400">{t.subtitle}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'team', label: t.myTeam, icon: <Shield className="w-4 h-4" /> },
            { id: 'leaderboard', label: t.leaderboard, icon: <Trophy className="w-4 h-4" /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* My Team Tab */}
        {activeTab === 'team' && (
          <div className="space-y-6">
            {loading ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-green-500 mx-auto animate-pulse" />
                <p className="text-gray-400 mt-4">{t.loading}</p>
              </div>
            ) : myTeam ? (
              <>
                {/* Team Card */}
                <div className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 backdrop-blur rounded-xl p-6 border border-green-500/30">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-green-500/30 rounded-xl flex items-center justify-center text-3xl">
                        🛡️
                      </div>
                      <div>
                        <h2 className="text-2xl font-black text-white">{myTeam.name}</h2>
                        <p className="text-gray-400">{t.teamCode}: <span className="text-green-400 font-mono">{myTeam.code}</span></p>
                      </div>
                    </div>
                    <Button 
                      onClick={handleLeaveTeam} 
                      variant="outline" 
                      className="border-red-500 text-red-400 hover:bg-red-500/20"
                      data-testid="leave-team-btn"
                    >
                      {t.leave}
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                      <p className="text-gray-400 text-sm">{t.members}</p>
                      <p className="text-2xl font-bold text-white">{myTeam.members?.length || 0}</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                      <p className="text-gray-400 text-sm">{t.totalBids}</p>
                      <p className="text-2xl font-bold text-green-400">{myTeam.shared_bids || 0}</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                      <p className="text-gray-400 text-sm">{t.wins}</p>
                      <p className="text-2xl font-bold text-yellow-400">{myTeam.total_wins || 0}</p>
                    </div>
                  </div>

                  {/* Members List */}
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h3 className="text-white font-bold mb-3">{t.members}</h3>
                    <div className="space-y-2">
                      {(myTeam.members || []).map((member, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 bg-gray-700/50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-sm">
                              {member.is_leader ? '👑' : '👤'}
                            </div>
                            <span className="text-white">{member.username || member.name}</span>
                            {member.is_leader && (
                              <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                                {t.captain}
                              </span>
                            )}
                          </div>
                          <span className="text-green-400">{member.contributed_bids || 0} Gebote</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* No Team */}
                <div className="text-center py-12 bg-gray-800/50 rounded-xl">
                  <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 mb-6">{t.noTeam}</p>
                  <div className="flex gap-4 justify-center">
                    <Button onClick={() => setShowCreate(true)} className="bg-green-600 hover:bg-green-700">
                      <Plus className="w-5 h-5 mr-2" />
                      {t.createTeam}
                    </Button>
                    <Button onClick={() => setShowJoin(true)} className="bg-gray-700 hover:bg-gray-600">
                      <UserPlus className="w-5 h-5 mr-2" />
                      {t.joinTeam}
                    </Button>
                  </div>
                </div>

                {/* Create Team Form */}
                {showCreate && (
                  <div className="bg-gray-800/80 backdrop-blur rounded-xl p-6 border border-green-500/30">
                    <h3 className="text-white font-bold mb-4">{t.createTeam}</h3>
                    <div className="flex gap-4">
                      <input
                        type="text"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        placeholder={t.teamName}
                        className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-green-500 focus:outline-none"
                      />
                      <Button onClick={handleCreateTeam} className="bg-green-600 hover:bg-green-700 px-8">
                        {t.create}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Join Team Form */}
                {showJoin && (
                  <div className="bg-gray-800/80 backdrop-blur rounded-xl p-6 border border-green-500/30">
                    <h3 className="text-white font-bold mb-4">{t.joinTeam}</h3>
                    <div className="flex gap-4">
                      <input
                        type="text"
                        value={teamCode}
                        onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
                        placeholder={t.enterCode}
                        className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white font-mono text-lg text-center tracking-widest focus:border-green-500 focus:outline-none"
                      />
                      <Button onClick={handleJoinTeam} className="bg-green-600 hover:bg-green-700 px-8">
                        {t.join}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <div className="bg-gray-800/80 backdrop-blur rounded-xl overflow-hidden border border-green-500/30">
            <div className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 px-4 py-3 border-b border-green-500/30">
              <div className="grid grid-cols-4 text-sm font-bold text-gray-400">
                <span>{t.rank}</span>
                <span>{t.team}</span>
                <span className="text-right">{t.wins}</span>
                <span className="text-right">{t.points}</span>
              </div>
            </div>
            <div className="divide-y divide-gray-700">
              {leaderboard.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Trophy className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>Noch keine Teams</p>
                </div>
              ) : (
                leaderboard.map((team, idx) => (
                  <div
                    key={idx}
                    className={`grid grid-cols-4 px-4 py-3 items-center ${
                      idx < 3 ? 'bg-green-500/5' : ''
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {idx === 0 && <Crown className="w-5 h-5 text-yellow-400" />}
                      {idx === 1 && <Medal className="w-5 h-5 text-gray-400" />}
                      {idx === 2 && <Medal className="w-5 h-5 text-orange-400" />}
                      <span className={idx < 3 ? 'text-green-400 font-bold' : 'text-gray-400'}>
                        #{idx + 1}
                      </span>
                    </span>
                    <span className="text-white font-medium">{team.name}</span>
                    <span className="text-right text-yellow-400 font-bold">
                      {team.wins || 0}
                    </span>
                    <span className="text-right text-green-400 font-bold">
                      {team.points?.toLocaleString() || 0}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* How It Works & Rewards */}
        <div className="grid md:grid-cols-2 gap-6 mt-8">
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
            <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-green-500" />
              {t.howItWorks}
            </h3>
            <div className="space-y-3">
              {[t.step1, t.step2, t.step3].map((step, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 font-bold text-sm flex-shrink-0">
                    {idx + 1}
                  </div>
                  <p className="text-gray-300">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
            <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              {t.bonusRewards}
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                <span className="text-2xl">🥇</span>
                <span className="text-yellow-400">{t.top1}</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-500/10 rounded-lg border border-gray-500/30">
                <span className="text-2xl">🥈</span>
                <span className="text-gray-300">{t.top2}</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-orange-500/10 rounded-lg border border-orange-500/30">
                <span className="text-2xl">🥉</span>
                <span className="text-orange-400">{t.top3}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamBiddingPage;
