/**
 * BidBlitz Live Events
 * Join events, earn rewards
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function LiveEvents() {
  const [coins, setCoins] = useState(0);
  const [joinedEvents, setJoinedEvents] = useState([]);
  const [result, setResult] = useState('');

  const events = [
    { 
      id: 1, 
      name: 'Coin Hunt Weekend', 
      icon: '🗺️', 
      reward: '+50% Coins',
      description: 'Doppelte Coins beim Sammeln auf der Map!',
      endsIn: '2 Tage',
      color: 'from-emerald-500/20 to-green-500/10',
      border: 'border-emerald-500/30'
    },
    { 
      id: 2, 
      name: 'Auction Night', 
      icon: '🔥', 
      reward: 'Exklusive Items',
      description: 'Spezielle Items nur heute Nacht verfügbar!',
      endsIn: '8 Stunden',
      color: 'from-red-500/20 to-orange-500/10',
      border: 'border-red-500/30'
    },
    { 
      id: 3, 
      name: 'Mystery Box Festival', 
      icon: '🎁', 
      reward: '3x Chance',
      description: 'Dreifache Gewinnchance bei Mystery Boxes!',
      endsIn: '1 Tag',
      color: 'from-purple-500/20 to-pink-500/10',
      border: 'border-purple-500/30'
    },
    { 
      id: 4, 
      name: 'VIP Double Coins', 
      icon: '👑', 
      reward: '2x Mining',
      description: 'VIP-Mitglieder erhalten doppelte Mining-Rewards!',
      endsIn: '3 Tage',
      color: 'from-amber-500/20 to-yellow-500/10',
      border: 'border-amber-500/30'
    },
    { 
      id: 5, 
      name: 'Referral Bonus Week', 
      icon: '👥', 
      reward: '+100 Coins',
      description: 'Extra Bonus für jede Einladung diese Woche!',
      endsIn: '5 Tage',
      color: 'from-cyan-500/20 to-blue-500/10',
      border: 'border-cyan-500/30'
    },
  ];

  useEffect(() => {
    fetchCoins();
  }, []);

  const fetchCoins = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API}/app/wallet/balance`, { headers });
      setCoins(res.data.coins || 0);
    } catch (error) {
      console.log('Coins error');
    }
  };

  const joinEvent = async (event) => {
    if (joinedEvents.includes(event.id)) {
      setResult(`Du bist bereits bei "${event.name}" dabei!`);
      setTimeout(() => setResult(''), 3000);
      return;
    }

    setJoinedEvents(prev => [...prev, event.id]);
    setResult(`🎉 Du nimmst jetzt an "${event.name}" teil!`);

    // Try to register on backend
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(`${API}/app/events/join`, { event_id: event.id }, { headers });
    } catch (error) {
      // Continue with local state
    }

    setTimeout(() => setResult(''), 3000);
  };

  const leaveEvent = (eventId) => {
    setJoinedEvents(prev => prev.filter(id => id !== eventId));
    setResult('Event verlassen');
    setTimeout(() => setResult(''), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0e24] via-[#0f1332] to-[#0b0e24] text-white pb-24">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-60 h-60 bg-purple-500/10 rounded-full blur-[80px]"></div>
        <div className="absolute bottom-40 -right-20 w-60 h-60 bg-amber-500/10 rounded-full blur-[80px]"></div>
      </div>

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/super-app" className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
              <span className="text-lg">←</span>
            </Link>
            <div>
              <h2 className="text-2xl font-bold">🎉 Live Events</h2>
              <p className="text-xs text-slate-400">Teilnehmen & gewinnen!</p>
            </div>
          </div>
          <div className="bg-amber-500/20 px-3 py-1.5 rounded-xl border border-amber-500/30">
            <span className="text-amber-400 font-bold">{coins.toLocaleString()} 💰</span>
          </div>
        </div>

        {/* Result Message */}
        {result && (
          <div className={`mb-4 p-4 rounded-xl text-center font-medium ${
            result.includes('🎉') 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
          }`}>
            {result}
          </div>
        )}

        {/* Active Events Count */}
        <div className="bg-[#6c63ff]/20 p-4 rounded-2xl border border-[#6c63ff]/30 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📅</span>
            <div>
              <p className="font-semibold">Aktive Events</p>
              <p className="text-xs text-slate-400">{events.length} Events verfügbar</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-[#6c63ff]">{joinedEvents.length}</p>
            <p className="text-xs text-slate-400">Beigetreten</p>
          </div>
        </div>

        {/* Events List */}
        <div className="space-y-4" data-testid="events-list">
          {events.map((event) => {
            const isJoined = joinedEvents.includes(event.id);
            
            return (
              <div 
                key={event.id}
                className={`bg-gradient-to-br ${event.color} p-5 rounded-2xl border ${event.border} transition-all`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{event.icon}</span>
                    <div>
                      <h3 className="font-bold text-lg">{event.name}</h3>
                      <p className="text-xs text-slate-400">{event.description}</p>
                    </div>
                  </div>
                  {isJoined && (
                    <span className="px-2 py-1 bg-emerald-500 text-xs rounded-full font-bold">
                      ✓ Dabei
                    </span>
                  )}
                </div>
                
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-black/20 px-3 py-1.5 rounded-lg">
                      <span className="text-xs text-slate-400">Reward: </span>
                      <span className="text-sm font-bold text-amber-400">{event.reward}</span>
                    </div>
                    <div className="bg-black/20 px-3 py-1.5 rounded-lg">
                      <span className="text-xs text-slate-400">Endet in: </span>
                      <span className="text-sm font-bold">{event.endsIn}</span>
                    </div>
                  </div>
                  
                  {isJoined ? (
                    <button
                      onClick={() => leaveEvent(event.id)}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl text-sm font-medium transition-all"
                    >
                      Verlassen
                    </button>
                  ) : (
                    <button
                      onClick={() => joinEvent(event)}
                      className="px-5 py-2 bg-[#6c63ff] hover:bg-[#8b6dff] rounded-xl font-semibold transition-all"
                      data-testid={`join-event-${event.id}`}
                    >
                      Beitreten
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-white/5 p-4 rounded-2xl border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <span>💡</span>
            <h4 className="font-semibold">Event-Info</h4>
          </div>
          <p className="text-sm text-slate-400">
            Tritt Events bei, um exklusive Belohnungen und Boni zu erhalten! 
            Du kannst an mehreren Events gleichzeitig teilnehmen.
          </p>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
