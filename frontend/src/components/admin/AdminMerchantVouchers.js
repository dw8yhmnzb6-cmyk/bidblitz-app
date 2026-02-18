/**
 * AdminMerchantVouchers - Admin Panel für Händler-Gutscheine erstellen
 */
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { 
  Ticket, Store, Plus, Euro, Clock, Gift, Search,
  CheckCircle, XCircle, Trash2, Eye, RefreshCw
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminMerchantVouchers = () => {
  const [partners, setPartners] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [selectedPartner, setSelectedPartner] = useState('');
  const [voucherName, setVoucherName] = useState('');
  const [voucherDescription, setVoucherDescription] = useState('');
  const [voucherValue, setVoucherValue] = useState('50');
  const [startPrice, setStartPrice] = useState('0.01');
  const [durationHours, setDurationHours] = useState('24');

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
  }, [fetchPartners, fetchVouchers]);

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
            <p className="text-sm text-gray-500">Erstelle Gutschein-Auktionen für Partner</p>
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
          <Button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-amber-500 hover:bg-amber-600"
          >
            <Plus className="w-4 h-4 mr-1" />
            Gutschein erstellen
          </Button>
        </div>
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

      {/* Vouchers List */}
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
    </div>
  );
};

export default AdminMerchantVouchers;
