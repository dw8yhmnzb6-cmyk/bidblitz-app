/**
 * Mobile Bottom Navigation Component
 * Fixed bottom nav with 5 tabs: Home, Mining, Games, Market, Wallet
 */
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Cpu, Gamepad2, Store, Wallet } from 'lucide-react';

const tabs = [
  { id: 'home', label: 'Home', icon: Home, path: '/super-app' },
  { id: 'mining', label: 'Mining', icon: Cpu, path: '/miner' },
  { id: 'games', label: 'Games', icon: Gamepad2, path: '/games' },
  { id: 'market', label: 'Market', icon: Store, path: '/miner-market' },
  { id: 'wallet', label: 'Wallet', icon: Wallet, path: '/app-wallet' },
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#11142a] border-t border-slate-700/50 safe-area-bottom">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.path);
          
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center justify-center py-3 px-4 flex-1 transition-all duration-200 ${
                active 
                  ? 'text-[#6c63ff]' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-5 h-5 mb-1 ${active ? 'scale-110' : ''} transition-transform`} />
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
