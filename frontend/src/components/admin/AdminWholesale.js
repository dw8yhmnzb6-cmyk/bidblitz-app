import { useState } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { 
  Building2, Mail, Clock, Package, CheckCircle, X, 
  Edit, Trash2, Save, Percent, CreditCard 
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function AdminWholesale({ 
  token, 
  wholesaleApplications, 
  wholesaleCustomers, 
  setWholesaleApplications,
  setWholesaleCustomers,
  fetchData 
}) {
  const [showWholesaleModal, setShowWholesaleModal] = useState(false);
  const [selectedWholesale, setSelectedWholesale] = useState(null);
  const [wholesaleForm, setWholesaleForm] = useState({
    discount_percent: 10,
    credit_limit: 0,
    payment_terms: 'prepaid',
    notes: ''
  });

  const handleApproveWholesale = async (id) => {
    try {
      await axios.post(`${API}/admin/wholesale/approve/${id}`, wholesaleForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Großkunde freigeschaltet');
      setShowWholesaleModal(false);
      setSelectedWholesale(null);
      fetchData();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Fehler beim Freischalten';
      toast.error(errorMsg);
      console.error('Wholesale approve error:', errorMsg);
    }
  };

  const handleRejectWholesale = async (id) => {
    if (!window.confirm('Bewerbung wirklich ablehnen?')) return;
    try {
      await axios.post(`${API}/wholesale/admin/${id}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Bewerbung abgelehnt');
      setWholesaleApplications(wholesaleApplications.filter(a => a.id !== id));
    } catch (error) {
      toast.error('Fehler');
    }
  };

  const handleUpdateWholesale = async (id) => {
    try {
      await axios.put(`${API}/wholesale/admin/${id}`, wholesaleForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Großkunde aktualisiert');
      setShowWholesaleModal(false);
      setSelectedWholesale(null);
      fetchData();
    } catch (error) {
      toast.error('Fehler');
    }
  };

  const handleDeleteWholesale = async (id) => {
    if (!window.confirm('Großkunde wirklich löschen?')) return;
    try {
      await axios.delete(`${API}/wholesale/admin/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Großkunde gelöscht');
      setWholesaleCustomers(wholesaleCustomers.filter(c => c.id !== id));
    } catch (error) {
      toast.error('Fehler');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="w-8 h-8 text-[#06B6D4]" />
          <div>
            <h1 className="text-2xl font-bold text-white">Großkunden (B2B)</h1>
            <p className="text-[#94A3B8]">Verwalten Sie Bewerbungen und Großkunden</p>
          </div>
        </div>
      </div>

      {/* Applications Section */}
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5 text-yellow-500" />
          Offene Bewerbungen ({(wholesaleApplications || []).filter(a => a.status === 'pending').length})
        </h2>
        
        {(wholesaleApplications || []).filter(a => a.status === 'pending').length === 0 ? (
          <p className="text-gray-400 text-center py-4">Keine offenen Bewerbungen</p>
        ) : (
          <div className="space-y-4">
            {(wholesaleApplications || []).filter(a => a.status === 'pending').map(app => (
              <div key={app.id} className="bg-[#181824] rounded-xl p-4 border border-white/10">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-white font-semibold">{app.company_name}</h3>
                    <p className="text-gray-400 text-sm">{app.contact_name}</p>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm">
                      <span className="text-gray-400">
                        <Mail className="w-4 h-4 inline mr-1" />
                        {app.email}
                      </span>
                      <span className="text-gray-400">
                        <Clock className="w-4 h-4 inline mr-1" />
                        {app.phone}
                      </span>
                      <span className="text-[#FFD700]">
                        <Package className="w-4 h-4 inline mr-1" />
                        {app.expected_volume} Gebote/Monat
                      </span>
                    </div>
                    {app.message && (
                      <p className="text-gray-500 text-sm mt-2 italic">"{app.message}"</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedWholesale(app);
                        setShowWholesaleModal(true);
                      }}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Freischalten
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRejectWholesale(app.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Customers Section */}
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-[#06B6D4]" />
          Aktive Großkunden ({(wholesaleCustomers || []).length})
        </h2>
        
        {(wholesaleCustomers || []).length === 0 ? (
          <p className="text-gray-400 text-center py-4">Keine aktiven Großkunden</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 text-sm border-b border-white/10">
                  <th className="pb-3">Firma</th>
                  <th className="pb-3">Kontakt</th>
                  <th className="pb-3">Rabatt</th>
                  <th className="pb-3">Kreditlimit</th>
                  <th className="pb-3">Zahlung</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {(wholesaleCustomers || []).map(customer => (
                  <tr key={customer.id} className="border-b border-white/5">
                    <td className="py-4">
                      <p className="text-white font-medium">{customer.company_name}</p>
                      <p className="text-gray-500 text-xs">{customer.email}</p>
                    </td>
                    <td className="py-4 text-gray-300">{customer.contact_name}</td>
                    <td className="py-4">
                      <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-500 text-sm">
                        {customer.discount_percent}%
                      </span>
                    </td>
                    <td className="py-4 text-white">
                      {customer.credit_limit > 0 ? `€${customer.credit_limit.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-4 text-gray-300 text-sm">
                      {customer.payment_terms === 'prepaid' ? 'Vorkasse' : 
                       customer.payment_terms === 'net15' ? 'Netto 15' : 
                       customer.payment_terms === 'net30' ? 'Netto 30' : customer.payment_terms}
                    </td>
                    <td className="py-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        customer.status === 'active' 
                          ? 'bg-green-500/20 text-green-500' 
                          : 'bg-gray-500/20 text-gray-500'
                      }`}>
                        {customer.status === 'active' ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </td>
                    <td className="py-4">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedWholesale(customer);
                            setWholesaleForm({
                              discount_percent: customer.discount_percent,
                              credit_limit: customer.credit_limit,
                              payment_terms: customer.payment_terms,
                              notes: customer.notes || ''
                            });
                            setShowWholesaleModal(true);
                          }}
                          className="border-white/20 text-white"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteWholesale(customer.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Wholesale Modal */}
      {showWholesaleModal && selectedWholesale && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0F0F16] rounded-2xl p-6 w-full max-w-md border border-white/10">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                {selectedWholesale.company_name ? 'Großkunde bearbeiten' : 'Bewerbung freischalten'}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowWholesaleModal(false);
                  setSelectedWholesale(null);
                  setWholesaleForm({ discount_percent: 10, credit_limit: 0, payment_terms: 'prepaid', notes: '' });
                }}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-white/5 rounded-xl">
                <p className="text-white font-semibold">{selectedWholesale.company_name}</p>
                <p className="text-gray-400 text-sm">{selectedWholesale.contact_name} • {selectedWholesale.email}</p>
              </div>

              <div>
                <Label className="text-white flex items-center gap-2">
                  <Percent className="w-4 h-4 text-green-500" />
                  Rabatt (%)
                </Label>
                <Input
                  type="number"
                  value={wholesaleForm.discount_percent}
                  onChange={(e) => setWholesaleForm({...wholesaleForm, discount_percent: parseFloat(e.target.value) || 0})}
                  placeholder="10"
                  className="bg-[#181824] border-white/10 text-white mt-1"
                />
              </div>

              <div>
                <Label className="text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-500" />
                  Kreditlimit (€)
                </Label>
                <Input
                  type="number"
                  value={wholesaleForm.credit_limit}
                  onChange={(e) => setWholesaleForm({...wholesaleForm, credit_limit: parseFloat(e.target.value) || 0})}
                  placeholder="0 = kein Limit"
                  className="bg-[#181824] border-white/10 text-white mt-1"
                />
              </div>

              <div>
                <Label className="text-white">Zahlungsziel</Label>
                <select
                  value={wholesaleForm.payment_terms}
                  onChange={(e) => setWholesaleForm({...wholesaleForm, payment_terms: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg bg-[#181824] border border-white/10 text-white mt-1"
                >
                  <option value="prepaid">Vorkasse</option>
                  <option value="net15">Netto 15 Tage</option>
                  <option value="net30">Netto 30 Tage</option>
                </select>
              </div>

              <div>
                <Label className="text-white">Notizen / Sonderkonditionen</Label>
                <textarea
                  value={wholesaleForm.notes}
                  onChange={(e) => setWholesaleForm({...wholesaleForm, notes: e.target.value})}
                  placeholder="Interne Notizen..."
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg bg-[#181824] border border-white/10 text-white mt-1 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowWholesaleModal(false);
                  setSelectedWholesale(null);
                }}
                className="border-white/20 text-white"
              >
                Abbrechen
              </Button>
              <Button
                onClick={() => {
                  if (selectedWholesale.status === 'pending') {
                    handleApproveWholesale(selectedWholesale.id);
                  } else {
                    handleUpdateWholesale(selectedWholesale.id);
                  }
                }}
                className="bg-[#10B981] hover:bg-[#10B981]/80"
              >
                {selectedWholesale.status === 'pending' ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Freischalten
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-1" />
                    Speichern
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
