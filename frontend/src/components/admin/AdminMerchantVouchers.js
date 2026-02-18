/**
 * AdminMerchantVouchers - Admin Panel für Händler-Gutscheine erstellen
 * Mobile-optimiert mit Premium-Preissystem
 */
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { 
  Ticket, Store, Plus, Euro, Clock, Gift, Search,
  CheckCircle, XCircle, Trash2, Eye, RefreshCw, Crown, Star,
  Bot, Percent, Zap, Calendar
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminMerchantVouchers = () => {
  const [partners, setPartners] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('vouchers'); // 'vouchers', 'premium', 'bots', 'cashback'
  
  // Bot state
  const [botStatus, setBotStatus] = useState([]);
  const [configuringBots, setConfiguringBots] = useState(false);
  const [botMinPercent, setBotMinPercent] = useState('10');
  const [botMaxPercent, setBotMaxPercent] = useState('30');
  
  // Cashback promotion state
  const [promotions, setPromotions] = useState([]);
  const [selectedPromoPartner, setSelectedPromoPartner] = useState('');
  const [promoRate, setPromoRate] = useState('8');
  const [promoDays, setPromoDays] = useState('7');
  const [creatingPromo, setCreatingPromo] = useState(false);

  // Form state
  const [selectedPartner, setSelectedPartner] = useState('');
  const [voucherName, setVoucherName] = useState('');
  const [voucherDescription, setVoucherDescription] = useState('');
  const [voucherValue, setVoucherValue] = useState('50');
  const [startPrice, setStartPrice] = useState('0.01');
  const [durationHours, setDurationHours] = useState('24');
  
  // Premium state
  const [premiumMonths, setPremiumMonths] = useState('1');
  const [premiumPrice, setPremiumPrice] = useState('10'); // €5-€20

  const fetchPartners = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/merchant-vouchers/merchants`);
      if (res.ok) {
        const data = await res.json();
        setPartners(data.merchants || []);
      }
    } catch (err) {
      console.error('Error fetching partners:', err);
    }
  }, []);

  const fetchVouchers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/merchant-vouchers/admin/all`);
      if (res.ok) {
        const data = await res.json();
        setVouchers(data.vouchers || []);
      }
    } catch (err) {
      console.error('Error fetching vouchers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPartners();
    fetchVouchers();
    fetchBotStatus();
    fetchPromotions();
  }, [fetchPartners, fetchVouchers]);

  const fetchBotStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/admin/bots/voucher-bot-status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBotStatus(data.auctions || []);
      }
    } catch (err) {
      console.error('Error fetching bot status:', err);
    }
  };

  const fetchPromotions = async () => {
    try {
      const res = await fetch(`${API}/api/cashback/admin/promotions`);
      if (res.ok) {
        const data = await res.json();
        setPromotions(data.promotions || []);
      }
    } catch (err) {
      console.error('Error fetching promotions:', err);
    }
  };

  const handleConfigureBots = async () => {
    setConfiguringBots(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/admin/bots/configure-voucher-bots?min_percent=${botMinPercent}&max_percent=${botMaxPercent}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        toast.success(`${data.configured} Gutschein-Auktionen mit Bots konfiguriert`);
        fetchBotStatus();
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Fehler beim Konfigurieren');
      }
    } catch (err) {
      console.error('Error configuring bots:', err);
      toast.error('Fehler beim Konfigurieren der Bots');
    } finally {
      setConfiguringBots(false);
    }
  };

  const handleCreatePromotion = async () => {
    if (!selectedPromoPartner) {
      toast.error('Bitte wählen Sie einen Händler aus');
      return;
    }
    
    setCreatingPromo(true);
    try {
      const res = await fetch(`${API}/api/cashback/admin/create-promotion/${selectedPromoPartner}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          special_rate: parseFloat(promoRate),
          duration_days: parseInt(promoDays)
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        toast.success(`Cashback-Aktion erstellt: ${data.special_rate}% für ${data.partner_name}`);
        setSelectedPromoPartner('');
        fetchPromotions();
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Fehler beim Erstellen');
      }
    } catch (err) {
      console.error('Error creating promotion:', err);
      toast.error('Fehler beim Erstellen der Aktion');
    } finally {
      setCreatingPromo(false);
    }
  };

  const handleRemovePromotion = async (partnerId, partnerName) => {
    if (!window.confirm(`Cashback-Aktion von "${partnerName}" beenden?`)) return;
    
    try {
      const res = await fetch(`${API}/api/cashback/admin/remove-promotion/${partnerId}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        toast.success(`Cashback-Aktion von ${partnerName} beendet`);
        fetchPromotions();
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Fehler');
      }
    } catch (err) {
      console.error('Error removing promotion:', err);
      toast.error('Fehler beim Beenden der Aktion');
    }
  };

  const handleCreateVoucher = async (e) => {
    e.preventDefault();
    
    if (!selectedPartner) {
      toast.error('Bitte wählen Sie einen Partner aus');
      return;
    }

    if (!voucherName.trim()) {
      toast.error('Bitte geben Sie einen Namen ein');
      return;
    }

    const value = parseFloat(voucherValue);
    if (isNaN(value) || value <= 0) {
      toast.error('Bitte geben Sie einen gültigen Gutscheinwert ein');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(`${API}/api/merchant-vouchers/admin/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partner_id: selectedPartner,
          name: voucherName,
          description: voucherDescription,
          voucher_value: value,
          start_price: parseFloat(startPrice) || 0.01,
          duration_hours: parseInt(durationHours) || 24
        })
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Gutschein-Auktion erstellt: ${voucherName}`);
        setShowCreateForm(false);
        resetForm();
        fetchVouchers();
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Fehler beim Erstellen');
      }
    } catch (err) {
      console.error('Error creating voucher:', err);
      toast.error('Fehler beim Erstellen');
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setSelectedPartner('');
    setVoucherName('');
    setVoucherDescription('');
    setVoucherValue('50');
    setStartPrice('0.01');
    setDurationHours('24');
  };

  const handleSetPremium = async (partnerId, partnerName) => {
    const months = parseInt(premiumMonths) || 1;
    const price = parseFloat(premiumPrice) || 10;
    
    // Validate price range (5€-20€)
    if (price < 5 || price > 20) {
      toast.error('Premium-Preis muss zwischen 5€ und 20€ liegen');
      return;
    }
    
    try {
      const res = await fetch(`${API}/api/merchant-vouchers/admin/set-premium`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          partner_id: partnerId, 
          months,
          price 
        })
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`${partnerName} ist jetzt Premium für ${months} Monat(e) (€${price}/Monat)`);
        fetchPartners();
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Fehler beim Setzen');
      }
    } catch (err) {
      console.error('Error setting premium:', err);
      toast.error('Fehler beim Setzen von Premium');
    }
  };

  const handleRemovePremium = async (partnerId, partnerName) => {
    if (!window.confirm(`Premium-Status von "${partnerName}" entfernen?`)) return;
    
    try {
      const res = await fetch(`${API}/api/merchant-vouchers/admin/remove-premium/${partnerId}`, {
        method: 'POST'
      });

      if (res.ok) {
        toast.success(`Premium-Status von ${partnerName} entfernt`);
        fetchPartners();
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Fehler');
      }
    } catch (err) {
      console.error('Error removing premium:', err);
      toast.error('Fehler beim Entfernen von Premium');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (voucher) => {
    if (voucher.redeemed) {
      return <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">Eingelöst</span>;
    }
    if (voucher.status === 'won') {
      return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Gewonnen</span>;
    }
    if (voucher.status === 'active') {
      return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">Aktiv</span>;
    }
    return <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">{voucher.status}</span>;
  };

  const filteredPartners = partners.filter(p =>
    p.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const premiumPartners = partners.filter(p => p.is_premium);
  const regularPartners = partners.filter(p => !p.is_premium);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-xl">
            <Ticket className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Händler-Gutscheine</h2>
            <p className="text-sm text-gray-500">Gutscheine & Premium-Partner verwalten</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { fetchPartners(); fetchVouchers(); }}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Aktualisieren
          </Button>
          {activeTab === 'vouchers' && (
            <Button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="bg-amber-500 hover:bg-amber-600"
            >
              <Plus className="w-4 h-4 mr-1" />
              Gutschein erstellen
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('vouchers')}
          className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
            activeTab === 'vouchers'
              ? 'bg-amber-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Ticket className="w-4 h-4" />
          Gutscheine ({vouchers.length})
        </button>
        <button
          onClick={() => setActiveTab('premium')}
          className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
            activeTab === 'premium'
              ? 'bg-yellow-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Crown className="w-4 h-4" />
          Premium Partner ({premiumPartners.length})
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-amber-50 rounded-xl p-6 border border-amber-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Gift className="w-5 h-5 text-amber-600" />
            Neuen Händler-Gutschein erstellen
          </h3>
          
          <form onSubmit={handleCreateVoucher} className="space-y-4">
            {/* Partner Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Partner auswählen *
              </label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Partner suchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg bg-white">
                {filteredPartners.length === 0 ? (
                  <p className="p-4 text-gray-500 text-center text-sm">Keine Partner gefunden</p>
                ) : (
                  filteredPartners.map((partner) => (
                    <div
                      key={partner.id}
                      onClick={() => setSelectedPartner(partner.id)}
                      className={`p-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-0 flex items-center justify-between ${
                        selectedPartner === partner.id ? 'bg-amber-100' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Store className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-sm">{partner.business_name}</span>
                        <span className="text-xs text-gray-400">{partner.city}</span>
                      </div>
                      {selectedPartner === partner.id && (
                        <CheckCircle className="w-4 h-4 text-amber-600" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Voucher Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gutschein-Name *
                </label>
                <Input
                  type="text"
                  placeholder="z.B. Restaurant Gutschein"
                  value={voucherName}
                  onChange={(e) => setVoucherName(e.target.value)}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gutscheinwert (€) *
                </label>
                <div className="relative">
                  <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="50"
                    value={voucherValue}
                    onChange={(e) => setVoucherValue(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Beschreibung (optional)
              </label>
              <Input
                type="text"
                placeholder="z.B. Einlösbar für alle Speisen und Getränke"
                value={voucherDescription}
                onChange={(e) => setVoucherDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Startpreis (€)
                </label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.01"
                  value={startPrice}
                  onChange={(e) => setStartPrice(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Auktionsdauer (Stunden)
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="24"
                    value={durationHours}
                    onChange={(e) => setDurationHours(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                disabled={creating || !selectedPartner}
                className="bg-amber-500 hover:bg-amber-600"
              >
                {creating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Erstelle...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-1" />
                    Gutschein-Auktion erstellen
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setShowCreateForm(false); resetForm(); }}
              >
                Abbrechen
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Vouchers Tab */}
      {activeTab === 'vouchers' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <h3 className="font-semibold text-gray-800">Alle Händler-Gutscheine ({vouchers.length})</h3>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto"></div>
            </div>
          ) : vouchers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p>Noch keine Händler-Gutscheine erstellt</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {vouchers.map((voucher) => (
                <div key={voucher.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                        <Ticket className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{voucher.name}</p>
                        <p className="text-sm text-gray-500">{voucher.partner_name}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-lg font-bold text-amber-600">€{voucher.voucher_value}</p>
                        <p className="text-xs text-gray-400">Aktuell: €{(voucher.current_price || 0).toFixed(2)}</p>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-700">{voucher.total_bids || 0} Gebote</p>
                        <p className="text-xs text-gray-400">Endet: {formatDate(voucher.end_time)}</p>
                      </div>
                      
                      {getStatusBadge(voucher)}
                    </div>
                  </div>
                  
                  {voucher.winner_name && (
                    <div className="mt-2 text-sm text-green-600 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                    Gewonnen von: {voucher.winner_name}
                    {voucher.redeemed && <span className="text-gray-500 ml-2">(Eingelöst: {formatDate(voucher.redeemed_at)})</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        </div>
      )}

      {/* Premium Tab */}
      {activeTab === 'premium' && (
        <div className="space-y-4">
          {/* Premium Info */}
          <div className="bg-gradient-to-r from-yellow-400 to-amber-500 rounded-xl p-4 text-white">
            <div className="flex items-center gap-3">
              <Crown className="w-8 h-8" />
              <div>
                <h3 className="font-bold text-lg">Premium Partner System</h3>
                <p className="text-yellow-100 text-sm">Premium-Partner werden ganz oben in der Händler-Liste angezeigt</p>
              </div>
            </div>
          </div>

          {/* Current Premium Partners */}
          <div className="bg-white rounded-xl border border-yellow-200 overflow-hidden">
            <div className="p-4 border-b border-yellow-100 bg-yellow-50">
              <h3 className="font-semibold text-yellow-800 flex items-center gap-2">
                <Crown className="w-5 h-5" />
                Aktive Premium Partner ({premiumPartners.length})
              </h3>
            </div>
            
            {premiumPartners.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Crown className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Noch keine Premium-Partner</p>
              </div>
            ) : (
              <div className="divide-y divide-yellow-100">
                {premiumPartners.map((partner) => (
                  <div key={partner.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                        {partner.logo_url ? (
                          <img src={partner.logo_url} alt={partner.business_name} className="w-8 h-8 rounded object-cover" />
                        ) : (
                          <Store className="w-5 h-5 text-yellow-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 flex items-center gap-1">
                          {partner.business_name}
                          <Crown className="w-4 h-4 text-yellow-500" />
                        </p>
                        <p className="text-sm text-gray-500">{partner.city}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Premium bis</p>
                        <p className="text-sm font-medium text-yellow-600">{formatDate(partner.premium_until)}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRemovePremium(partner.id, partner.business_name)}
                        className="border-red-200 text-red-600 hover:bg-red-50"
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Entfernen
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Set Premium for Partner */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-yellow-500" />
              Partner zu Premium machen
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Partner auswählen</label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Partner suchen..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                  {filteredPartners.filter(p => !p.is_premium).map((partner) => (
                    <div
                      key={partner.id}
                      onClick={() => setSelectedPartner(partner.id)}
                      className={`p-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-0 flex items-center justify-between ${
                        selectedPartner === partner.id ? 'bg-yellow-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Store className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-sm">{partner.business_name}</span>
                        <span className="text-xs text-gray-400">{partner.city}</span>
                      </div>
                      {selectedPartner === partner.id && (
                        <CheckCircle className="w-4 h-4 text-yellow-600" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dauer (Monate)</label>
                  <Input
                    type="number"
                    min="1"
                    max="12"
                    value={premiumMonths}
                    onChange={(e) => setPremiumMonths(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preis pro Monat (€5-€20)</label>
                  <Input
                    type="number"
                    min="5"
                    max="20"
                    step="1"
                    value={premiumPrice}
                    onChange={(e) => setPremiumPrice(e.target.value)}
                    placeholder="10"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Gesamt: €{(parseFloat(premiumPrice) || 10) * (parseInt(premiumMonths) || 1)}
                  </p>
                </div>
                <Button
                  onClick={() => {
                    const partner = partners.find(p => p.id === selectedPartner);
                    if (partner) handleSetPremium(selectedPartner, partner.business_name);
                  }}
                  disabled={!selectedPartner}
                  className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600"
                >
                  <Crown className="w-4 h-4 mr-1" />
                  Premium aktivieren (€{(parseFloat(premiumPrice) || 10) * (parseInt(premiumMonths) || 1)} total)
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMerchantVouchers;
