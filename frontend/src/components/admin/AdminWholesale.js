import { useState } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { 
  Building2, Mail, Clock, Package, CheckCircle, X, 
  Edit, Trash2, Save, Percent, CreditCard, AlertCircle, Info
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
      const response = await axios.post(`${API}/admin/wholesale/approve/${id}`, wholesaleForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.user_linked === false) {
        toast.success('Großkunde freigeschaltet! Das Benutzerkonto wird bei der Registrierung verknüpft.');
      } else {
        toast.success('Großkunde freigeschaltet');
      }
      
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
      await axios.post(`${API}/admin/wholesale/reject/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Bewerbung abgelehnt');
      setWholesaleApplications(wholesaleApplications.filter(a => a.id !== id));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Ablehnen');
    }
  };

  const handleUpdateWholesale = async (id) => {
    try {
      await axios.put(`${API}/admin/wholesale/${id}`, wholesaleForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Großkunde aktualisiert');
      setShowWholesaleModal(false);
      setSelectedWholesale(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Aktualisieren');
    }
  };

  const handleDeleteWholesale = async (id) => {
    if (!window.confirm('Großkunde wirklich löschen?')) return;
    try {
      await axios.delete(`${API}/admin/wholesale/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Großkunde gelöscht');
      setWholesaleCustomers(wholesaleCustomers.filter(c => c.id !== id));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Löschen');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Großkunden (B2B)</h1>
            <p className="text-slate-500 text-sm">Verwalten Sie Bewerbungen und Großkunden</p>
          </div>
        </div>
      </div>

      {/* Applications Section */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg border border-slate-100">
        <h2 className="text-base sm:text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5 text-amber-500" />
          Offene Bewerbungen ({(wholesaleApplications || []).filter(a => a.status === 'pending').length})
        </h2>
        
        {(wholesaleApplications || []).filter(a => a.status === 'pending').length === 0 ? (
          <p className="text-slate-400 text-center py-8">Keine offenen Bewerbungen</p>
        ) : (
          <div className="space-y-4">
            {(wholesaleApplications || []).filter(a => a.status === 'pending').map(app => (
              <div key={app.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                {/* Mobile-optimized layout */}
                <div className="flex flex-col gap-3">
                  {/* Company Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-slate-800 font-semibold text-sm sm:text-base truncate">{app.company_name}</h3>
                    <p className="text-slate-500 text-xs sm:text-sm truncate">{app.contact_name}</p>
                  </div>
                  
                  {/* Contact Details - Mobile Card Style */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs sm:text-sm">
                    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2">
                      <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="text-slate-600 truncate">{app.email}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2">
                      <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="text-slate-600 truncate">{app.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2">
                      <Package className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <span className="text-amber-600 font-medium truncate">{app.expected_volume} Gebote/Mo.</span>
                    </div>
                  </div>
                  
                  {app.message && (
                    <p className="text-slate-500 text-xs sm:text-sm italic bg-white p-2 rounded-lg">"{app.message}"</p>
                  )}
                  
                  {/* Action Buttons - Full Width on Mobile */}
                  <div className="flex gap-2 mt-1">
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedWholesale(app);
                        setShowWholesaleModal(true);
                      }}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs sm:text-sm"
                      data-testid={`approve-wholesale-${app.id}`}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Freischalten
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRejectWholesale(app.id)}
                      className="px-3"
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
      <div className="bg-white rounded-2xl p-4 md:p-6 shadow-lg border border-slate-100">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-cyan-500" />
          Aktive Großkunden ({(wholesaleCustomers || []).length})
        </h2>
        
        {(wholesaleCustomers || []).length === 0 ? (
          <p className="text-slate-400 text-center py-8">Keine aktiven Großkunden</p>
        ) : (
          <div className="space-y-4">
            {(wholesaleCustomers || []).map(customer => (
              <div key={customer.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                {/* Header with company name and status */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <h3 className="text-slate-800 font-semibold truncate text-sm md:text-base">{customer.company_name}</h3>
                    <p className="text-slate-500 text-xs md:text-sm truncate">{customer.contact_name}</p>
                    <p className="text-slate-400 text-xs truncate break-all">{customer.email}</p>
                    {!customer.user_id && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 mt-1">
                        <Info className="w-3 h-3" />
                        Kein Benutzerkonto
                      </span>
                    )}
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 whitespace-nowrap ${
                    customer.status === 'active' 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {customer.status === 'active' ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </div>
                
                {/* Stats Grid - 3 columns on mobile */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-white rounded-lg p-2 text-center">
                    <p className="text-xs text-slate-400">Rabatt</p>
                    <p className="text-lg font-bold text-emerald-600">{customer.discount_percent}%</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 text-center">
                    <p className="text-xs text-slate-400">Kreditlimit</p>
                    <p className="text-sm font-bold text-slate-800">
                      {customer.credit_limit > 0 ? `€${customer.credit_limit.toLocaleString()}` : '-'}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-2 text-center">
                    <p className="text-xs text-slate-400">Zahlung</p>
                    <p className="text-xs font-medium text-slate-600">
                      {customer.payment_terms === 'prepaid' ? 'Vorkasse' : 
                       customer.payment_terms === 'net15' ? 'Netto 15' : 
                       customer.payment_terms === 'net30' ? 'Netto 30' : customer.payment_terms}
                    </p>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex flex-col xs:flex-row gap-2">
                  <Button
                    size="sm"
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
                    className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white text-xs md:text-sm"
                  >
                    <Edit className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                    Bearbeiten
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteWholesale(customer.id)}
                    className="px-3"
                  >
                    <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Wholesale Modal - Light Theme */}
      {showWholesaleModal && selectedWholesale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-800">
                {selectedWholesale.status === 'pending' ? 'Bewerbung freischalten' : 'Großkunde bearbeiten'}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowWholesaleModal(false);
                  setSelectedWholesale(null);
                  setWholesaleForm({ discount_percent: 10, credit_limit: 0, payment_terms: 'prepaid', notes: '' });
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-4">
              {/* Customer Info */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-slate-800 font-semibold">{selectedWholesale.company_name || selectedWholesale.contact_name}</p>
                <p className="text-slate-500 text-sm">{selectedWholesale.contact_name} • {selectedWholesale.email}</p>
              </div>

              {/* Info Banner for new applications */}
              {selectedWholesale.status === 'pending' && (
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 flex items-start gap-2">
                  <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-700">
                    Falls noch kein Benutzerkonto existiert, wird die Freischaltung gespeichert und automatisch verknüpft, sobald sich der Kunde registriert.
                  </p>
                </div>
              )}

              <div>
                <Label className="text-slate-700 flex items-center gap-2">
                  <Percent className="w-4 h-4 text-emerald-500" />
                  Rabatt (%)
                </Label>
                <Input
                  type="number"
                  value={wholesaleForm.discount_percent}
                  onChange={(e) => setWholesaleForm({...wholesaleForm, discount_percent: parseFloat(e.target.value) || 0})}
                  placeholder="10"
                  className="bg-slate-50 border-slate-200 text-slate-800 mt-1 focus:border-cyan-400"
                />
              </div>

              <div>
                <Label className="text-slate-700 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-500" />
                  Kreditlimit (€)
                </Label>
                <Input
                  type="number"
                  value={wholesaleForm.credit_limit}
                  onChange={(e) => setWholesaleForm({...wholesaleForm, credit_limit: parseFloat(e.target.value) || 0})}
                  placeholder="0 = kein Limit"
                  className="bg-slate-50 border-slate-200 text-slate-800 mt-1 focus:border-cyan-400"
                />
              </div>

              <div>
                <Label className="text-slate-700">Zahlungsziel</Label>
                <select
                  value={wholesaleForm.payment_terms}
                  onChange={(e) => setWholesaleForm({...wholesaleForm, payment_terms: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 mt-1 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                >
                  <option value="prepaid">Vorkasse</option>
                  <option value="net15">Netto 15 Tage</option>
                  <option value="net30">Netto 30 Tage</option>
                </select>
              </div>

              <div>
                <Label className="text-slate-700">Notizen / Sonderkonditionen</Label>
                <textarea
                  value={wholesaleForm.notes}
                  onChange={(e) => setWholesaleForm({...wholesaleForm, notes: e.target.value})}
                  placeholder="Interne Notizen..."
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 mt-1 resize-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
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
                className="border-slate-200 text-slate-600"
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
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
                data-testid="wholesale-submit-btn"
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
