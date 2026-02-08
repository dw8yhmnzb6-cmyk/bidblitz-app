// Admin Mobile Bottom Navigation Bar
// Only visible on mobile devices (md:hidden)
import { useState } from 'react';
import { 
  LayoutDashboard, 
  Search, 
  Plus, 
  Bot, 
  Settings,
  Gavel,
  Users,
  Package,
  Ticket,
  TrendingUp,
  DollarSign,
  X,
  Zap
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

export default function AdminMobileNav({ 
  activeTab,
  onTabChange, 
  users = [],
  onUserSelect
}) {
  const [showSearch, setShowSearch] = useState(false);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.length > 1) {
      const results = (users || []).filter(u => 
        u.name?.toLowerCase().includes(query.toLowerCase()) ||
        u.email?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  const quickActions = [
    { icon: Gavel, label: 'Auktionen', color: 'bg-violet-500', tab: 'auctions' },
    { icon: Users, label: 'Benutzer', color: 'bg-cyan-500', tab: 'users' },
    { icon: Package, label: 'Produkte', color: 'bg-emerald-500', tab: 'products' },
    { icon: Ticket, label: 'Gutscheine', color: 'bg-pink-500', tab: 'vouchers' },
    { icon: DollarSign, label: 'Zahlungen', color: 'bg-green-500', tab: 'payments' },
    { icon: TrendingUp, label: 'Analytics', color: 'bg-amber-500', tab: 'analytics' },
    { icon: Bot, label: 'Bots', color: 'bg-indigo-500', tab: 'bots' },
    { icon: Zap, label: 'Influencer', color: 'bg-rose-500', tab: 'influencers' },
    { icon: Users, label: 'Großkunden', color: 'bg-teal-500', tab: 'wholesale' },
    { icon: Settings, label: 'Manager', color: 'bg-slate-500', tab: 'manager' },
    { icon: Users, label: 'Mitarbeiter', color: 'bg-blue-500', tab: 'staff' },
    { icon: Settings, label: 'Spiele', color: 'bg-orange-500', tab: 'game-config' },
  ];

  return (
    <>
      {/* Fixed Bottom Bar - Only visible on mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-2 z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}>
        <div className="flex items-center justify-around gap-1">
          {/* Dashboard */}
          <button 
            onClick={() => onTabChange('dashboard')}
            className={`flex-1 flex flex-col items-center py-2 rounded-lg transition-colors ${
              activeTab === 'dashboard' 
                ? 'text-violet-600 bg-violet-50' 
                : 'text-slate-500 hover:text-violet-600 hover:bg-violet-50'
            }`}
          >
            <LayoutDashboard className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-medium">Dashboard</span>
          </button>

          {/* Search */}
          <button 
            onClick={() => setShowSearch(true)}
            className="flex-1 flex flex-col items-center py-2 rounded-lg text-slate-500 hover:text-cyan-600 hover:bg-cyan-50 transition-colors"
          >
            <Search className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-medium">Suchen</span>
          </button>

          {/* Quick Add - Center prominent button */}
          <button 
            onClick={() => setShowQuickMenu(true)}
            className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg -mt-6 flex items-center justify-center transition-all active:scale-95"
          >
            <Plus className="w-7 h-7 text-white" />
          </button>

          {/* Auctions */}
          <button 
            onClick={() => onTabChange('auctions')}
            className={`flex-1 flex flex-col items-center py-2 rounded-lg transition-colors ${
              activeTab === 'auctions' 
                ? 'text-amber-600 bg-amber-50' 
                : 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'
            }`}
          >
            <Gavel className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-medium">Auktionen</span>
          </button>

          {/* Settings / More - Opens All Tabs */}
          <button 
            onClick={() => setShowQuickMenu(true)}
            className={`flex-1 flex flex-col items-center py-2 rounded-lg transition-colors ${
              ['settings', 'wholesale', 'manager', 'staff', 'game-config', 'influencers', 'analytics', 'bots', 'vouchers', 'payments'].includes(activeTab)
                ? 'text-slate-800 bg-slate-100' 
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <Settings className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-medium">Mehr</span>
          </button>
        </div>
      </div>

      {/* Search Dialog */}
      <Dialog open={showSearch} onOpenChange={setShowSearch}>
        <DialogContent className="sm:max-w-md mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Search className="w-5 h-5 text-cyan-500" />
              Benutzer suchen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Name oder E-Mail eingeben..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="bg-slate-50 border-slate-200 text-slate-800"
              autoFocus
            />
            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {searchResults.map((user) => (
                  <div 
                    key={user.id}
                    onClick={() => {
                      if (onUserSelect) onUserSelect(user);
                      onTabChange('users');
                      setShowSearch(false);
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                      {user.name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 truncate">{user.name}</p>
                      <p className="text-sm text-slate-500 truncate">{user.email}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-cyan-600 font-medium">{user.bids_balance || 0} Gebote</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        user.is_blocked ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                      }`}>
                        {user.is_blocked ? 'Gesperrt' : 'Aktiv'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {searchQuery.length > 1 && searchResults.length === 0 && (
              <p className="text-center text-slate-400 py-4">Keine Benutzer gefunden</p>
            )}
            {searchQuery.length <= 1 && (
              <p className="text-center text-slate-400 py-4 text-sm">
                Mindestens 2 Zeichen eingeben...
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Menu Dialog */}
      <Dialog open={showQuickMenu} onOpenChange={setShowQuickMenu}>
        <DialogContent className="sm:max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Plus className="w-5 h-5 text-violet-500" />
              Schnellzugriff
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-2 py-4">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => {
                  onTabChange(action.tab);
                  setShowQuickMenu(false);
                }}
                className="flex flex-col items-center gap-1.5 py-3 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <div className={`w-11 h-11 rounded-xl ${action.color} flex items-center justify-center shadow-md`}>
                  <action.icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] text-slate-600 font-medium">{action.label}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Spacer to prevent content from being hidden behind the bar */}
      <div className="md:hidden h-20" />
    </>
  );
}
