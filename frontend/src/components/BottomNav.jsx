/**
 * Mobile Bottom Navigation with Emoji Icons
 * 5-tab navigation with Transport tab
 */
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const tabs = [
  { id: 'home', emoji: '🏠', label: 'Home', path: '/super-app' },
  { id: 'games', emoji: '🎮', label: 'Games', path: '/games' },
  { id: 'wallet', emoji: '💳', label: 'Wallet', path: '/app-wallet' },
  { id: 'bbz', emoji: '💎', label: 'BBZ', path: '/bbz' },
  { id: 'profile', emoji: '👤', label: 'Profile', path: '/app-profile' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const isActive = (path) => {
    if (path === '/super-app') {
      return location.pathname === '/super-app' || location.pathname === '/';
    }
    if (path === '/bbz') {
      return location.pathname === '/bbz' || 
             location.pathname === '/bbz-wallet' ||
             location.pathname === '/token';
    }
    if (path === '/games') {
      return location.pathname === '/games' || 
             location.pathname === '/map' || 
             location.pathname === '/missions';
    }
    return location.pathname.startsWith(path);
  };
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#11142a] border-t border-white/5">
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              data-testid={`nav-${tab.id}`}
              className={`flex-1 py-3 flex flex-col items-center gap-1 transition-all ${
                active 
                  ? 'bg-[#6c63ff]/20' 
                  : 'hover:bg-[#1c213f]/50'
              }`}
            >
              <span className={`text-xl ${active ? 'scale-110' : 'opacity-60'} transition-transform`}>
                {tab.emoji}
              </span>
              <span className={`text-[10px] ${active ? 'text-[#6c63ff]' : 'text-slate-500'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
