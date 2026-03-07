/**
 * BidBlitz Missions & Challenges
 * Daily missions and permanent challenges with rewards
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function Missions() {
  const [coins, setCoins] = useState(0);
  const [missions, setMissions] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [tournament, setTournament] = useState(null);
  const [activeTab, setActiveTab] = useState('missions');
  const [completing, setCompleting] = useState('');
  const [result, setResult] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [walletRes, missionsRes, challengesRes, tournamentRes] = await Promise.all([
        axios.get(`${API}/app/wallet/balance`, { headers }),
        axios.get(`${API}/app/core/missions/list`, { headers }),
        axios.get(`${API}/app/core/challenges/list`, { headers }),
        axios.get(`${API}/app/core/tournament/status`, { headers })
      ]);

      setCoins(walletRes.data.coins || 0);
      setMissions(missionsRes.data.missions || []);
      setChallenges(challengesRes.data.challenges || []);
      setTournament(tournamentRes.data);
    } catch (error) {
      console.log('Fetch error');
      // Use fallback data
      setMissions([
        { id: 'play_game', name: 'Spiel spielen', icon: '🎮', reward: 20, completed: false },
        { id: 'open_app', name: 'App öffnen', icon: '📱', reward: 5, completed: true },
        { id: 'invite_friend', name: 'Freund einladen', icon: '👥', reward: 50, completed: false },
      ]);
      setChallenges([
        { id: 'play_3_games', name: '3 Spiele spielen', icon: '🎮', reward: 20, completed: false },
        { id: 'earn_50_coins', name: '50 Coins verdienen', icon: '💰', reward: 30, completed: true },
      ]);
    }
  };

  const completeMission = async (missionId) => {
    setCompleting(missionId);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await axios.post(`${API}/app/core/missions/complete`, { mission: missionId }, { headers });
      
      setCoins(res.data.new_balance);
      setMissions(prev => prev.map(m => m.id === missionId ? { ...m, completed: true } : m));
      setResult({ type: 'success', message: res.data.message });
    } catch (error) {
      setResult({ type: 'error', message: error.response?.data?.detail || 'Fehler' });
    } finally {
      setCompleting('');
      setTimeout(() => setResult(''), 3000);
    }
  };

  const completeChallenge = async (challengeId) => {
    setCompleting(challengeId);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await axios.post(`${API}/app/core/challenges/complete`, { challenge: challengeId }, { headers });
      
      setCoins(res.data.new_balance);
      setChallenges(prev => prev.map(c => c.id === challengeId ? { ...c, completed: true } : c));
      setResult({ type: 'success', message: res.data.message });
    } catch (error) {
      setResult({ type: 'error', message: error.response?.data?.detail || 'Fehler' });
    } finally {
      setCompleting('');
      setTimeout(() => setResult(''), 3000);
    }
  };

  const tabs = [
    { id: 'missions', label: 'Missionen', icon: '🎯' },
    { id: 'challenges', label: 'Challenges', icon: '🏆' },
    { id: 'tournament', label: 'Turnier', icon: '👑' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0e24] via-[#0f1332] to-[#0b0e24] text-white pb-24">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-60 h-60 bg-purple-500/10 rounded-full blur-[80px]"></div>
        <div className="absolute bottom-40 -right-20 w-60 h-60 bg-cyan-500/10 rounded-full blur-[80px]"></div>
      </div>

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/super-app" className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
              <span className="text-lg">←</span>
            </Link>
            <div>
              <h2 className="text-2xl font-bold">🎯 Missionen</h2>
              <p className="text-xs text-slate-400">Verdiene extra Coins!</p>
            </div>
          </div>
          <div className="bg-amber-500/20 px-4 py-2 rounded-xl border border-amber-500/30">
            <span className="text-amber-400 font-bold">{coins.toLocaleString()} 💰</span>
          </div>
        </div>

        {/* Result Toast */}
        {result && (
          <div className={`mb-4 p-4 rounded-xl text-center font-medium ${
            result.type === 'success' 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {result.message}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-[#6c63ff] text-white'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              <span>{tab.icon}</span>
              <span className="text-sm">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Missions Tab */}
        {activeTab === 'missions' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Tägliche Missionen</p>
            {missions.map(mission => (
              <div
                key={mission.id}
                className={`bg-white/5 backdrop-blur-sm p-4 rounded-2xl border ${
                  mission.completed ? 'border-emerald-500/30' : 'border-white/10'
                } flex items-center gap-4`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                  mission.completed ? 'bg-emerald-500/20' : 'bg-white/10'
                }`}>
                  {mission.icon}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{mission.name}</p>
                  <p className="text-xs text-amber-400">+{mission.reward} Coins</p>
                </div>
                <button
                  onClick={() => completeMission(mission.id)}
                  disabled={mission.completed || completing === mission.id}
                  className={`px-4 py-2 rounded-xl font-medium transition-all ${
                    mission.completed
                      ? 'bg-emerald-500/20 text-emerald-400 cursor-default'
                      : completing === mission.id
                        ? 'bg-white/10 text-slate-400'
                        : 'bg-[#6c63ff] hover:bg-[#5a52e0] text-white'
                  }`}
                >
                  {mission.completed ? '✓' : completing === mission.id ? '...' : 'Abholen'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Challenges Tab */}
        {activeTab === 'challenges' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Permanente Challenges</p>
            {challenges.map(challenge => (
              <div
                key={challenge.id}
                className={`bg-white/5 backdrop-blur-sm p-4 rounded-2xl border ${
                  challenge.completed ? 'border-purple-500/30' : 'border-white/10'
                } flex items-center gap-4`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                  challenge.completed ? 'bg-purple-500/20' : 'bg-white/10'
                }`}>
                  {challenge.icon}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{challenge.name}</p>
                  <p className="text-xs text-purple-400">+{challenge.reward} Coins</p>
                </div>
                <button
                  onClick={() => completeChallenge(challenge.id)}
                  disabled={challenge.completed || completing === challenge.id}
                  className={`px-4 py-2 rounded-xl font-medium transition-all ${
                    challenge.completed
                      ? 'bg-purple-500/20 text-purple-400 cursor-default'
                      : completing === challenge.id
                        ? 'bg-white/10 text-slate-400'
                        : 'bg-purple-500 hover:bg-purple-600 text-white'
                  }`}
                >
                  {challenge.completed ? '✓' : completing === challenge.id ? '...' : 'Abholen'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Tournament Tab */}
        {activeTab === 'tournament' && (
          <div className="space-y-4">
            {/* Tournament Header */}
            <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/10 p-5 rounded-2xl border border-amber-500/30 text-center">
              <span className="text-4xl mb-2 block">👑</span>
              <h3 className="text-xl font-bold mb-1">Wöchentliches Turnier</h3>
              <p className="text-amber-400/80 text-sm">
                {tournament?.days_left || 7} Tage übrig
              </p>
            </div>

            {/* Your Stats */}
            <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
              <p className="text-xs text-slate-400 mb-3">Deine Statistiken</p>
              <div className="flex gap-4">
                <div className="flex-1 text-center">
                  <p className="text-2xl font-bold text-cyan-400">{tournament?.your_score || 0}</p>
                  <p className="text-xs text-slate-400">Punkte</p>
                </div>
                <div className="flex-1 text-center">
                  <p className="text-2xl font-bold text-amber-400">#{tournament?.your_rank || '-'}</p>
                  <p className="text-xs text-slate-400">Rang</p>
                </div>
              </div>
            </div>

            {/* Leaderboard */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
              <div className="p-4 border-b border-white/10">
                <p className="font-semibold">🏆 Top 10</p>
              </div>
              <div className="p-3 space-y-2">
                {(tournament?.top_10 || []).map((player, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 p-3 rounded-xl ${
                      idx === 0 ? 'bg-amber-500/20' : idx === 1 ? 'bg-slate-400/20' : idx === 2 ? 'bg-orange-500/20' : 'bg-white/5'
                    }`}
                  >
                    <span className="text-lg font-bold w-8 text-center">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{player.user_id}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-amber-400">{player.score}</p>
                      {tournament?.prizes?.[idx] && (
                        <p className="text-xs text-emerald-400">+{tournament.prizes[idx]} Coins</p>
                      )}
                    </div>
                  </div>
                ))}
                {(!tournament?.top_10 || tournament.top_10.length === 0) && (
                  <p className="text-center text-slate-400 py-4">Noch keine Teilnehmer</p>
                )}
              </div>
            </div>

            {/* Prizes */}
            <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
              <p className="text-xs text-slate-400 mb-3">Preise</p>
              <div className="flex gap-2 justify-center">
                {[500, 300, 200, 100, 50].map((prize, idx) => (
                  <div key={idx} className={`px-3 py-2 rounded-lg text-center ${
                    idx === 0 ? 'bg-amber-500/30 text-amber-300' : 'bg-white/5 text-slate-400'
                  }`}>
                    <p className="text-xs">#{idx + 1}</p>
                    <p className="font-bold text-sm">{prize}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
