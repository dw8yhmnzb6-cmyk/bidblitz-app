/**
 * Mobile Bottom Navigation with Emoji Icons
 * Simple 5-tab navigation
 */
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const tabs = [
  { id: 'home', emoji: '🏠', label: 'Home', path: '/super-app' },
  { id: 'wallet', emoji: '💳', label: 'Wallet', path: '/app-wallet' },
  { id: 'games', emoji: '🎮', label: 'Games', path: '/games' },
  { id: 'mining', emoji: '⛏️', label: 'Mining', path: '/miner' },
  { id: 'profile', emoji: '👤', label: 'Profile', path: '/app-profile' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const isActive = (path) => {
    if (path === '/super-app') {
      return location.pathname === '/super-app' || location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#11142a]">
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={`flex-1 py-4 text-center text-xl transition-all ${
                active 
                  ? 'bg-[#1c213f] scale-110' 
                  : 'hover:bg-[#1c213f]/50'
              }`}
            >
              <span className={active ? 'filter-none' : 'opacity-60'}>
                {tab.emoji}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
