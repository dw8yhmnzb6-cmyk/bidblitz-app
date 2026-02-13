import { useState } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { Ticket, X } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function AdminPromoCodes({ token, promoCodes, fetchData, language = 'de' }) {
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoForm, setPromoForm] = useState({
    code: '', 
    name: '', 
    reward_type: 'bids', 
    reward_amount: 10, 
    max_uses: null, 
    valid_until: '', 
    one_per_user: true
  });

  const handleTogglePromo = async (promo) => {
    try {
      await axios.put(`${API}/promo-codes/admin/${promo.id}/toggle`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(promo.is_active ? 'Code deaktiviert' : 'Code aktiviert');
      fetchData();
    } catch (err) {
      toast.error('Fehler');
    }
  };

  const handleDeletePromo = async (promo) => {
    if (window.confirm('Code wirklich löschen?')) {
      try {
        await axios.delete(`${API}/promo-codes/admin/${promo.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Code gelöscht');
        fetchData();
      } catch (err) {
        toast.error('Fehler beim Löschen');
      }
    }
  };

  const handleCreatePromo = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/promo-codes/admin/create`, {
        ...promoForm,
        max_uses: promoForm.max_uses || null,
        valid_until: promoForm.valid_until || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Gutschein-Code erstellt!');
      setShowPromoModal(false);
      setPromoForm({ code: '', name: '', reward_type: 'bids', reward_amount: 10, max_uses: null, valid_until: '', one_per_user: true });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler beim Erstellen');
    }
  };

  const getRewardLabel = (promo) => {
    if (promo.reward_type === 'bids') return `${promo.reward_amount} Gebote`;
    if (promo.reward_type === 'vip_days') return `${promo.reward_amount} VIP`;
    return `${promo.reward_amount}%`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
          <Ticket className="w-5 h-5 text-amber-500" />
          {language === 'en' ? 'Promo Codes' : 'Gutschein-Codes'}
        </h2>
        <Button
          onClick={() => setShowPromoModal(true)}
          className="btn-primary w-full sm:w-auto"
        >
          + {language === 'en' ? 'New Code' : 'Neuen Code erstellen'}
        </Button>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {promoCodes.map(promo => (
          <div key={promo.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            {/* Header: Code + Status */}
            <div className="flex items-start justify-between mb-3">
              <span className="font-mono text-[#FFD700] bg-[#FFD700]/10 px-2 py-1 rounded text-sm font-bold">
                {promo.code}
              </span>
              <span className={`px-2 py-1 rounded text-xs ${promo.is_active ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-red-500/20 text-red-500'}`}>
                {promo.is_active ? 'Aktiv' : 'Inaktiv'}
              </span>
            </div>
            
            {/* Name */}
            <p className="text-gray-800 font-medium mb-3">{promo.name}</p>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="text-xs text-gray-400">{language === 'en' ? 'Reward' : 'Belohnung'}</p>
                <p className="text-sm font-bold text-[#10B981]">{getRewardLabel(promo)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="text-xs text-gray-400">{language === 'en' ? 'Used' : 'Einlösungen'}</p>
                <p className="text-sm font-bold text-gray-800">
                  {promo.current_uses || 0}
                  {promo.max_uses && <span className="text-gray-400 font-normal">/{promo.max_uses}</span>}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="text-xs text-gray-400">Limit</p>
                <p className="text-sm font-bold">
                  {promo.one_per_user !== false ? (
                    <span className="text-blue-500">1x/{language === 'en' ? 'User' : 'Kunde'}</span>
                  ) : (
                    <span className="text-purple-500">{language === 'en' ? 'Multi' : 'Mehrfach'}</span>
                  )}
                </p>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => handleTogglePromo(promo)}
                className={`flex-1 px-3 py-2 rounded text-sm font-medium ${promo.is_active ? 'bg-red-100 text-red-600' : 'bg-[#10B981]/20 text-[#10B981]'}`}
              >
                {promo.is_active ? (language === 'en' ? 'Disable' : 'Deaktivieren') : (language === 'en' ? 'Enable' : 'Aktivieren')}
              </button>
              <button
                onClick={() => handleDeletePromo(promo)}
                className="px-4 py-2 rounded text-sm bg-red-100 text-red-600"
              >
                {language === 'en' ? 'Delete' : 'Löschen'}
              </button>
            </div>
          </div>
        ))}
        {promoCodes.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            {language === 'en' ? 'No promo codes yet' : 'Keine Gutschein-Codes vorhanden'}
          </p>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="glass-card rounded-xl overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white">
              <tr>
                <th className="text-left text-gray-500 font-medium p-4">Code</th>
                <th className="text-left text-gray-500 font-medium p-4">Name</th>
                <th className="text-left text-gray-500 font-medium p-4">{language === 'en' ? 'Reward' : 'Belohnung'}</th>
                <th className="text-left text-gray-500 font-medium p-4">{language === 'en' ? 'Used' : 'Einlösungen'}</th>
                <th className="text-left text-gray-500 font-medium p-4">Limit</th>
                <th className="text-left text-gray-500 font-medium p-4">Status</th>
                <th className="text-left text-gray-500 font-medium p-4">{language === 'en' ? 'Actions' : 'Aktionen'}</th>
              </tr>
            </thead>
            <tbody>
              {promoCodes.map(promo => (
                <tr key={promo.id} className="border-t border-white/5">
                  <td className="p-4">
                    <span className="font-mono text-[#FFD700] bg-[#FFD700]/10 px-2 py-1 rounded">
                      {promo.code}
                    </span>
                  </td>
                  <td className="p-4 text-gray-800">{promo.name}</td>
                  <td className="p-4">
                    <span className="text-[#10B981]">
                      {promo.reward_amount} {promo.reward_type === 'bids' ? 'Gebote' : promo.reward_type === 'vip_days' ? 'VIP Tage' : '%'}
                    </span>
                  </td>
                  <td className="p-4 text-gray-800">
                    {promo.current_uses || 0}
                    {promo.max_uses && <span className="text-gray-500"> / {promo.max_uses}</span>}
                  </td>
                  <td className="p-4">
                    {promo.one_per_user !== false ? (
                      <span className="px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-400" title="Jeder Kunde nur 1x">
                        1x/Kunde
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded text-xs bg-purple-500/20 text-purple-400" title="Mehrfach nutzbar">
                        Mehrfach
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs ${promo.is_active ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-red-500/20 text-red-500'}`}>
                      {promo.is_active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTogglePromo(promo)}
                        className={`px-3 py-1 rounded text-sm ${promo.is_active ? 'bg-red-500/20 text-red-400' : 'bg-[#10B981]/20 text-[#10B981]'}`}
                      >
                        {promo.is_active ? 'Deaktivieren' : 'Aktivieren'}
                      </button>
                      <button
                        onClick={() => handleDeletePromo(promo)}
                        className="px-3 py-1 rounded text-sm bg-red-500/20 text-red-400"
                      >
                        {language === 'en' ? 'Delete' : 'Löschen'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {promoCodes.length === 0 && (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-gray-500">
                    {language === 'en' ? 'No promo codes yet' : 'Keine Gutschein-Codes vorhanden'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Promo Modal */}
      {showPromoModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowPromoModal(false)}>
          <div className="bg-white rounded-xl border border-gray-200 max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800">
                {language === 'en' ? 'Create Promo Code' : 'Neuen Gutschein-Code erstellen'}
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setShowPromoModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <form onSubmit={handleCreatePromo} className="space-y-4">
              <div>
                <label className="text-gray-800 text-sm">Code (z.B. WEIHNACHTEN2026)</label>
                <input
                  type="text"
                  value={promoForm.code}
                  onChange={(e) => setPromoForm({...promoForm, code: e.target.value.toUpperCase()})}
                  className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2 text-gray-800 font-mono"
                  placeholder="WILLKOMMEN"
                  required
                />
              </div>
              
              <div>
                <label className="text-gray-800 text-sm">{language === 'en' ? 'Name/Description' : 'Name/Beschreibung'}</label>
                <input
                  type="text"
                  value={promoForm.name}
                  onChange={(e) => setPromoForm({...promoForm, name: e.target.value})}
                  className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2 text-gray-800"
                  placeholder="Willkommensbonus für neue Nutzer"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-800 text-sm">{language === 'en' ? 'Reward Type' : 'Belohnungsart'}</label>
                  <select
                    value={promoForm.reward_type}
                    onChange={(e) => setPromoForm({...promoForm, reward_type: e.target.value})}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2 text-gray-800"
                  >
                    <option value="bids">{language === 'en' ? 'Free Bids' : 'Gratis-Gebote'}</option>
                    <option value="vip_days">{language === 'en' ? 'VIP Days' : 'VIP-Tage'}</option>
                    <option value="discount_percent">{language === 'en' ? 'Discount %' : 'Rabatt %'}</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-800 text-sm">{language === 'en' ? 'Amount' : 'Menge'}</label>
                  <input
                    type="number"
                    min="1"
                    value={promoForm.reward_amount}
                    onChange={(e) => setPromoForm({...promoForm, reward_amount: parseInt(e.target.value)})}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2 text-gray-800"
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-800 text-sm">{language === 'en' ? 'Max Uses (empty = unlimited)' : 'Max. Einlösungen (leer = unbegrenzt)'}</label>
                  <input
                    type="number"
                    min="1"
                    value={promoForm.max_uses || ''}
                    onChange={(e) => setPromoForm({...promoForm, max_uses: e.target.value ? parseInt(e.target.value) : null})}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2 text-gray-800"
                    placeholder={language === 'en' ? 'Unlimited' : 'Unbegrenzt'}
                  />
                </div>
                <div>
                  <label className="text-gray-800 text-sm">{language === 'en' ? 'Valid Until (optional)' : 'Gültig bis (optional)'}</label>
                  <input
                    type="date"
                    value={promoForm.valid_until}
                    onChange={(e) => setPromoForm({...promoForm, valid_until: e.target.value})}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2 text-gray-800"
                  />
                </div>
              </div>
              
              {/* One per user option */}
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                <input
                  type="checkbox"
                  id="one_per_user"
                  checked={promoForm.one_per_user}
                  onChange={(e) => setPromoForm({...promoForm, one_per_user: e.target.checked})}
                  className="w-5 h-5 rounded bg-[#252540] border-gray-300 text-[#FFD700] focus:ring-[#FFD700]"
                />
                <label htmlFor="one_per_user" className="text-gray-800 cursor-pointer">
                  <span className="font-medium">{language === 'en' ? 'Once per user' : 'Nur einmal pro Kunde'}</span>
                  <span className="text-gray-500 text-sm block">
                    {language === 'en' ? 'Each user can redeem this code only once' : 'Jeder Kunde kann diesen Code nur 1x einlösen'}
                  </span>
                </label>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPromoModal(false)}
                  className="flex-1"
                >
                  {language === 'en' ? 'Cancel' : 'Abbrechen'}
                </Button>
                <Button type="submit" className="flex-1 btn-primary">
                  {language === 'en' ? 'Create' : 'Erstellen'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPromoCodes;
