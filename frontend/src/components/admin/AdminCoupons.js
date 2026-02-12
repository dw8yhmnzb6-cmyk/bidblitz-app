import { useState, useEffect } from 'react';
import { Ticket, Plus, Trash2, Copy, Check, Percent, Euro, Gift, Calendar, Users, TrendingUp, Clock, Ban, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminCoupons() {
  const { token } = useAuth();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discount_type: 'percent',
    discount_value: 10,
    min_purchase: 0,
    max_uses: null,
    expires_in_days: 30,
    description: ''
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const response = await axios.get(`${API}/coupons/admin/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCoupons(response.data.coupons || []);
    } catch (error) {
      toast.error('Fehler beim Laden der Gutscheine');
    } finally {
      setLoading(false);
    }
  };

  const createCoupon = async () => {
    if (!newCoupon.code) {
      toast.error('Code ist erforderlich');
      return;
    }
    
    try {
      await axios.post(`${API}/coupons/create`, newCoupon, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Gutschein ${newCoupon.code.toUpperCase()} erstellt!`);
      setShowCreateModal(false);
      setNewCoupon({
        code: '',
        discount_type: 'percent',
        discount_value: 10,
        min_purchase: 0,
        max_uses: null,
        expires_in_days: 30,
        description: ''
      });
      fetchCoupons();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Erstellen');
    }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`${code} kopiert!`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewCoupon({...newCoupon, code});
  };

  const getDiscountDisplay = (coupon) => {
    switch(coupon.discount_type) {
      case 'percent':
        return `${coupon.discount_value}%`;
      case 'fixed':
        return `€${coupon.discount_value.toFixed(2)}`;
      case 'bids':
        return `${coupon.discount_value} Gebote`;
      default:
        return coupon.discount_value;
    }
  };

  const getDiscountIcon = (type) => {
    switch(type) {
      case 'percent':
        return <Percent className="w-4 h-4" />;
      case 'fixed':
        return <Euro className="w-4 h-4" />;
      case 'bids':
        return <Gift className="w-4 h-4" />;
      default:
        return <Ticket className="w-4 h-4" />;
    }
  };

  const isExpired = (expiresAt) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const getStatusBadge = (coupon) => {
    if (coupon.status !== 'active') {
      return <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-700">Deaktiviert</span>;
    }
    if (isExpired(coupon.expires_at)) {
      return <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">Abgelaufen</span>;
    }
    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
      return <span className="px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700">Aufgebraucht</span>;
    }
    return <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">Aktiv</span>;
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'Unbegrenzt';
    return new Date(isoString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Stats
  const activeCoupons = coupons.filter(c => c.status === 'active' && !isExpired(c.expires_at));
  const totalRedemptions = coupons.reduce((sum, c) => sum + (c.current_uses || 0), 0);
  const bidCoupons = coupons.filter(c => c.discount_type === 'bids');
  const totalBidsGiven = bidCoupons.reduce((sum, c) => sum + ((c.current_uses || 0) * c.discount_value), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Ticket className="w-6 h-6 text-purple-500" />
            Gutschein-Verwaltung
          </h2>
          <p className="text-gray-500 text-sm mt-1">Erstelle und verwalte Rabatt-Codes</p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Neuer Gutschein
        </Button>
      </div>

      {/* Stats - Mobile optimized grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Ticket className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
            </div>
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-bold text-gray-800">{coupons.length}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 truncate">Gesamt</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
            </div>
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-bold text-gray-800">{activeCoupons.length}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 truncate">Aktiv</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
            </div>
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-bold text-gray-800">{totalRedemptions}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 truncate">Einlösungen</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Gift className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
            </div>
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-bold text-gray-800">{totalBidsGiven}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 truncate">Gebote vergeben</p>
            </div>
          </div>
        </div>
      </div>

      {/* Coupons List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-800">Alle Gutscheine</h3>
        </div>
        
        {coupons.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Ticket className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>Keine Gutscheine vorhanden</p>
            <p className="text-sm mt-1">Erstelle deinen ersten Gutschein!</p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-100">
              {coupons.map((coupon) => (
                <div key={coupon.id} className="p-4 space-y-3">
                  {/* Header: Code + Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <code className="px-2 py-1 bg-purple-100 text-purple-700 rounded font-mono text-sm font-bold truncate">
                        {coupon.code}
                      </code>
                      <button
                        onClick={() => copyCode(coupon.code)}
                        className="p-1 hover:bg-gray-100 rounded flex-shrink-0"
                      >
                        {copiedCode === coupon.code ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                    {getStatusBadge(coupon)}
                  </div>
                  
                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <span className={`inline-flex p-1 rounded ${
                        coupon.discount_type === 'percent' ? 'bg-blue-100 text-blue-600' :
                        coupon.discount_type === 'bids' ? 'bg-amber-100 text-amber-600' :
                        'bg-green-100 text-green-600'
                      }`}>
                        {getDiscountIcon(coupon.discount_type)}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">Rabatt</p>
                      <p className="text-sm font-bold text-gray-800">{getDiscountDisplay(coupon)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <Users className="w-4 h-4 mx-auto text-gray-400" />
                      <p className="text-xs text-gray-500 mt-1">Nutzungen</p>
                      <p className="text-sm font-bold text-gray-800">
                        {coupon.current_uses || 0}
                        {coupon.max_uses && <span className="text-gray-400 font-normal">/{coupon.max_uses}</span>}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <Calendar className="w-4 h-4 mx-auto text-gray-400" />
                      <p className="text-xs text-gray-500 mt-1">Gültig bis</p>
                      <p className="text-xs font-medium text-gray-800">{formatDate(coupon.expires_at)}</p>
                    </div>
                  </div>
                  
                  {/* Description */}
                  {coupon.description && (
                    <p className="text-xs text-gray-500 truncate">{coupon.description}</p>
                  )}
                </div>
              ))}
            </div>
            
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Code</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Rabatt</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Beschreibung</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Nutzungen</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Gültig bis</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Aktion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {coupons.map((coupon) => (
                    <tr key={coupon.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <code className="px-2 py-1 bg-purple-100 text-purple-700 rounded font-mono text-sm font-bold">
                            {coupon.code}
                          </code>
                          <button
                            onClick={() => copyCode(coupon.code)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            {copiedCode === coupon.code ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`p-1.5 rounded-lg ${
                            coupon.discount_type === 'percent' ? 'bg-blue-100 text-blue-600' :
                            coupon.discount_type === 'bids' ? 'bg-amber-100 text-amber-600' :
                            'bg-green-100 text-green-600'
                          }`}>
                            {getDiscountIcon(coupon.discount_type)}
                          </span>
                          <span className="font-semibold text-gray-800">
                            {getDiscountDisplay(coupon)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-600 text-sm truncate max-w-[200px] block">
                          {coupon.description || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-800 font-medium">
                          {coupon.current_uses || 0}
                          {coupon.max_uses && <span className="text-gray-400">/{coupon.max_uses}</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-gray-500 text-sm">
                          <Calendar className="w-3 h-3" />
                          {formatDate(coupon.expires_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(coupon)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => copyCode(coupon.code)}
                          className="p-2 hover:bg-purple-100 rounded-lg text-purple-600 transition-colors"
                          title="Code kopieren"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Ticket className="w-5 h-5 text-purple-500" />
                Neuen Gutschein erstellen
              </h3>
            </div>
            <div className="p-4 space-y-4">
              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gutschein-Code *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCoupon.code}
                    onChange={(e) => setNewCoupon({...newCoupon, code: e.target.value.toUpperCase()})}
                    placeholder="z.B. SOMMER2024"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase"
                  />
                  <Button variant="outline" onClick={generateCode} className="whitespace-nowrap">
                    Generieren
                  </Button>
                </div>
              </div>

              {/* Discount Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rabatt-Typ</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'percent', label: 'Prozent', icon: <Percent className="w-4 h-4" />, color: 'blue' },
                    { value: 'fixed', label: 'Euro', icon: <Euro className="w-4 h-4" />, color: 'green' },
                    { value: 'bids', label: 'Gebote', icon: <Gift className="w-4 h-4" />, color: 'amber' }
                  ].map(type => (
                    <button
                      key={type.value}
                      onClick={() => setNewCoupon({...newCoupon, discount_type: type.value})}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                        newCoupon.discount_type === type.value
                          ? `border-${type.color}-500 bg-${type.color}-50 text-${type.color}-700`
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {type.icon}
                      <span className="text-xs font-medium">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Discount Value */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Wert {newCoupon.discount_type === 'percent' ? '(%)' : newCoupon.discount_type === 'bids' ? '(Gebote)' : '(€)'}
                </label>
                <input
                  type="number"
                  value={newCoupon.discount_value}
                  onChange={(e) => setNewCoupon({...newCoupon, discount_value: parseFloat(e.target.value) || 0})}
                  min="0"
                  step={newCoupon.discount_type === 'percent' ? '1' : '0.01'}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Optional Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max. Nutzungen</label>
                  <input
                    type="number"
                    value={newCoupon.max_uses || ''}
                    onChange={(e) => setNewCoupon({...newCoupon, max_uses: e.target.value ? parseInt(e.target.value) : null})}
                    placeholder="Unbegrenzt"
                    min="1"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gültig (Tage)</label>
                  <input
                    type="number"
                    value={newCoupon.expires_in_days || ''}
                    onChange={(e) => setNewCoupon({...newCoupon, expires_in_days: e.target.value ? parseInt(e.target.value) : null})}
                    placeholder="30"
                    min="1"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Min Purchase */}
              {newCoupon.discount_type !== 'bids' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mindestbestellwert (€)</label>
                  <input
                    type="number"
                    value={newCoupon.min_purchase}
                    onChange={(e) => setNewCoupon({...newCoupon, min_purchase: parseFloat(e.target.value) || 0})}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung (intern)</label>
                <input
                  type="text"
                  value={newCoupon.description}
                  onChange={(e) => setNewCoupon({...newCoupon, description: e.target.value})}
                  placeholder="z.B. Sommer-Kampagne 2024"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Preview */}
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <p className="text-sm text-purple-700 font-medium mb-2">Vorschau:</p>
                <div className="flex items-center gap-3">
                  <code className="px-3 py-1.5 bg-white text-purple-700 rounded font-mono font-bold">
                    {newCoupon.code || 'CODE'}
                  </code>
                  <span className="text-purple-600">→</span>
                  <span className="font-bold text-purple-800">
                    {newCoupon.discount_type === 'percent' && `${newCoupon.discount_value}% Rabatt`}
                    {newCoupon.discount_type === 'fixed' && `€${newCoupon.discount_value.toFixed(2)} Rabatt`}
                    {newCoupon.discount_type === 'bids' && `${newCoupon.discount_value} Gratis-Gebote`}
                  </span>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Abbrechen
              </Button>
              <Button 
                onClick={createCoupon}
                className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white"
              >
                Gutschein erstellen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
