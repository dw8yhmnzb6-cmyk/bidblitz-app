/**
 * Admin Wallet Top-up Component
 * Allows admins to top-up customer BidBlitz Pay wallets
 * Includes bonuses: 2% customer bonus, €1 first top-up, 2% merchant commission
 */
import { useState, useEffect, useCallback } from 'react';
import { 
  Wallet, Search, Plus, Euro, CheckCircle, Users, 
  Gift, Percent, Trophy, TrendingUp, Crown, AlertCircle,
  RefreshCw, History, ArrowUpRight, Store, ChevronDown, Star, X
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

export default function AdminWalletTopup({ token, t }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [recentTopUps, setRecentTopUps] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [favoriteCustomers, setFavoriteCustomers] = useState([]);
  const [stats, setStats] = useState({
    totalTopUps: 0,
    totalAmount: 0,
    totalBonus: 0,
    newCustomers: 0
  });
  
  // Merchant selection
  const [merchants, setMerchants] = useState([]);
  const [selectedMerchant, setSelectedMerchant] = useState(null);
  const [showMerchantDropdown, setShowMerchantDropdown] = useState(false);
  const [merchantSearchQuery, setMerchantSearchQuery] = useState('');

  // Load favorite customers from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('favorite_customers');
    if (saved) {
      try {
        setFavoriteCustomers(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  // Save customer to favorites
  const addToFavorites = (user) => {
    const updated = [user, ...favoriteCustomers.filter(f => f.id !== user.id)].slice(0, 10);
    setFavoriteCustomers(updated);
    localStorage.setItem('favorite_customers', JSON.stringify(updated));
    toast.success(`${user.name} zu Favoriten hinzugefügt`);
  };

  // Remove from favorites
  const removeFromFavorites = (userId) => {
    const updated = favoriteCustomers.filter(f => f.id !== userId);
    setFavoriteCustomers(updated);
    localStorage.setItem('favorite_customers', JSON.stringify(updated));
  };

  // Fetch merchants list
  const fetchMerchants = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/api/partner-portal/admin/all-partners`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Filter only approved partners
      const approvedMerchants = (response.data.partners || []).filter(p => p.status === 'approved');
      setMerchants(approvedMerchants);
    } catch (error) {
      console.error('Error fetching merchants:', error);
    }
  }, [token]);

  // Fetch leaderboard and stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/api/admin/wallet-topup/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data.stats || stats);
      setLeaderboard(response.data.leaderboard || []);
      setRecentTopUps(response.data.recent_topups || []);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, [token]);

  useEffect(() => {
    fetchStats();
    fetchMerchants();
  }, [fetchStats]);

  // Search customers
  const searchCustomers = async () => {
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    try {
      const response = await axios.get(`${API}/api/admin/wallet-topup/search`, {
        params: { query: searchQuery },
        headers: { Authorization: `Bearer ${token}` }
      });
      setSearchResults(response.data.users || []);
      if (response.data.users?.length === 0) {
        toast.info('Kein Kunde gefunden');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Fehler bei der Suche');
    } finally {
      setSearching(false);
    }
  };

  // Top up customer wallet
  const handleTopUp = async () => {
    if (!selectedUser || !topUpAmount) return;
    
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount < 1) {
      toast.error('Mindestbetrag: €1');
      return;
    }
    
    setProcessing(true);
    try {
      const response = await axios.post(
        `${API}/api/admin/wallet-topup/topup`,
        {
          user_id: selectedUser.id,
          amount: amount,
          merchant_id: selectedMerchant?.id || null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const data = response.data;
      
      // Show success message with bonus info
      let message = `€${amount.toFixed(2)} aufgeladen!`;
      if (data.customer_bonus > 0) {
        message += ` (+€${data.customer_bonus.toFixed(2)} Kundenbonus)`;
      }
      if (data.first_topup_bonus > 0) {
        message += ` (+€${data.first_topup_bonus.toFixed(2)} Erstaufladungsbonus)`;
      }
      if (data.merchant_commission > 0) {
        message += ` | Händler: +€${data.merchant_commission.toFixed(2)}`;
      }
      toast.success(message);
      
      // Update UI
      setSelectedUser({
        ...selectedUser,
        bidblitz_balance: data.new_balance
      });
      setTopUpAmount('');
      setSelectedMerchant(null);
      fetchStats();
      
    } catch (error) {
      console.error('Top up error:', error);
      toast.error(error.response?.data?.detail || 'Aufladung fehlgeschlagen');
    } finally {
      setProcessing(false);
    }
  };

  // Filter merchants by search query
  const filteredMerchants = merchants.filter(m => 
    m.company_name?.toLowerCase().includes(merchantSearchQuery.toLowerCase()) ||
    m.business_name?.toLowerCase().includes(merchantSearchQuery.toLowerCase()) ||
    m.email?.toLowerCase().includes(merchantSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Header - Kompakt für Mobile */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
          <Wallet className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
        </div>
        <div>
          <h1 className="text-base sm:text-2xl font-bold text-slate-800">Kunden-Guthaben Aufladen</h1>
          <p className="text-slate-500 text-[10px] sm:text-sm">BidBlitz Pay Wallet aufladen mit Bonus-System</p>
        </div>
      </div>

      {/* Stats Cards - 4 in einer Reihe auf Mobile */}
      <div className="grid grid-cols-4 gap-1 sm:gap-4">
        <div className="bg-white rounded-lg p-1.5 sm:p-4 shadow-sm border border-slate-100 text-center">
          <div className="flex items-center justify-center gap-1 text-slate-500 text-[8px] sm:text-sm mb-0.5 sm:mb-1">
            <ArrowUpRight className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Aufladungen heute</span>
          </div>
          <p className="text-sm sm:text-2xl font-bold text-slate-800">{stats.totalTopUps}</p>
          <p className="text-[7px] sm:hidden text-slate-400">Heute</p>
        </div>
        <div className="bg-white rounded-lg p-1.5 sm:p-4 shadow-sm border border-slate-100 text-center">
          <div className="flex items-center justify-center gap-1 text-slate-500 text-[8px] sm:text-sm mb-0.5 sm:mb-1">
            <Euro className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Gesamtvolumen</span>
          </div>
          <p className="text-sm sm:text-2xl font-bold text-green-600">€{stats.totalAmount?.toFixed(0) || '0'}</p>
          <p className="text-[7px] sm:hidden text-slate-400">Volumen</p>
        </div>
        <div className="bg-white rounded-lg p-1.5 sm:p-4 shadow-sm border border-slate-100 text-center">
          <div className="flex items-center justify-center gap-1 text-slate-500 text-[8px] sm:text-sm mb-0.5 sm:mb-1">
            <Gift className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Ausgezahlte Boni</span>
          </div>
          <p className="text-sm sm:text-2xl font-bold text-amber-600">€{stats.totalBonus?.toFixed(2) || '0'}</p>
          <p className="text-[7px] sm:hidden text-slate-400">Boni</p>
        </div>
        <div className="bg-white rounded-lg p-1.5 sm:p-4 shadow-sm border border-slate-100 text-center">
          <div className="flex items-center justify-center gap-1 text-slate-500 text-[8px] sm:text-sm mb-0.5 sm:mb-1">
            <Users className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Neue Kunden</span>
          </div>
          <p className="text-sm sm:text-2xl font-bold text-blue-600">{stats.newCustomers}</p>
          <p className="text-[7px] sm:hidden text-slate-400">Neue</p>
        </div>
      </div>

      {/* Bonus Info Banner - Kompakt */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-2 sm:p-4">
        <h3 className="font-bold text-amber-800 mb-1 sm:mb-2 flex items-center gap-1.5 text-xs sm:text-base">
          <Gift className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
          Aktive Boni & Anreize
        </h3>
        <div className="grid grid-cols-3 gap-1 sm:gap-4 text-[9px] sm:text-sm">
          <div className="flex items-center gap-1">
            <Percent className="w-3 h-3 text-green-600 flex-shrink-0" />
            <span><strong>2%</strong> Kundenbonus</span>
          </div>
          <div className="flex items-center gap-1">
            <Gift className="w-3 h-3 text-blue-600 flex-shrink-0" />
            <span><strong>€1</strong> Erstaufladung</span>
          </div>
          <div className="flex items-center gap-1">
            <Trophy className="w-3 h-3 text-amber-600 flex-shrink-0" />
            <span><strong>2%</strong> Händler</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-6">
        {/* Main Top-up Section */}
        <div className="lg:col-span-2 space-y-3 sm:space-y-4">
          {/* Search Customer */}
          <div className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-6 shadow-sm border border-slate-100">
            <h2 className="font-bold text-slate-800 mb-2 sm:mb-4 flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base">
              <Search className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
              Kunde suchen
            </h2>
            
            <div className="flex gap-1.5 sm:gap-2">
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchCustomers()}
                placeholder="E-Mail oder Kunden-ID..."
                className="flex-1 text-sm h-9 sm:h-10"
              />
              <Button
                onClick={searchCustomers}
                disabled={searching || !searchQuery.trim()}
                className="bg-blue-500 hover:bg-blue-600 h-9 sm:h-10 px-3"
              >
                {searching ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-2 sm:mt-4 space-y-1.5 sm:space-y-2 max-h-48 overflow-y-auto">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      setSelectedUser(user);
                      setSearchResults([]);
                      setSearchQuery('');
                    }}
                    className={`w-full text-left p-2 sm:p-3 rounded-lg border transition-all ${
                      selectedUser?.id === user.id 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-slate-200 hover:border-green-300 hover:bg-green-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-800">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addToFavorites(user);
                          }}
                          className="p-1 hover:bg-yellow-100 rounded"
                          title="Zu Favoriten hinzufügen"
                        >
                          <Star className={`w-4 h-4 ${favoriteCustomers.some(f => f.id === user.id) ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'}`} />
                        </button>
                        <div className="text-right">
                          <p className="font-bold text-green-600">€{user.bidblitz_balance?.toFixed(2) || '0.00'}</p>
                          <p className="text-xs text-slate-400">Guthaben</p>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Favoriten / Gespeicherte Kunden */}
            {favoriteCustomers.length > 0 && searchResults.length === 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-slate-600 mb-2 flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  Gespeicherte Kunden
                </h3>
                <div className="flex flex-wrap gap-2">
                  {favoriteCustomers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className={`px-3 py-2 rounded-lg border text-sm transition-all flex items-center gap-2 ${
                        selectedUser?.id === user.id 
                          ? 'border-green-500 bg-green-50 text-green-700' 
                          : 'border-slate-200 hover:border-green-300 bg-white text-slate-700'
                      }`}
                    >
                      <span className="font-medium truncate max-w-[120px]">{user.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromFavorites(user.id);
                        }}
                        className="p-0.5 hover:bg-red-100 rounded"
                        title="Entfernen"
                      >
                        <X className="w-3 h-3 text-slate-400 hover:text-red-500" />
                      </button>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Selected Customer & Top-up Form */}
          {selectedUser && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-green-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  <Users className="w-5 h-5 text-green-500" />
                  Ausgewählter Kunde
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedUser(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  Ändern
                </Button>
              </div>

              {/* Customer Info */}
              <div className="bg-slate-50 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                    <Users className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-slate-800">{selectedUser.name}</p>
                    <p className="text-sm text-slate-500">{selectedUser.email}</p>
                    <p className="text-xs text-slate-400">ID: {selectedUser.id?.slice(0, 8)}...</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">Aktuelles Guthaben</p>
                    <p className="text-2xl font-bold text-green-600">
                      €{selectedUser.bidblitz_balance?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Top-up Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Aufladebetrag
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">€</span>
                    <Input
                      type="number"
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                      className="pl-8 text-lg"
                      placeholder="0.00"
                      min="1"
                      step="0.01"
                    />
                  </div>
                </div>

                {/* Quick Amounts */}
                <div className="flex gap-2 flex-wrap">
                  {[10, 25, 50, 100, 200].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setTopUpAmount(String(amount))}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                        parseFloat(topUpAmount) === amount
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-slate-200 text-slate-600 hover:border-green-300'
                      }`}
                    >
                      €{amount}
                    </button>
                  ))}
                </div>

                {/* Merchant Selection (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <Store className="w-4 h-4 inline mr-1" />
                    Händler zuordnen <span className="text-slate-400 font-normal">(optional - für 2% Provision)</span>
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowMerchantDropdown(!showMerchantDropdown)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-all ${
                        selectedMerchant 
                          ? 'border-amber-400 bg-amber-50' 
                          : 'border-slate-200 bg-white hover:border-amber-300'
                      }`}
                    >
                      {selectedMerchant ? (
                        <div className="flex items-center gap-2">
                          <Store className="w-4 h-4 text-amber-600" />
                          <span className="font-medium text-slate-800">
                            {selectedMerchant.company_name || selectedMerchant.business_name}
                          </span>
                          <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                            +2% Provision
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">Kein Händler (keine Provision)</span>
                      )}
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showMerchantDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {/* Merchant Dropdown */}
                    {showMerchantDropdown && (
                      <div className="absolute z-20 w-full mt-1 bg-white rounded-lg border border-slate-200 shadow-lg max-h-64 overflow-hidden">
                        <div className="p-2 border-b border-slate-100">
                          <Input
                            type="text"
                            placeholder="Händler suchen..."
                            value={merchantSearchQuery}
                            onChange={(e) => setMerchantSearchQuery(e.target.value)}
                            className="text-sm"
                          />
                        </div>
                        <div className="overflow-y-auto max-h-48">
                          {/* Option: No merchant */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMerchant(null);
                              setShowMerchantDropdown(false);
                              setMerchantSearchQuery('');
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm text-slate-500"
                          >
                            Kein Händler (keine Provision)
                          </button>
                          
                          {filteredMerchants.length > 0 ? (
                            filteredMerchants.map((merchant) => (
                              <button
                                key={merchant.id}
                                type="button"
                                onClick={() => {
                                  setSelectedMerchant(merchant);
                                  setShowMerchantDropdown(false);
                                  setMerchantSearchQuery('');
                                }}
                                className={`w-full text-left px-3 py-2 hover:bg-amber-50 flex items-center justify-between ${
                                  selectedMerchant?.id === merchant.id ? 'bg-amber-50' : ''
                                }`}
                              >
                                <div>
                                  <p className="font-medium text-slate-800 text-sm">
                                    {merchant.company_name || merchant.business_name}
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    {merchant.city || merchant.email}
                                  </p>
                                </div>
                                {selectedMerchant?.id === merchant.id && (
                                  <CheckCircle className="w-4 h-4 text-amber-500" />
                                )}
                              </button>
                            ))
                          ) : (
                            <p className="px-3 py-4 text-center text-sm text-slate-400">
                              Keine Händler gefunden
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bonus Preview */}
                {topUpAmount && parseFloat(topUpAmount) > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <h4 className="font-medium text-green-800 mb-2">Bonus-Vorschau</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Aufladebetrag:</span>
                        <span className="font-medium">€{parseFloat(topUpAmount).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-green-600">
                        <span>+ 2% Kundenbonus:</span>
                        <span className="font-medium">+€{(parseFloat(topUpAmount) * 0.02).toFixed(2)}</span>
                      </div>
                      {!selectedUser.has_first_topup && (
                        <div className="flex justify-between text-blue-600">
                          <span>+ Erstaufladungsbonus:</span>
                          <span className="font-medium">+€1.00</span>
                        </div>
                      )}
                      <hr className="border-green-200 my-2" />
                      <div className="flex justify-between font-bold text-green-700">
                        <span>Kundengutschrift:</span>
                        <span>
                          €{(
                            parseFloat(topUpAmount) + 
                            parseFloat(topUpAmount) * 0.02 + 
                            (selectedUser.has_first_topup ? 0 : 1)
                          ).toFixed(2)}
                        </span>
                      </div>
                      
                      {/* Merchant Commission */}
                      {selectedMerchant && (
                        <>
                          <hr className="border-amber-200 my-2" />
                          <div className="flex justify-between text-amber-600">
                            <span className="flex items-center gap-1">
                              <Store className="w-3 h-3" />
                              Händlerprovision (2%):
                            </span>
                            <span className="font-medium">+€{(parseFloat(topUpAmount) * 0.02).toFixed(2)}</span>
                          </div>
                          <div className="text-xs text-amber-500 mt-1">
                            → an {selectedMerchant.company_name || selectedMerchant.business_name}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleTopUp}
                  disabled={processing || !topUpAmount || parseFloat(topUpAmount) < 1}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 py-4 text-lg"
                >
                  {processing ? (
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-5 h-5 mr-2" />
                  )}
                  Guthaben aufladen
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Leaderboard & Recent */}
        <div className="space-y-4">
          {/* Merchant Leaderboard */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Top 3 Händler
            </h3>
            
            {leaderboard.length > 0 ? (
              <div className="space-y-2">
                {leaderboard.slice(0, 3).map((merchant, index) => (
                  <div 
                    key={merchant.id}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      index === 0 ? 'bg-amber-50 border border-amber-200' :
                      index === 1 ? 'bg-slate-50 border border-slate-200' :
                      'bg-orange-50 border border-orange-200'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                      index === 0 ? 'bg-amber-500' :
                      index === 1 ? 'bg-slate-400' :
                      'bg-orange-400'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 truncate">{merchant.name}</p>
                      <p className="text-xs text-slate-500">{merchant.topups_count} Aufladungen</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">€{merchant.total_volume?.toFixed(2)}</p>
                      <p className="text-xs text-amber-600">+€{merchant.commission?.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400">
                <Trophy className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Noch keine Daten</p>
              </div>
            )}
          </div>

          {/* Recent Top-ups */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
              <History className="w-5 h-5 text-slate-400" />
              Letzte Aufladungen
            </h3>
            
            {recentTopUps.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {recentTopUps.map((topup) => (
                  <div 
                    key={topup.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-700 truncate">{topup.user_name}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(topup.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">+€{topup.amount?.toFixed(2)}</p>
                      {topup.bonus > 0 && (
                        <p className="text-xs text-amber-500">+€{topup.bonus?.toFixed(2)} Bonus</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400">
                <History className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Noch keine Aufladungen</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
