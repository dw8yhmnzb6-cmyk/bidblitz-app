import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { 
  Users, Swords, Trophy, Clock, Crown, Target,
  Zap, ChevronRight, Plus, Star, UserPlus
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const translations = {
  de: {
    title: 'Freunde-Battles',
    subtitle: 'Lade Freunde ein und kämpfe um Preise!',
    createBattle: 'Battle erstellen',
    joinBattle: 'Battle beitreten',
    myBattles: 'Meine Battles',
    invitations: 'Einladungen',
    active: 'Aktiv',
    completed: 'Abgeschlossen',
    noBattles: 'Noch keine Battles',
    startFirst: 'Starte dein erstes Battle!',
    noInvitations: 'Keine Einladungen',
    inviteFriend: 'Freund einladen',
    friendEmail: 'E-Mail des Freundes',
    stake: 'Einsatz',
    bids: 'Gebote',
    winner: 'Gewinner',
    loser: 'Verlierer',
    draw: 'Unentschieden',
    duration: 'Dauer',
    hours: 'Stunden',
    accept: 'Annehmen',
    decline: 'Ablehnen',
    vs: 'VS',
    you: 'Du',
    waiting: 'Wartet...',
    inProgress: 'Läuft',
    finished: 'Beendet',
    prize: 'Preis',
    rules: 'Regeln',
    rule1: 'Beide Spieler setzen Gebote ein',
    rule2: 'Wer mehr Auktionen gewinnt, gewinnt das Battle',
    rule3: 'Der Gewinner erhält alle eingesetzten Gebote!',
    loginRequired: 'Bitte anmelden',
    loginToPlay: 'Melde dich an um Battles zu spielen',
    loading: 'Laden...',
    battleCode: 'Battle-Code',
    enterCode: 'Code eingeben',
    join: 'Beitreten',
    create: 'Erstellen'
  },
  en: {
    title: 'Friends Battle',
    subtitle: 'Challenge friends and compete for prizes!',
    createBattle: 'Create Battle',
    joinBattle: 'Join Battle',
    myBattles: 'My Battles',
    invitations: 'Invitations',
    active: 'Active',
    completed: 'Completed',
    noBattles: 'No battles yet',
    startFirst: 'Start your first battle!',
    noInvitations: 'No invitations',
    inviteFriend: 'Invite Friend',
    friendEmail: 'Friend\'s Email',
    stake: 'Stake',
    bids: 'Bids',
    winner: 'Winner',
    loser: 'Loser',
    draw: 'Draw',
    duration: 'Duration',
    hours: 'Hours',
    accept: 'Accept',
    decline: 'Decline',
    vs: 'VS',
    you: 'You',
    waiting: 'Waiting...',
    inProgress: 'In Progress',
    finished: 'Finished',
    prize: 'Prize',
    rules: 'Rules',
    rule1: 'Both players stake bids',
    rule2: 'Who wins more auctions wins the battle',
    rule3: 'Winner takes all staked bids!',
    loginRequired: 'Please login',
    loginToPlay: 'Login to play battles',
    loading: 'Loading...',
    battleCode: 'Battle Code',
    enterCode: 'Enter Code',
    join: 'Join',
    create: 'Create'
  },
  sq: {
    title: 'Betejat me Miqtë',
    subtitle: 'Sfido miqtë dhe lufto për çmime!',
    createBattle: 'Krijo Betejë',
    joinBattle: 'Bashkohu Betejës',
    myBattles: 'Betejat e Mia',
    invitations: 'Ftesat',
    active: 'Aktive',
    completed: 'Të përfunduara',
    noBattles: 'Asnjë betejë ende',
    startFirst: 'Fillo betejën e parë!',
    noInvitations: 'Asnjë ftesë',
    inviteFriend: 'Fto Mikun',
    friendEmail: 'Email i Mikut',
    stake: 'Basti',
    bids: 'Oferta',
    winner: 'Fituesi',
    loser: 'Humbësi',
    draw: 'Barazim',
    duration: 'Kohëzgjatja',
    hours: 'Orë',
    accept: 'Prano',
    decline: 'Refuzo',
    vs: 'VS',
    you: 'Ti',
    waiting: 'Duke pritur...',
    inProgress: 'Në Progres',
    finished: 'E përfunduar',
    prize: 'Çmimi',
    rules: 'Rregullat',
    rule1: 'Të dy lojtarët vendosin baste',
    rule2: 'Kush fiton më shumë ankande fiton betejën',
    rule3: 'Fituesi merr të gjitha ofertat e bastuara!',
    loginRequired: 'Ju lutem identifikohuni',
    loginToPlay: 'Identifikohuni për të luajtur beteja',
    loading: 'Duke ngarkuar...',
    battleCode: 'Kodi i Betejës',
    enterCode: 'Fut Kodin',
    join: 'Bashkohu',
    create: 'Krijo'
  },
  // Kosovo uses same as Albanian
  xk: {
    title: 'Betejat me Miqtë',
    subtitle: 'Sfido miqtë dhe lufto për çmime!',
    createBattle: 'Krijo Betejë',
    joinBattle: 'Bashkohu Betejës',
    myBattles: 'Betejat e Mia',
    invitations: 'Ftesat',
    active: 'Aktive',
    completed: 'Të përfunduara',
    noBattles: 'Asnjë betejë ende',
    startFirst: 'Fillo betejën e parë!',
    noInvitations: 'Asnjë ftesë',
    inviteFriend: 'Fto Mikun',
    friendEmail: 'Email i Mikut',
    stake: 'Basti',
    bids: 'Oferta',
    winner: 'Fituesi',
    loser: 'Humbësi',
    draw: 'Barazim',
    duration: 'Kohëzgjatja',
    hours: 'Orë',
    accept: 'Prano',
    decline: 'Refuzo',
    vs: 'VS',
    you: 'Ti',
    waiting: 'Duke pritur...',
    inProgress: 'Në Progres',
    finished: 'E përfunduar',
    prize: 'Çmimi',
    rules: 'Rregullat',
    rule1: 'Të dy lojtarët vendosin baste',
    rule2: 'Kush fiton më shumë ankande fiton betejën',
    rule3: 'Fituesi merr të gjitha ofertat e bastuara!',
    loginRequired: 'Ju lutem identifikohuni',
    loginToPlay: 'Identifikohuni për të luajtur beteja',
    loading: 'Duke ngarkuar...',
    battleCode: 'Kodi i Betejës',
    enterCode: 'Fut Kodin',
    join: 'Bashkohu',
    create: 'Krijo'
  }
};

const FriendBattlesPage = () => {
  const { isAuthenticated, token, user } = useAuth();
  const { language, mappedLanguage } = useLanguage();
  const navigate = useNavigate();
  const langKey = mappedLanguage || language;
  const t = translations[langKey] || translations.de;

  const [activeTab, setActiveTab] = useState('battles');
  const [battles, setBattles] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [friendEmail, setFriendEmail] = useState('');
  const [stake, setStake] = useState(10);
  const [duration, setDuration] = useState(24);
  const [battleCode, setBattleCode] = useState('');

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      const [battlesRes, invitationsRes] = await Promise.all([
        fetch(`${API}/api/friend-battles/my-battles`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API}/api/friend-battles/invitations`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (battlesRes.ok) {
        const data = await battlesRes.json();
        setBattles(data.battles || []);
      }

      if (invitationsRes.ok) {
        const data = await invitationsRes.json();
        setInvitations(data.invitations || []);
      }
    } catch (err) {
      console.error('Error fetching battles:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateBattle = async () => {
    if (!friendEmail) {
      toast.error('Bitte gib die E-Mail deines Freundes ein');
      return;
    }

    try {
      const res = await fetch(`${API}/api/friend-battles/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          opponent_email: friendEmail,
          stake_bids: stake,
          duration_hours: duration
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Battle erstellt! Warte auf Annahme.');
        setShowCreate(false);
        setFriendEmail('');
        fetchData();
      } else {
        toast.error(data.detail || 'Fehler beim Erstellen');
      }
    } catch (err) {
      toast.error('Netzwerkfehler');
    }
  };

  const handleJoinBattle = async () => {
    if (!battleCode) {
      toast.error('Bitte gib einen Battle-Code ein');
      return;
    }

    try {
      const res = await fetch(`${API}/api/friend-battles/join/${battleCode}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Battle beigetreten!');
        setShowJoin(false);
        setBattleCode('');
        fetchData();
      } else {
        toast.error(data.detail || 'Fehler beim Beitreten');
      }
    } catch (err) {
      toast.error('Netzwerkfehler');
    }
  };

  const handleAcceptInvitation = async (battleId) => {
    try {
      const res = await fetch(`${API}/api/friend-battles/${battleId}/accept`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        toast.success('Battle akzeptiert!');
        fetchData();
      }
    } catch (err) {
      toast.error('Fehler');
    }
  };

  const handleDeclineInvitation = async (battleId) => {
    try {
      const res = await fetch(`${API}/api/friend-battles/${battleId}/decline`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        toast.success('Battle abgelehnt');
        fetchData();
      }
    } catch (err) {
      toast.error('Fehler');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-orange-900/20 to-gray-900 pt-20 px-4">
        <div className="max-w-md mx-auto text-center py-16">
          <Swords className="w-16 h-16 text-orange-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">{t.title}</h1>
          <p className="text-gray-400 mb-6">{t.loginToPlay}</p>
          <Button onClick={() => navigate('/login')} className="bg-orange-500 hover:bg-orange-600">
            {t.loginRequired}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-orange-900/20 to-gray-900 pt-20 pb-24 px-4" data-testid="friend-battles-page">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Swords className="w-10 h-10 text-orange-500" />
            <h1 className="text-3xl font-black text-white">{t.title}</h1>
          </div>
          <p className="text-gray-400">{t.subtitle}</p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Button
            onClick={() => { setShowCreate(true); setShowJoin(false); }}
            className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 py-4"
          >
            <Plus className="w-5 h-5 mr-2" />
            {t.createBattle}
          </Button>
          <Button
            onClick={() => { setShowJoin(true); setShowCreate(false); }}
            className="bg-gray-700 hover:bg-gray-600 py-4"
          >
            <UserPlus className="w-5 h-5 mr-2" />
            {t.joinBattle}
          </Button>
        </div>

        {/* Create Battle Form */}
        {showCreate && (
          <div className="bg-gray-800/80 backdrop-blur rounded-xl p-6 mb-6 border border-orange-500/30">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <Swords className="w-5 h-5 text-orange-500" />
              {t.createBattle}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-gray-300 text-sm mb-1 block">{t.friendEmail}</label>
                <input
                  type="email"
                  value={friendEmail}
                  onChange={(e) => setFriendEmail(e.target.value)}
                  placeholder="freund@example.com"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-gray-300 text-sm mb-1 block">{t.stake}: {stake} {t.bids}</label>
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={stake}
                  onChange={(e) => setStake(parseInt(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>
              <div>
                <label className="text-gray-300 text-sm mb-1 block">{t.duration}: {duration} {t.hours}</label>
                <div className="flex gap-2">
                  {[12, 24, 48, 72].map((h) => (
                    <button
                      key={h}
                      onClick={() => setDuration(h)}
                      className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                        duration === h
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
              </div>
              <Button onClick={handleCreateBattle} className="w-full bg-orange-600 hover:bg-orange-700">
                {t.create}
              </Button>
            </div>
          </div>
        )}

        {/* Join Battle Form */}
        {showJoin && (
          <div className="bg-gray-800/80 backdrop-blur rounded-xl p-6 mb-6 border border-orange-500/30">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-orange-500" />
              {t.joinBattle}
            </h3>
            <div className="flex gap-4">
              <input
                type="text"
                value={battleCode}
                onChange={(e) => setBattleCode(e.target.value.toUpperCase())}
                placeholder={t.enterCode}
                className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white font-mono text-lg text-center tracking-widest focus:border-orange-500 focus:outline-none"
              />
              <Button onClick={handleJoinBattle} className="bg-orange-600 hover:bg-orange-700 px-8">
                {t.join}
              </Button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'battles', label: t.myBattles, icon: <Swords className="w-4 h-4" /> },
            { id: 'invitations', label: `${t.invitations} (${invitations.length})`, icon: <Users className="w-4 h-4" /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Battles Tab */}
        {activeTab === 'battles' && (
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <Swords className="w-12 h-12 text-orange-500 mx-auto animate-pulse" />
                <p className="text-gray-400 mt-4">{t.loading}</p>
              </div>
            ) : battles.length === 0 ? (
              <div className="text-center py-12 bg-gray-800/50 rounded-xl">
                <Swords className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 mb-2">{t.noBattles}</p>
                <Button onClick={() => setShowCreate(true)} className="bg-orange-600 hover:bg-orange-700">
                  {t.startFirst}
                </Button>
              </div>
            ) : (
              battles.map((battle) => (
                <div
                  key={battle.id}
                  className="bg-gray-800/80 backdrop-blur rounded-xl p-6 border border-orange-500/30"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                      battle.status === 'active'
                        ? 'bg-green-500/20 text-green-400'
                        : battle.status === 'pending'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {battle.status === 'active' ? t.inProgress :
                       battle.status === 'pending' ? t.waiting :
                       t.finished}
                    </span>
                    <span className="text-gray-400 text-sm flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {battle.duration_hours}h
                    </span>
                  </div>

                  <div className="flex items-center justify-center gap-6">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center text-2xl mb-2">
                        👤
                      </div>
                      <p className="text-white font-bold">{battle.player1_name || t.you}</p>
                      <p className="text-orange-400 font-bold text-xl">{battle.player1_wins || 0}</p>
                    </div>

                    <div className="text-center">
                      <p className="text-orange-500 font-black text-2xl">{t.vs}</p>
                      <p className="text-yellow-400 text-sm mt-1">{battle.stake_bids * 2} {t.bids}</p>
                    </div>

                    <div className="text-center">
                      <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center text-2xl mb-2">
                        👤
                      </div>
                      <p className="text-white font-bold">{battle.player2_name || t.waiting}</p>
                      <p className="text-orange-400 font-bold text-xl">{battle.player2_wins || 0}</p>
                    </div>
                  </div>

                  {battle.winner_id && (
                    <div className="mt-4 text-center">
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/20 rounded-full">
                        <Crown className="w-5 h-5 text-yellow-500" />
                        <span className="text-yellow-400 font-bold">
                          {t.winner}: {battle.winner_name}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Invitations Tab */}
        {activeTab === 'invitations' && (
          <div className="space-y-4">
            {invitations.length === 0 ? (
              <div className="text-center py-12 bg-gray-800/50 rounded-xl">
                <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">{t.noInvitations}</p>
              </div>
            ) : (
              invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="bg-gray-800/80 backdrop-blur rounded-xl p-4 border border-yellow-500/30 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center text-xl">
                      ⚔️
                    </div>
                    <div>
                      <p className="text-white font-bold">{inv.challenger_name}</p>
                      <p className="text-gray-400 text-sm">{inv.stake_bids} {t.bids} | {inv.duration_hours}h</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleAcceptInvitation(inv.id)}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {t.accept}
                    </Button>
                    <Button
                      onClick={() => handleDeclineInvitation(inv.id)}
                      size="sm"
                      variant="outline"
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      {t.decline}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Rules */}
        <div className="mt-8 bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-orange-500" />
            {t.rules}
          </h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-orange-500/20 rounded-full flex items-center justify-center text-orange-400 font-bold text-sm">1</div>
              <p className="text-gray-300">{t.rule1}</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-orange-500/20 rounded-full flex items-center justify-center text-orange-400 font-bold text-sm">2</div>
              <p className="text-gray-300">{t.rule2}</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-orange-500/20 rounded-full flex items-center justify-center text-orange-400 font-bold text-sm">3</div>
              <p className="text-gray-300">{t.rule3}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FriendBattlesPage;
