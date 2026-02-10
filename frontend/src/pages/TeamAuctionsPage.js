import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { safeCopyToClipboard } from '../utils/clipboard';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { Users, Crown, Trophy, Plus, Copy, UserPlus, LogOut, Zap } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function TeamAuctionsPage() {
  const { language , mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const { token, isAuthenticated } = useAuth();
  const [myTeam, setMyTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [contributeBids, setContributeBids] = useState(10);

  const texts = {
    de: {
      title: 'Team-Auktionen',
      subtitle: 'Biete gemeinsam mit Freunden!',
      createTeam: 'Team erstellen',
      joinTeam: 'Team beitreten',
      teamCode: 'Team-Code',
      teamName: 'Team-Name',
      create: 'Erstellen',
      join: 'Beitreten',
      leave: 'Verlassen',
      members: 'Mitglieder',
      sharedBids: 'Team-Gebote',
      contribute: 'Gebote einzahlen',
      yourTeam: 'Dein Team',
      noTeam: 'Du bist noch in keinem Team',
      leaderboard: 'Team-Rangliste',
      wins: 'Siege',
      copyCode: 'Code kopieren',
      leader: 'Leader',
      contributed: 'Eingezahlt',
      loginRequired: 'Bitte melde dich an'
    },
    en: {
      title: 'Team Auctions',
      subtitle: 'Bid together with friends!',
      createTeam: 'Create Team',
      joinTeam: 'Join Team',
      teamCode: 'Team Code',
      teamName: 'Team Name',
      create: 'Create',
      join: 'Join',
      leave: 'Leave',
      members: 'Members',
      sharedBids: 'Team Bids',
      contribute: 'Contribute Bids',
      yourTeam: 'Your Team',
      noTeam: 'You are not in a team yet',
      leaderboard: 'Team Leaderboard',
      wins: 'Wins',
      copyCode: 'Copy Code',
      leader: 'Leader',
      contributed: 'Contributed',
      loginRequired: 'Please log in'
    }
  };

  const t = texts[langKey] || texts.de;

  useEffect(() => {
    if (token) {
      fetchMyTeam();
      fetchLeaderboard();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchMyTeam = async () => {
    try {
      const res = await fetch(`${API_URL}/api/teams/my-team`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.has_team) {
        setMyTeam(data.team);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(`${API_URL}/api/teams/leaderboard`);
      const data = await res.json();
      setLeaderboard(data.leaderboard || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) {
      toast.error('Team-Name erforderlich');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/teams/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: newTeamName, max_members: 3 })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchMyTeam();
        setShowCreate(false);
        setNewTeamName('');
      } else {
        toast.error(data.detail || 'Fehler');
      }
    } catch (err) {
      toast.error('Fehler beim Erstellen');
    }
  };

  const handleJoinTeam = async () => {
    if (!joinCode.trim()) {
      toast.error('Team-Code erforderlich');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/teams/join/${joinCode.toUpperCase()}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchMyTeam();
        setJoinCode('');
      } else {
        toast.error(data.detail || 'Fehler');
      }
    } catch (err) {
      toast.error('Fehler beim Beitreten');
    }
  };

  const handleLeaveTeam = async () => {
    if (!window.confirm('Team wirklich verlassen?')) return;

    try {
      const res = await fetch(`${API_URL}/api/teams/leave`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setMyTeam(null);
      }
    } catch (err) {
      toast.error('Fehler');
    }
  };

  const handleContribute = async () => {
    try {
      const res = await fetch(`${API_URL}/api/teams/contribute-bids?bid_count=${contributeBids}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchMyTeam();
      } else {
        toast.error(data.detail || 'Fehler');
      }
    } catch (err) {
      toast.error('Fehler');
    }
  };

  const copyTeamCode = async () => {
    if (myTeam?.code) {
      const success = await safeCopyToClipboard(myTeam.code);
      if (success) toast.success('Code kopiert!');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 flex items-center justify-center">
        <Card className="bg-[#1A1A2E] border-gray-200 p-8 text-center">
          <Users className="w-16 h-16 text-[#7C3AED] mx-auto mb-4" />
          <p className="text-gray-800 text-xl">{t.loginRequired}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4" data-testid="team-auctions-page">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#EC4899] mb-4">
            <Users className="w-10 h-10 text-gray-800" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">{t.title}</h1>
          <p className="text-gray-500">{t.subtitle}</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Laden...</div>
        ) : myTeam ? (
          /* User has a team */
          <div className="space-y-6">
            {/* Team Info */}
            <Card className="bg-gradient-to-r from-[#7C3AED]/20 to-[#EC4899]/20 border-[#7C3AED]/30">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-[#7C3AED] flex items-center justify-center">
                      <Crown className="w-7 h-7 text-gray-800" />
                    </div>
                    <div>
                      <CardTitle className="text-gray-800 text-2xl">{myTeam.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className="bg-[#7C3AED]/20 text-[#7C3AED]">
                          Code: {myTeam.code}
                        </Badge>
                        <Button size="sm" variant="ghost" onClick={copyTeamCode}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" onClick={handleLeaveTeam} className="border-red-500/30 text-red-400">
                    <LogOut className="w-4 h-4 mr-2" />
                    {t.leave}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Team Stats */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-gradient-to-b from-cyan-50 to-cyan-100 rounded-lg p-4 text-center">
                    <Users className="w-6 h-6 text-[#7C3AED] mx-auto mb-1" />
                    <p className="text-2xl font-bold text-gray-800">{myTeam.members?.length || 0}/{myTeam.max_members}</p>
                    <p className="text-gray-500 text-sm">{t.members}</p>
                  </div>
                  <div className="bg-gradient-to-b from-cyan-50 to-cyan-100 rounded-lg p-4 text-center">
                    <Zap className="w-6 h-6 text-[#F59E0B] mx-auto mb-1" />
                    <p className="text-2xl font-bold text-gray-800">{myTeam.shared_bids || 0}</p>
                    <p className="text-gray-500 text-sm">{t.sharedBids}</p>
                  </div>
                  <div className="bg-gradient-to-b from-cyan-50 to-cyan-100 rounded-lg p-4 text-center">
                    <Trophy className="w-6 h-6 text-[#10B981] mx-auto mb-1" />
                    <p className="text-2xl font-bold text-gray-800">{myTeam.total_wins || 0}</p>
                    <p className="text-gray-500 text-sm">{t.wins}</p>
                  </div>
                </div>

                {/* Members List */}
                <div className="space-y-2 mb-6">
                  <h4 className="text-gray-800 font-medium">{t.members}</h4>
                  {myTeam.members?.map((member, i) => (
                    <div key={i} className="flex items-center justify-between bg-gradient-to-b from-cyan-50 to-cyan-100 rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#7C3AED]/20 flex items-center justify-center">
                          {member.is_leader ? <Crown className="w-5 h-5 text-[#F59E0B]" /> : <Users className="w-5 h-5 text-[#7C3AED]" />}
                        </div>
                        <div>
                          <p className="text-gray-800">{member.username}</p>
                          {member.is_leader && <Badge className="bg-[#F59E0B]/20 text-[#F59E0B] text-xs">{t.leader}</Badge>}
                        </div>
                      </div>
                      <p className="text-gray-500 text-sm">{member.contributed_bids} {t.contributed}</p>
                    </div>
                  ))}
                </div>

                {/* Contribute Bids */}
                <div className="bg-gradient-to-b from-cyan-50 to-cyan-100 rounded-lg p-4">
                  <h4 className="text-gray-800 font-medium mb-3">{t.contribute}</h4>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={contributeBids}
                      onChange={(e) => setContributeBids(parseInt(e.target.value) || 0)}
                      min={1}
                      className="bg-[#1A1A2E] border-gray-200 text-gray-800 w-24"
                    />
                    <Button onClick={handleContribute} className="bg-[#7C3AED]">
                      <Plus className="w-4 h-4 mr-2" />
                      {t.contribute}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* User has no team */
          <div className="space-y-6">
            <Card className="bg-[#1A1A2E] border-gray-200">
              <CardContent className="p-6 text-center">
                <Users className="w-16 h-16 text-gray-500 mx-auto mb-4 opacity-50" />
                <h3 className="text-gray-800 text-xl mb-4">{t.noTeam}</h3>
                
                {/* Join Team */}
                <div className="bg-gradient-to-b from-cyan-50 to-cyan-100 rounded-lg p-4 mb-4">
                  <h4 className="text-gray-800 font-medium mb-3">{t.joinTeam}</h4>
                  <div className="flex gap-2">
                    <Input
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder={t.teamCode}
                      className="bg-[#1A1A2E] border-gray-200 text-gray-800"
                    />
                    <Button onClick={handleJoinTeam} className="bg-[#10B981]">
                      <UserPlus className="w-4 h-4 mr-2" />
                      {t.join}
                    </Button>
                  </div>
                </div>

                {/* Create Team */}
                {showCreate ? (
                  <div className="bg-gradient-to-b from-cyan-50 to-cyan-100 rounded-lg p-4">
                    <h4 className="text-gray-800 font-medium mb-3">{t.createTeam}</h4>
                    <div className="flex gap-2">
                      <Input
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                        placeholder={t.teamName}
                        className="bg-[#1A1A2E] border-gray-200 text-gray-800"
                      />
                      <Button onClick={handleCreateTeam} className="bg-[#7C3AED]">
                        {t.create}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button onClick={() => setShowCreate(true)} variant="outline" className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    {t.createTeam}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Leaderboard */}
            <Card className="bg-[#1A1A2E] border-gray-200">
              <CardHeader>
                <CardTitle className="text-gray-800 flex items-center">
                  <Trophy className="w-5 h-5 mr-2 text-[#F59E0B]" />
                  {t.leaderboard}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {leaderboard.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Noch keine Teams</p>
                ) : (
                  <div className="space-y-2">
                    {leaderboard.map((team, i) => (
                      <div key={team.team_id} className="flex items-center justify-between bg-gradient-to-b from-cyan-50 to-cyan-100 rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            i === 0 ? 'bg-[#F59E0B]' : i === 1 ? 'bg-[#94A3B8]' : i === 2 ? 'bg-[#CD7F32]' : 'bg-[#1A1A2E]'
                          }`}>
                            <span className="text-gray-800 font-bold">{team.rank}</span>
                          </div>
                          <p className="text-gray-800 font-medium">{team.name}</p>
                        </div>
                        <Badge className="bg-[#10B981]/20 text-[#10B981]">
                          {team.wins} {t.wins}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
